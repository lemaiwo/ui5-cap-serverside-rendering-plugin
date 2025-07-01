const cds = require("@sap/cds")
const fs = require("fs")
const path = require("path")
const { createApp } = require("./app/vuejs/app.js")
const { renderToString } = require("vue/server-renderer")

cds.once("bootstrap", (server) => {
  server.get("/vue-ssr", async (req, res) => {
    const vueComponent = await createApp()
    const html = await renderToString(vueComponent)
    
    const templatePath = path.join(__dirname, "app", "vuejs", "template.html")
    const template = fs.readFileSync(templatePath, "utf-8")
    
    const assembledHtml = template.replace("{{APP_HTML}}", html)
    
    res.send(assembledHtml)
  })
})

module.exports = cds.server
