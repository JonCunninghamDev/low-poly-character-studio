import assert from 'node:assert/strict'
import test from 'node:test'
import { buildHumanoidStyleDna, type HumanoidLandmarks } from './final-build-workflow'
import { reviewMarkers, readConfirmedStyleDna } from './marker-review'
const landmarks: HumanoidLandmarks = {
  HeadTop: { x: 100, y: 20 },
  Chin: { x: 100, y: 100 },
  HeadLeft: { x: 60, y: 55 },
  HeadRight: { x: 140, y: 55 },
  EyeLeft: { x: 82, y: 58 },
  EyeRight: { x: 118, y: 58 },
  ShoulderLeft: { x: 65, y: 125 },
  ShoulderRight: { x: 135, y: 125 },
  WaistLeft: { x: 72, y: 175 },
  WaistRight: { x: 128, y: 175 },
  FeetBottom: { x: 100, y: 300 },
}
const imageSize = { width: 200, height: 320 }
test('lists missing markers instead of treating partial placement as complete', () => {
  const review = reviewMarkers({ HeadTop: landmarks.HeadTop }, imageSize)
  assert.equal(review.placed, 1)
  assert.equal(review.valid, false)
  assert.ok(review.missing.includes('FeetBottom'))
})
test('rejects nonfinite, out-of-bounds, reversed and degenerate markers', () => {
  for (const changed of [
    { HeadTop: { x: NaN, y: 20 } },
    { FeetBottom: { x: 100, y: 321 } },
    { EyeLeft: landmarks.EyeRight, EyeRight: landmarks.EyeLeft },
    { Chin: landmarks.HeadTop },
    { FeetBottom: { x: 100, y: 10 } },
  ]) assert.equal(reviewMarkers({ ...landmarks, ...changed }, imageSize).valid, false)
})
test('confirmed StyleDNA remains usable without an editor DOM', () => {
  const styleDna = buildHumanoidStyleDna({ source: 'front.png', imageSize, landmarks })
  const stored = JSON.stringify({ schemaVersion: 'marker-review/v1', confirmedAt: '2026-10-22T00:00:00Z', styleDna })
  assert.deepEqual(readConfirmedStyleDna(stored), styleDna)
  assert.equal(reviewMarkers(landmarks, imageSize).valid, true)
})
test('generation rejects missing, unconfirmed or invalid saved review', () => {
  assert.throws(() => readConfirmedStyleDna(null), /confirm markers/)
  assert.throws(() => readConfirmedStyleDna('{}'), /confirm markers/)
  assert.throws(() => readConfirmedStyleDna(JSON.stringify({ schemaVersion: 'marker-review/v1', confirmedAt: 'now', styleDna: { source: 'front.png', imageSize, landmarks: {} } })), /missing markers/)
})
