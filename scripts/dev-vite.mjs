import { createServer } from 'vite'

const port = Number(process.env.PORT)

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('Vercel CLI must provide a valid PORT for the Vite dev server')
}

const server = await createServer({
  server: {
    host: '0.0.0.0',
    port,
    strictPort: true,
  },
})

await server.listen()
server.printUrls()
