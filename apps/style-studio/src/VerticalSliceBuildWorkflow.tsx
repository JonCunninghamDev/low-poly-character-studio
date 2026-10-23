import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MARKER_REVIEW_KEY, readConfirmedStyleDna } from './marker-review'
import './final-build-workflow.css'

const API_BASE = 'http://localhost:3001'
const STAGES = ['model', 'rig', 'animate', 'validate', 'export'] as const

type Stage = (typeof STAGES)[number]
type GuidedBuildStep = 'generate' | 'rig' | 'review'
type Job = { id: string; stages: Record<Stage | 'ingest' | 'analyze', { status: string; error?: { message: string; details?: string } }> }
type FinalResult = {
  ok: true
  job: Job
  metadata: { jobId: string; previewUrl: string; downloadUrl: string; animationClips: string[] }
  validation: { valid: boolean; gltfVersion: string | null; meshCount: number; materialCount: number; skinCount: number; animationClips: string[]; errors: string[] }
}

type VerticalSliceBuildWorkflowProps = {
  modelTypeId: string
  activeStep: GuidedBuildStep
  onStepChange: (step: GuidedBuildStep) => void
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...(init.headers ?? {}) } : init?.headers,
  })
  const payload = await response.json().catch(() => ({})) as { ok?: boolean; error?: string }
  if (!response.ok || payload.ok === false) throw new Error(payload.error ?? `Request failed (${response.status})`)
  return payload as T
}

function readJson(key: string) {
  const value = localStorage.getItem(key)
  if (!value) return null
  try { return JSON.parse(value) as unknown } catch { return null }
}

function readStyleDna() {
  return readConfirmedStyleDna(localStorage.getItem(MARKER_REVIEW_KEY))
}

function Preview({ url, clip }: { url: string; clip: string | null }) {
  const mount = useRef<HTMLDivElement | null>(null)
  const actions = useRef(new Map<string, THREE.AnimationAction>())
  const active = useRef<THREE.AnimationAction | null>(null)

  useEffect(() => {
    if (!mount.current) return
    const host = mount.current
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0d0f15')
    const camera = new THREE.PerspectiveCamera(42, host.clientWidth / Math.max(host.clientHeight, 1), 0.01, 100)
    camera.position.set(0, 0.65, 3.1)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(host.clientWidth, host.clientHeight)
    host.appendChild(renderer.domElement)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x293047, 1.5))
    const light = new THREE.DirectionalLight(0xffffff, 2)
    light.position.set(3, 4, 5)
    scene.add(light)
    let mixer: THREE.AnimationMixer | null = null
    let frame = 0
    const clock = new THREE.Clock()
    new GLTFLoader().load(url, (gltf) => {
      const model = gltf.scene
      const box = new THREE.Box3().setFromObject(model)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const scale = 1.65 / (Math.max(size.x, size.y, size.z) || 1)
      model.scale.setScalar(scale)
      model.position.set(-center.x * scale, -center.y * scale, -center.z * scale)
      scene.add(model)
      mixer = new THREE.AnimationMixer(model)
      actions.current = new Map(gltf.animations.map((item) => [item.name, mixer!.clipAction(item)]))
      const first = actions.current.values().next().value as THREE.AnimationAction | undefined
      first?.play()
      active.current = first ?? null
    })
    const animate = () => {
      frame = requestAnimationFrame(animate)
      mixer?.update(clock.getDelta())
      renderer.render(scene, camera)
    }
    animate()
    return () => {
      cancelAnimationFrame(frame)
      mixer?.stopAllAction()
      renderer.dispose()
      host.innerHTML = ''
    }
  }, [url])

  useEffect(() => {
    if (!clip) return
    const next = actions.current.get(clip)
    if (!next || next === active.current) return
    active.current?.fadeOut(0.15)
    next.reset().fadeIn(0.15).play()
    active.current = next
  }, [clip])

  return <div ref={mount} className="finalGlbPreview" aria-label="Generated character preview" />
}

function StageList({ job }: { job: Job | null }) {
  return <ol className="finalStageList" aria-label="Character build progress">
    {STAGES.map((stage) => <li key={stage} data-status={job?.stages[stage]?.status ?? 'pending'}>
      <span>{stage === 'model' ? 'Character model' : stage === 'rig' ? 'Skeleton' : stage === 'animate' ? 'Starter motion' : stage === 'validate' ? 'Quality checks' : 'Portable GLB'}</span>
      <strong>{job?.stages[stage]?.status ?? 'pending'}</strong>
      {job?.stages[stage]?.error ? <small>{job.stages[stage].error?.details ?? job.stages[stage].error?.message}</small> : null}
    </li>)}
  </ol>
}

function VerticalSliceBuildWorkflow({ modelTypeId, activeStep, onStepChange }: VerticalSliceBuildWorkflowProps) {
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('Your reviewed character shape is ready to generate.')
  const [result, setResult] = useState<FinalResult | null>(null)
  const [job, setJob] = useState<Job | null>(null)
  const [clip, setClip] = useState<string | null>(null)

  async function run() {
    setRunning(true)
    setResult(null)
    onStepChange('generate')
    try {
      if (modelTypeId !== 'humanoid/chibi-v1') throw new Error(`Character generation is not available for ${modelTypeId}.`)
      setMessage('Creating the character from the confirmed references and shape…')
      const created = await requestJson<{ ok: true; job: Job }>('/jobs', {
        method: 'POST',
        body: JSON.stringify({
          modelTypeId,
          input: {
            styleDna: readStyleDna(),
            referenceSet: readJson('low-poly-character-studio.reference-set.v1'),
            analysis: readJson('low-poly-character-studio.reference-analysis.v1'),
            modelTypeConfirmation: readJson('low-poly-character-studio.model-type-confirmation.v1'),
          },
        }),
      })
      setJob(created.job)
      onStepChange('rig')
      setMessage('Adding the skeleton, starter animations, quality checks, and portable export…')
      const completed = await requestJson<FinalResult>(`/jobs/${created.job.id}/run`, { method: 'POST' })
      setJob(completed.job)
      setResult(completed)
      setClip(completed.metadata.animationClips[0] ?? null)
      onStepChange('review')
      setMessage(completed.validation.valid ? 'Character complete and ready to download.' : 'The character needs attention before it can be downloaded.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
      onStepChange('generate')
    } finally {
      setRunning(false)
    }
  }

  if (activeStep === 'generate') {
    return <section className="finalWorkflowInline" aria-labelledby="generate-character-title">
      <header><div><span className="guidedEyebrow">Step 5</span><h2 id="generate-character-title">Generate character</h2><p>Create the model from the references and shape you reviewed.</p></div></header>
      <div className="finalWorkflowActions"><button type="button" className="primary" disabled={running} onClick={() => void run()}>{running ? 'Generating…' : 'Generate character'}</button></div>
      <p className={`finalWorkflowStatus ${running ? 'running' : 'idle'}`} role="status" aria-live="polite">{message}</p>
      {job ? <StageList job={job} /> : null}
    </section>
  }

  if (activeStep === 'rig') {
    return <section className="finalWorkflowInline" aria-labelledby="rig-character-title">
      <header><div><span className="guidedEyebrow">Step 6</span><h2 id="rig-character-title">Rig and animate</h2><p>The Studio is adding a skeleton and the starter motion pack.</p></div></header>
      <p className="finalWorkflowStatus running" role="status" aria-live="polite">{message}</p>
      {job ? <p className="finalWorkflowJob">Project build <code>{job.id}</code></p> : null}
      <StageList job={job} />
    </section>
  }

  return <section className="finalWorkflowInline finalWorkflowReview" aria-labelledby="review-export-title">
    <header><div><span className="guidedEyebrow">Step 7</span><h2 id="review-export-title">{result?.validation.valid ? 'Character complete' : 'Review and export'}</h2><p>Preview the result, test its starter motion, and download the validated GLB.</p></div></header>
    <p className={`finalWorkflowStatus ${result?.validation.valid ? 'success' : 'idle'}`} role="status" aria-live="polite">{message}</p>
    {result ? <>
      <Preview url={`${API_BASE}${result.metadata.previewUrl}`} clip={clip} />
      <div className="finalClipControls" aria-label="Starter animation clips">{result.metadata.animationClips.map((name) => <button type="button" key={name} className={clip === name ? 'active' : ''} aria-pressed={clip === name} onClick={() => setClip(name)}>{name}</button>)}</div>
      <section className={result.validation.valid ? 'finalValidation valid' : 'finalValidation invalid'}>
        <h3>{result.validation.valid ? 'Ready for use' : 'Quality checks found a problem'}</h3>
        <p>{result.validation.valid ? 'The model, materials, skeleton, and animation clips passed the required checks.' : 'Download remains unavailable until the required checks pass.'}</p>
        {result.validation.errors.length ? <ul>{result.validation.errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
      </section>
      {result.validation.valid ? <a className="finalDownload" href={`${API_BASE}${result.metadata.downloadUrl}`} download>Download validated GLB</a> : null}
      <details className="finalAdvancedDetails"><summary>Advanced build details</summary><p>Job <code>{result.metadata.jobId}</code> · glTF {result.validation.gltfVersion ?? 'unknown'} · {result.validation.meshCount} meshes · {result.validation.materialCount} materials · {result.validation.skinCount} skins · {result.validation.animationClips.length} clips</p><StageList job={result.job} /></details>
    </> : <p>Complete character generation before reviewing the final asset.</p>}
  </section>
}

export { VerticalSliceBuildWorkflow }
export type { GuidedBuildStep }
