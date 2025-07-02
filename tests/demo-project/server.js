const cds = require("@sap/cds")
const fs = require("fs")
const path = require("path")
const { createApp } = require("./app/vuejs/app.js")
const { renderToString } = require("vue/server-renderer")

cds.once("bootstrap", (server) => {
  server.get("/vue-ssr", async (req, res) => {
    // Render the Vue app and fill the store (global.__INITIAL_STATE__)
    const vueComponent = await createApp()
    const html = await renderToString(vueComponent)

    // Get the state from the global variable (set in app.js during SSR)
    const state = global.__INITIAL_STATE__ || []

    const templatePath = path.join(__dirname, "app", "vuejs", "template.html")
    const template = fs
      .readFileSync(templatePath, "utf-8")
      .replace("{{APP_HTML}}", html)
      .replace("'{{APP_STATE}}'", JSON.stringify(state))

    res.send(template)
  })
})

module.exports = cds.server
