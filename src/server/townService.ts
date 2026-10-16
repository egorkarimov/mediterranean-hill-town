import { Context, Effect, Layer, Match, Option, Schema, pipe } from 'effect'

import {
  BellChimeResponse,
  CameraPreset,
  GenerateTownPayload,
  TOWN_COOKIE_NAME,
  TimeOfDay,
  TownPalette,
  TownSnapshot,
  createTownSnapshot,
  parseCookiePrefs,
} from '../shared/domain.ts'

export { createTownSnapshot }

const parseUrlSafe = Option.liftThrowable(
  (rawUrl: string) => new URL(rawUrl, 'http://localhost:3000'),
)

const PositiveSeedFromString = Schema.NumberFromString.pipe(
  Schema.check(Schema.isInt(), Schema.isGreaterThan(0)),
)

const searchParamOf =
  (key: string) =>
  (url: URL): Option.Option<string> =>
    Option.fromNullishOr(url.searchParams.get(key))

const queryPrefsOf = (
  rawUrl: string,
): {
  readonly seed: Option.Option<number>
  readonly palette: Option.Option<TownPalette>
  readonly timeOfDay: Option.Option<TimeOfDay>
  readonly cameraPreset: Option.Option<CameraPreset>
} => {
  const maybeUrl = parseUrlSafe(rawUrl)

  return {
    seed: pipe(
      maybeUrl,
      Option.flatMap(searchParamOf('seed')),
      Option.flatMap(Schema.decodeUnknownOption(PositiveSeedFromString)),
    ),
    palette: pipe(
      maybeUrl,
      Option.flatMap(searchParamOf('palette')),
      Option.flatMap(Schema.decodeUnknownOption(TownPalette)),
    ),
    timeOfDay: pipe(
      maybeUrl,
      Option.flatMap(searchParamOf('time')),
      Option.flatMap(Schema.decodeUnknownOption(TimeOfDay)),
    ),
    cameraPreset: pipe(
      maybeUrl,
      Option.flatMap(searchParamOf('camera')),
      Option.flatMap(Schema.decodeUnknownOption(CameraPreset)),
    ),
  }
}

const CHIME_NOTES: ReadonlyArray<string> = [
  'D♯4 · Campana Maggiore (Bronze 1684)',
  'G4 · Campana dei Naviganti (Harbor Vesper)',
  'A♯4 · Squilla del Tramonto (Golden Hour Carillon)',
  'F4 · Campana di Santa Maria (Duomo Major)',
]

export class TownService extends Context.Service<TownService>()(
  'BorgoSolare/TownService',
  {
    make: Effect.succeed({
      resolveSnapshotForRequest: (request: Request): Effect.Effect<TownSnapshot> =>
        Effect.sync(() => {
          const cookieHeader = Option.getOrElse(
            Option.fromNullishOr(request.headers.get('cookie')),
            () => '',
          )
          const cookiePrefs = parseCookiePrefs(cookieHeader)
          const queryPrefs = queryPrefsOf(request.url)

          const seed = Option.getOrElse(
            Option.orElse(queryPrefs.seed, () => cookiePrefs.seed),
            () => 42,
          )
          const palette = Option.getOrElse(
            Option.orElse(queryPrefs.palette, () => cookiePrefs.palette),
            (): TownPalette => 'Amalfi',
          )
          const timeOfDay = Option.getOrElse(
            Option.orElse(queryPrefs.timeOfDay, () => cookiePrefs.timeOfDay),
            (): TimeOfDay => 'GoldenHour',
          )
          const cameraPreset = Option.getOrElse(
            queryPrefs.cameraPreset,
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

      generateNewTown: (payload: GenerateTownPayload): Effect.Effect<TownSnapshot> =>
        Effect.sync(() => {
          const nextSeed = Option.getOrElse(
            Option.fromNullishOr(payload.seed),
            () => Math.floor(100 + Math.random() * 8900),
          )
          const palette = Option.getOrElse(
            Option.fromNullishOr(payload.palette),
            (): TownPalette => 'Amalfi',
          )
          const timeOfDay = Option.getOrElse(
            Option.fromNullishOr(payload.timeOfDay),
            (): TimeOfDay => 'GoldenHour',
          )

          return createTownSnapshot({
            seed: nextSeed,
            palette,
            timeOfDay,
            renderedOn: 'Server',
          })
        }),

      ringCampanileBells: (seed: number): Effect.Effect<BellChimeResponse> =>
        Effect.sync(() => {
          const chimeNote = Option.getOrElse(
            Option.fromNullishOr(CHIME_NOTES[Math.abs(seed) % CHIME_NOTES.length]),
            () => 'D♯4 · Campana Maggiore (Bronze 1684)',
          )
          return BellChimeResponse.make({
            chimeNote,
            seagullsStartled: 6 + (Math.abs(seed) % 5),
            echoDurationMs: 3600,
            timestamp: new Date().toISOString(),
          })
        }),
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}

export const TownServiceLive = TownService.layer

const BellRequestSchema = Schema.Struct({
  seed: Schema.optional(Schema.Number),
})

const encodeSnapshotJson = Schema.encodeSync(TownSnapshot)
const decodeGeneratePayload = Schema.decodeUnknownOption(GenerateTownPayload)
const decodeBellRequest = Schema.decodeUnknownOption(BellRequestSchema)
const encodeBellChimeJson = Schema.encodeSync(BellChimeResponse)

const jsonBodyOf = (request: Request): Effect.Effect<unknown> =>
  Effect.tryPromise({
    try: () => request.json(),
    catch: () => ({}),
  }).pipe(Effect.orElseSucceed(() => ({})))

const jsonResponseOf = (
  body: unknown,
  status = 200,
  cookieHeader: Option.Option<string> = Option.none(),
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...Option.match(cookieHeader, {
        onNone: (): Record<string, string> => ({}),
        onSome: (cookie) => ({ 'set-cookie': cookie }),
      }),
    },
  })

export const handleApiRequestEffect = (
  request: Request,
): Effect.Effect<Option.Option<Response>, never, TownService> =>
  Effect.gen(function* () {
    const maybeUrl = parseUrlSafe(request.url)
    if (Option.isNone(maybeUrl) || !maybeUrl.value.pathname.startsWith('/api/')) {
      return Option.none()
    }

    const pathname = maybeUrl.value.pathname
    const townService = yield* TownService

    return yield* Match.value({ pathname, method: request.method }).pipe(
      Match.when({ pathname: '/api/town', method: 'GET' }, () =>
        townService
          .resolveSnapshotForRequest(request)
          .pipe(
            Effect.map((snapshot) =>
              Option.some(jsonResponseOf(encodeSnapshotJson(snapshot))),
            ),
          ),
      ),
      Match.when({ pathname: '/api/town/generate', method: 'POST' }, () =>
        Effect.gen(function* () {
          const rawBody = yield* jsonBodyOf(request)
          const payload = Option.getOrElse(
            decodeGeneratePayload(rawBody),
            (): GenerateTownPayload => ({}),
          )
          const snapshot = yield* townService.generateNewTown(payload)
          const cookieValue = encodeURIComponent(
            JSON.stringify({
              seed: snapshot.seed,
              palette: snapshot.palette,
              timeOfDay: snapshot.timeOfDay,
            }),
          )
          const cookie = `${TOWN_COOKIE_NAME}=${cookieValue}; Path=/; Max-Age=31536000; SameSite=Lax`
          return Option.some(
            jsonResponseOf(encodeSnapshotJson(snapshot), 200, Option.some(cookie)),
          )
        }),
      ),
      Match.when({ pathname: '/api/town/bells', method: 'POST' }, () =>
        Effect.gen(function* () {
          const rawBody = yield* jsonBodyOf(request)
          const seed = pipe(
            decodeBellRequest(rawBody),
            Option.flatMap((req) => Option.fromNullishOr(req.seed)),
            Option.filter((val) => Number.isFinite(val)),
            Option.getOrElse(() => 42),
          )
          const chime = yield* townService.ringCampanileBells(seed)
          return Option.some(jsonResponseOf(encodeBellChimeJson(chime)))
        }),
      ),
      Match.orElse(() =>
        Effect.succeed(
          Option.some(
            jsonResponseOf({ error: 'Not Found', path: pathname }, 404),
          ),
        ),
      ),
    )
  })

export const handleApiRequest = (
  request: Request,
): Promise<Option.Option<Response>> =>
  Effect.runPromise(
    handleApiRequestEffect(request).pipe(Effect.provide(TownService.layer)),
  )
