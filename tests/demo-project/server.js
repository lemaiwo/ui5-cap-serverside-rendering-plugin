const cds = require("@sap/cds")
const { createApp } = require("./app/vuejs/app.js")
const { renderToString } = require("vue/server-renderer")

// react on bootstrapping events...
cds.once("bootstrap", (_app) => {
  _app.get("/vue-ssr", (req, res) => {
    const app = createApp()

    renderToString(app).then((html) => {
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
})

module.exports = cds.server
