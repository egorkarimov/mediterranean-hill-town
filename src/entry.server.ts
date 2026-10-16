import { Effect, Option } from 'effect'
import { Server } from 'foldkit/experimental'

import { Flags, init, view } from './main'
import {
  TownService,
  TownServiceLive,
  handleApiRequestEffect,
} from './server/townService'

export const prerenderPaths = ['/']

export const renderDocument: Server.DocumentRenderer = (application, assets) =>
  Server.renderDocument(application, assets, {
    lang: 'en',
    head: '<meta name="theme-color" content="#0f172a">',
  })

export const renderPage = (request: Request): Promise<Server.EntryResult> =>
  Effect.runPromise(
    Effect.gen(function* () {
      if (request.method === 'OPTIONS') {
        return Server.Responded(
          new Response(null, {
            status: 204,
            headers: {
              allow: 'GET, HEAD, POST, OPTIONS',
            },
          }),
        )
      }

      // If an API call reaches the server entry directly, handle it with Effect TownService
      const maybeApiResponse = yield* handleApiRequestEffect(request)
      if (Option.isSome(maybeApiResponse)) {
        return Server.Responded(maybeApiResponse.value)
      }

      const townService = yield* TownService
      const flags = yield* townService.resolveSnapshotForRequest(request)

      const renderedApplication = yield* Server.renderToString(
        { Flags, init, view },
        { flags },
      )

      if (request.headers.get('cookie') !== null) {
        return Server.Rendered(renderedApplication, {
          headers: {
            'cache-control': 'private, no-store',
            vary: 'cookie',
          },
        })
      }

      return Server.Rendered(renderedApplication)
    }).pipe(Effect.provide(TownServiceLive)),
  )
