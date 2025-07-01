import { createSSRApp } from "vue"

export async function createApp() {
  const data = await fetchData()

  const books = createSSRApp({
    data: () => ({
      list: data || []
    }),

    template: `<table id="books" class="hovering">
        <thead>
            <th>Book</th>
            <th>Author</th>
            <th>Stock</th>
        </thead>
        <tr v-for="book in list" v-bind:id="book.ID">
            <td>{{ book.title }}</td>
            <td>{{ book.author.name }}</td>
            <td>{{ book.stock }}</td>
        </tr>
    </table>`
  })

  return books
}

export async function fetchData() {
  const books = await SELECT.from("Books", (b) => {
    b.ID, b.title, b.to_author`as author`((a) => a.name), b.stock
  })
  return books
}
