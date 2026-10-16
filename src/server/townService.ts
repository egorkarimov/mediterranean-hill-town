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
  defaultLanternsForTime,
  defaultSunAngleForTime,
  parseCookiePrefs,
} from '../shared/domain.ts'

// ============================================================================
// Procedural Mediterranean Hill Town Generator (Pure + Effect Service)
// ============================================================================

const TOWN_NAMES: ReadonlyArray<
  Readonly<{ name: string; region: string }>
> = [
  { name: 'Borgo Solare', region: 'Costiera Tirrenica · 40°38′N 14°36′E' },
  { name: 'Castelmarino d’Oro', region: 'Golfo di Salerno · 40°37′N 14°32′E' },
  { name: 'Civita delle Sirene', region: 'Promontorio Ligure · 44°08′N 9°41′E' },
  { name: 'Rocca dei Limoni', region: 'Riviera di Levante · 44°18′N 9°12′E' },
  { name: 'Porto Miramare', region: 'Arcipelago Campano · 40°33′N 14°14′E' },
  { name: 'Monte Corallo', region: 'Costa degli Dei · 38°40′N 15°53′E' },
  { name: 'Sant’Angelo sul Mare', region: 'Isole Eolie · 38°38′N 15°04′E' },
  { name: 'Valloria Antica', region: 'Vaucluse & Provenza · 43°54′N 5°17′E' },
]

const CHIME_NOTES: ReadonlyArray<string> = [
  'D♯4 · Campana Maggiore (Bronze 1684)',
  'G4 · Campana dei Naviganti (Harbor Vesper)',
  'A♯4 ·Squilla del Tramonto (Golden Hour Carillon)',
  'F4 · Campana di Santa Maria (Duomo Major)',
]

const seededHash = (seed: number, salt: number): number => {
  let x = Math.imul(seed ^ (salt * 0x9e3779b9), 0x85ebca6b)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) / 4294967296
}

const buildDistrictsForSeed = (
  seed: number,
  palette: TownPalette,
  timeOfDay: TimeOfDay,
): ReadonlyArray<DistrictInfo> => {
  const duomoBldgs = 8 + Math.floor(seededHash(seed, 11) * 5)
  const harborBldgs = 14 + Math.floor(seededHash(seed, 22) * 8)
  const piazzaBldgs = 16 + Math.floor(seededHash(seed, 33) * 7)
  const windmillBldgs = 6 + Math.floor(seededHash(seed, 44) * 5)
  const terraceBldgs = 22 + Math.floor(seededHash(seed, 55) * 10)

  const domeStyle =
    palette === 'Santorini'
      ? 'cobalt-blue Cycladic cupola & whitewashed bell arcade'
      : palette === 'CinqueTerre'
        ? 'polychrome Ligurian slate & majolica-tiled dome'
        : palette === 'Provence'
          ? 'Provençal limestone belfry & weathered roman tiles'
          : 'glazed Vietri majolica dome & Romanesque campanile'

  const harborActivity =
    timeOfDay === 'Starlight'
      ? 'Lantern-lit Gozzo boats moored by the Faro beacon'
      : timeOfDay === 'GoldenHour'
        ? 'Fishing fleet returning under warm amber lighthouse beams'
        : timeOfDay === 'Dawn'
          ? 'Early fishermen setting lateen sails across calm turquoise water'
          : 'Sun-dappled limestone pier with bustling marina promenade'

  return [
    {
      id: 'duomo',
      name: 'Duomo di Santa Maria & Campanile',
      italianSubtitle: 'Cittadella Alta · Crown Sanctuary',
      elevationMeters: 94 + Math.floor(seededHash(seed, 101) * 18),
      buildingCount: duomoBldgs,
      description: `Crowning the highest limestone crag with a ${domeStyle}, rose window, and bronze bell tower overlooking the entire gulf.`,
      highlightStat: '14th-Century Majolica Cupola',
    },
    {
      id: 'piazza',
      name: 'Piazza del Mercato & Fontana',
      italianSubtitle: 'Cuore del Borgo · Central Terrace',
      elevationMeters: 52 + Math.floor(seededHash(seed, 102) * 12),
      buildingCount: piazzaBldgs,
      description:
        'Stepped travertine square with a tiered marble fountain, vaulted loggias, outdoor taverna parasols, and overhead festoon garlands.',
      highlightStat: '28 Warm Festoon String Lanterns',
    },
    {
      id: 'terraces',
      name: 'Terrazze degli Ulivi & Viadotto',
      italianSubtitle: 'Scalinata Antica · Cascading Houses',
      elevationMeters: 36 + Math.floor(seededHash(seed, 103) * 14),
      buildingCount: terraceBldgs,
      description:
        'Stacked pastel & terracotta dwellings connected by stone flying buttresses, arched stairways, Roman viaduct arches, and magenta bougainvillea.',
      highlightStat: '420 Cobblestone Steps & Pergolas',
    },
    {
      id: 'windmill',
      name: 'Crinale del Mulino a Vento',
      italianSubtitle: 'Belvedere di Ponente · Western Ridge',
      elevationMeters: 74 + Math.floor(seededHash(seed, 104) * 15),
      buildingCount: windmillBldgs,
      description:
        'Breezy limestone promontory lined with slender Italian cypresses and a working timber-sail Mediterranean grain windmill.',
      highlightStat: '4 Rotating Canvas & Cedar Sails',
    },
    {
      id: 'harbor',
      name: 'Porto Vecchio & Faro del Molo',
      italianSubtitle: 'Marina Piccola · Seafront Cove',
      elevationMeters: 4,
      buildingCount: harborBldgs,
      description: `${harborActivity}. Boasts vaulted boathouses, a red-and-cream striped lighthouse, and crystalline shallow reefs.`,
      highlightStat: '6 Wooden Gozzo Boats & Active Faro',
    },
  ]
}

export const createTownSnapshot = (options: {
  seed: number
  palette: TownPalette
  timeOfDay: TimeOfDay
  cameraPreset?: CameraPreset
  renderedOn: 'Server' | 'Client'
}): TownSnapshot => {
  const normalizedSeed = Math.max(1, Math.floor(Math.abs(options.seed)))
  const townMeta =
    TOWN_NAMES[normalizedSeed % TOWN_NAMES.length] ?? TOWN_NAMES[0]!
  const districts = buildDistrictsForSeed(
    normalizedSeed,
    options.palette,
    options.timeOfDay,
  )

  const totalBuildings = districts.reduce((acc, d) => acc + d.buildingCount, 0)
  const population =
    totalBuildings * 14 + Math.floor(seededHash(normalizedSeed, 77) * 90)
  const activeBoats = 5 + (normalizedSeed % 3)

  const tempBase =
    options.timeOfDay === 'Midday'
      ? 26
      : options.timeOfDay === 'GoldenHour'
        ? 23
        : options.timeOfDay === 'Dawn'
          ? 19
          : 18
  const harborTempC =
    tempBase + Math.round(seededHash(normalizedSeed, 88) * 30) / 10

  const seaState =
    options.timeOfDay === 'Starlight'
      ? 'Calmo · Bioluminescent Ripples'
      : options.timeOfDay === 'GoldenHour'
        ? 'Breve Onda · Amber Sun Glint'
        : options.timeOfDay === 'Dawn'
          ? 'Specchio · Rose Mist Swell'
          : 'Poco Mosso · Crystalline Azure'

  return {
    townName: townMeta.name,
    region: townMeta.region,
    seed: normalizedSeed,
    timeOfDay: options.timeOfDay,
    palette: options.palette,
    cameraPreset: options.cameraPreset ?? 'Panorama',
    sunAngle: defaultSunAngleForTime(options.timeOfDay),
    windBreeze: 1.0,
    autoOrbit: true,
    autoTimeCycle: false,
    lanternsLit: defaultLanternsForTime(options.timeOfDay),
    bellsRinging: false,
    population,
    activeBoats,
    harborTempC,
    seaState,
    districts: [...districts],
    renderedAt: new Date().toISOString(),
    renderedOn: options.renderedOn,
  }
}

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
