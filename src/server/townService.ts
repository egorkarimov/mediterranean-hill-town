import { Context, Effect, Layer, Option, Schema } from 'effect'

import {
  BellChimeResponse,
  type CameraPreset,
  type DistrictInfo,
  GenerateTownPayload,
  TOWN_COOKIE_NAME,
  type TimeOfDay,
  type TownPalette,
  TownSnapshot,
  createTownSnapshot,
  parseCookiePrefs,
} from '../shared/domain.ts'

export { createTownSnapshot }

const CHIME_NOTES: ReadonlyArray<string> = [
  'D♯4 · Campana Maggiore (Bronze 1684)',
  'G4 · Campana dei Naviganti (Harbor Vesper)',
  'A♯4 · Squilla del Tramonto (Golden Hour Carillon)',
  'F4 · Campana di Santa Maria (Duomo Major)',
]

// ============================================================================
// Effect Backend Service Definition & Layer
// ============================================================================

export interface TownServiceApi {
  readonly resolveSnapshotForRequest: (
    request: Request,
  ) => Effect.Effect<TownSnapshot>
  readonly generateNewTown: (
    payload: GenerateTownPayload,
  ) => Effect.Effect<TownSnapshot>
  readonly ringCampanileBells: (
    seed: number,
  ) => Effect.Effect<BellChimeResponse>
}

export class TownService extends Context.Service<
  TownService,
  TownServiceApi
>()('BorgoSolare/TownService') {}

export const TownServiceLive: Layer.Layer<TownService> = Layer.succeed(
  TownService,
  {
    resolveSnapshotForRequest: (request: Request) =>
      Effect.sync(() => {
        const cookieHeader = request.headers.get('cookie') ?? ''
        const cookiePrefs = parseCookiePrefs(cookieHeader)

        let urlPalette: Option.Option<TownPalette> = Option.none()
        let urlTime: Option.Option<TimeOfDay> = Option.none()
        let urlSeed: Option.Option<number> = Option.none()
        let urlCamera: Option.Option<CameraPreset> = Option.none()

        try {
          const url = new URL(request.url, 'http://localhost:3000')
          const p = url.searchParams.get('palette')
          if (
            p === 'Amalfi' ||
            p === 'CinqueTerre' ||
            p === 'Santorini' ||
            p === 'Provence'
          ) {
            urlPalette = Option.some(p)
          }
          const t = url.searchParams.get('time')
          if (
            t === 'Dawn' ||
            t === 'Midday' ||
            t === 'GoldenHour' ||
            t === 'Starlight'
          ) {
            urlTime = Option.some(t)
          }
          const s = url.searchParams.get('seed')
          if (s !== null) {
            const parsedSeed = Number.parseInt(s, 10)
            if (Number.isFinite(parsedSeed) && parsedSeed > 0) {
              urlSeed = Option.some(parsedSeed)
            }
          }
          const c = url.searchParams.get('camera')
          if (
            c === 'Panorama' ||
            c === 'HarborCove' ||
            c === 'DuomoPiazza' ||
            c === 'WindmillRidge'
          ) {
            urlCamera = Option.some(c)
          }
        } catch {
          // Fallback to defaults
        }

        const seed = Option.getOrElse(
          Option.orElse(urlSeed, () => cookiePrefs.seed),
          () => 42,
        )
        const palette = Option.getOrElse(
          Option.orElse(urlPalette, () => cookiePrefs.palette),
          (): TownPalette => 'Amalfi',
        )
        const timeOfDay = Option.getOrElse(
          Option.orElse(urlTime, () => cookiePrefs.timeOfDay),
          (): TimeOfDay => 'GoldenHour',
        )
        const cameraPreset = Option.getOrElse(
          urlCamera,
          (): CameraPreset => 'Panorama',
        )

        return createTownSnapshot({
          seed,
          palette,
          timeOfDay,
          cameraPreset,
          renderedOn: 'Server',
        })
      }),

    generateNewTown: (payload: GenerateTownPayload) =>
      Effect.sync(() => {
        const nextSeed =
          payload.seed ?? Math.floor(100 + Math.random() * 8900)
        const palette: TownPalette = payload.palette ?? 'Amalfi'
        const timeOfDay: TimeOfDay = payload.timeOfDay ?? 'GoldenHour'

        return createTownSnapshot({
          seed: nextSeed,
          palette,
          timeOfDay,
          renderedOn: 'Server',
        })
      }),

    ringCampanileBells: (seed: number) =>
      Effect.sync(() => {
        const note =
          CHIME_NOTES[Math.abs(seed) % CHIME_NOTES.length] ?? CHIME_NOTES[0]!
        return {
          chimeNote: note,
          seagullsStartled: 6 + (Math.abs(seed) % 5),
          echoDurationMs: 3600,
          timestamp: new Date().toISOString(),
        }
      }),
  },
)

// ============================================================================
// Effect HTTP API Request Handler (Used by both Bun Server & Vite Dev Server)
// ============================================================================

const encodeSnapshotJson = Schema.encodeSync(TownSnapshot)
const decodeGeneratePayload = Schema.decodeUnknownEffect(GenerateTownPayload)
const encodeBellChimeJson = Schema.encodeSync(BellChimeResponse)

export const handleApiRequestEffect = (
  request: Request,
): Effect.Effect<Option.Option<Response>, never, TownService> =>
  Effect.gen(function* () {
    const url = new URL(request.url, 'http://localhost:3000')

    if (!url.pathname.startsWith('/api/')) {
      return Option.none()
    }

    const townService = yield* TownService

    if (url.pathname === '/api/town' && request.method === 'GET') {
      const snapshot = yield* townService.resolveSnapshotForRequest(request)
      return Option.some(
        new Response(JSON.stringify(encodeSnapshotJson(snapshot)), {
          status: 200,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
          },
        }),
      )
    }

    if (url.pathname === '/api/town/generate' && request.method === 'POST') {
      const rawBody = yield* Effect.tryPromise({
        try: () => request.json(),
        catch: () => ({}),
      }).pipe(Effect.orElseSucceed(() => ({})))

      const payload = yield* decodeGeneratePayload(rawBody).pipe(
        Effect.orElseSucceed((): GenerateTownPayload => ({})),
      )

      const snapshot = yield* townService.generateNewTown(payload)
      const cookieValue = encodeURIComponent(
        JSON.stringify({
          seed: snapshot.seed,
          palette: snapshot.palette,
          timeOfDay: snapshot.timeOfDay,
        }),
      )

      return Option.some(
        new Response(JSON.stringify(encodeSnapshotJson(snapshot)), {
          status: 200,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'set-cookie': `${TOWN_COOKIE_NAME}=${cookieValue}; Path=/; Max-Age=31536000; SameSite=Lax`,
          },
        }),
      )
    }

    if (url.pathname === '/api/town/bells' && request.method === 'POST') {
      const rawBody = yield* Effect.tryPromise({
        try: () => request.json() as Promise<{ seed?: number }>,
        catch: () => ({ seed: 42 }),
      }).pipe(Effect.orElseSucceed(() => ({ seed: 42 })))

      const seed =
        typeof rawBody.seed === 'number' && Number.isFinite(rawBody.seed)
          ? rawBody.seed
          : 42
      const chime = yield* townService.ringCampanileBells(seed)

      return Option.some(
        new Response(JSON.stringify(encodeBellChimeJson(chime)), {
          status: 200,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
          },
        }),
      )
    }

    return Option.some(
      new Response(
        JSON.stringify({
          error: 'Not Found',
          path: url.pathname,
        }),
        {
          status: 404,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        },
      ),
    )
  })

export const handleApiRequest = (
  request: Request,
): Promise<Option.Option<Response>> =>
  Effect.runPromise(
    handleApiRequestEffect(request).pipe(Effect.provide(TownServiceLive)),
  )
