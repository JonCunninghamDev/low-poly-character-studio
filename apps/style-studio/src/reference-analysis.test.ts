import assert from 'node:assert/strict'
import {
  analyzeCharacterRaster,
  assessCharacterBodyPlan,
  assessCharacterInput,
  assessCharacterOrientation,
  isolateCharacterSubject,
  observeCharacterFeatures,
  type RasterImage as GenericRasterImage,
} from './character-image-assessment'
import { analyzeHumanoidRaster, type RasterImage } from './reference-analysis'

function makeRaster(width: number, height: number, subject: (x: number, y: number) => boolean): RasterImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const foreground = subject(x, y)
      data[offset] = foreground ? 190 : 245
      data[offset + 1] = foreground ? 110 : 245
      data[offset + 2] = foreground ? 75 : 245
      data[offset + 3] = 255
    }
  }
  return { width, height, data }
}

function makeCharacterRaster(
  width: number,
  height: number,
  subject: (x: number, y: number) => boolean,
  marks: (x: number, y: number) => boolean = () => false,
  bodyRgb: [number, number, number] = [188, 112, 78],
): GenericRasterImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const isSubject = subject(x, y)
      const isMark = isSubject && marks(x, y)
      const rgb = isMark ? [24, 24, 24] : isSubject ? bodyRgb : [245, 245, 245]
      data[offset] = rgb[0]
      data[offset + 1] = rgb[1]
      data[offset + 2] = rgb[2]
      data[offset + 3] = 255
    }
  }
  return { width, height, data }
}

function rotateClockwise(source: GenericRasterImage): GenericRasterImage {
  const width = source.height
  const height = source.width
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const targetX = source.height - 1 - y
      const targetY = x
      const sourceOffset = (y * source.width + x) * 4
      const targetOffset = (targetY * width + targetX) * 4
      for (let channel = 0; channel < 4; channel += 1) data[targetOffset + channel] = source.data[sourceOffset + channel]
    }
  }
  return { width, height, data }
}

const humanoid = makeRaster(100, 160, (x, y) => {
  const head = y >= 10 && y <= 58 && Math.abs(x - 50) <= 24 - Math.abs(y - 34) * 0.16
  const torso = y > 58 && y <= 112 && Math.abs(x - 50) <= (y < 78 ? 19 : 14)
  const leftLeg = y > 112 && y <= 148 && x >= 34 && x <= 48
  const rightLeg = y > 112 && y <= 148 && x >= 52 && x <= 66
  return head || torso || leftLeg || rightLeg
})

const result = analyzeHumanoidRaster(humanoid)
assert.equal(result.schemaVersion, 'humanoid-reference-analysis/v1')
assert.equal(result.modelTypeId, 'humanoid/chibi-v1')
assert.equal(result.adapterId, 'humanoid/chibi-local-silhouette-v1')
assert.ok(result.landmarks.HeadTop.y <= 11)
assert.ok(result.landmarks.FeetBottom.y >= 147)
assert.ok(result.landmarks.HeadLeft.x < result.landmarks.HeadRight.x)
assert.ok(result.landmarks.ShoulderLeft.x < result.landmarks.ShoulderRight.x)
assert.ok(result.landmarks.WaistLeft.x < result.landmarks.WaistRight.x)
assert.ok(result.landmarks.EyeLeft.x < result.landmarks.EyeRight.x)
assert.ok(result.confidence.overall > 0.5)
assert.equal(result.colorRegions.length, 3)
assert.ok(result.warnings.some((warning) => warning.code === 'heuristic-landmarks'))

const genericHumanoid = analyzeCharacterRaster(humanoid)
assert.equal(genericHumanoid.schemaVersion, 'character-image-assessment/v1')
assert.equal(genericHumanoid.adapterId, 'generic-local-silhouette-v2')
assert.equal(genericHumanoid.bodyPlan.selected.value, 'articulated/humanoid-bipedal')
assert.equal(genericHumanoid.decision.outcome, 'classified')
assert.ok((genericHumanoid.subject.support?.splitRatio ?? 0) > 0.25)
assert.equal(genericHumanoid.subject.support?.maxSupports, 2)
assert.equal(genericHumanoid.orientation.groundDirection.value, 'bottom')
assert.equal(genericHumanoid.functional.locomotionHint.value, 'walk')

const blobShape = (x: number, y: number) => {
  const dx = (x - 60) / 42
  const dy = (y - 63) / 46
  return dx * dx + dy * dy <= 1
}
const blobMarks = (x: number, y: number) => {
  const leftEye = x >= 45 && x <= 50 && y >= 48 && y <= 54
  const rightEye = x >= 70 && x <= 75 && y >= 48 && y <= 54
  const mouth = x >= 52 && x <= 68 && y >= 70 && y <= 73
  return leftEye || rightEye || mouth
}
const blob = makeCharacterRaster(120, 120, blobShape, blobMarks)

const inputStep = assessCharacterInput(blob)
const subjectStep = isolateCharacterSubject(blob, inputStep)
const featureStep = observeCharacterFeatures(blob, inputStep, subjectStep)
const orientationStep = assessCharacterOrientation(featureStep, subjectStep)
const bodyPlanStep = assessCharacterBodyPlan(inputStep, subjectStep)
assert.equal(inputStep.usability.value, 'usable')
assert.equal(subjectStep.available, true)
assert.equal(featureStep.face.value, true)
assert.equal(orientationStep.facing.value, 'front')
assert.equal(bodyPlanStep.selected.value, 'compact/blob-amorphous')

const blobResult = analyzeCharacterRaster(blob)
assert.equal(blobResult.bodyPlan.selected.value, 'compact/blob-amorphous')
assert.equal(blobResult.decision.outcome, 'classified')
assert.equal(blobResult.features.face.value, true)
assert.equal(blobResult.features.eyes.value, 2)
assert.equal(blobResult.features.mouth.value, true)
assert.equal(blobResult.orientation.facing.value, 'front')
assert.equal(blobResult.subject.support?.maxSupports, 1)
assert.equal(blobResult.functional.locomotionHint.value, 'bounce-squash')
assert.ok(blobResult.bodyPlan.candidates.find((candidate) => candidate.id === 'compact/blob-amorphous')?.confidence! > 0.7)

const noFaceBlob = analyzeCharacterRaster(makeCharacterRaster(120, 120, blobShape))
assert.equal(noFaceBlob.bodyPlan.selected.value, 'compact/blob-amorphous')
assert.equal(noFaceBlob.features.face.value, false)
assert.equal(noFaceBlob.orientation.facing.value, 'unknown')

const describedBlob = analyzeCharacterRaster(blob, { description: 'A humanoid person with a face.' })
assert.equal(describedBlob.userPrior?.suggestedBodyPlan, 'articulated/humanoid-bipedal')
assert.equal(describedBlob.bodyPlan.selected.value, 'compact/blob-amorphous')
assert.ok(describedBlob.bodyPlan.candidates.find((candidate) => candidate.id === 'articulated/humanoid-bipedal')?.evidence.includes('user description supplies a weak directional prior'))

const quadruped = makeCharacterRaster(120, 120, (x, y) => {
  const body = x >= 25 && x <= 95 && y >= 35 && y <= 75
  const head = x >= 18 && x <= 40 && y >= 20 && y <= 48
  const leg1 = x >= 30 && x <= 40 && y > 75 && y <= 105
  const leg2 = x >= 50 && x <= 60 && y > 75 && y <= 105
  const leg3 = x >= 72 && x <= 82 && y > 75 && y <= 105
  const leg4 = x >= 88 && x <= 98 && y > 75 && y <= 105
  return body || head || leg1 || leg2 || leg3 || leg4
})
const quadrupedResult = analyzeCharacterRaster(quadruped)
assert.equal(quadrupedResult.bodyPlan.selected.value, 'articulated/quadrupedal')
assert.ok((quadrupedResult.subject.support?.maxSupports ?? 0) >= 3)
assert.equal(quadrupedResult.orientation.groundDirection.value, 'bottom')

const rotatedHumanoid = analyzeCharacterRaster(rotateClockwise(humanoid))
assert.equal(rotatedHumanoid.bodyPlan.selected.value, 'articulated/humanoid-bipedal')
assert.equal(rotatedHumanoid.orientation.groundDirection.value, 'left')
assert.equal(rotatedHumanoid.orientation.imageUp.value, 'right')

const ambiguous = makeCharacterRaster(100, 140, (x, y) => {
  const body = y >= 10 && y <= 85 && Math.abs(x - 50) <= 25
  const leftSupport = y > 85 && y <= 95 && x >= 36 && x <= 47
  const rightSupport = y > 85 && y <= 95 && x >= 53 && x <= 64
  return body || leftSupport || rightSupport
})
const ambiguousResult = analyzeCharacterRaster(ambiguous)
assert.equal(ambiguousResult.decision.outcome, 'unresolved')
assert.equal(ambiguousResult.bodyPlan.selected.value, 'unknown')
assert.match(ambiguousResult.decision.reason, /ambiguous/i)

const poorContrastBlob = makeCharacterRaster(120, 120, blobShape, () => false, [235, 235, 235])
const poorContrastResult = analyzeCharacterRaster(poorContrastBlob)
assert.equal(poorContrastResult.input.usability.value, 'limited')
assert.equal(poorContrastResult.decision.outcome, 'unresolved')
assert.equal(poorContrastResult.bodyPlan.selected.value, 'unknown')
assert.ok(poorContrastResult.bodyPlan.candidates.some((candidate) => candidate.id === 'compact/blob-amorphous'))

const cropped = makeRaster(80, 120, (x, y) => x >= 0 && x <= 45 && y >= 0 && y <= 119)
const croppedResult = analyzeHumanoidRaster(cropped)
assert.ok(croppedResult.warnings.some((warning) => warning.code === 'cropped-subject'))

const blank = makeRaster(40, 40, () => false)
assert.throws(() => analyzeHumanoidRaster(blank), /No subject silhouette/)
const genericBlank = analyzeCharacterRaster(blank)
assert.equal(genericBlank.input.usability.value, 'unusable')
assert.equal(genericBlank.subject.available, false)
assert.equal(genericBlank.bodyPlan.selected.value, 'unknown')
assert.equal(genericBlank.decision.outcome, 'unresolved')

const invalid: RasterImage = { width: 10, height: 10, data: new Uint8ClampedArray(400) }
assert.throws(() => analyzeHumanoidRaster(invalid), /at least 16/)
assert.throws(() => analyzeCharacterRaster(invalid), /at least 16/)

console.log('reference analysis contract tests passed')
