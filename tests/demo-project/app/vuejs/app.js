import { createSSRApp } from "vue"
// import fs from "fs"
// import path from "path"
// import { fileURLToPath } from "url"

// ESM
// const __filename = fileURLToPath(import.meta.url)
// const __dirname = path.dirname(__filename)

// import cds from "@sap/cds"
function inspect(event) {
  alert("inspect called")
  // const bookId = event.currentTarget.id
  // this.book = this.list.find((b) => b.ID === bookId)
}

export async function createApp() {
  // On the server, fetch from local endpoint; on client, fetch from relative URL
  let data = []
  if (typeof window === "undefined") {
    // SSR: fetch from CAP service (localhost or env)
    data = await fetchData()
  } else {
    // Client: fetch from same origin
    const res = await fetch("/odata/v4/catalog/Books?$expand=to_author")
    data = (await res.json()).value
      // data = data.value || data
      // data = data
      .map((b) => ({
        ...b,
        author: b.to_author || { name: "" }
      }))
  }

  const books = createSSRApp({
    data: () => ({
      list: data,
      book: null
    }),
    methods: {
      selectBook(event, book) {
        this.book = book
      }
    },
    template: `
    <table id="books" class="hovering">
      <thead>
        <tr>
          <th>Book</th>
          <th>Author</th>
          <th>Stock</th>
        </tr>
      </thead>
      <tbody>
        <tr v-once v-for="book in list" :key="book.ID" @click="selectBook($event, book)">
          <td>{{ book.title }}</td>
          <td>{{ book.author.name }}</td>
          <td>{{ book.stock }}</td>
        </tr>
      </tbody>
    </table>
    <div v-if="book">
      <h3>Details</h3>
      <p><strong>{{ book.title }}</strong> by {{ book.author.name }}</p>
      <p>{{ book.description }}</p>
      <button @click="book = null">Close</button>
    </div>
    <div v-else>
      <em>(Click on a row to see details...)</em>
    </div>
    `
  })
  return books
}

export async function fetchData() {
  const books = await SELECT.from("Books", (b) => {
    b.ID, b.title, b.to_author`as author`((a) => a.name), b.stock, b.description
  })
  return books
}
