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

// Cheap well-formedness gate for AI output. The model intermittently emits a
// broken root (e.g. two <mvc:View> opening tags but one close, or a duplicated
// xmlns attribute), which sanitizeAIResponse can't detect and which only blows
// up later in the browser as "still inside the root element". We check tag
// balance, a single root, and no duplicate attributes before trusting the XML.
function isWellFormedXml(xml) {
  if (!xml) return false
  const stripped = xml
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
  const tagRe = /<\/?([a-zA-Z_][\w.:-]*)((?:[^">]|"[^"]*")*)>/g
  const stack = []
  let rootClosed = false
  let match
  while ((match = tagRe.exec(stripped))) {
    const [full, name, attrs] = match
    if (full.startsWith("</")) {
      if (stack.pop() !== name) return false
    } else if (full.endsWith("/>")) {
      if (stack.length === 0 && rootClosed) return false // second root
    } else {
      if (stack.length === 0 && rootClosed) return false // second root
      const attrSection = attrs.replace(/"[^"]*"/g, '""')
      const attrNames = (attrSection.match(/[\w.:-]+\s*=/g) || []).map(a => a.replace(/\s*=$/, ""))
      if (new Set(attrNames).size !== attrNames.length) return false // duplicate attribute
      stack.push(name)
    }
    if (stack.length === 0) rootClosed = true
  }
  return stack.length === 0 && rootClosed
}

function buildPrompt({ entity, props, keys, mode, controllerName }) {
  const controllerInstruction = controllerName
    ? `Add controllerName="${controllerName}" to the root mvc:View element so event handlers resolve. `
    : `Do not add a controllerName. `
  const noBindingInstruction =
    `IMPORTANT: the data is rendered server-side via Handlebars before UI5 ever sees the XML. ` +
    `Do NOT use any UI5 data binding syntax. Do not set items="{/...}", do not set value="{...}", do not set text="{...}", ` +
    `and do not declare any model paths. The only braces in the output must be Handlebars expressions like {{property}} or {{#each ...}}. `
  const singleRootInstruction =
    `Output exactly ONE root <mvc:View> element that wraps everything, and make sure it is properly closed with a matching </mvc:View>. ` +
    `Do NOT repeat, nest, or duplicate the root <mvc:View> element, and declare each xmlns namespace attribute at most once on it. `
  if (mode === "list") {
    const customDataXml = keys.length
      ? keys.map(k => `<core:CustomData key="${k}" value="{{${k}}}" writeToDom="true" />`).join(" ")
      : ""
    return `Generate a UI5 XMLView that shows a list of the entitySet "${entity}" with the properties ${props}. ` +
      `Declare the xmlns:core="sap.ui.core" namespace on the root element. ` +
      controllerInstruction +
      noBindingInstruction +
      singleRootInstruction +
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
    singleRootInstruction +
    `For each property, render an appropriate input control (Input for strings, StepInput for integers/numbers, ` +
    `DatePicker for dates, CheckBox for booleans) and a matching Label. ` +
    `Use Handlebars syntax like value="{{property}}" so existing values are prefilled. ` +
    `Wrap the form in a Page that has a Save Button in the footer. ` +
    `Return only the raw XML as plain text, without code fences, comments, or commentary.`
}

const MAX_AI_ATTEMPTS = 2

// Ask Claude for a template and only return XML that is complete and well-formed.
// The model occasionally truncates (stop_reason "max_tokens") or emits a broken
// root; both are retried, and anything still bad returns null so the caller can
// fall back to disk instead of caching a broken template.
async function requestAITemplate({ entity, props, keys, mode, controllerName, cacheKey }) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const prompt = buildPrompt({ entity, props, keys, mode, controllerName })
  for (let attempt = 1; attempt <= MAX_AI_ATTEMPTS; attempt++) {
    const response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }]
    })
    if (response?.stop_reason === "max_tokens") {
      console.warn(`Claude response for ${cacheKey} was truncated (max_tokens), attempt ${attempt}/${MAX_AI_ATTEMPTS}.`)
      continue
    }
    const xml = sanitizeAIResponse(response?.content?.[0]?.text)
    if (xml && isWellFormedXml(xml)) return xml
    console.warn(`Claude returned malformed XML for ${cacheKey}, attempt ${attempt}/${MAX_AI_ATTEMPTS}.`)
  }
  return null
}

async function generateTemplate({ entity, props, keys, mode, fragment, type, controllerName }) {
  const cacheKey = `${entity}::${type}::${mode}::${controllerName || ""}`
  if (templateCache.has(cacheKey)) return templateCache.get(cacheKey)

  let xml = null

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      xml = await requestAITemplate({ entity, props, keys, mode, controllerName, cacheKey })
      if (!xml) console.warn(`No usable AI XML for ${cacheKey}, falling back to disk.`)
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
