import { createSSRApp, reactive, provide, inject } from "vue"
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

// typeof window === "undefined" ? (global.__INITIAL_STATE__ = []) : (window.__INITIAL_STATE__ = [])

// Simple store using Vue's provide/inject
const store = reactive({
  list: [],
  book: null
})

export async function createApp() {
  const books = createSSRApp({
    template: `
      <Suspense>
        <template #default>
          <BookTable />
        </template>
        <template #fallback>
          <div>Loading...</div>
        </template>
      </Suspense>
    `
  })

  books.component("BookTable", {
    async setup() {
      let initialData = []
      if (typeof window === "undefined") {
        initialData = await fetchData()
        global.__INITIAL_STATE__ = initialData
      } else {
        initialData = window.__INITIAL_STATE__ || []
      }
      store.list = initialData
      provide("store", store)
      return { store }
    },
    methods: {
      selectBook(event, book) {
        this.store.book = book
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
          <tr v-for="book in store.list" :key="book.ID" @click="selectBook($event, book)">
            <td>{{ book.title }}</td>
            <td>{{ book.author.name }}</td>
            <td>{{ book.stock }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="store.book">
        <h3>Details</h3>
        <p><strong>{{ store.book.title }}</strong> by {{ store.book.author.name }}</p>
        <p>{{ store.book.description }}</p>
        <button @click="store.book = null">Close</button>
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
