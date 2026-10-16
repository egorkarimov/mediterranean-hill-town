import { Data, Effect, Option } from 'effect'
import { Server } from 'foldkit/experimental'
import { resolve, sep } from 'node:path'

import { TownService, handleApiRequestEffect } from './townService'

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10)
const CLIENT_DIR = resolve(process.cwd(), 'dist/client')
const FETCH_HANDLER_PATH = resolve(process.cwd(), 'dist/server/fetch.js')

type SsrFetchHandler = {
  readonly fetch: (request: Request) => Promise<Response>
}

export class SsrLoadError extends Data.TaggedError('SsrLoadError')<{
  readonly path: string
  readonly cause: unknown
}> {
  override get message(): string {
    return `Could not load built Foldkit SSR handler at ${this.path}. Run 'bun run build' first.`
  }
}

const loadSsrHandler = Effect.tryPromise({
  try: () =>
    import(FETCH_HANDLER_PATH) as Promise<{
      readonly default: SsrFetchHandler
    }>,
  catch: (cause) => new SsrLoadError({ path: FETCH_HANDLER_PATH, cause }),
}).pipe(Effect.map((module) => module.default))

const staticAssetResponseOf = (
  request: Request,
  pathname: string,
): Effect.Effect<Option.Option<Response>> =>
  Effect.gen(function* () {
    const isReadMethod = request.method === 'GET' || request.method === 'HEAD'
    if (!isReadMethod || Server.resolvesToIndexHtml(pathname)) {
      return Option.none()
    }

    const candidatePath = resolve(CLIENT_DIR, `.${pathname}`)
    const insideClientDir =
      candidatePath.startsWith(`${CLIENT_DIR}${sep}`) &&
      candidatePath !== CLIENT_DIR

    if (!insideClientDir) {
      return Option.none()
    }

    const file = Bun.file(candidatePath)
    const exists = yield* Effect.promise(() => file.exists())
    if (!exists) {
      return Option.none()
    }

    const cacheControl = pathname.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=3600'

    return Option.some(
      new Response(request.method === 'HEAD' ? null : file, {
        status: 200,
        headers: {
          'content-type': file.type || 'application/octet-stream',
          'cache-control': cacheControl,
        },
      }),
    )
  })

const startServerEffect = Effect.gen(function* () {
  const ssrHandler = yield* loadSsrHandler

  const server = Bun.serve({
    port: PORT,
    fetch: (request: Request): Promise<Response> =>
      Effect.runPromise(
        Effect.gen(function* () {
          const maybeApiResponse = yield* handleApiRequestEffect(request)
          if (Option.isSome(maybeApiResponse)) {
            return maybeApiResponse.value
          }

          const url = new URL(request.url)
          const maybeStatic = yield* staticAssetResponseOf(request, url.pathname)
          if (Option.isSome(maybeStatic)) {
            return maybeStatic.value
          }

          return yield* Effect.promise(() => ssrHandler.fetch(request))
        }).pipe(Effect.provide(TownService.layer)),
      ),
  })

  yield* Effect.logInfo(
    `Borgo Solare (Bun + Effect BE + Foldkit SSR FE) listening on http://localhost:${server.port}`,
  )
  return yield* Effect.never
})

Effect.runFork(startServerEffect)
