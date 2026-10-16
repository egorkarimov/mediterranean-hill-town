import { Command, given, message, model, story } from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import {
  ExpireBellResonance,
  Message,
  PersistTownPreferences,
  RequestNewTownFromBackend,
  SyncTownScene,
  TriggerCampanileBells,
  init,
  update,
} from './main'
import {
  createTownSnapshot,
  handleApiRequest,
} from './server/townService'

describe('Borgo Solare — Foldkit TEA & Effect Backend', () => {
  const initialFlags = createTownSnapshot({
    seed: 42,
    palette: 'Amalfi',
    timeOfDay: 'GoldenHour',
    renderedOn: 'Server',
  })

  const { model: initialModel } = init(initialFlags)

  test('switching palette and time of day updates Model and dispatches SyncTownScene + PersistTownPreferences', () => {
    story(
      update,
      given(initialModel),
      message(Message.SelectedPalette({ palette: 'Santorini' })),
      model(m => {
        expect(m.palette).toBe('Santorini')
      }),
      Command.expectExact(SyncTownScene, PersistTownPreferences),
      Command.resolve(SyncTownScene, Message.CompletedSyncScene()),
      Command.resolve(
        PersistTownPreferences,
        Message.CompletedPersistCookie(),
      ),
      message(Message.SelectedTimeOfDay({ timeOfDay: 'Starlight' })),
      model(m => {
        expect(m.timeOfDay).toBe('Starlight')
        expect(m.lanternsLit).toBe(true)
        expect(m.sunAngle).toBe(-28)
      }),
      Command.expectExact(SyncTownScene, PersistTownPreferences),
      Command.resolve(SyncTownScene, Message.CompletedSyncScene()),
      Command.resolve(
        PersistTownPreferences,
        Message.CompletedPersistCookie(),
      ),
    )
  })

  test('ringing Campanile bells selects Duomo district and triggers acoustic chime', () => {
    const mockChime = {
      chimeNote: 'D♯4 · Campana Maggiore (Bronze 1684)',
      seagullsStartled: 9,
      echoDurationMs: 3600,
      timestamp: '2026-10-16T12:00:00.000Z',
    }

    story(
      update,
      given(initialModel),
      message(Message.ClickedRingCampanileBells()),
      model(m => {
        expect(m.bellsRinging).toBe(true)
        expect(m.selectedDistrict._tag).toBe('Some')
      }),
      Command.expectExact(
        SyncTownScene,
        TriggerCampanileBells,
        ExpireBellResonance,
      ),
      Command.resolve(SyncTownScene, Message.CompletedSyncScene()),
      Command.resolve(
        TriggerCampanileBells,
        Message.SucceededRingBells({ chime: mockChime }),
      ),
      Command.resolve(ExpireBellResonance, Message.CompletedBellResonance()),
      Command.expectExact(SyncTownScene),
      Command.resolve(SyncTownScene, Message.CompletedSyncScene()),
      model(m => {
        expect(m.bellsRinging).toBe(false)
        expect(m.lastBellChime._tag).toBe('Some')
      }),
    )
  })

  test('generating a new Borgo seed dispatches RequestNewTownFromBackend and updates town telemetry', () => {
    const generatedSnapshot = createTownSnapshot({
      seed: 777,
      palette: 'CinqueTerre',
      timeOfDay: 'Dawn',
      renderedOn: 'Server',
    })

    story(
      update,
      given(initialModel),
      message(Message.ClickedRegenerateTown()),
      model(m => {
        expect(m.isGeneratingTown).toBe(true)
      }),
      Command.expectExact(RequestNewTownFromBackend),
      Command.resolve(
        RequestNewTownFromBackend,
        Message.SucceededGenerateTown({ snapshot: generatedSnapshot }),
      ),
      Command.expectExact(SyncTownScene),
      Command.resolve(SyncTownScene, Message.CompletedSyncScene()),
      model(m => {
        expect(m.isGeneratingTown).toBe(false)
        expect(m.seed).toBe(777)
        expect(m.townName).toBe(generatedSnapshot.townName)
      }),
    )
  })

  test('Effect backend API handles GET /api/town and POST /api/town/generate', async () => {
    const getRes = await handleApiRequest(
      new Request('http://localhost:3000/api/town?palette=Santorini&seed=108'),
    )
    expect(getRes._tag).toBe('Some')
    if (getRes._tag === 'Some') {
      const data = (await getRes.value.json()) as {
        seed: number
        palette: string
      }
      expect(data.seed).toBe(108)
      expect(data.palette).toBe('Santorini')
    }

    const postRes = await handleApiRequest(
      new Request('http://localhost:3000/api/town/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          seed: 512,
          palette: 'Provence',
          timeOfDay: 'Midday',
        }),
      }),
    )
    expect(postRes._tag).toBe('Some')
    if (postRes._tag === 'Some') {
      const data = (await postRes.value.json()) as {
        seed: number
        palette: string
        timeOfDay: string
      }
      expect(data.seed).toBe(512)
      expect(data.palette).toBe('Provence')
      expect(data.timeOfDay).toBe('Midday')
    }
  })
})
