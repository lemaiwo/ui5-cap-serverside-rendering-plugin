const cds = require("@sap/cds")
const fs = require("fs")
const path = require("path")
const { createApp } = require("./app/vuejs/app.js")
const { renderToString } = require("vue/server-renderer")

cds.once("bootstrap", (_app) => {
  _app.get("/vue-ssr", async (req, res) => {
    const app = await createApp()
    const html = await renderToString(app)
    
    const templatePath = path.join(__dirname, "app", "vuejs", "template.html")
    const template = fs.readFileSync(templatePath, "utf-8")
    
    const assembledHtml = template.replace("{{APP_HTML}}", html)
    
    res.send(assembledHtml)
  })
})

module.exports = cds.server
