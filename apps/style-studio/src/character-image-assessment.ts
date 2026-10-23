export type RasterImage = {
  width: number
  height: number
  data: Uint8ClampedArray
}

export type RubricLevel = 0 | 1 | 2 | 3 | 4
export type ImageDirection = 'up' | 'down' | 'left' | 'right' | 'unknown'
export type GroundDirection = 'bottom' | 'top' | 'left' | 'right' | 'unknown'

export type CharacterBodyPlan =
  | 'articulated/humanoid-bipedal'
  | 'articulated/quadrupedal'
  | 'articulated/multi-limbed'
  | 'compact/blob-amorphous'
  | 'compact/head-dominant'
  | 'elongated/serpentine'
  | 'radial/other'
  | 'unknown'

export type AssessmentEvidence<T> = {
  value: T | null
  confidence: number | null
  rubricLevel: RubricLevel
  origin: 'measured' | 'inferred' | 'user-provided' | 'unavailable'
  note?: string
}

type Bounds = { left: number; top: number; right: number; bottom: number }
type Component = { area: number; left: number; top: number; right: number; bottom: number; centerX: number; centerY: number }
type SupportDirection = Exclude<GroundDirection, 'unknown'>
type SupportMetrics = { direction: SupportDirection; splitRatio: number; maxSupports: number }

type ForegroundWorkingSet = {
  mask: Uint8Array
  foregroundCount: number
  averageSeparation: number
  averageForegroundLuminance: number
  threshold: number
  maxDistance: number
}

export type CharacterInputAssessment = {
  usability: AssessmentEvidence<'usable' | 'limited' | 'unusable'>
  subjectVisibility: AssessmentEvidence<number>
  backgroundSeparation: AssessmentEvidence<number>
  foreground: ForegroundWorkingSet
}

export type CharacterSubjectAssessment = {
  available: boolean
  bounds: Bounds | null
  center: { x: number; y: number } | null
  coverage: number
  compactness: number
  widthToHeight: number
  support: SupportMetrics | null
}

export type CharacterFeatureAssessment = {
  bodyCore: AssessmentEvidence<boolean>
  face: AssessmentEvidence<boolean>
  eyes: AssessmentEvidence<number>
  mouth: AssessmentEvidence<boolean>
  lowerSupports: AssessmentEvidence<number>
}

export type CharacterOrientationAssessment = {
  facing: AssessmentEvidence<'front' | 'side' | 'back' | 'unknown'>
  imageUp: AssessmentEvidence<ImageDirection>
  groundDirection: AssessmentEvidence<GroundDirection>
}

export type CharacterBodyPlanAssessment = {
  selected: AssessmentEvidence<CharacterBodyPlan>
  candidates: Array<{
    id: CharacterBodyPlan
    confidence: number
    rubricLevel: RubricLevel
    evidence: string[]
    contradictions: string[]
  }>
}

export type CharacterFunctionalAssessment = {
  rootCore: AssessmentEvidence<boolean>
  supportMode: AssessmentEvidence<'limbed' | 'body-contact' | 'unknown'>
  locomotionHint: AssessmentEvidence<'walk' | 'bounce-squash' | 'slither' | 'unknown'>
}

export type CharacterImageAssessment = {
  schemaVersion: 'character-image-assessment/v1'
  adapterId: 'generic-local-silhouette-v2'
  input: CharacterInputAssessment
  subject: CharacterSubjectAssessment
  features: CharacterFeatureAssessment
  orientation: CharacterOrientationAssessment
  bodyPlan: CharacterBodyPlanAssessment
  functional: CharacterFunctionalAssessment
  userPrior?: {
    description: string
    suggestedBodyPlan: CharacterBodyPlan | null
    confidence: number
  }
  decision: {
    outcome: 'classified' | 'unresolved'
    reason: string
  }
}

export type PersistedCharacterImageAssessment = Omit<CharacterImageAssessment, 'input'> & {
  input: Omit<CharacterInputAssessment, 'foreground'>
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function rubricLevel(confidence: number): RubricLevel {
  if (confidence >= 0.9) return 4
  if (confidence >= 0.72) return 3
  if (confidence >= 0.5) return 2
  if (confidence > 0) return 1
  return 0
}

function pixelAt(image: RasterImage, x: number, y: number) {
  const offset = (y * image.width + x) * 4
  return [image.data[offset], image.data[offset + 1], image.data[offset + 2], image.data[offset + 3]] as const
}

function luminance(rgb: readonly number[]) {
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
}

function colorDistance(a: readonly number[], b: readonly number[]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

function estimateBackground(image: RasterImage): [number, number, number] {
  const samples = [
    pixelAt(image, 0, 0),
    pixelAt(image, image.width - 1, 0),
    pixelAt(image, 0, image.height - 1),
    pixelAt(image, image.width - 1, image.height - 1),
  ]
  return [0, 1, 2].map((channel) =>
    Math.round(samples.reduce((sum, sample) => sum + sample[channel], 0) / samples.length)
  ) as [number, number, number]
}

export function assessCharacterInput(image: RasterImage): CharacterInputAssessment {
  if (image.width < 16 || image.height < 16 || image.data.length !== image.width * image.height * 4) {
    throw new Error('Reference raster must be at least 16 × 16 pixels with RGBA data.')
  }

  const background = estimateBackground(image)
  let maxDistance = 0
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const pixel = pixelAt(image, x, y)
      if (pixel[3] < 24) continue
      maxDistance = Math.max(maxDistance, colorDistance(pixel, background))
    }
  }

  const threshold = maxDistance >= 8 ? Math.max(7, Math.min(34, maxDistance * 0.55)) : Number.POSITIVE_INFINITY
  const mask = new Uint8Array(image.width * image.height)
  let foregroundCount = 0
  let separationSum = 0
  let foregroundLuminance = 0

  if (Number.isFinite(threshold)) {
    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        const pixel = pixelAt(image, x, y)
        if (pixel[3] < 24) continue
        const distance = colorDistance(pixel, background)
        if (distance < threshold) continue
        mask[y * image.width + x] = 1
        foregroundCount += 1
        separationSum += distance
        foregroundLuminance += luminance(pixel)
      }
    }
  }

  const coverage = foregroundCount / (image.width * image.height)
  const averageSeparation = foregroundCount ? separationSum / foregroundCount : 0
  const visibilityConfidence = clamp(coverage / 0.18)
  const separationConfidence = clamp((averageSeparation - 8) / 54)
  const usable = foregroundCount > 0 && visibilityConfidence >= 0.35 && separationConfidence >= 0.35
  const limited = foregroundCount > 0 && !usable
  const usability = usable ? 'usable' : limited ? 'limited' : 'unusable'
  const usabilityConfidence = usable
    ? Math.min(visibilityConfidence, separationConfidence)
    : limited
      ? Math.max(0.35, separationConfidence)
      : 1

  return {
    usability: {
      value: usability,
      confidence: usabilityConfidence,
      rubricLevel: usable ? rubricLevel(usabilityConfidence) : limited ? 1 : 0,
      origin: 'measured',
      note: limited
        ? 'A subject can be separated, but image quality is below the classification gate.'
        : usability === 'unusable'
          ? 'No reliable foreground subject could be isolated.'
          : undefined,
    },
    subjectVisibility: { value: coverage, confidence: visibilityConfidence, rubricLevel: 4, origin: 'measured' },
    backgroundSeparation: { value: averageSeparation, confidence: separationConfidence, rubricLevel: 4, origin: 'measured' },
    foreground: {
      mask,
      foregroundCount,
      averageSeparation,
      averageForegroundLuminance: foregroundCount ? foregroundLuminance / foregroundCount : 0,
      threshold,
      maxDistance,
    },
  }
}

function boundsForMask(mask: Uint8Array, width: number, height: number): Bounds | null {
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }
  return right >= left && bottom >= top ? { left, top, right, bottom } : null
}

function rowRuns(mask: Uint8Array, width: number, y: number, left: number, right: number) {
  let runs = 0
  let active = false
  for (let x = left; x <= right; x += 1) {
    const foreground = mask[y * width + x] === 1
    if (foreground && !active) runs += 1
    active = foreground
  }
  return runs
}

function columnRuns(mask: Uint8Array, width: number, x: number, top: number, bottom: number) {
  let runs = 0
  let active = false
  for (let y = top; y <= bottom; y += 1) {
    const foreground = mask[y * width + x] === 1
    if (foreground && !active) runs += 1
    active = foreground
  }
  return runs
}

function supportToward(mask: Uint8Array, width: number, bounds: Bounds, direction: SupportDirection): SupportMetrics {
  const subjectWidth = bounds.right - bounds.left + 1
  const subjectHeight = bounds.bottom - bounds.top + 1
  let samples = 0
  let splitSamples = 0
  let maxSupports = 1

  if (direction === 'bottom' || direction === 'top') {
    const start = Math.round(bounds.top + subjectHeight * (direction === 'bottom' ? 0.62 : 0.04))
    const end = Math.round(bounds.top + subjectHeight * (direction === 'bottom' ? 0.96 : 0.38))
    for (let y = start; y <= end; y += 1) {
      const runs = rowRuns(mask, width, y, bounds.left, bounds.right)
      if (!runs) continue
      samples += 1
      if (runs >= 2) splitSamples += 1
      maxSupports = Math.max(maxSupports, runs)
    }
  } else {
    const start = Math.round(bounds.left + subjectWidth * (direction === 'right' ? 0.62 : 0.04))
    const end = Math.round(bounds.left + subjectWidth * (direction === 'right' ? 0.96 : 0.38))
    for (let x = start; x <= end; x += 1) {
      const runs = columnRuns(mask, width, x, bounds.top, bounds.bottom)
      if (!runs) continue
      samples += 1
      if (runs >= 2) splitSamples += 1
      maxSupports = Math.max(maxSupports, runs)
    }
  }

  return { direction, splitRatio: samples ? splitSamples / samples : 0, maxSupports }
}

function bestSupport(mask: Uint8Array, width: number, bounds: Bounds) {
  return (['bottom', 'top', 'left', 'right'] as const)
    .map((direction) => supportToward(mask, width, bounds, direction))
    .sort((a, b) => (b.splitRatio + (b.maxSupports - 1) * 0.12) - (a.splitRatio + (a.maxSupports - 1) * 0.12))[0]
}

export function isolateCharacterSubject(image: RasterImage, input: CharacterInputAssessment): CharacterSubjectAssessment {
  const bounds = boundsForMask(input.foreground.mask, image.width, image.height)
  if (!bounds) {
    return { available: false, bounds: null, center: null, coverage: 0, compactness: 0, widthToHeight: 0, support: null }
  }

  const subjectWidth = bounds.right - bounds.left + 1
  const subjectHeight = bounds.bottom - bounds.top + 1
  return {
    available: true,
    bounds,
    center: { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 },
    coverage: input.foreground.foregroundCount / (image.width * image.height),
    compactness: input.foreground.foregroundCount / (subjectWidth * subjectHeight),
    widthToHeight: subjectWidth / subjectHeight,
    support: bestSupport(input.foreground.mask, image.width, bounds),
  }
}

function darkComponents(image: RasterImage, input: CharacterInputAssessment, bounds: Bounds): Component[] {
  const mask = input.foreground.mask
  const visited = new Uint8Array(image.width * image.height)
  const darknessThreshold = input.foreground.averageForegroundLuminance - 42
  const area = (bounds.right - bounds.left + 1) * (bounds.bottom - bounds.top + 1)
  const minArea = Math.max(2, Math.round(area * 0.0008))
  const maxArea = Math.max(minArea + 1, Math.round(area * 0.08))
  const components: Component[] = []

  const candidate = (x: number, y: number) =>
    x > bounds.left && x < bounds.right && y > bounds.top && y < bounds.bottom &&
    mask[y * image.width + x] === 1 && luminance(pixelAt(image, x, y)) <= darknessThreshold

  for (let y = bounds.top + 1; y < bounds.bottom; y += 1) {
    for (let x = bounds.left + 1; x < bounds.right; x += 1) {
      const index = y * image.width + x
      if (visited[index] || !candidate(x, y)) continue
      const queue: Array<[number, number]> = [[x, y]]
      visited[index] = 1
      let cursor = 0
      let componentArea = 0
      let left = x
      let right = x
      let top = y
      let bottom = y
      let sumX = 0
      let sumY = 0

      while (cursor < queue.length) {
        const [cx, cy] = queue[cursor++]
        componentArea += 1
        sumX += cx
        sumY += cy
        left = Math.min(left, cx)
        right = Math.max(right, cx)
        top = Math.min(top, cy)
        bottom = Math.max(bottom, cy)
        for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]] as const) {
          if (nx < 0 || nx >= image.width || ny < 0 || ny >= image.height) continue
          const next = ny * image.width + nx
          if (visited[next] || !candidate(nx, ny)) continue
          visited[next] = 1
          queue.push([nx, ny])
        }
      }

      if (componentArea >= minArea && componentArea <= maxArea) {
        components.push({ componentArea, area: componentArea, left, right, top, bottom, centerX: sumX / componentArea, centerY: sumY / componentArea } as Component)
      }
    }
  }

  return components
}

function inferFace(components: Component[], bounds: Bounds) {
  const width = bounds.right - bounds.left + 1
  const height = bounds.bottom - bounds.top + 1
  const upper = components.filter((component) => component.centerY <= bounds.top + height * 0.68)
  const pairs: Array<[Component, Component]> = []

  for (let i = 0; i < upper.length; i += 1) {
    for (let j = i + 1; j < upper.length; j += 1) {
      const a = upper[i]
      const b = upper[j]
      const yDelta = Math.abs(a.centerY - b.centerY) / height
      const xDelta = Math.abs(a.centerX - b.centerX) / width
      if (yDelta <= 0.08 && xDelta >= 0.12 && xDelta <= 0.65) pairs.push([a, b])
    }
  }

  const eyes = pairs.sort((a, b) => Math.abs(a[0].centerY - a[1].centerY) - Math.abs(b[0].centerY - b[1].centerY))[0]
  if (!eyes) return { hasFace: false, eyeCount: 0, hasMouth: false, confidence: 0 }

  const eyeY = (eyes[0].centerY + eyes[1].centerY) / 2
  const mouth = components.find((component) => {
    const componentWidth = component.right - component.left + 1
    const componentHeight = component.bottom - component.top + 1
    return component.centerY > eyeY + height * 0.05 &&
      component.centerY < bounds.top + height * 0.8 &&
      componentWidth >= componentHeight * 1.35
  })
  return { hasFace: true, eyeCount: 2, hasMouth: Boolean(mouth), confidence: mouth ? 0.88 : 0.72 }
}

export function observeCharacterFeatures(
  image: RasterImage,
  input: CharacterInputAssessment,
  subject: CharacterSubjectAssessment,
): CharacterFeatureAssessment {
  if (!subject.available || !subject.bounds) {
    return {
      bodyCore: { value: false, confidence: 1, rubricLevel: 0, origin: 'unavailable' },
      face: { value: false, confidence: 1, rubricLevel: 0, origin: 'unavailable' },
      eyes: { value: 0, confidence: 1, rubricLevel: 0, origin: 'unavailable' },
      mouth: { value: false, confidence: 1, rubricLevel: 0, origin: 'unavailable' },
      lowerSupports: { value: 0, confidence: 1, rubricLevel: 0, origin: 'unavailable' },
    }
  }

  const face = inferFace(darkComponents(image, input, subject.bounds), subject.bounds)
  const supportCount = subject.support?.maxSupports ?? 1
  const supportConfidence = clamp((subject.support?.splitRatio ?? 0) + (supportCount > 1 ? 0.25 : 0))

  return {
    bodyCore: { value: true, confidence: 0.98, rubricLevel: 4, origin: 'measured' },
    face: { value: face.hasFace, confidence: face.hasFace ? face.confidence : 0.35, rubricLevel: face.hasFace ? rubricLevel(face.confidence) : 1, origin: face.hasFace ? 'inferred' : 'unavailable' },
    eyes: { value: face.eyeCount, confidence: face.hasFace ? face.confidence : 0.25, rubricLevel: face.hasFace ? rubricLevel(face.confidence) : 1, origin: face.hasFace ? 'inferred' : 'unavailable' },
    mouth: { value: face.hasMouth, confidence: face.hasMouth ? face.confidence : face.hasFace ? 0.45 : 0.2, rubricLevel: face.hasMouth ? rubricLevel(face.confidence) : 1, origin: face.hasMouth ? 'inferred' : 'unavailable' },
    lowerSupports: { value: supportCount, confidence: supportConfidence, rubricLevel: 4, origin: 'measured' },
  }
}

function imageUpForGround(direction: GroundDirection): ImageDirection {
  if (direction === 'bottom') return 'up'
  if (direction === 'top') return 'down'
  if (direction === 'left') return 'right'
  if (direction === 'right') return 'left'
  return 'unknown'
}

export function assessCharacterOrientation(
  features: CharacterFeatureAssessment,
  subject: CharacterSubjectAssessment,
): CharacterOrientationAssessment {
  const support = subject.support
  const supportReliable = Boolean(support && support.maxSupports >= 2 && support.splitRatio >= 0.14)
  const ground = supportReliable ? support!.direction : 'unknown'
  const groundConfidence = supportReliable ? clamp(support!.splitRatio + (support!.maxSupports - 1) * 0.1) : 0.2
  const faceConfidence = features.face.value ? features.face.confidence ?? 0.7 : 0.2

  return {
    facing: features.face.value
      ? { value: 'front', confidence: faceConfidence, rubricLevel: rubricLevel(faceConfidence), origin: 'inferred', note: 'Paired eye-like marks support a front-facing interpretation.' }
      : { value: 'unknown', confidence: 0.2, rubricLevel: 1, origin: 'unavailable', note: 'No reliable face-orientation cue detected.' },
    groundDirection: supportReliable
      ? { value: ground, confidence: groundConfidence, rubricLevel: rubricLevel(groundConfidence), origin: 'inferred' }
      : { value: 'unknown', confidence: 0.2, rubricLevel: 1, origin: 'unavailable' },
    imageUp: supportReliable
      ? { value: imageUpForGround(ground), confidence: groundConfidence, rubricLevel: rubricLevel(groundConfidence), origin: 'inferred' }
      : { value: 'unknown', confidence: 0.2, rubricLevel: 1, origin: 'unavailable' },
  }
}

function userPrior(description?: string): CharacterImageAssessment['userPrior'] {
  const cleaned = description?.trim()
  if (!cleaned) return undefined
  const text = cleaned.toLowerCase()
  let suggestedBodyPlan: CharacterBodyPlan | null = null
  if (/\b(blob|slime|amorphous|goo|jelly)\b/.test(text)) suggestedBodyPlan = 'compact/blob-amorphous'
  else if (/\b(human|humanoid|person|biped|two[- ]legged)\b/.test(text)) suggestedBodyPlan = 'articulated/humanoid-bipedal'
  else if (/\b(quadruped|four[- ]legged|dog|cat|horse|wolf)\b/.test(text)) suggestedBodyPlan = 'articulated/quadrupedal'
  else if (/\b(snake|serpent|worm|eel)\b/.test(text)) suggestedBodyPlan = 'elongated/serpentine'
  return { description: cleaned, suggestedBodyPlan, confidence: suggestedBodyPlan ? 0.72 : 0.25 }
}

export function assessCharacterBodyPlan(
  input: CharacterInputAssessment,
  subject: CharacterSubjectAssessment,
  prior?: CharacterImageAssessment['userPrior'],
): CharacterBodyPlanAssessment {
  if (!subject.available || !subject.bounds) {
    return { selected: { value: 'unknown', confidence: null, rubricLevel: 0, origin: 'unavailable' }, candidates: [] }
  }

  const support = subject.support
  const splitRatio = support?.splitRatio ?? 0
  const supportCount = support?.maxSupports ?? 1
  const verticalGroundAxis = support?.direction === 'bottom' || support?.direction === 'top'
  const orientedTallness = verticalGroundAxis
    ? 1 / subject.widthToHeight
    : support
      ? subject.widthToHeight
      : Math.max(subject.widthToHeight, 1 / subject.widthToHeight)
  const maxAspect = Math.max(subject.widthToHeight, 1 / subject.widthToHeight)

  const humanoidScore = clamp((orientedTallness - 1.05) * 0.45 + splitRatio * 0.72 + (supportCount === 2 ? 0.12 : 0) - (supportCount >= 3 ? 0.3 : 0))
  const blobBase = clamp((1 - Math.abs(subject.widthToHeight - 1) / 0.75) * 0.48 + subject.compactness * 0.42 + (1 - splitRatio) * 0.28)
  const blobScore = clamp(blobBase * (supportCount <= 1 ? 1 : 0.72))
  const quadrupedScore = clamp(
    (verticalGroundAxis ? subject.widthToHeight - 0.95 : (1 / Math.max(subject.widthToHeight, 1e-6)) - 0.95) * 0.5 +
    (supportCount >= 3 ? 0.55 : 0) + splitRatio * 0.2
  )
  const serpentineScore = clamp((maxAspect - 1.8) * 0.45 + (1 - splitRatio) * 0.18 - (supportCount >= 2 ? 0.2 : 0))

  const candidates = [
    {
      id: 'articulated/humanoid-bipedal' as const,
      score: humanoidScore,
      evidence: [
        ...(orientedTallness > 1.3 ? ['elongated body axis after orientation normalization'] : []),
        ...(splitRatio > 0.28 ? ['support-side silhouette repeatedly separates'] : []),
        ...(supportCount === 2 ? ['two support regions detected'] : []),
      ],
      contradictions: [
        ...(splitRatio < 0.12 ? ['no stable support separation detected'] : []),
        ...(supportCount >= 3 ? ['three or more supports contradict the initial bipedal heuristic'] : []),
      ],
    },
    {
      id: 'compact/blob-amorphous' as const,
      score: blobScore,
      evidence: [
        ...(subject.compactness > 0.58 ? ['silhouette densely fills its bounding region'] : []),
        ...(splitRatio < 0.12 ? ['no stable limb/support separation detected'] : []),
        ...(maxAspect < 1.6 ? ['compact overall proportion'] : []),
      ],
      contradictions: [
        ...(splitRatio > 0.35 ? ['strong support separation suggests articulated limbs'] : []),
        ...(supportCount >= 3 ? ['several support regions detected'] : []),
      ],
    },
    {
      id: 'articulated/quadrupedal' as const,
      score: quadrupedScore,
      evidence: [
        ...(supportCount >= 3 ? ['three or more support regions detected'] : []),
        ...(splitRatio > 0.25 ? ['support-side silhouette repeatedly separates'] : []),
      ],
      contradictions: [...(supportCount <= 1 ? ['no separated support regions detected'] : [])],
    },
    {
      id: 'elongated/serpentine' as const,
      score: serpentineScore,
      evidence: [
        ...(maxAspect > 2 ? ['strongly elongated silhouette'] : []),
        ...(splitRatio < 0.1 ? ['silhouette lacks stable support separation'] : []),
      ],
      contradictions: [...(supportCount >= 2 ? ['multiple support regions detected'] : [])],
    },
  ]

  if (prior?.suggestedBodyPlan) {
    const candidate = candidates.find((item) => item.id === prior.suggestedBodyPlan)
    if (candidate) {
      candidate.score = clamp(candidate.score + 0.12)
      candidate.evidence.push('user description supplies a weak directional prior')
    }
  }

  const ranked = candidates
    .map((candidate) => ({
      id: candidate.id,
      confidence: Number(candidate.score.toFixed(3)),
      rubricLevel: rubricLevel(candidate.score),
      evidence: candidate.evidence,
      contradictions: candidate.contradictions,
    }))
    .sort((a, b) => b.confidence - a.confidence)

  const top = ranked[0]
  const second = ranked[1]
  const separation = top.confidence - second.confidence
  const qualityGate = input.usability.value === 'usable'
  const classified = qualityGate && top.confidence >= 0.58 && separation >= 0.08

  return {
    selected: classified
      ? { value: top.id, confidence: top.confidence, rubricLevel: rubricLevel(top.confidence), origin: 'inferred' }
      : {
          value: 'unknown',
          confidence: Math.min(top.confidence, 0.49),
          rubricLevel: qualityGate ? 1 : 0,
          origin: 'inferred',
          note: qualityGate
            ? 'Top morphology candidates are not sufficiently separated; abstaining.'
            : 'Image quality does not meet the morphology classification gate.',
        },
    candidates: ranked,
  }
}

export function inferCharacterFunction(
  bodyPlan: CharacterBodyPlanAssessment,
  subject: CharacterSubjectAssessment,
): CharacterFunctionalAssessment {
  const selected = bodyPlan.selected.value
  const supportCount = subject.support?.maxSupports ?? 0
  const limbed = selected === 'articulated/humanoid-bipedal' || selected === 'articulated/quadrupedal' || supportCount >= 2
  const bodyContact = selected === 'compact/blob-amorphous' || selected === 'elongated/serpentine'
  const locomotion: 'walk' | 'bounce-squash' | 'slither' | 'unknown' =
    selected === 'compact/blob-amorphous' ? 'bounce-squash' :
      selected === 'elongated/serpentine' ? 'slither' :
        limbed ? 'walk' : 'unknown'

  return {
    rootCore: subject.available
      ? { value: true, confidence: 0.9, rubricLevel: 4, origin: 'inferred' }
      : { value: false, confidence: 1, rubricLevel: 0, origin: 'unavailable' },
    supportMode: limbed
      ? { value: 'limbed', confidence: 0.7, rubricLevel: 2, origin: 'inferred' }
      : bodyContact
        ? { value: 'body-contact', confidence: 0.7, rubricLevel: 2, origin: 'inferred' }
        : { value: 'unknown', confidence: 0.2, rubricLevel: 1, origin: 'unavailable' },
    locomotionHint: locomotion === 'unknown'
      ? { value: 'unknown', confidence: 0.2, rubricLevel: 1, origin: 'unavailable' }
      : { value: locomotion, confidence: 0.62, rubricLevel: 2, origin: 'inferred', note: 'Functional hypothesis only; capability confirmation happens later.' },
  }
}

export function analyzeCharacterRaster(image: RasterImage, options: { description?: string } = {}): CharacterImageAssessment {
  const input = assessCharacterInput(image)
  const subject = isolateCharacterSubject(image, input)
  const features = observeCharacterFeatures(image, input, subject)
  const orientation = assessCharacterOrientation(features, subject)
  const prior = userPrior(options.description)
  const bodyPlan = assessCharacterBodyPlan(input, subject, prior)
  const functional = inferCharacterFunction(bodyPlan, subject)
  const top = bodyPlan.candidates[0]
  const second = bodyPlan.candidates[1]
  const classified = bodyPlan.selected.value !== 'unknown'

  const reason = classified
    ? `${bodyPlan.selected.value} is supported at confidence ${(bodyPlan.selected.confidence ?? 0).toFixed(3)} after image-quality and ambiguity gates.`
    : input.usability.value !== 'usable'
      ? `Image quality is ${input.usability.value}; preserve candidate evidence but do not select a body plan.`
      : top && second
        ? `Morphology evidence is ambiguous (${top.id} ${top.confidence.toFixed(3)} vs ${second.id} ${second.confidence.toFixed(3)}); no model type should be selected yet.`
        : 'No usable morphology evidence is available.'

  return {
    schemaVersion: 'character-image-assessment/v1',
    adapterId: 'generic-local-silhouette-v2',
    input,
    subject,
    features,
    orientation,
    bodyPlan,
    functional,
    userPrior: prior,
    decision: { outcome: classified ? 'classified' : 'unresolved', reason },
  }
}

export function persistableCharacterImageAssessment(
  assessment: CharacterImageAssessment,
): PersistedCharacterImageAssessment {
  const { foreground: _foreground, ...input } = assessment.input
  return { ...assessment, input }
}

export async function analyzeCharacterImageUrl(
  url: string,
  options: { description?: string; maxDimension?: number } = {},
): Promise<CharacterImageAssessment> {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('The reference image could not be decoded for generic assessment.'))
    image.src = url
  })

  const maxDimension = options.maxDimension ?? 512
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(16, Math.round(image.naturalWidth * scale))
  const height = Math.max(16, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas image assessment is unavailable in this browser.')
  context.drawImage(image, 0, 0, width, height)
  const raster = context.getImageData(0, 0, width, height)
  return analyzeCharacterRaster({ width, height, data: raster.data }, { description: options.description })
}
