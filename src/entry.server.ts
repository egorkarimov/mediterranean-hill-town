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

const renderPageEffect = (request: Request) =>
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

    return Option.match(Option.fromNullishOr(request.headers.get('cookie')), {
      onNone: () => Server.Rendered(renderedApplication),
      onSome: () =>
        Server.Rendered(renderedApplication, {
          headers: {
            'cache-control': 'private, no-store',
            vary: 'cookie',
          },
        }),
    })
  })

export const renderPage = (request: Request): Promise<Server.EntryResult> =>
  Effect.runPromise(
    renderPageEffect(request).pipe(Effect.provide(TownServiceLive)),
  )
