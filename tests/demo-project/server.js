const cds = require("@sap/cds")
const { createApp } = require("./app/vuejs/app.js")
const { renderToString } = require("vue/server-renderer")

cds.once("bootstrap", (_app) => {
  _app.get("/vue-ssr", async (req, res) => {
    const app = await createApp()
    const html = await renderToString(app)
    res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Vue SSR Example</title>
        <script type="importmap">
          {
            "imports": {
              "vue": "https://unpkg.com/vue@3/dist/vue.esm-browser.js"
            }
          }
        </script>
        <script type="module" src="/vuejs/client.js"></script>

      </head>
      <body>
        <div id="app">${html}</div>
      </body>
    </html>
    `)
  })
})

module.exports = cds.server
