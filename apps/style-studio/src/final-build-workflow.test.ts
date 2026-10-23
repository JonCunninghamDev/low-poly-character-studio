import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildHumanoidStyleDna,
  selectLatestFinalizedJob,
  type HumanoidLandmarks,
} from './final-build-workflow'

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

test('builds model-runner compatible humanoid StyleDNA from editable landmarks', () => {
  const result = buildHumanoidStyleDna({
    source: 'front.png',
    imageSize: { width: 200, height: 320 },
    landmarks,
  })

  assert.equal(result.schema, 'humanoid-style-dna/v1')
  assert.equal(result.modelTypeId, 'humanoid/chibi-v1')
  assert.equal(result.measurements.totalHeightPx, 280)
  assert.equal(result.measurements.headWidthPx, 80)
  for (const [name, value] of Object.entries(result.blenderHints)) {
    assert.ok(Number.isFinite(value) && value > 0, `${name} should be a positive finite number`)
  }
})

test('rejects incomplete landmark input before creating a build job', () => {
  assert.throws(
    () => buildHumanoidStyleDna({
      source: 'front.png',
      imageSize: { width: 200, height: 320 },
      landmarks: { ...landmarks, EyeRight: undefined },
    }),
    /EyeRight/
  )
})

test('selects the newest completed validated export for the humanoid model type', () => {
  const selected = selectLatestFinalizedJob([
    {
      id: 'older',
      createdAt: '2026-07-24T10:00:00.000Z',
      modelTypeId: 'humanoid/chibi-v1',
      stages: { validate: { status: 'completed' }, export: { status: 'completed' } },
    },
    {
      id: 'newer',
      createdAt: '2026-07-24T11:00:00.000Z',
      modelTypeId: 'humanoid/chibi-v1',
      stages: { validate: { status: 'completed' }, export: { status: 'completed' } },
    },
    {
      id: 'invalid',
      createdAt: '2026-07-24T12:00:00.000Z',
      modelTypeId: 'humanoid/chibi-v1',
      stages: { validate: { status: 'failed' }, export: { status: 'pending' } },
    },
  ])

  assert.equal(selected?.id, 'newer')
})

// Exercise the actual Python consumer rather than duplicating its range checks.
test('generated proportions pass Blender StyleDNA validation for conflicting image measurements', () => {
  const variants = [
    landmarks,
    { ...landmarks, ShoulderLeft: { x: 80, y: 125 }, ShoulderRight: { x: 119, y: 125 },
      WaistLeft: { x: 10, y: 175 }, WaistRight: { x: 190, y: 175 } },
    { ...landmarks, HeadRight: { x: 1000, y: 55 }, EyeRight: { x: 900, y: 58 } },
    { ...landmarks, EyeLeft: { x: 82, y: 200 }, ShoulderRight: { x: 1000, y: 125 } },
  ]
  const documents = variants.map(points => buildHumanoidStyleDna({
    source: 'proportion-regression.png', imageSize: { width: 1200, height: 320 }, landmarks: points,
  }))
  assert.equal(documents[1].measurements.waistWidthPx, 180)
  const result = spawnSync('python3', ['-c', `
import json, sys
from generator.style_dna import dna_from_style_document
for document in json.load(sys.stdin):
    dna_from_style_document(document)
`], {
    cwd: fileURLToPath(new URL('../../../packages/asset-compiler/blender/', import.meta.url)),
    input: JSON.stringify(documents), encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr || String(result.error))
})
