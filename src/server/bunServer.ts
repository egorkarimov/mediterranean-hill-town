import { Effect, Option } from 'effect'
import { Server } from 'foldkit/experimental'
import { resolve, sep } from 'node:path'

import {
  TownServiceLive,
  handleApiRequestEffect,
} from './townService'

// ============================================================================
// Bun + Effect Production Server (Serves Static Assets, Effect API, & Foldkit SSR)
// ============================================================================

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10)
const CLIENT_DIR = resolve(process.cwd(), 'dist/client')
const FETCH_HANDLER_PATH = resolve(process.cwd(), 'dist/server/fetch.js')

const startServerEffect = Effect.gen(function* () {
  const ssrModule = yield* Effect.tryPromise({
    try: () =>
      import(FETCH_HANDLER_PATH) as Promise<{
        default: { fetch: (req: Request) => Promise<Response> }
      }>,
    catch: cause =>
      new Error(
        `Could not load built Foldkit SSR handler at ${FETCH_HANDLER_PATH}. Run 'bun run build' first.`,
        { cause },
      ),
  })

  const ssrHandler = ssrModule.default

  const server = Bun.serve({
    port: PORT,
    fetch: async (request: Request): Promise<Response> => {
      // 1. Route /api/* requests through our Effect TownService layer
      const maybeApiResponse = await Effect.runPromise(
        handleApiRequestEffect(request).pipe(Effect.provide(TownServiceLive)),
      )
      if (Option.isSome(maybeApiResponse)) {
        return maybeApiResponse.value
      }

      const url = new URL(request.url)

      // 2. Serve built static client assets for GET / HEAD requests
      if (
        (request.method === 'GET' || request.method === 'HEAD') &&
        !Server.resolvesToIndexHtml(url.pathname)
      ) {
        const candidatePath = resolve(CLIENT_DIR, `.${url.pathname}`)
        if (
          candidatePath.startsWith(`${CLIENT_DIR}${sep}`) &&
          candidatePath !== CLIENT_DIR
        ) {
          const file = Bun.file(candidatePath)
          if (await file.exists()) {
            return new Response(request.method === 'HEAD' ? null : file, {
              status: 200,
              headers: {
                'content-type': file.type || 'application/octet-stream',
                'cache-control': url.pathname.startsWith('/assets/')
                  ? 'public, max-age=31536000, immutable'
                  : 'public, max-age=3600',
              },
            })
          }
        }
      }

      // 3. Delegate page requests to Foldkit SSR Fetch Handler
      return ssrHandler.fetch(request)
    },
  })

  yield* Effect.logInfo(
    `Borgo Solare (Bun + Effect BE + Foldkit SSR FE) listening on http://localhost:${server.port}`,
  )
  return yield* Effect.never
})

Effect.runFork(startServerEffect)
