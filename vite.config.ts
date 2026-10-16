import { Option } from 'effect'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'

import { foldkit } from '@foldkit/vite-plugin'
import tailwindcss from '@tailwindcss/vite'

import { handleApiRequest } from './src/server/townService.ts'

const effectBackendApiPlugin = (): Plugin => ({
  name: 'borgo-solare:effect-api',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith('/api/')) {
        next()
        return
      }

      const origin = `http://${req.headers.host ?? 'localhost:5173'}`
      const chunks: Array<Buffer> = []
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }
      const bodyBuffer = Buffer.concat(chunks)

      const headers = new Headers()
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) {
          for (const v of value) headers.append(key, v)
        } else if (typeof value === 'string') {
          headers.set(key, value)
        }
      }

      const method = req.method ?? 'GET'
      const webRequest = new Request(`${origin}${req.url}`, {
        method,
        headers,
        body:
          method !== 'GET' && method !== 'HEAD' && bodyBuffer.length > 0
            ? bodyBuffer
            : undefined,
      })

      const maybeResponse = await handleApiRequest(webRequest)
      if (Option.isNone(maybeResponse)) {
        next()
        return
      }

      const response = maybeResponse.value
      res.statusCode = response.status
      response.headers.forEach((val, key) => {
        res.setHeader(key, val)
      })
      const arrayBuf = await response.arrayBuffer()
      res.end(Buffer.from(arrayBuf))
    })
  },
})

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1000,
  },
  plugins: [
    tailwindcss(),
    effectBackendApiPlugin(),
    foldkit({
      ssr: {
        serverEntry: '/src/entry.server.ts',
        clientEntry: '/src/entry.ts',
        build: true,
      },
    }),
  ],
})
