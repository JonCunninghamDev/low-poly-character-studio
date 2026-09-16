import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  analyzeCharacterImageUrl,
  persistableCharacterImageAssessment,
  type CharacterBodyPlan,
  type CharacterImageAssessment,
} from './character-image-assessment'
import { LANDMARK_KEYS, humanoidChibiAnalysisAdapter, type HumanoidReferenceAnalysis } from './reference-analysis'
import './reference-workspace.css'

type ReferenceSlotId = 'front' | 'side' | 'back'
type ReferenceSource = 'upload' | 'example'

type ReferenceAsset = {
  slot: ReferenceSlotId
  label: string
  required: boolean
  source: ReferenceSource
  url: string
  fileName: string
  mimeType: string
  sizeBytes: number
  width: number
  height: number
}

type ReferenceSetInput = {
  schemaVersion: 'reference-set/v1'
  modelTypeId: 'humanoid/chibi-v1'
  description?: string
  updatedAt: string
  references: Partial<Record<ReferenceSlotId, Omit<ReferenceAsset, 'url'>>>
}

const MAX_FILE_SIZE = 15 * 1024 * 1024
const SUPPORTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const slots: Array<{ id: ReferenceSlotId; label: string; required: boolean }> = [
  { id: 'front', label: 'Front', required: true },
  { id: 'side', label: 'Side', required: false },
  { id: 'back', label: 'Back', required: false },
]

const examples: Record<ReferenceSlotId, string> = {
  front: '/references/little-guy/front.png',
  side: '/references/little-guy/side.png',
  back: '/references/little-guy/back.png',
}

const bodyPlanLabels: Record<CharacterBodyPlan, string> = {
  'articulated/humanoid-bipedal': 'Humanoid / bipedal',
  'articulated/quadrupedal': 'Quadrupedal',
  'articulated/multi-limbed': 'Multi-limbed',
  'compact/blob-amorphous': 'Blob / amorphous',
  'compact/head-dominant': 'Head-dominant',
  'elongated/serpentine': 'Serpentine / elongated',
  'radial/other': 'Radial / other',
  unknown: 'Unresolved',
}

function readDimensions(url: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('The selected file could not be decoded as an image.'))
    image.src = url
  })
}

function storedDescription() {
  try {
    const stored = localStorage.getItem('low-poly-character-studio.reference-set.v1')
    if (!stored) return ''
    const parsed = JSON.parse(stored) as { description?: unknown }
    return typeof parsed.description === 'string' ? parsed.description : ''
  } catch {
    return ''
  }
}

function toInput(
  references: Partial<Record<ReferenceSlotId, ReferenceAsset>>,
  description: string,
): ReferenceSetInput {
  return {
    schemaVersion: 'reference-set/v1',
    modelTypeId: 'humanoid/chibi-v1',
    description: description.trim() || undefined,
    updatedAt: new Date().toISOString(),
    references: Object.fromEntries(
      Object.entries(references).map(([slot, asset]) => {
        const { url: _url, ...metadata } = asset
        return [slot, metadata]
      })
    ),
  }
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}

function notifyWorkspaceResize() {
  requestAnimationFrame(() => window.dispatchEvent(new Event('low-poly:reference-panel-toggle')))
}

function referenceDrawerInitiallyCollapsed() {
  return new URLSearchParams(window.location.search).get('references') !== 'open'
}

async function clearLandmarkEditor() {
  document.querySelectorAll<HTMLElement>('.imageLayer [data-landmark]').forEach((marker) => {
    marker.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  })
  await nextFrame()
}

async function applyAnalysisToLandmarkEditor(analysis: HumanoidReferenceAnalysis, source: ReferenceAsset) {
  await clearLandmarkEditor()

  const canvas = document.querySelector<HTMLElement>('.canvas')
  const editorImage = document.querySelector<HTMLImageElement>('.imageLayer img')
  if (!canvas || !editorImage) throw new Error('The landmark editor is not ready. Try analysis again after the image appears.')

  const imageRect = editorImage.getBoundingClientRect()
  if (!imageRect.width || !imageRect.height) throw new Error('The front reference is not visible in the landmark editor.')

  for (const key of LANDMARK_KEYS) {
    const point = analysis.landmarks[key]
    const clientX = imageRect.left + (point.x / source.width) * imageRect.width
    const clientY = imageRect.top + (point.y / source.height) * imageRect.height
    canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX, clientY }))
    await nextFrame()
  }
}

function ReferenceWorkspace({ children }: { children: React.ReactNode }) {
  const [references, setReferences] = useState<Partial<Record<ReferenceSlotId, ReferenceAsset>>>({})
  const [description, setDescription] = useState(storedDescription)
  const [errors, setErrors] = useState<Partial<Record<ReferenceSlotId, string>>>({})
  const [genericAnalysis, setGenericAnalysis] = useState<CharacterImageAssessment | null>(null)
  const [analysis, setAnalysis] = useState<HumanoidReferenceAnalysis | null>(null)
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle')
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(referenceDrawerInitiallyCollapsed)
  const inputRefs = useRef<Partial<Record<ReferenceSlotId, HTMLInputElement | null>>>({})
  const referenceInput = useMemo(() => toInput(references, description), [references, description])
  const referenceCount = Object.keys(references).length

  useEffect(() => {
    localStorage.setItem('low-poly-character-studio.reference-set.v1', JSON.stringify(referenceInput))
    window.dispatchEvent(new CustomEvent('low-poly:reference-set-change', { detail: referenceInput }))
  }, [referenceInput])

  useEffect(() => {
    const frontUrl = references.front?.url
    if (!frontUrl) return

    const syncFrontReference = () => {
      const editorImage = document.querySelector<HTMLImageElement>('.imageLayer img')
      if (editorImage && editorImage.src !== frontUrl) editorImage.src = frontUrl
    }

    syncFrontReference()
    const observer = new MutationObserver(syncFrontReference)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [references.front?.url])

  useEffect(() => () => {
    Object.values(references).forEach((asset) => {
      if (asset?.source === 'upload') URL.revokeObjectURL(asset.url)
    })
  }, [references])

  function resetAnalysis() {
    setGenericAnalysis(null)
    setAnalysis(null)
    setAnalysisStatus('idle')
    setAnalysisError(null)
    localStorage.removeItem('low-poly-character-studio.character-image-assessment.v1')
    localStorage.removeItem('low-poly-character-studio.reference-analysis.v1')
  }

  function toggleCollapsed() {
    setCollapsed((current) => !current)
    notifyWorkspaceResize()
  }

  async function selectFile(slot: ReferenceSlotId, file?: File) {
    if (!file) return
    if (!SUPPORTED_TYPES.has(file.type)) {
      setErrors((current) => ({ ...current, [slot]: 'Use a PNG, JPEG, or WebP image.' }))
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setErrors((current) => ({ ...current, [slot]: 'Image must be 15 MB or smaller.' }))
      return
    }

    const url = URL.createObjectURL(file)
    try {
      const dimensions = await readDimensions(url)
      setReferences((current) => {
        const previous = current[slot]
        if (previous?.source === 'upload') URL.revokeObjectURL(previous.url)
        return {
          ...current,
          [slot]: {
            slot,
            label: slots.find((candidate) => candidate.id === slot)!.label,
            required: slot === 'front',
            source: 'upload',
            url,
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            ...dimensions,
          },
        }
      })
      setErrors((current) => ({ ...current, [slot]: undefined }))
      if (slot === 'front') resetAnalysis()
    } catch (error) {
      URL.revokeObjectURL(url)
      setErrors((current) => ({ ...current, [slot]: error instanceof Error ? error.message : 'Invalid image.' }))
    }
  }

  async function loadExamplePreset() {
    const loaded = await Promise.all(slots.map(async (slot) => {
      const dimensions = await readDimensions(examples[slot.id])
      return [slot.id, {
        slot: slot.id,
        label: slot.label,
        required: slot.required,
        source: 'example' as const,
        url: examples[slot.id],
        fileName: `little-guy-${slot.id}.png`,
        mimeType: 'image/png',
        sizeBytes: 0,
        ...dimensions,
      }] as const
    }))
    setReferences(Object.fromEntries(loaded))
    setDescription('A compact humanoid character. It stands upright and moves on two legs.')
    setErrors({})
    resetAnalysis()
  }

  async function analyzeFrontReference() {
    const front = references.front
    if (!front) return
    setAnalysisStatus('running')
    setAnalysisError(null)

    try {
      const generic = await analyzeCharacterImageUrl(front.url, { description })
      setGenericAnalysis(generic)
      const persistedGeneric = persistableCharacterImageAssessment(generic)
      localStorage.setItem('low-poly-character-studio.character-image-assessment.v1', JSON.stringify(persistedGeneric))
      window.dispatchEvent(new CustomEvent('low-poly:character-image-assessment-complete', { detail: persistedGeneric }))

      if (generic.bodyPlan.selected.value === 'articulated/humanoid-bipedal') {
        const humanoid = await humanoidChibiAnalysisAdapter.analyzeImageUrl(front.url)
        await applyAnalysisToLandmarkEditor(humanoid, front)
        setAnalysis(humanoid)
        localStorage.setItem('low-poly-character-studio.reference-analysis.v1', JSON.stringify(humanoid))
        window.dispatchEvent(new CustomEvent('low-poly:reference-analysis-complete', { detail: humanoid }))
      } else {
        await clearLandmarkEditor()
        setAnalysis(null)
        localStorage.removeItem('low-poly-character-studio.reference-analysis.v1')
      }

      setAnalysisStatus('complete')
      setCollapsed(true)
      notifyWorkspaceResize()
    } catch (error) {
      setAnalysisStatus('error')
      setAnalysisError(error instanceof Error ? error.message : 'Reference analysis failed.')
    }
  }

  function remove(slot: ReferenceSlotId) {
    setReferences((current) => {
      const previous = current[slot]
      if (previous?.source === 'upload') URL.revokeObjectURL(previous.url)
      const next = { ...current }
      delete next[slot]
      return next
    })
    if (slot === 'front') resetAnalysis()
    if (inputRefs.current[slot]) inputRefs.current[slot]!.value = ''
  }

  const classifiedPlan = genericAnalysis?.bodyPlan.selected.value ?? 'unknown'
  const classificationSummary = genericAnalysis
    ? `${bodyPlanLabels[classifiedPlan]} · ${genericAnalysis.input.usability.value}`
    : null

  return (
    <div className="referenceWorkspace">
      <section className={collapsed ? 'referenceManager collapsed' : 'referenceManager'} aria-label="Character reference images">
        <div className="referenceManagerHeading">
          <div>
            <h2>Reference set</h2>
            <p>
              {collapsed
                ? `${referenceCount} reference${referenceCount === 1 ? '' : 's'} selected${classificationSummary ? ` · ${classificationSummary}` : ''}`
                : 'Front is required. Side and back improve fidelity. Generic image classification runs before any model-specific interpretation.'}
            </p>
          </div>
          <div className="referenceManagerHeadingActions">
            {!collapsed ? <button type="button" onClick={loadExamplePreset}>Load Little Guy example</button> : null}
            <button type="button" onClick={toggleCollapsed}>{collapsed ? 'Expand references' : 'Collapse references'}</button>
          </div>
        </div>

        <div className="referenceManagerBody">
          <div className="referenceSlots">
            {slots.map((slot) => {
              const asset = references[slot.id]
              return (
                <article className={asset ? 'referenceSlot populated' : 'referenceSlot'} key={slot.id}>
                  <div className="referenceSlotTitle">
                    <strong>{slot.label}</strong>
                    <span>{slot.required ? 'Required' : 'Optional'}</span>
                  </div>
                  {asset ? (
                    <>
                      <img src={asset.url} alt={`${slot.label} reference thumbnail`} />
                      <small>{asset.fileName}</small>
                      <small>{asset.width} × {asset.height} · {asset.source}</small>
                    </>
                  ) : <div className="referencePlaceholder">No image selected</div>}
                  <input
                    ref={(element) => { inputRefs.current[slot.id] = element }}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => selectFile(slot.id, event.currentTarget.files?.[0])}
                  />
                  <div className="referenceSlotActions">
                    <button type="button" onClick={() => inputRefs.current[slot.id]?.click()}>{asset ? 'Replace' : 'Choose image'}</button>
                    {asset ? <button type="button" onClick={() => remove(slot.id)}>Remove</button> : null}
                  </div>
                  {errors[slot.id] ? <p className="referenceError" role="alert">{errors[slot.id]}</p> : null}
                </article>
              )
            })}
          </div>

          <label className="referenceDescription">
            <strong>Describe the character</strong>
            <span>What are we looking at, and anything important we should know about how it should move or work?</span>
            <textarea
              rows={3}
              value={description}
              onChange={(event) => {
                setDescription(event.currentTarget.value)
                resetAnalysis()
              }}
              placeholder="Example: A smiling blob with no arms or legs. It moves by bouncing and faces toward its eyes."
            />
            <small>Your description gives the analyzer direction. It is stored as a user-provided prior, not treated as visual ground truth.</small>
          </label>

          {!references.front ? <p className="referenceRequirement" role="status">Add a front reference before analysis.</p> : (
            <section className="referenceAnalysis" aria-label="Automated reference analysis">
              <div>
                <strong>Assess character</strong>
                <p>Assess image quality, isolate the subject, infer orientation and body plan, observe features, then decide whether a supported model-specific analysis should run.</p>
              </div>
              <button type="button" onClick={analyzeFrontReference} disabled={analysisStatus === 'running'}>
                {analysisStatus === 'running' ? 'Assessing…' : genericAnalysis ? 'Assess again' : 'Assess image'}
              </button>

              {genericAnalysis ? (
                <div className={`analysisSummary ${genericAnalysis.decision.outcome}`} role="status">
                  <strong>{bodyPlanLabels[classifiedPlan]}</strong>
                  <p>Image quality: {genericAnalysis.input.usability.value}. Facing: {genericAnalysis.orientation.facing.value}. Suggested movement: {genericAnalysis.functional.locomotionHint.value}.</p>
                  <p>{genericAnalysis.decision.reason}</p>
                  {classifiedPlan !== 'articulated/humanoid-bipedal' && classifiedPlan !== 'unknown' ? (
                    <p>Model-specific humanoid landmark mapping was intentionally skipped. A compatible model type can consume this generic assessment later.</p>
                  ) : null}
                  {classifiedPlan === 'unknown' ? (
                    <p>The classifier abstained rather than forcing a model type. The candidate evidence remains available for review or another image-analysis provider.</p>
                  ) : null}
                </div>
              ) : null}

              {analysis ? (
                <div className={`analysisSummary ${analysis.confidence.level}`} role="status">
                  <strong>Humanoid mapping: {Math.round(analysis.confidence.overall * 100)}% {analysis.confidence.level} confidence</strong>
                  {analysis.warnings.map((warning) => <p key={warning.code}>{warning.message}</p>)}
                </div>
              ) : null}

              {analysisError ? <p className="referenceError" role="alert">{analysisError} Uploaded references and description were preserved; correct the input or retry.</p> : null}
            </section>
          )}

          <details>
            <summary>Versioned job input</summary>
            <pre>{JSON.stringify(referenceInput, null, 2)}</pre>
          </details>
          {genericAnalysis ? (
            <details>
              <summary>Generic image assessment</summary>
              <pre>{JSON.stringify(persistableCharacterImageAssessment(genericAnalysis), null, 2)}</pre>
            </details>
          ) : null}
          {analysis ? (
            <details>
              <summary>Humanoid-specific analysis</summary>
              <pre>{JSON.stringify(analysis, null, 2)}</pre>
            </details>
          ) : null}
        </div>
      </section>
      {children}
    </div>
  )
}

export { ReferenceWorkspace }
export type { ReferenceSetInput }
