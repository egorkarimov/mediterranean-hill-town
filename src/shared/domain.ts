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
