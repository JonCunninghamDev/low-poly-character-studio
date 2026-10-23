export const MAX_REFERENCE_DESCRIPTION_LENGTH = 2000

/** A user's decision is separate from machine observations of the image. */
export type ReferenceIntent = {
  schemaVersion: 'reference-intent/v1'
  referenceId: string
  origin: 'user-provided'
  decision: 'described' | 'skipped'
  description?: string
  decidedAt: string
}

export function createReferenceIntent(referenceId: string, decision: ReferenceIntent['decision'], description: string): ReferenceIntent {
  const text = description.trim()
  if (typeof referenceId !== 'string' || !referenceId || (decision !== 'described' && decision !== 'skipped')) throw new Error('Choose a reference and description decision first.')
  if (decision === 'described' && (!text || text.length > MAX_REFERENCE_DESCRIPTION_LENGTH)) {
    throw new Error(`Describe the reference in 1–${MAX_REFERENCE_DESCRIPTION_LENGTH} characters, or explicitly analyze without a description.`)
  }
  return {
    schemaVersion: 'reference-intent/v1', referenceId, origin: 'user-provided', decision,
    ...(decision === 'described' ? { description: text } : {}),
    decidedAt: new Date().toISOString(),
  }
}

export function isCurrentReferenceIntent(value: unknown, referenceId: unknown): value is ReferenceIntent {
  if (!value || typeof value !== 'object' || typeof referenceId !== 'string' || !referenceId) return false
  const intent = value as Partial<ReferenceIntent>
  if (intent.schemaVersion !== 'reference-intent/v1' || intent.referenceId !== referenceId || intent.origin !== 'user-provided'
    || typeof intent.decidedAt !== 'string' || !Number.isFinite(Date.parse(intent.decidedAt))) return false
  if (intent.decision === 'skipped') return intent.description === undefined
  return intent.decision === 'described' && typeof intent.description === 'string'
    && Boolean(intent.description.trim()) && intent.description.length <= MAX_REFERENCE_DESCRIPTION_LENGTH
}
