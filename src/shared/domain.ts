import { Option, Schema } from 'effect'

// ============================================================================
// Core Domain Literals & Schemas (Shared between Effect BE and Foldkit SSR FE)
// ============================================================================

export const TimeOfDay = Schema.Literals([
  'Dawn',
  'Midday',
  'GoldenHour',
  'Starlight',
])
export type TimeOfDay = typeof TimeOfDay.Type

export const TownPalette = Schema.Literals([
  'Amalfi',
  'CinqueTerre',
  'Santorini',
  'Provence',
])
export type TownPalette = typeof TownPalette.Type

export const CameraPreset = Schema.Literals([
  'Panorama',
  'HarborCove',
  'DuomoPiazza',
  'WindmillRidge',
])
export type CameraPreset = typeof CameraPreset.Type

export const DistrictId = Schema.Literals([
  'duomo',
  'harbor',
  'piazza',
  'windmill',
  'terraces',
])
export type DistrictId = typeof DistrictId.Type

export const DistrictInfo = Schema.Struct({
  id: DistrictId,
  name: Schema.String,
  italianSubtitle: Schema.String,
  elevationMeters: Schema.Number,
  buildingCount: Schema.Number,
  description: Schema.String,
  highlightStat: Schema.String,
})
export type DistrictInfo = typeof DistrictInfo.Type

export const TownSnapshot = Schema.Struct({
  townName: Schema.String,
  region: Schema.String,
  seed: Schema.Number,
  timeOfDay: TimeOfDay,
  palette: TownPalette,
  cameraPreset: CameraPreset,
  sunAngle: Schema.Number,
  windBreeze: Schema.Number,
  autoOrbit: Schema.Boolean,
  autoTimeCycle: Schema.Boolean,
  lanternsLit: Schema.Boolean,
  bellsRinging: Schema.Boolean,
  population: Schema.Number,
  activeBoats: Schema.Number,
  harborTempC: Schema.Number,
  seaState: Schema.String,
  districts: Schema.Array(DistrictInfo),
  renderedAt: Schema.String,
  renderedOn: Schema.Literals(['Server', 'Client']),
})
export type TownSnapshot = typeof TownSnapshot.Type

export const GenerateTownPayload = Schema.Struct({
  palette: Schema.optional(TownPalette),
  timeOfDay: Schema.optional(TimeOfDay),
  seed: Schema.optional(Schema.Number),
})
export type GenerateTownPayload = typeof GenerateTownPayload.Type

export const BellChimeResponse = Schema.Struct({
  chimeNote: Schema.String,
  seagullsStartled: Schema.Number,
  echoDurationMs: Schema.Number,
  timestamp: Schema.String,
})
export type BellChimeResponse = typeof BellChimeResponse.Type

export const TownSceneState = Schema.Struct({
  seed: Schema.Number,
  timeOfDay: TimeOfDay,
  palette: TownPalette,
  cameraPreset: CameraPreset,
  sunAngle: Schema.Number,
  windBreeze: Schema.Number,
  autoOrbit: Schema.Boolean,
  lanternsLit: Schema.Boolean,
  bellsRinging: Schema.Boolean,
  selectedDistrict: Schema.Option(DistrictId),
})
export type TownSceneState = typeof TownSceneState.Type

export const TOWN_COOKIE_NAME = 'borgo_solare_prefs'

export const defaultSunAngleForTime = (timeOfDay: TimeOfDay): number => {
  switch (timeOfDay) {
    case 'Dawn':
      return 18
    case 'Midday':
      return 68
    case 'GoldenHour':
      return 12
    case 'Starlight':
      return -28
  }
}

export const defaultLanternsForTime = (timeOfDay: TimeOfDay): boolean =>
  timeOfDay === 'GoldenHour' || timeOfDay === 'Starlight' || timeOfDay === 'Dawn'

export const paletteDisplayName = (palette: TownPalette): string => {
  switch (palette) {
    case 'Amalfi':
      return 'Costiera Amalfitana'
    case 'CinqueTerre':
      return 'Cinque Terre Liguria'
    case 'Santorini':
      return 'Santorini Cyclades'
    case 'Provence':
      return 'Roussillon Ochre'
  }
}

export const timeOfDayLabel = (timeOfDay: TimeOfDay): string => {
  switch (timeOfDay) {
    case 'Dawn':
      return 'Alba Rosa · Dawn'
    case 'Midday':
      return 'Mezzogiorno · Noon'
    case 'GoldenHour':
      return 'Tramonto d’Oro · Sunset'
    case 'Starlight':
      return 'Notte Stellata · Night'
  }
}

export const cameraPresetLabel = (preset: CameraPreset): string => {
  switch (preset) {
    case 'Panorama':
      return 'Isometric Panorama'
    case 'HarborCove':
      return 'Porto & Lighthouse'
    case 'DuomoPiazza':
      return 'Hilltop Duomo'
    case 'WindmillRidge':
      return 'Mulino Wind Ridge'
  }
}

export const parseCookiePrefs = (
  cookieHeader: string,
): {
  seed: Option.Option<number>
  palette: Option.Option<TownPalette>
  timeOfDay: Option.Option<TimeOfDay>
} => {
  const entries = cookieHeader
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)

  let seed: Option.Option<number> = Option.none()
  let palette: Option.Option<TownPalette> = Option.none()
  let timeOfDay: Option.Option<TimeOfDay> = Option.none()

  for (const entry of entries) {
    const eqIdx = entry.indexOf('=')
    if (eqIdx === -1) continue
    const key = entry.slice(0, eqIdx).trim()
    const rawVal = decodeURIComponent(entry.slice(eqIdx + 1).trim())
    if (key === TOWN_COOKIE_NAME) {
      try {
        const parsed = JSON.parse(rawVal) as Record<string, unknown>
        if (typeof parsed.seed === 'number' && Number.isFinite(parsed.seed)) {
          seed = Option.some(Math.max(1, Math.floor(parsed.seed)))
        }
        if (
          parsed.palette === 'Amalfi' ||
          parsed.palette === 'CinqueTerre' ||
          parsed.palette === 'Santorini' ||
          parsed.palette === 'Provence'
        ) {
          palette = Option.some(parsed.palette)
        }
        if (
          parsed.timeOfDay === 'Dawn' ||
          parsed.timeOfDay === 'Midday' ||
          parsed.timeOfDay === 'GoldenHour' ||
          parsed.timeOfDay === 'Starlight'
        ) {
          timeOfDay = Option.some(parsed.timeOfDay)
        }
      } catch {
        // Ignore malformed cookie
      }
    }
  }

  return { seed, palette, timeOfDay }
}

// ============================================================================
// Deterministic Mediterranean Hill Town Snapshot Builder
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
    renderedAt: '2026-10-16T12:00:00.000Z',
    renderedOn: options.renderedOn,
  }
}
