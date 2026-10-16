import { Array, Match, Option, Schema, pipe } from 'effect'

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

export const defaultSunAngleForTime = (timeOfDay: TimeOfDay): number =>
  Match.value(timeOfDay).pipe(
    Match.when('Dawn', () => 18),
    Match.when('Midday', () => 68),
    Match.when('GoldenHour', () => 12),
    Match.when('Starlight', () => -28),
    Match.exhaustive,
  )

export const defaultLanternsForTime = (timeOfDay: TimeOfDay): boolean =>
  Match.value(timeOfDay).pipe(
    Match.when('Midday', () => false),
    Match.when('Dawn', () => true),
    Match.when('GoldenHour', () => true),
    Match.when('Starlight', () => true),
    Match.exhaustive,
  )

export const paletteDisplayName = (palette: TownPalette): string =>
  Match.value(palette).pipe(
    Match.when('Amalfi', () => 'Costiera Amalfitana'),
    Match.when('CinqueTerre', () => 'Cinque Terre Liguria'),
    Match.when('Santorini', () => 'Santorini Cyclades'),
    Match.when('Provence', () => 'Roussillon Ochre'),
    Match.exhaustive,
  )

export const timeOfDayLabel = (timeOfDay: TimeOfDay): string =>
  Match.value(timeOfDay).pipe(
    Match.when('Dawn', () => 'Alba Rosa · Dawn'),
    Match.when('Midday', () => 'Mezzogiorno · Noon'),
    Match.when('GoldenHour', () => 'Tramonto d’Oro · Sunset'),
    Match.when('Starlight', () => 'Notte Stellata · Night'),
    Match.exhaustive,
  )

export const cameraPresetLabel = (preset: CameraPreset): string =>
  Match.value(preset).pipe(
    Match.when('Panorama', () => 'Isometric Panorama'),
    Match.when('HarborCove', () => 'Porto & Lighthouse'),
    Match.when('DuomoPiazza', () => 'Hilltop Duomo'),
    Match.when('WindmillRidge', () => 'Mulino Wind Ridge'),
    Match.exhaustive,
  )

export const TOWN_COOKIE_NAME = 'borgo_solare_prefs'

const CookieWireSchema = Schema.Struct({
  seed: Schema.optional(Schema.Number),
  palette: Schema.optional(TownPalette),
  timeOfDay: Schema.optional(TimeOfDay),
})

const decodeUriSafe = Option.liftThrowable(decodeURIComponent)
const parseJsonSafe = Option.liftThrowable((raw: string): unknown => JSON.parse(raw))

const cookieValueOf = (cookieHeader: string): Option.Option<string> =>
  pipe(
    cookieHeader.split(';'),
    Array.map((part) => part.trim()),
    Array.findFirst((entry) => entry.startsWith(`${TOWN_COOKIE_NAME}=`)),
    Option.map((entry) => entry.slice(TOWN_COOKIE_NAME.length + 1).trim()),
    Option.flatMap(decodeUriSafe),
  )

export const parseCookiePrefs = (
  cookieHeader: string,
): {
  readonly seed: Option.Option<number>
  readonly palette: Option.Option<TownPalette>
  readonly timeOfDay: Option.Option<TimeOfDay>
} => {
  const decoded = pipe(
    cookieValueOf(cookieHeader),
    Option.flatMap(parseJsonSafe),
    Option.flatMap(Schema.decodeUnknownOption(CookieWireSchema)),
  )

  return {
    seed: pipe(
      decoded,
      Option.flatMap((prefs) => Option.fromNullishOr(prefs.seed)),
      Option.filter((seed) => Number.isFinite(seed)),
      Option.map((seed) => Math.max(1, Math.floor(seed))),
    ),
    palette: pipe(
      decoded,
      Option.flatMap((prefs) => Option.fromNullishOr(prefs.palette)),
    ),
    timeOfDay: pipe(
      decoded,
      Option.flatMap((prefs) => Option.fromNullishOr(prefs.timeOfDay)),
    ),
  }
}

const TOWN_NAMES: ReadonlyArray<Readonly<{ name: string; region: string }>> = [
  { name: 'Borgo Solare', region: 'Costiera Tirrenica · 40°38′N 14°36′E' },
  { name: 'Castelmarino d’Oro', region: 'Golfo di Salerno · 40°37′N 14°32′E' },
  { name: 'Civita delle Sirene', region: 'Promontorio Ligure · 44°08′N 9°41′E' },
  { name: 'Rocca dei Limoni', region: 'Riviera di Levante · 44°18′N 9°12′E' },
  { name: 'Porto Miramare', region: 'Arcipelago Campano · 40°33′N 14°14′E' },
  { name: 'Monte Corallo', region: 'Costa degli Dei · 38°40′N 15°53′E' },
  { name: 'Sant’Angelo sul Mare', region: 'Isole Eolie · 38°38′N 15°04′E' },
  { name: 'Valloria Antica', region: 'Vaucluse & Provenza · 43°54′N 5°17′E' },
]

export const seededHash = (seed: number, salt: number): number => {
  const step1 = Math.imul(seed ^ Math.imul(salt, 0x9e3779b9), 0x85ebca6b)
  const step2 = Math.imul(step1 ^ (step1 >>> 13), 0xc2b2ae35)
  const step3 = step2 ^ (step2 >>> 16)
  return (step3 >>> 0) / 4294967296
}

const domeStyleOf = (palette: TownPalette): string =>
  Match.value(palette).pipe(
    Match.when('Santorini', () => 'cobalt-blue Cycladic cupola & whitewashed bell arcade'),
    Match.when('CinqueTerre', () => 'polychrome Ligurian slate & majolica-tiled dome'),
    Match.when('Provence', () => 'Provençal limestone belfry & weathered roman tiles'),
    Match.when('Amalfi', () => 'glazed Vietri majolica dome & Romanesque campanile'),
    Match.exhaustive,
  )

const harborActivityOf = (timeOfDay: TimeOfDay): string =>
  Match.value(timeOfDay).pipe(
    Match.when('Starlight', () => 'Lantern-lit Gozzo boats moored by the Faro beacon'),
    Match.when('GoldenHour', () => 'Fishing fleet returning under warm amber lighthouse beams'),
    Match.when('Dawn', () => 'Early fishermen setting lateen sails across calm turquoise water'),
    Match.when('Midday', () => 'Sun-dappled limestone pier with bustling marina promenade'),
    Match.exhaustive,
  )

const buildDistrictsForSeed = (
  seed: number,
  palette: TownPalette,
  timeOfDay: TimeOfDay,
): ReadonlyArray<DistrictInfo> => [
  DistrictInfo.make({
    id: 'duomo',
    name: 'Duomo di Santa Maria & Campanile',
    italianSubtitle: 'Cittadella Alta · Crown Sanctuary',
    elevationMeters: 94 + Math.floor(seededHash(seed, 101) * 18),
    buildingCount: 8 + Math.floor(seededHash(seed, 11) * 5),
    description: `Crowning the highest limestone crag with a ${domeStyleOf(palette)}, rose window, and bronze bell tower overlooking the entire gulf.`,
    highlightStat: '14th-Century Majolica Cupola',
  }),
  DistrictInfo.make({
    id: 'piazza',
    name: 'Piazza del Mercato & Fontana',
    italianSubtitle: 'Cuore del Borgo · Central Terrace',
    elevationMeters: 52 + Math.floor(seededHash(seed, 102) * 12),
    buildingCount: 16 + Math.floor(seededHash(seed, 33) * 7),
    description:
      'Stepped travertine square with a tiered marble fountain, vaulted loggias, outdoor taverna parasols, and overhead festoon garlands.',
    highlightStat: '28 Warm Festoon String Lanterns',
  }),
  DistrictInfo.make({
    id: 'terraces',
    name: 'Terrazze degli Ulivi & Viadotto',
    italianSubtitle: 'Scalinata Antica · Cascading Houses',
    elevationMeters: 36 + Math.floor(seededHash(seed, 103) * 14),
    buildingCount: 22 + Math.floor(seededHash(seed, 55) * 10),
    description:
      'Stacked pastel & terracotta dwellings connected by stone flying buttresses, arched stairways, Roman viaduct arches, and magenta bougainvillea.',
    highlightStat: '420 Cobblestone Steps & Pergolas',
  }),
  DistrictInfo.make({
    id: 'windmill',
    name: 'Crinale del Mulino a Vento',
    italianSubtitle: 'Belvedere di Ponente · Western Ridge',
    elevationMeters: 74 + Math.floor(seededHash(seed, 104) * 15),
    buildingCount: 6 + Math.floor(seededHash(seed, 44) * 5),
    description:
      'Breezy limestone promontory lined with slender Italian cypresses and a working timber-sail Mediterranean grain windmill.',
    highlightStat: '4 Rotating Canvas & Cedar Sails',
  }),
  DistrictInfo.make({
    id: 'harbor',
    name: 'Porto Vecchio & Faro del Molo',
    italianSubtitle: 'Marina Piccola · Seafront Cove',
    elevationMeters: 4,
    buildingCount: 14 + Math.floor(seededHash(seed, 22) * 8),
    description: `${harborActivityOf(timeOfDay)}. Boasts vaulted boathouses, a red-and-cream striped lighthouse, and crystalline shallow reefs.`,
    highlightStat: '6 Wooden Gozzo Boats & Active Faro',
  }),
]

const baseTempOf = (timeOfDay: TimeOfDay): number =>
  Match.value(timeOfDay).pipe(
    Match.when('Midday', () => 26),
    Match.when('GoldenHour', () => 23),
    Match.when('Dawn', () => 19),
    Match.when('Starlight', () => 18),
    Match.exhaustive,
  )

const seaStateOf = (timeOfDay: TimeOfDay): string =>
  Match.value(timeOfDay).pipe(
    Match.when('Starlight', () => 'Calmo · Bioluminescent Ripples'),
    Match.when('GoldenHour', () => 'Breve Onda · Amber Sun Glint'),
    Match.when('Dawn', () => 'Specchio · Rose Mist Swell'),
    Match.when('Midday', () => 'Poco Mosso · Crystalline Azure'),
    Match.exhaustive,
  )

export const createTownSnapshot = (options: {
  readonly seed: number
  readonly palette: TownPalette
  readonly timeOfDay: TimeOfDay
  readonly cameraPreset?: CameraPreset
  readonly renderedOn: 'Server' | 'Client'
}): TownSnapshot => {
  const normalizedSeed = Math.max(1, Math.floor(Math.abs(options.seed)))
  const townMeta = Option.getOrElse(
    Option.fromNullishOr(TOWN_NAMES[normalizedSeed % TOWN_NAMES.length]),
    () => ({ name: 'Borgo Solare', region: 'Costiera Tirrenica · 40°38′N 14°36′E' }),
  )
  const districts = buildDistrictsForSeed(
    normalizedSeed,
    options.palette,
    options.timeOfDay,
  )
  const totalBuildings = Array.reduce(
    districts,
    0,
    (sum, district) => sum + district.buildingCount,
  )
  const population =
    totalBuildings * 14 + Math.floor(seededHash(normalizedSeed, 77) * 90)
  const activeBoats = 5 + (normalizedSeed % 3)
  const harborTempC =
    baseTempOf(options.timeOfDay) +
    Math.round(seededHash(normalizedSeed, 88) * 30) / 10

  return TownSnapshot.make({
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
    seaState: seaStateOf(options.timeOfDay),
    districts: [...districts],
    renderedAt: '2026-10-16T12:00:00.000Z',
    renderedOn: options.renderedOn,
  })
}
