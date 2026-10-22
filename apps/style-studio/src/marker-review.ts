import { HUMANOID_LANDMARK_KEYS, buildHumanoidStyleDna, type HumanoidLandmarkKey, type Point } from './final-build-workflow'

export const MARKER_REVIEW_KEY = 'low-poly-character-studio.marker-review.v1'

export function reviewMarkers(landmarks: Partial<Record<HumanoidLandmarkKey, Point>>, imageSize: { width: number; height: number }) {
  const missing = HUMANOID_LANDMARK_KEYS.filter((key) => !landmarks[key])
  const invalid = HUMANOID_LANDMARK_KEYS.filter((key) => {
    const point = landmarks[key]
    return point && (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.y < 0 || point.x > imageSize.width || point.y > imageSize.height)
  })
  let error = missing.length ? `Place missing markers: ${missing.join(', ')}.` : invalid.length ? `Move markers inside the image: ${invalid.join(', ')}.` : ''
  if (!error) {
    try {
      if (!(imageSize.width > 0 && imageSize.height > 0)) throw new Error('Load a reference image first.')
      buildHumanoidStyleDna({ source: 'marker-review', imageSize, landmarks })
      if (landmarks.HeadTop!.y >= landmarks.Chin!.y || landmarks.Chin!.y >= landmarks.FeetBottom!.y) throw new Error('Head top, chin, and feet must run from top to bottom.')
      for (const [left, right] of [['HeadLeft', 'HeadRight'], ['EyeLeft', 'EyeRight'], ['ShoulderLeft', 'ShoulderRight'], ['WaistLeft', 'WaistRight']] as const) {
        if (landmarks[left]!.x >= landmarks[right]!.x) throw new Error(`${left} must be to the image-left of ${right}.`)
      }
    } catch (cause) { error = cause instanceof Error ? cause.message : 'Check marker positions.' }
  }
  return { missing, invalid, placed: HUMANOID_LANDMARK_KEYS.length - missing.length, total: HUMANOID_LANDMARK_KEYS.length, valid: !error, error }
}

export function readConfirmedStyleDna(value: string | null) {
  if (!value) throw new Error('Review and confirm markers before generation.')
  const review = JSON.parse(value)
  if (review.schemaVersion !== 'marker-review/v1' || !review.confirmedAt || !review.styleDna) throw new Error('Review and confirm markers before generation.')
  const { source, imageSize, landmarks } = review.styleDna
  const result = reviewMarkers(landmarks, imageSize)
  if (!result.valid) throw new Error(result.error)
  return buildHumanoidStyleDna({ source, imageSize, landmarks })
}
