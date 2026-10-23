export const HUMANOID_LANDMARK_KEYS = [
  'HeadTop',
  'Chin',
  'HeadLeft',
  'HeadRight',
  'EyeLeft',
  'EyeRight',
  'ShoulderLeft',
  'ShoulderRight',
  'WaistLeft',
  'WaistRight',
  'FeetBottom',
] as const

export type HumanoidLandmarkKey = (typeof HUMANOID_LANDMARK_KEYS)[number]
export type Point = { x: number; y: number }
export type HumanoidLandmarks = Record<HumanoidLandmarkKey, Point>

export type HumanoidStyleDna = {
  schema: 'humanoid-style-dna/v1'
  modelTypeId: 'humanoid/chibi-v1'
  source: string
  imageSize: { width: number; height: number }
  landmarks: HumanoidLandmarks
  measurements: {
    totalHeightPx: number
    headHeightPx: number
    headWidthPx: number
    eyeSpacingPx: number
    shoulderWidthPx: number
    waistWidthPx: number
    headHeightRatio: number
    headWidthToHeight: number
    eyeHeightFromTopRatio: number
    eyeSpacingToHeadWidth: number
    shoulderWidthToHeadWidth: number
    waistWidthToHeadWidth: number
  }
  blenderHints: {
    totalHeight: number
    headWidth: number
    headDepth: number
    headHeight: number
    eyeSpacing: number
    eyeZ: number
    torsoWidth: number
    waistWidth: number
    legLength: number
  }
}

export type FinalizedJobSummary = {
  id: string
  createdAt: string
  modelTypeId: string
  stages: {
    validate: { status: string }
    export: { status: string }
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function distance(a: number, b: number) {
  return Math.abs(a - b)
}

function requirePositive(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`)
  return value
}

export function buildHumanoidStyleDna(input: {
  source: string
  imageSize: { width: number; height: number }
  landmarks: Partial<Record<HumanoidLandmarkKey, Point>>
}): HumanoidStyleDna {
  const missing = HUMANOID_LANDMARK_KEYS.filter((key) => {
    const point = input.landmarks[key]
    return !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)
  })
  if (missing.length) throw new Error(`Place all required landmarks before generation: ${missing.join(', ')}`)

  const landmarks = input.landmarks as HumanoidLandmarks
  const headHeightPx = requirePositive(distance(landmarks.HeadTop.y, landmarks.Chin.y), 'Head height')
  const totalHeightPx = requirePositive(distance(landmarks.HeadTop.y, landmarks.FeetBottom.y), 'Total height')
  const headWidthPx = requirePositive(distance(landmarks.HeadLeft.x, landmarks.HeadRight.x), 'Head width')
  const eyeSpacingPx = requirePositive(distance(landmarks.EyeLeft.x, landmarks.EyeRight.x), 'Eye spacing')
  const shoulderWidthPx = requirePositive(distance(landmarks.ShoulderLeft.x, landmarks.ShoulderRight.x), 'Shoulder width')
  const waistWidthPx = requirePositive(distance(landmarks.WaistLeft.x, landmarks.WaistRight.x), 'Waist width')

  const headHeightRatio = headHeightPx / totalHeightPx
  const headWidthToHeight = headWidthPx / headHeightPx
  const eyeHeightFromTopRatio = distance(landmarks.EyeLeft.y, landmarks.HeadTop.y) / headHeightPx
  const eyeSpacingToHeadWidth = eyeSpacingPx / headWidthPx
  const shoulderWidthToHeadWidth = shoulderWidthPx / headWidthPx
  const waistWidthToHeadWidth = waistWidthPx / headWidthPx

  // Resolve dependent dimensions against the same envelope Blender validates.
  // Preserve the raw image measurements below for review and later refinement.
  const headWidth = clamp(headWidthToHeight * 0.42, 0.32, 0.55)
  const torsoWidth = clamp(
    clamp(shoulderWidthToHeadWidth * 0.42, 0.20, 0.42),
    headWidth * 0.35,
    headWidth * 1.10,
  )

  return {
    schema: 'humanoid-style-dna/v1',
    modelTypeId: 'humanoid/chibi-v1',
    source: input.source,
    imageSize: input.imageSize,
    landmarks,
    measurements: {
      totalHeightPx,
      headHeightPx,
      headWidthPx,
      eyeSpacingPx,
      shoulderWidthPx,
      waistWidthPx,
      headHeightRatio,
      headWidthToHeight,
      eyeHeightFromTopRatio,
      eyeSpacingToHeadWidth,
      shoulderWidthToHeadWidth,
      waistWidthToHeadWidth,
    },
    blenderHints: {
      totalHeight: 1.35,
      headWidth,
      headDepth: 0.36,
      headHeight: 0.42,
      eyeSpacing: clamp(clamp(eyeSpacingToHeadWidth * 0.42, 0.12, 0.28), headWidth * 0.15, headWidth * 0.75),
      eyeZ: clamp(1.35 - eyeHeightFromTopRatio * 0.42, 1.35 - 0.42, 1.22),
      torsoWidth,
      waistWidth: clamp(clamp(waistWidthToHeadWidth * 0.42, 0.18, 0.38), torsoWidth * 0.55, torsoWidth * 1.10),
      legLength: 0.27,
    },
  }
}

export function selectLatestFinalizedJob(jobs: FinalizedJobSummary[]) {
  return jobs
    .filter((job) =>
      job.modelTypeId === 'humanoid/chibi-v1'
      && job.stages.validate.status === 'completed'
      && job.stages.export.status === 'completed')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
}
