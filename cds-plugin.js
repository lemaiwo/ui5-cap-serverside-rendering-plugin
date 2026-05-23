require('dotenv').config()
const globalcds = global.cds || require("@sap/cds")
const Handlebars = require("handlebars")
const fs = require("fs")
const path = require("path")
const { Readable } = require("stream")
const { renderToString } = require("vue/server-renderer")
const { Anthropic } = require('@anthropic-ai/sdk');

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'

// Compiled Handlebars templates keyed by entity+type+mode. Process-lifetime cache:
// AI generation is paid + slow, and the inputs (entity metadata) only change on restart.
const templateCache = new Map()

const vueConfig = {
  app: "",
  template: ""
}

function registerSSRHandlers(cdsInstance) {
  for (let srv of cdsInstance.services) {
    if (srv instanceof cds.ApplicationService) {
      Object.values(srv.entities).forEach((entity) => {
        if (entity["@ServerSideRendering"] && entity["@VueApp"]) {
          vueConfig.template = entity["@VueTemplate"]
          vueConfig.app = entity["@VueApp"]
        } else if (entity["@ServerSideRendering"]) {
          srv.after("READ", entity.name, getUI)
        }
      })
    }
  }
}

globalcds.once("bootstrap", (server) => {
  server.get("/vue-ssr", async (req, res) => {
    const vueAppPath = path.join(globalcds.root, "app", vueConfig.app)
    const { createApp } = require(vueAppPath)

    // Render the Vue app and fill the store (global.__INITIAL_STATE__)
    const vueComponent = await createApp()
    const html = await renderToString(vueComponent)

    // Get the state from the global variable (set in app.js during SSR) -> REVISIT
    const state = global.__INITIAL_STATE__ || []

    const templatePath = path.join(globalcds.root, "app", vueConfig.template)
    const template = fs
      .readFileSync(templatePath, "utf-8")
      .replace("{{APP_HTML}}", html)
      .replace("'{{APP_STATE}}'", JSON.stringify(state)) // hacky-hack data store -> REVISIT

    res.send(template)
  })
})

globalcds.once("served", async (server) => {
  if (!("ServerSideRendering" in cds.model.definitions)) return
  registerSSRHandlers(globalcds)
})

function isObjectEmpty(objectName) {
  for (let prop in objectName) {
    if (objectName.hasOwnProperty(prop)) {
      return false
    }
  }
  return true
}

function sanitizeAIResponse(text) {
  if (!text) return ""
  let cleaned = text.trim()
  const fenced = cleaned.match(/^```(?:xml)?\s*([\s\S]*?)\s*```$/i)
  if (fenced) cleaned = fenced[1].trim()
  const first = cleaned.indexOf("<")
  const last = cleaned.lastIndexOf(">")
  if (first === -1 || last === -1) return ""
  return cleaned.substring(first, last + 1)
}

function buildPrompt({ entity, props, keys, mode, controllerName }) {
  const controllerInstruction = controllerName
    ? `Add controllerName="${controllerName}" to the root mvc:View element so event handlers resolve. `
    : `Do not add a controllerName. `
  const noBindingInstruction =
    `IMPORTANT: the data is rendered server-side via Handlebars before UI5 ever sees the XML. ` +
    `Do NOT use any UI5 data binding syntax. Do not set items="{/...}", do not set value="{...}", do not set text="{...}", ` +
    `and do not declare any model paths. The only braces in the output must be Handlebars expressions like {{property}} or {{#each ...}}. `
  if (mode === "list") {
    const customDataXml = keys.length
      ? keys.map(k => `<core:CustomData key="${k}" value="{{${k}}}" writeToDom="true" />`).join(" ")
      : ""
    return `Generate a UI5 XMLView that shows a list of the entitySet "${entity}" with the properties ${props}. ` +
      `Declare the xmlns:core="sap.ui.core" namespace on the root element. ` +
      controllerInstruction +
      noBindingInstruction +
      `Use a sap.m.List with mode="SingleSelectMaster" and selectionChange="onSelected${entity}" so a row can be selected. ` +
      `Do NOT set an items aggregation binding on the List — the items must be produced by a Handlebars {{#each ${entity}}} ` +
      `loop placed directly inside the <List> element, iterating the collection and emitting one StandardListItem per record. ` +
      `Each StandardListItem must have type="Active", a meaningful title using {{property}} interpolation, ` +
      `and the remaining properties concatenated into the description using {{property}} interpolation. ` +
      (customDataXml
        ? `Inside each StandardListItem add a <customData> aggregation containing ${customDataXml} so the selection handler can read the key. `
        : "") +
      `Return only the raw XML as plain text, without code fences, comments, or commentary.`
  }
  return `Generate a UI5 XMLView containing a sap.ui.layout.form.SimpleForm for editing a "${entity}" record ` +
    `with the properties ${props}. ` +
    controllerInstruction +
    noBindingInstruction +
    `For each property, render an appropriate input control (Input for strings, StepInput for integers/numbers, ` +
    `DatePicker for dates, CheckBox for booleans) and a matching Label. ` +
    `Use Handlebars syntax like value="{{property}}" so existing values are prefilled. ` +
    `Wrap the form in a Page that has a Save Button in the footer. ` +
    `Return only the raw XML as plain text, without code fences, comments, or commentary.`
}

async function generateTemplate({ entity, props, keys, mode, fragment, type, controllerName }) {
  const cacheKey = `${entity}::${type}::${mode}::${controllerName || ""}`
  if (templateCache.has(cacheKey)) return templateCache.get(cacheKey)

  let xml = null

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 5024,
        messages: [{ role: 'user', content: buildPrompt({ entity, props, keys, mode, controllerName }) }]
      })
      xml = sanitizeAIResponse(response?.content?.[0]?.text)
      if (!xml) console.warn(`Claude returned no usable XML for ${cacheKey}, falling back to disk.`)
    } catch (err) {
      console.error(`Claude AI request failed for ${cacheKey}, falling back to disk:`, err.message)
    }
  }

  if (!xml) {
    const filePath = path.join(globalcds.root, `./srv/${type}s`, `${fragment}.${type}.xml`)
    if (!fs.existsSync(filePath)) {
      throw new Error(`No AI-generated template and no local ${type} at ${filePath}`)
    }
    xml = fs.readFileSync(filePath, "utf-8")
  }

  const compiled = Handlebars.compile(xml)
  templateCache.set(cacheKey, compiled)
  return compiled
}

async function getUI([results], req) {
  if (!req?.req?.url?.endsWith("/content")) return

  const validTypes = new Set(["view", "fragment"])
  const isKeyEmpty = isObjectEmpty(results)
  const mode = isKeyEmpty ? "list" : "form"
  const pathEntity = req.query.SELECT.from.ref[0].id
  const entity = pathEntity.substring(pathEntity.indexOf(".") + 1)
  const entityDefinition = req.query.SELECT.from.$refLinks[0].definition

  const renderableElements = Object.values(entityDefinition.elements)
    .filter(el => !el.virtual && el.type !== "cds.Association" && el.name)
  const props = renderableElements.map(el => el.name).join(", ")
  const keys = renderableElements.filter(el => el.key).map(el => el.name)

  const expand = (rootEntity) => {
    let expand = []
    for (const relationship of ["associations", "compositions"]) {
      for (const rel in entityDefinition[relationship]) {
        expand.push(
          rootEntity[rel]((c) => {
            c`.*`
          })
        )
      }
    }
    return expand
  }

  const defaultFragment = `${entity}${isKeyEmpty ? "List" : "Form"}`
  const fragment =
    (mode === "form" && (entityDefinition["@ServerSideRenderingFormName"] || entityDefinition["@SSRFormName"])) ||
    entityDefinition["@ServerSideRenderingName"] ||
    entityDefinition["@SSRName"] ||
    defaultFragment

  let type = entityDefinition["@ServerSideRenderingType"] || entityDefinition["@SSRType"] || "view"
  if (!validTypes.has(type)) type = "view"

  const controllerName = type === "view"
    ? (entityDefinition["@ServerSideRenderingController"] || entityDefinition["@SSRController"] || null)
    : null

  const query = isKeyEmpty
    ? SELECT.from({ ref: [{ id: pathEntity }] })
    : SELECT.from(req.query.SELECT.from).columns((b) => {
      b`.*`, expand(b)
    })

  const [template, queryResult] = await Promise.all([
    generateTemplate({ entity, props, keys, mode, fragment, type, controllerName }),
    query
  ])

  let templateData = {}
  if (mode === "list") {
    templateData[entity] = queryResult
  } else if (queryResult.length) {
    ;[templateData] = queryResult
  }

  const result = template(templateData)
  const readableInstanceStream = new Readable({
    read() {
      this.push(result)
      this.push(null)
    }
  })
  req._.res.setHeader("Content-disposition", `attachment; filename="${fragment}.${type}.xml"`)
  req._.res.setHeader("Content-type", "application/xml")

  if (results) {
    results.content = readableInstanceStream
  } else {
    req.results = { ID: 0, content: readableInstanceStream }
  }
}
