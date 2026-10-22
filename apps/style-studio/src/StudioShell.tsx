import React, { useEffect, useMemo, useState } from 'react'
import { modelTypeRegistry } from '../../../packages/model-types/src/registry'
import type { ModelTypeManifest } from '../../../packages/model-types/src/types'
import { App } from './App'
import { ModelTypeCatalog } from './ModelTypeCatalog'
import { ReferenceWorkspace } from './ReferenceWorkspace'
import { VerticalSliceBuildWorkflow, type GuidedBuildStep } from './VerticalSliceBuildWorkflow'
import { VerticalSliceReadinessPanel } from './VerticalSliceReadiness'
import { MARKER_REVIEW_KEY } from './marker-review'
import './responsive-studio.css'
import './responsive-studio-mobile.css'
import './vertical-slice-readiness.css'
import './guided-studio-shell.css'

const MODEL_TYPE_STORAGE_KEY = 'low-poly-character-studio.model-type.v1'
const REFERENCE_SET_STORAGE_KEY = 'low-poly-character-studio.reference-set.v1'
const REFERENCE_ANALYSIS_STORAGE_KEY = 'low-poly-character-studio.reference-analysis.v1'
const DIRECT_PAN_THRESHOLD = 6

const WORKFLOW_STEPS = [
  'Choose character type',
  'Add reference images',
  'Place markers',
  'Review character shape',
  'Generate character',
  'Rig and animate',
  'Review and export',
] as const

type WorkflowStep = typeof WORKFLOW_STEPS[number]
type StepState = 'completed' | 'current' | 'available' | 'warning' | 'future'
type ReferenceSetSnapshot = { references?: { front?: unknown } }
type DirectPanPointerEvent = PointerEvent & { __lowPolyDirectPanProxy?: boolean }

function initialModelType(): ModelTypeManifest | null {
  const requestedId = new URLSearchParams(window.location.search).get('modelType')
    ?? localStorage.getItem(MODEL_TYPE_STORAGE_KEY)
  return requestedId ? modelTypeRegistry.get(requestedId) ?? null : null
}

function hasFrontReference() {
  try {
    const stored = localStorage.getItem(REFERENCE_SET_STORAGE_KEY)
    if (!stored) return false
    return Boolean((JSON.parse(stored) as ReferenceSetSnapshot).references?.front)
  } catch { return false }
}

function hasReferenceAnalysis() {
  return Boolean(localStorage.getItem(REFERENCE_ANALYSIS_STORAGE_KEY))
}

function guidedBuildIndex(step: GuidedBuildStep) {
  if (step === 'generate') return 4
  if (step === 'rig') return 5
  return 6
}

function currentStepIndexFor(frontReady: boolean, analysisReady: boolean, buildReady: boolean, buildStep: GuidedBuildStep) {
  if (!frontReady) return 1
  if (!analysisReady) return 2
  if (!buildReady) return 3
  return guidedBuildIndex(buildStep)
}

function stepState(index: number, currentStepIndex: number): StepState {
  if (index < currentStepIndex) return 'completed'
  if (index === currentStepIndex) return 'current'
  if (index === currentStepIndex + 1) return 'available'
  return 'future'
}

function inspectorCopy(step: WorkflowStep) {
  const copy: Partial<Record<WorkflowStep, { title: string; body: string }>> = {
    'Add reference images': { title: 'Reference guidance', body: 'Add a clear front image first. Side and back views are optional and improve fidelity.' },
    'Place markers': { title: 'Marker guidance', body: 'Use Fit to see the complete image, drag anywhere outside a marker to pan, and refine markers with pointer or keyboard controls.' },
    'Review character shape': { title: 'Review the inferred shape', body: 'Check the analyzed proportions and marker placement, then confirm the character type when the reference interpretation is correct.' },
    'Generate character': { title: 'Create the model', body: 'One primary action creates the model from the confirmed references and reviewed shape.' },
    'Rig and animate': { title: 'Skeleton and starter motion', body: 'Progress remains visible while the Studio adds the skeleton, skinning, and starter animation clips.' },
    'Review and export': { title: 'Final review', body: 'Preview the largest practical model view, test the starter clips, review plain-language quality checks, and download one validated GLB.' },
  }
  return copy[step] ?? { title: 'Project guidance', body: 'Complete the current step to unlock the next part of the character workflow.' }
}

function StudioShell() {
  const [selected, setSelected] = useState<ModelTypeManifest | null>(initialModelType)
  const [frontReady, setFrontReady] = useState(hasFrontReference)
  const [analysisReady, setAnalysisReady] = useState(hasReferenceAnalysis)
  const [buildReady, setBuildReady] = useState(false)
  const [markersConfirmed, setMarkersConfirmed] = useState(false)
  const [buildStep, setBuildStep] = useState<GuidedBuildStep>('generate')
  const [stepsOpen, setStepsOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)

  useEffect(() => {
    if (!selected) return
    localStorage.setItem(MODEL_TYPE_STORAGE_KEY, selected.id)
    window.dispatchEvent(new CustomEvent('low-poly:model-type-selected', { detail: selected }))
    setBuildReady(false)
    setBuildStep('generate')
  }, [selected])

  useEffect(() => {
    const onReferenceSetChange = (event: Event) => {
      const detail = (event as CustomEvent<ReferenceSetSnapshot>).detail
      const nextFrontReady = Boolean(detail?.references?.front)
      setFrontReady(nextFrontReady)
      if (!nextFrontReady) setAnalysisReady(false)
    }
    const onAnalysisComplete = () => setAnalysisReady(true)
    const onAnalysisInvalidated = () => { setAnalysisReady(false); setMarkersConfirmed(false); setBuildReady(false) }
    window.addEventListener('low-poly:analysis-invalidated', onAnalysisInvalidated)
    const onMarkersChanged = () => { setMarkersConfirmed(false); setBuildReady(false) }
    const onMarkersConfirmed = () => {
      setFrontReady(hasFrontReference())
      setAnalysisReady(hasReferenceAnalysis())
      setMarkersConfirmed(Boolean(localStorage.getItem(MARKER_REVIEW_KEY)))
    }
    window.addEventListener('low-poly:markers-changed', onMarkersChanged)
    window.addEventListener('low-poly:markers-confirmed', onMarkersConfirmed)
    window.addEventListener('low-poly:reference-set-change', onReferenceSetChange)
    window.addEventListener('low-poly:reference-analysis-complete', onAnalysisComplete)
    setFrontReady(hasFrontReference())
    return () => {
      window.removeEventListener('low-poly:analysis-invalidated', onAnalysisInvalidated)
      window.removeEventListener('low-poly:markers-changed', onMarkersChanged)
      window.removeEventListener('low-poly:markers-confirmed', onMarkersConfirmed)
      window.removeEventListener('low-poly:reference-set-change', onReferenceSetChange)
      window.removeEventListener('low-poly:reference-analysis-complete', onAnalysisComplete)
    }
  }, [])

  useEffect(() => {
    if (!buildReady) setBuildStep('generate')
  }, [buildReady])

  const currentStepIndex = currentStepIndexFor(frontReady, analysisReady && markersConfirmed, buildReady && markersConfirmed, buildStep)
  const currentStep = WORKFLOW_STEPS[currentStepIndex]
  const inspector = useMemo(() => inspectorCopy(currentStep), [currentStep])
  const isReferenceStep = currentStepIndex <= 3

  useEffect(() => {
    if (currentStep !== 'Place markers') return
    let candidate: { pointerId: number; pointerType: string; startX: number; startY: number; target: HTMLElement } | null = null
    let proxyStarted = false

    const onPointerDown = (event: PointerEvent) => {
      const directPanEvent = event as DirectPanPointerEvent
      if (directPanEvent.__lowPolyDirectPanProxy || event.button !== 0) return
      const target = event.target as HTMLElement | null
      const canvas = target?.closest('.guidedStudioStep--2 .referenceWorkspace .canvas') as HTMLElement | null
      if (!canvas || target?.closest('[data-landmark]')) return
      candidate = { pointerId: event.pointerId, pointerType: event.pointerType, startX: event.clientX, startY: event.clientY, target: canvas }
      proxyStarted = false
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!candidate || event.pointerId !== candidate.pointerId || proxyStarted) return
      const distance = Math.hypot(event.clientX - candidate.startX, event.clientY - candidate.startY)
      if (distance < DIRECT_PAN_THRESHOLD) return
      const proxy = new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true, composed: true,
        pointerId: candidate.pointerId, pointerType: candidate.pointerType, isPrimary: event.isPrimary,
        clientX: candidate.startX, clientY: candidate.startY, button: 0, buttons: 1, shiftKey: true,
      }) as DirectPanPointerEvent
      proxy.__lowPolyDirectPanProxy = true
      candidate.target.dispatchEvent(proxy)
      proxyStarted = true
    }

    const clearCandidate = (event: PointerEvent) => {
      if (candidate && event.pointerId === candidate.pointerId) { candidate = null; proxyStarted = false }
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointermove', onPointerMove, true)
    document.addEventListener('pointerup', clearCandidate, true)
    document.addEventListener('pointercancel', clearCandidate, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointermove', onPointerMove, true)
      document.removeEventListener('pointerup', clearCandidate, true)
      document.removeEventListener('pointercancel', clearCandidate, true)
    }
  }, [currentStep])

  if (!selected) return <ModelTypeCatalog onSelect={setSelected} />

  return <div className={`guidedStudioShell studioApplicationShell guidedStudioStep--${currentStepIndex}`}>
    <header className="guidedStudioTopbar">
      <div className="guidedStudioBrand"><strong>Low Poly Character Studio</strong><span>Guest project</span></div>
      <div className="guidedStudioTopbarActions">
        <button type="button" className="guidedMobileControl" aria-expanded={stepsOpen} onClick={() => setStepsOpen((open) => !open)}>Steps</button>
        <button type="button" className="guidedMobileControl" aria-expanded={inspectorOpen} onClick={() => setInspectorOpen((open) => !open)}>Guidance</button>
        <button type="button" onClick={() => setSelected(null)}>Change type</button>
      </div>
    </header>

    <div className="guidedStudioBody">
      <nav className={`guidedStepRail ${stepsOpen ? 'isOpen' : ''}`} aria-label="Character workflow">
        <div className="guidedRailHeading"><span>Workflow</span><button type="button" className="guidedDrawerClose" onClick={() => setStepsOpen(false)}>Close</button></div>
        <ol>{WORKFLOW_STEPS.map((step, index) => {
          const state = stepState(index, currentStepIndex)
          return <li key={step} className={`guidedStep guidedStep--${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="guidedStepNumber">{state === 'completed' ? '✓' : index + 1}</span>
            <span><strong>{step}</strong><small>{state}</small></span>
          </li>
        })}</ol>
      </nav>

      <main className="guidedMainWorkspace">
        <div className="guidedWorkspaceHeading">
          <div>
            <span className="guidedEyebrow">{selected.name} · Step {currentStepIndex + 1} of {WORKFLOW_STEPS.length}</span>
            <h1>{currentStep}</h1>
          </div>
        </div>
        {isReferenceStep ? <>
          <VerticalSliceReadinessPanel
            modelType={selected}
            visible={currentStepIndex === 3}
            onReadinessChange={(readiness) => setBuildReady(readiness.ready)}
          />
          <ReferenceWorkspace><App /></ReferenceWorkspace>
        </> : <VerticalSliceBuildWorkflow modelTypeId={selected.id} activeStep={buildStep} onStepChange={setBuildStep} />}
      </main>

      <aside className={`guidedInspector ${inspectorOpen ? 'isOpen' : ''}`} aria-label="Step guidance">
        <div className="guidedRailHeading"><span>Inspector</span><button type="button" className="guidedDrawerClose" onClick={() => setInspectorOpen(false)}>Close</button></div>
        <section><span className="guidedEyebrow">Current step</span><h2>{inspector.title}</h2><p>{inspector.body}</p></section>
        <section><h3>Character type</h3><p><strong>{selected.name}</strong></p><p>{selected.id}</p></section>
        <details><summary>Advanced project details</summary><p>Technical artifacts and diagnostics remain available only when useful to the current step.</p></details>
      </aside>
    </div>
  </div>
}

export { StudioShell }
