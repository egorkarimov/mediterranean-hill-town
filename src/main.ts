import {
  Array,
  Data,
  Duration,
  Effect,
  Match,
  Option,
  Queue,
  Schema,
  Stream,
} from 'effect'
import {
  Command,
  Mount,
  type Runtime,
  Subscription,
  type Update,
} from 'foldkit'
import type { Document, Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { modifyFields } from 'foldkit/struct'

import {
  BellChimeResponse,
  CameraPreset,
  DistrictId,
  DistrictInfo,
  TOWN_COOKIE_NAME,
  TimeOfDay,
  TownPalette,
  TownSceneState,
  TownSnapshot,
  cameraPresetLabel,
  createTownSnapshot,
  defaultLanternsForTime,
  defaultSunAngleForTime,
  paletteDisplayName,
  timeOfDayLabel,
} from './shared/domain'
import {
  getActiveTownController,
  mountIsometricTown,
} from './three/isometricTown'

export const Flags = TownSnapshot
export type Flags = typeof Flags.Type

export const Model = Schema.Struct({
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
  selectedDistrict: Schema.Option(DistrictId),
  isGeneratingTown: Schema.Boolean,
  lastBellChime: Schema.Option(BellChimeResponse),
  hudCollapsed: Schema.Boolean,
  renderedAt: Schema.String,
  renderedOn: Schema.Literals(['Server', 'Client']),
  canvasMounted: Schema.Boolean,
})
export type Model = typeof Model.Type

export const toSceneState = (model: Model): TownSceneState =>
  TownSceneState.make({
    seed: model.seed,
    timeOfDay: model.timeOfDay,
    palette: model.palette,
    cameraPreset: model.cameraPreset,
    sunAngle: model.sunAngle,
    windBreeze: model.windBreeze,
    autoOrbit: model.autoOrbit,
    lanternsLit: model.lanternsLit,
    bellsRinging: model.bellsRinging,
    selectedDistrict: model.selectedDistrict,
  })

export const Message = defineMessageUnion({
  SelectedTimeOfDay: { timeOfDay: TimeOfDay },
  SelectedPalette: { palette: TownPalette },
  SelectedCameraPreset: { cameraPreset: CameraPreset },
  ChangedSunAngle: { sunAngle: Schema.Number },
  ChangedWindBreeze: { windBreeze: Schema.Number },
  ToggledAutoOrbit: {},
  ToggledAutoTimeCycle: {},
  ToggledLanterns: {},
  ToggledHudCollapsed: {},
  SelectedDistrictCard: { districtId: Schema.Option(DistrictId) },
  SelectedDistrictFromCanvas: { districtId: DistrictId },
  ClickedRegenerateTown: {},
  SucceededGenerateTown: { snapshot: TownSnapshot },
  FailedGenerateTown: { reason: Schema.String },
  ClickedRingCampanileBells: {},
  SucceededRingBells: { chime: BellChimeResponse },
  CompletedBellResonance: {},
  MountedTownCanvas: {},
  CompletedSyncScene: {},
  CompletedPersistCookie: {},
  TickedAutoCycle: {},
})
export type Message = typeof Message.Type

export const SyncTownScene = Command.define('SyncTownScene', {
  args: { sceneState: TownSceneState },
  messages: [Message.CompletedSyncScene],
  execute: ({ sceneState }) =>
    Effect.sync(() => {
      Option.map(getActiveTownController(), (controller) => {
        controller.applyState(sceneState)
      })
      return Message.CompletedSyncScene()
    }),
})

export const PersistTownPreferences = Command.define('PersistTownPreferences', {
  args: {
    seed: Schema.Number,
    palette: TownPalette,
    timeOfDay: TimeOfDay,
  },
  messages: [Message.CompletedPersistCookie],
  execute: ({ seed, palette, timeOfDay }) =>
    Effect.sync(() => {
      const payload = encodeURIComponent(
        JSON.stringify({ seed, palette, timeOfDay }),
      )
      document.cookie = `${TOWN_COOKIE_NAME}=${payload}; path=/; max-age=31536000; samesite=lax`
      return Message.CompletedPersistCookie()
    }),
})

class TownApiError extends Data.TaggedError('TownApiError')<{
  readonly reason: string
}> {}

const decodeSnapshotEffect = Schema.decodeUnknownEffect(TownSnapshot)
const decodeBellChimeEffect = Schema.decodeUnknownEffect(BellChimeResponse)

export const RequestNewTownFromBackend = Command.define(
  'RequestNewTownFromBackend',
  {
    args: {
      palette: TownPalette,
      timeOfDay: TimeOfDay,
    },
    messages: [Message.SucceededGenerateTown, Message.FailedGenerateTown],
    execute: ({ palette, timeOfDay }) =>
      Effect.gen(function* () {
        const response = yield* Effect.tryPromise({
          try: () =>
            fetch('/api/town/generate', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ palette, timeOfDay }),
            }),
          catch: () =>
            new TownApiError({ reason: 'Network request failed' }),
        })

        if (!response.ok) {
          return yield* new TownApiError({ reason: 'Static host fallback' })
        }

        const json = yield* Effect.tryPromise({
          try: () => response.json(),
          catch: () =>
            new TownApiError({ reason: 'Invalid JSON from Effect backend' }),
        })

        const snapshot = yield* decodeSnapshotEffect(json).pipe(
          Effect.mapError(
            () =>
              new TownApiError({
                reason: 'Schema validation failed for TownSnapshot',
              }),
          ),
        )

        return Message.SucceededGenerateTown({ snapshot })
      }).pipe(
        Effect.catch(() =>
          Effect.sync(() => {
            const nextSeed = Math.floor(100 + Math.random() * 8900)
            const snapshot = createTownSnapshot({
              seed: nextSeed,
              palette,
              timeOfDay,
              renderedOn: 'Client',
            })
            return Message.SucceededGenerateTown({ snapshot })
          }),
        ),
      ),
  },
)

export const TriggerCampanileBells = Command.define('TriggerCampanileBells', {
  args: { seed: Schema.Number },
  messages: [Message.SucceededRingBells],
  execute: ({ seed }) =>
    Effect.gen(function* () {
      Option.map(getActiveTownController(), (controller) => {
        controller.triggerBellChime()
      })

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch('/api/town/bells', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ seed }),
          }),
        catch: () =>
          new TownApiError({ reason: 'Bell endpoint unreachable' }),
      })

      if (!response.ok) {
        return yield* new TownApiError({ reason: 'Bell endpoint status error' })
      }

      const raw = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: () => new TownApiError({ reason: 'Invalid bell JSON' }),
      })

      const chime = yield* decodeBellChimeEffect(raw)
      return Message.SucceededRingBells({ chime })
    }).pipe(
      Effect.catch(() =>
        Effect.succeed(
          Message.SucceededRingBells({
            chime: BellChimeResponse.make({
              chimeNote: 'D♯4 · Campana Maggiore',
              seagullsStartled: 8,
              echoDurationMs: 3600,
              timestamp: new Date().toISOString(),
            }),
          }),
        ),
      ),
    ),
})

export const ExpireBellResonance = Command.define('ExpireBellResonance', {
  messages: [Message.CompletedBellResonance],
  execute: Effect.sleep(Duration.millis(3800)).pipe(
    Effect.as(Message.CompletedBellResonance()),
  ),
})

export const MountTownViewport = Mount.defineStream('MountTownViewport', {
  args: { initialScene: TownSceneState },
  messages: [
    Message.MountedTownCanvas,
    Message.SelectedDistrictFromCanvas,
  ],
  execute: ({ element, viewStateChanges, initialScene }) =>
    Stream.callback<
      | typeof Message.MountedTownCanvas.Type
      | typeof Message.SelectedDistrictFromCanvas.Type
    >((queue) =>
      Effect.gen(function* () {
        const controller = yield* Effect.acquireRelease(
          Effect.sync(() =>
            mountIsometricTown(element, initialScene, (districtId) => {
              Queue.offerUnsafe(
                queue,
                Message.SelectedDistrictFromCanvas({ districtId }),
              )
            }),
          ),
          (instance) => Effect.sync(() => instance.dispose()),
        )

        yield* viewStateChanges.pipe(
          Stream.runForEach((viewState) =>
            Effect.sync(() => controller.setPaused(viewState !== 'Live')),
          ),
          Effect.forkScoped,
        )

        Queue.offerUnsafe(queue, Message.MountedTownCanvas())
        return yield* Effect.never
      }),
    ),
})

export const subscriptions = Subscription.make<Model, Message>()((entry) => ({
  autoCycle: entry(
    { autoTimeCycle: Schema.Boolean },
    {
      modelToDependencies: (model) => ({
        autoTimeCycle: model.autoTimeCycle,
      }),
      dependenciesToStream: ({ autoTimeCycle }) =>
        Stream.when(
          Stream.tick(Duration.millis(220)).pipe(
            Stream.drop(1),
            Stream.map(() => Message.TickedAutoCycle()),
          ),
          Effect.sync(() => autoTimeCycle),
        ),
    },
  ),
}))

export const init: Runtime.ApplicationInit<Model, Message, Flags> = (flags) => ({
  model: Model.make({
    townName: flags.townName,
    region: flags.region,
    seed: flags.seed,
    timeOfDay: flags.timeOfDay,
    palette: flags.palette,
    cameraPreset: flags.cameraPreset,
    sunAngle: flags.sunAngle,
    windBreeze: flags.windBreeze,
    autoOrbit: flags.autoOrbit,
    autoTimeCycle: flags.autoTimeCycle,
    lanternsLit: flags.lanternsLit,
    bellsRinging: flags.bellsRinging,
    population: flags.population,
    activeBoats: flags.activeBoats,
    harborTempC: flags.harborTempC,
    seaState: flags.seaState,
    districts: flags.districts,
    selectedDistrict: Option.none(),
    isGeneratingTown: false,
    lastBellChime: Option.none(),
    hudCollapsed: false,
    renderedAt: flags.renderedAt,
    renderedOn: flags.renderedOn,
    canvasMounted: false,
  }),
})

const deriveTimeOfDayFromAngle = (angle: number): TimeOfDay =>
  Match.value(angle).pipe(
    Match.when(
      (a) => a < -6,
      () => 'Starlight' as const,
    ),
    Match.when(
      (a) => a < 20,
      () => 'GoldenHour' as const,
    ),
    Match.when(
      (a) => a < 38,
      () => 'Dawn' as const,
    ),
    Match.orElse(() => 'Midday' as const),
  )

export const update = (
  model: Model,
  message: Message,
): Update.Return<Model, Message> =>
  Message.match<Update.Return<Model, Message>>(message, {
    SelectedTimeOfDay: ({ timeOfDay }) => {
      const nextModel = modifyFields(model, {
        timeOfDay: () => timeOfDay,
        sunAngle: () => defaultSunAngleForTime(timeOfDay),
        lanternsLit: () => defaultLanternsForTime(timeOfDay),
      })
      return {
        model: nextModel,
        commands: [
          SyncTownScene({ sceneState: toSceneState(nextModel) }),
          PersistTownPreferences({
            seed: nextModel.seed,
            palette: nextModel.palette,
            timeOfDay: nextModel.timeOfDay,
          }),
        ],
      }
    },

    SelectedPalette: ({ palette }) => {
      const nextModel = modifyFields(model, {
        palette: () => palette,
      })
      return {
        model: nextModel,
        commands: [
          SyncTownScene({ sceneState: toSceneState(nextModel) }),
          PersistTownPreferences({
            seed: nextModel.seed,
            palette: nextModel.palette,
            timeOfDay: nextModel.timeOfDay,
          }),
        ],
      }
    },

    SelectedCameraPreset: ({ cameraPreset }) => {
      const nextModel = modifyFields(model, {
        cameraPreset: () => cameraPreset,
        selectedDistrict: () => Option.none(),
      })
      return {
        model: nextModel,
        commands: [SyncTownScene({ sceneState: toSceneState(nextModel) })],
      }
    },

    ChangedSunAngle: ({ sunAngle }) => {
      const clamped = Math.max(-35, Math.min(85, sunAngle))
      const derivedTime = deriveTimeOfDayFromAngle(clamped)
      const nextModel = modifyFields(model, {
        sunAngle: () => clamped,
        timeOfDay: () => derivedTime,
        lanternsLit: () => clamped < 24,
      })
      return {
        model: nextModel,
        commands: [SyncTownScene({ sceneState: toSceneState(nextModel) })],
      }
    },

    ChangedWindBreeze: ({ windBreeze }) => {
      const clamped = Math.max(0.2, Math.min(2.5, windBreeze))
      const nextModel = modifyFields(model, {
        windBreeze: () => clamped,
      })
      return {
        model: nextModel,
        commands: [SyncTownScene({ sceneState: toSceneState(nextModel) })],
      }
    },

    ToggledAutoOrbit: () => {
      const nextModel = modifyFields(model, {
        autoOrbit: (current) => !current,
      })
      return {
        model: nextModel,
        commands: [SyncTownScene({ sceneState: toSceneState(nextModel) })],
      }
    },

    ToggledAutoTimeCycle: () => ({
      model: modifyFields(model, {
        autoTimeCycle: (current) => !current,
      }),
    }),

    ToggledLanterns: () => {
      const nextModel = modifyFields(model, {
        lanternsLit: (current) => !current,
      })
      return {
        model: nextModel,
        commands: [SyncTownScene({ sceneState: toSceneState(nextModel) })],
      }
    },

    ToggledHudCollapsed: () => ({
      model: modifyFields(model, {
        hudCollapsed: (current) => !current,
      }),
    }),

    SelectedDistrictCard: ({ districtId }) => {
      const nextModel = modifyFields(model, {
        selectedDistrict: () => districtId,
      })
      return {
        model: nextModel,
        commands: [SyncTownScene({ sceneState: toSceneState(nextModel) })],
      }
    },

    SelectedDistrictFromCanvas: ({ districtId }) => {
      const nextSelected = Option.contains(model.selectedDistrict, districtId)
        ? Option.none<DistrictId>()
        : Option.some(districtId)

      const nextModel = modifyFields(model, {
        selectedDistrict: () => nextSelected,
      })
      return {
        model: nextModel,
        commands: [SyncTownScene({ sceneState: toSceneState(nextModel) })],
      }
    },

    ClickedRegenerateTown: () => ({
      model: modifyFields(model, {
        isGeneratingTown: () => true,
      }),
      commands: [
        RequestNewTownFromBackend({
          palette: model.palette,
          timeOfDay: model.timeOfDay,
        }),
      ],
    }),

    SucceededGenerateTown: ({ snapshot }) => {
      const nextModel = modifyFields(model, {
        townName: () => snapshot.townName,
        region: () => snapshot.region,
        seed: () => snapshot.seed,
        population: () => snapshot.population,
        activeBoats: () => snapshot.activeBoats,
        harborTempC: () => snapshot.harborTempC,
        seaState: () => snapshot.seaState,
        districts: () => snapshot.districts,
        renderedAt: () => snapshot.renderedAt,
        isGeneratingTown: () => false,
        selectedDistrict: () => Option.none(),
      })
      return {
        model: nextModel,
        commands: [SyncTownScene({ sceneState: toSceneState(nextModel) })],
      }
    },

    FailedGenerateTown: () => {
      const fallbackSeed =
        (((model.seed * 1664525 + 1013904223) >>> 0) % 8900) + 100
      const nextModel = modifyFields(model, {
        seed: () => fallbackSeed,
        isGeneratingTown: () => false,
      })
      return {
        model: nextModel,
        commands: [SyncTownScene({ sceneState: toSceneState(nextModel) })],
      }
    },

    ClickedRingCampanileBells: () => {
      const nextModel = modifyFields(model, {
        bellsRinging: () => true,
        selectedDistrict: () => Option.some('duomo' as const),
      })
      return {
        model: nextModel,
        commands: [
          SyncTownScene({ sceneState: toSceneState(nextModel) }),
          TriggerCampanileBells({ seed: nextModel.seed }),
          ExpireBellResonance(),
        ],
      }
    },

    SucceededRingBells: ({ chime }) => ({
      model: modifyFields(model, {
        lastBellChime: () => Option.some(chime),
      }),
    }),

    CompletedBellResonance: () => {
      const nextModel = modifyFields(model, {
        bellsRinging: () => false,
      })
      return {
        model: nextModel,
        commands: [SyncTownScene({ sceneState: toSceneState(nextModel) })],
      }
    },

    MountedTownCanvas: () => {
      const nextModel = modifyFields(model, {
        canvasMounted: () => true,
      })
      return {
        model: nextModel,
        commands: [SyncTownScene({ sceneState: toSceneState(nextModel) })],
      }
    },

    CompletedSyncScene: () => ({ model }),

    CompletedPersistCookie: () => ({ model }),

    TickedAutoCycle: () => {
      const nextSun =
        model.sunAngle >= 80
          ? -32
          : Math.round((model.sunAngle + 1.5) * 10) / 10
      const nextTime = deriveTimeOfDayFromAngle(nextSun)
      const nextModel = modifyFields(model, {
        sunAngle: () => nextSun,
        timeOfDay: () => nextTime,
        lanternsLit: () => nextSun < 24,
      })
      return {
        model: nextModel,
        commands: [SyncTownScene({ sceneState: toSceneState(nextModel) })],
      }
    },
  })

const TIME_OPTIONS: ReadonlyArray<
  Readonly<{ id: TimeOfDay; short: string; badge: string }>
> = [
  { id: 'Dawn', short: 'Alba', badge: '06:15' },
  { id: 'Midday', short: 'Mezzogiorno', badge: '13:00' },
  { id: 'GoldenHour', short: 'Tramonto', badge: '19:40' },
  { id: 'Starlight', short: 'Notte', badge: '23:15' },
]

const PALETTE_OPTIONS: ReadonlyArray<
  Readonly<{
    id: TownPalette
    label: string
    swatches: readonly [string, string, string]
  }>
> = [
  {
    id: 'Amalfi',
    label: 'Amalfi Terracotta',
    swatches: ['bg-[#e8b882]', 'bg-[#c75f3e]', 'bg-[#2c8c74]'],
  },
  {
    id: 'CinqueTerre',
    label: 'Cinque Terre Pastel',
    swatches: ['bg-[#e66c55]', 'bg-[#f0b659]', 'bg-[#1f5c4b]'],
  },
  {
    id: 'Santorini',
    label: 'Santorini Aegean',
    swatches: ['bg-[#fafcff]', 'bg-[#1a5fb4]', 'bg-[#d91e6b]'],
  },
  {
    id: 'Provence',
    label: 'Roussillon Ochre',
    swatches: ['bg-[#d6a76c]', 'bg-[#a65838]', 'bg-[#5e789e]'],
  },
]

const CAMERA_OPTIONS: ReadonlyArray<CameraPreset> = [
  'Panorama',
  'HarborCove',
  'DuomoPiazza',
  'WindmillRidge',
]

const renderTopHeader = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.header(
    [
      h.Class(
        'pointer-events-auto flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/20 bg-slate-950/75 px-4 py-3 text-amber-50 shadow-2xl backdrop-blur-md',
      ),
    ],
    [
      h.div(
        [h.Class('flex items-center gap-3.5')],
        [
          h.div(
            [
              h.Class(
                'flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/35 bg-gradient-to-br from-amber-500/30 to-orange-600/20 text-lg font-semibold text-amber-200 shadow-inner',
              ),
            ],
            ['☀'],
          ),
          h.div(
            [],
            [
              h.div(
                [h.Class('flex items-center gap-2.5')],
                [
                  h.h1(
                    [
                      h.Class(
                        'font-serif text-xl font-semibold tracking-tight text-amber-50 sm:text-2xl',
                      ),
                    ],
                    [model.townName],
                  ),
                  h.span(
                    [
                      h.Class(
                        'rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[11px] font-medium text-emerald-300',
                      ),
                    ],
                    [`SSR · ${model.renderedOn}`],
                  ),
                  h.span(
                    [
                      h.Class(
                        'hidden rounded-full border border-amber-300/25 bg-amber-400/10 px-2.5 py-0.5 font-mono text-[11px] text-amber-200/90 md:inline-block',
                      ),
                    ],
                    [`Seed #${model.seed}`],
                  ),
                ],
              ),
              h.p(
                [h.Class('text-xs text-amber-100/70')],
                [
                  `${model.region} · ${paletteDisplayName(model.palette)} · ${timeOfDayLabel(model.timeOfDay)}`,
                ],
              ),
            ],
          ),
        ],
      ),

      h.div(
        [h.Class('flex flex-wrap items-center gap-2')],
        [
          h.button(
            [
              h.Type('button'),
              h.OnClick(Message.ClickedRingCampanileBells()),
              h.Class(
                'cursor-pointer rounded-xl border border-amber-400/40 bg-amber-500/20 px-3.5 py-2 text-xs font-medium text-amber-100 transition hover:bg-amber-500/35 active:scale-95',
              ),
            ],
            [
              model.bellsRinging
                ? '🔔 Campanile Chime Active...'
                : '🔔 Ring Duomo Bells',
            ],
          ),
          h.button(
            [
              h.Type('button'),
              h.OnClick(Message.ClickedRegenerateTown()),
              h.Class(
                'cursor-pointer rounded-xl border border-orange-400/40 bg-gradient-to-r from-amber-500/80 to-orange-600/80 px-3.5 py-2 text-xs font-semibold text-slate-950 shadow-md transition hover:from-amber-400 hover:to-orange-500 active:scale-95',
              ),
            ],
            [
              model.isGeneratingTown
                ? 'Generating Borgo...'
                : '✦ New Borgo Seed (Effect BE)',
            ],
          ),
          h.button(
            [
              h.Type('button'),
              h.OnClick(Message.ToggledHudCollapsed()),
              h.Class(
                'cursor-pointer rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-amber-100/80 transition hover:bg-white/15',
              ),
            ],
            [model.hudCollapsed ? 'Show Controls' : 'Hide Panels'],
          ),
        ],
      ),
    ],
  )

const renderLeftControlsPanel = (
  model: Model,
  h: HtmlBuilder<Message>,
): Html =>
  h.aside(
    [
      h.Class(
        'pointer-events-auto flex w-full flex-col gap-3.5 rounded-2xl border border-amber-200/15 bg-slate-950/75 p-4 text-amber-50 shadow-2xl backdrop-blur-md sm:w-80',
      ),
    ],
    [
      h.div(
        [h.Class('flex flex-col gap-2')],
        [
          h.div(
            [h.Class('flex items-center justify-between')],
            [
              h.span(
                [
                  h.Class(
                    'font-mono text-[11px] font-semibold tracking-wider text-amber-300/80 uppercase',
                  ),
                ],
                ['Luce & Atmosfera'],
              ),
              h.span(
                [h.Class('font-mono text-[11px] text-amber-200/70')],
                [`Sun ${model.sunAngle}°`],
              ),
            ],
          ),
          h.div(
            [h.Class('grid grid-cols-2 gap-1.5')],
            Array.map(TIME_OPTIONS, (opt) => {
              const active = model.timeOfDay === opt.id
              return h.button(
                [
                  h.Type('button'),
                  h.OnClick(Message.SelectedTimeOfDay({ timeOfDay: opt.id })),
                  h.Class(
                    active
                      ? 'cursor-pointer flex items-center justify-between rounded-xl border border-amber-400/60 bg-amber-500/25 px-3 py-2 text-left text-xs font-semibold text-amber-100 shadow-sm transition'
                      : 'cursor-pointer flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-amber-100/75 transition hover:border-white/25 hover:bg-white/10',
                  ),
                ],
                [
                  h.span([], [opt.short]),
                  h.span(
                    [h.Class('font-mono text-[10px] opacity-65')],
                    [opt.badge],
                  ),
                ],
              )
            }),
          ),
        ],
      ),

      h.div(
        [
          h.Class(
            'flex flex-col gap-2.5 rounded-xl border border-white/10 bg-black/25 p-3',
          ),
        ],
        [
          h.label(
            [h.Class('flex flex-col gap-1 text-xs text-amber-100/80')],
            [
              h.div(
                [h.Class('flex justify-between')],
                [
                  h.span([], ['Solar Elevation Arc']),
                  h.span(
                    [h.Class('font-mono text-[11px] text-amber-300')],
                    [`${model.sunAngle}°`],
                  ),
                ],
              ),
              h.input([
                h.Type('range'),
                h.Min('-32'),
                h.Max('80'),
                h.Step('1'),
                h.Value(String(model.sunAngle)),
                h.OnInput((val) =>
                  Message.ChangedSunAngle({
                    sunAngle: Number.parseFloat(val) || 0,
                  }),
                ),
                h.Class('h-1.5 w-full cursor-pointer accent-amber-400'),
              ]),
            ],
          ),
          h.label(
            [h.Class('flex flex-col gap-1 text-xs text-amber-100/80')],
            [
              h.div(
                [h.Class('flex justify-between')],
                [
                  h.span([], ['Maestrale Sea Breeze']),
                  h.span(
                    [h.Class('font-mono text-[11px] text-amber-300')],
                    [`${model.windBreeze.toFixed(1)}x`],
                  ),
                ],
              ),
              h.input([
                h.Type('range'),
                h.Min('0.2'),
                h.Max('2.4'),
                h.Step('0.1'),
                h.Value(String(model.windBreeze)),
                h.OnInput((val) =>
                  Message.ChangedWindBreeze({
                    windBreeze: Number.parseFloat(val) || 1.0,
                  }),
                ),
                h.Class('h-1.5 w-full cursor-pointer accent-amber-400'),
              ]),
            ],
          ),
        ],
      ),

      h.div(
        [h.Class('flex flex-col gap-2')],
        [
          h.span(
            [
              h.Class(
                'font-mono text-[11px] font-semibold tracking-wider text-amber-300/80 uppercase',
              ),
            ],
            ['Mediterranean Stucco & Majolica'],
          ),
          h.div(
            [h.Class('grid grid-cols-2 gap-1.5')],
            Array.map(PALETTE_OPTIONS, (p) => {
              const active = model.palette === p.id
              return h.button(
                [
                  h.Type('button'),
                  h.OnClick(Message.SelectedPalette({ palette: p.id })),
                  h.Class(
                    active
                      ? 'cursor-pointer flex flex-col gap-1.5 rounded-xl border border-amber-400/60 bg-amber-500/20 p-2.5 text-left text-xs font-semibold text-amber-50 transition'
                      : 'cursor-pointer flex flex-col gap-1.5 rounded-xl border border-white/10 bg-white/5 p-2.5 text-left text-xs text-amber-100/75 transition hover:border-white/25 hover:bg-white/10',
                  ),
                ],
                [
                  h.span([h.Class('truncate')], [p.label]),
                  h.div(
                    [h.Class('flex items-center gap-1')],
                    Array.map(p.swatches, (sw) =>
                      h.span([
                        h.Class(
                          `h-2.5 w-4 rounded-sm border border-white/20 ${sw}`,
                        ),
                      ]),
                    ),
                  ),
                ],
              )
            }),
          ),
        ],
      ),

      h.div(
        [h.Class('flex flex-col gap-2')],
        [
          h.span(
            [
              h.Class(
                'font-mono text-[11px] font-semibold tracking-wider text-amber-300/80 uppercase',
              ),
            ],
            ['Isometric Camera Viewpoints'],
          ),
          h.div(
            [h.Class('grid grid-cols-2 gap-1.5')],
            Array.map(CAMERA_OPTIONS, (preset) => {
              const active =
                model.cameraPreset === preset &&
                Option.isNone(model.selectedDistrict)
              return h.button(
                [
                  h.Type('button'),
                  h.OnClick(
                    Message.SelectedCameraPreset({ cameraPreset: preset }),
                  ),
                  h.Class(
                    active
                      ? 'cursor-pointer rounded-xl border border-sky-400/60 bg-sky-500/25 px-2.5 py-2 text-left text-xs font-semibold text-sky-100 transition'
                      : 'cursor-pointer rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-left text-xs text-amber-100/75 transition hover:bg-white/10',
                  ),
                ],
                [cameraPresetLabel(preset)],
              )
            }),
          ),
        ],
      ),

      h.div(
        [h.Class('flex flex-wrap gap-1.5 pt-1')],
        [
          h.button(
            [
              h.Type('button'),
              h.OnClick(Message.ToggledAutoOrbit()),
              h.Class(
                model.autoOrbit
                  ? 'cursor-pointer flex-1 rounded-xl border border-amber-400/50 bg-amber-500/20 px-2.5 py-1.5 text-[11px] font-medium text-amber-100'
                  : 'cursor-pointer flex-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-amber-100/60',
              ),
            ],
            [model.autoOrbit ? '⟳ Orbit: On' : '⟳ Orbit: Off'],
          ),
          h.button(
            [
              h.Type('button'),
              h.OnClick(Message.ToggledLanterns()),
              h.Class(
                model.lanternsLit
                  ? 'cursor-pointer flex-1 rounded-xl border border-amber-400/50 bg-amber-500/20 px-2.5 py-1.5 text-[11px] font-medium text-amber-100'
                  : 'cursor-pointer flex-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-amber-100/60',
              ),
            ],
            [model.lanternsLit ? '🏮 Lanterns: Lit' : '🏮 Lanterns: Off'],
          ),
          h.button(
            [
              h.Type('button'),
              h.OnClick(Message.ToggledAutoTimeCycle()),
              h.Class(
                model.autoTimeCycle
                  ? 'cursor-pointer flex-1 rounded-xl border border-emerald-400/50 bg-emerald-500/20 px-2.5 py-1.5 text-[11px] font-medium text-emerald-200'
                  : 'cursor-pointer flex-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] text-amber-100/60',
              ),
            ],
            [
              model.autoTimeCycle
                ? '☀ Solar Cycle: Live'
                : '☀ Solar Cycle: Pause',
            ],
          ),
        ],
      ),
    ],
  )

const renderRightDistrictsPanel = (
  model: Model,
  h: HtmlBuilder<Message>,
): Html =>
  h.aside(
    [
      h.Class(
        'pointer-events-auto flex w-full flex-col gap-3 rounded-2xl border border-amber-200/15 bg-slate-950/75 p-4 text-amber-50 shadow-2xl backdrop-blur-md sm:w-84',
      ),
    ],
    [
      h.div(
        [h.Class('grid grid-cols-3 gap-2')],
        [
          h.div(
            [
              h.Class(
                'rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-center',
              ),
            ],
            [
              h.div(
                [h.Class('font-mono text-sm font-semibold text-amber-200')],
                [String(model.population)],
              ),
              h.div(
                [h.Class('text-[10px] text-amber-100/60')],
                ['Abitanti'],
              ),
            ],
          ),
          h.div(
            [
              h.Class(
                'rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-center',
              ),
            ],
            [
              h.div(
                [h.Class('font-mono text-sm font-semibold text-sky-300')],
                [`${model.harborTempC.toFixed(1)}°C`],
              ),
              h.div(
                [h.Class('text-[10px] text-amber-100/60')],
                ['Harbor Temp'],
              ),
            ],
          ),
          h.div(
            [
              h.Class(
                'rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-center',
              ),
            ],
            [
              h.div(
                [h.Class('font-mono text-sm font-semibold text-emerald-300')],
                [`${model.activeBoats} Gozzi`],
              ),
              h.div(
                [h.Class('text-[10px] text-amber-100/60')],
                ['Active Fleet'],
              ),
            ],
          ),
        ],
      ),

      Option.match(model.lastBellChime, {
        onNone: () => h.empty,
        onSome: (chime) =>
          h.div(
            [
              h.Class(
                'rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs text-amber-100',
              ),
            ],
            [
              h.div(
                [h.Class('font-semibold text-amber-200')],
                [`🔔 ${chime.chimeNote}`],
              ),
              h.div(
                [h.Class('text-[11px] text-amber-100/75')],
                [
                  `${chime.seagullsStartled} seagulls took flight across the cupola`,
                ],
              ),
            ],
          ),
      }),

      h.div(
        [h.Class('flex items-center justify-between')],
        [
          h.span(
            [
              h.Class(
                'font-mono text-[11px] font-semibold tracking-wider text-amber-300/80 uppercase',
              ),
            ],
            ['Quartieri del Borgo (Click 3D or Card)'],
          ),
          Option.match(model.selectedDistrict, {
            onNone: () => h.empty,
            onSome: () =>
              h.button(
                [
                  h.Type('button'),
                  h.OnClick(
                    Message.SelectedDistrictCard({ districtId: Option.none() }),
                  ),
                  h.Class(
                    'cursor-pointer text-[11px] text-amber-300 underline hover:text-amber-100',
                  ),
                ],
                ['Reset Focus'],
              ),
          }),
        ],
      ),

      h.div(
        [h.Class('flex max-h-80 flex-col gap-2 overflow-y-auto pr-1')],
        Array.map(model.districts, (district) => {
          const isSelected = Option.contains(
            model.selectedDistrict,
            district.id,
          )
          return h.button(
            [
              h.Type('button'),
              h.OnClick(
                Message.SelectedDistrictCard({
                  districtId: isSelected
                    ? Option.none()
                    : Option.some(district.id),
                }),
              ),
              h.Class(
                isSelected
                  ? 'cursor-pointer flex flex-col gap-1 rounded-xl border border-amber-400/70 bg-amber-500/20 p-3 text-left transition'
                  : 'cursor-pointer flex flex-col gap-1 rounded-xl border border-white/10 bg-white/5 p-2.5 text-left transition hover:border-white/25 hover:bg-white/10',
              ),
            ],
            [
              h.div(
                [h.Class('flex items-center justify-between gap-2')],
                [
                  h.span(
                    [h.Class('text-xs font-semibold text-amber-50')],
                    [district.name],
                  ),
                  h.span(
                    [
                      h.Class(
                        'shrink-0 rounded-md bg-black/35 px-1.5 py-0.5 font-mono text-[10px] text-amber-300',
                      ),
                    ],
                    [`+${district.elevationMeters}m`],
                  ),
                ],
              ),
              h.div(
                [h.Class('text-[11px] font-medium text-amber-200/75')],
                [
                  `${district.italianSubtitle} · ${district.buildingCount} structures`,
                ],
              ),
              isSelected
                ? h.p(
                    [
                      h.Class(
                        'mt-1 text-[11px] leading-relaxed text-amber-100/85',
                      ),
                    ],
                    [district.description],
                  )
                : h.empty,
              h.div(
                [
                  h.Class(
                    'mt-0.5 inline-flex items-center gap-1 font-mono text-[10px] text-emerald-300/90',
                  ),
                ],
                [`◆ ${district.highlightStat}`],
              ),
            ],
          )
        }),
      ),

      h.div(
        [
          h.Class(
            'flex items-center justify-between border-t border-white/10 pt-2 font-mono text-[10px] text-amber-100/60',
          ),
        ],
        [
          h.span([], [model.seaState]),
          h.span(
            [],
            [model.canvasMounted ? 'WebGL 3D Live' : 'SSR HTML Ready'],
          ),
        ],
      ),
    ],
  )

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: `${model.townName} · Mediterranean Hill Town (Foldkit SSR + Three.js)`,
  lang: 'en',
  body: h.main(
    [
      h.Class(
        'relative h-screen w-screen overflow-hidden bg-slate-950 font-sans select-none',
      ),
    ],
    [
      h.div([
        h.Id('town-canvas-container'),
        h.Class('absolute inset-0 h-full w-full'),
        h.OnMount(
          MountTownViewport({
            initialScene: toSceneState(model),
          }),
        ),
      ]),

      h.div(
        [
          h.Class(
            'pointer-events-none relative z-10 flex h-full w-full flex-col justify-between p-3 sm:p-5',
          ),
        ],
        [
          renderTopHeader(model, h),

          model.hudCollapsed
            ? h.empty
            : h.div(
                [
                  h.Class(
                    'my-auto flex flex-col items-start justify-between gap-4 overflow-y-auto py-3 sm:flex-row sm:items-end',
                  ),
                ],
                [
                  renderLeftControlsPanel(model, h),
                  renderRightDistrictsPanel(model, h),
                ],
              ),

          h.footer(
            [
              h.Class(
                'pointer-events-auto mx-auto flex flex-wrap items-center justify-center gap-3 rounded-full border border-amber-200/15 bg-slate-950/70 px-4 py-1.5 text-[11px] text-amber-100/75 shadow-lg backdrop-blur-md',
              ),
            ],
            [
              h.span([], ['🖱 Drag to Orbit Isometric Angle']),
              h.span([h.Class('opacity-40')], ['·']),
              h.span([], ['⇧ + Drag / Right-Click to Pan']),
              h.span([h.Class('opacity-40')], ['·']),
              h.span([], ['Scroll to Zoom']),
              h.span([h.Class('opacity-40')], ['·']),
              h.span([], ['Click 3D Landmarks to Inspect']),
            ],
          ),
        ],
      ),
    ],
  ),
})
