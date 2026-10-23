import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MARKER_REVIEW_KEY, reviewMarkers } from './marker-review'
import { buildHumanoidStyleDna } from './final-build-workflow'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

type LandmarkKey =
  | 'HeadTop'
  | 'Chin'
  | 'HeadLeft'
  | 'HeadRight'
  | 'EyeLeft'
  | 'EyeRight'
  | 'ShoulderLeft'
  | 'ShoulderRight'
  | 'WaistLeft'
  | 'WaistRight'
  | 'FeetBottom'

type Point = { x: number; y: number }
type Landmarks = Partial<Record<LandmarkKey, Point>>
type MarkerStyle = React.CSSProperties & {
  '--marker-arm': string
  '--marker-core': string
  '--marker-stroke': string
  '--marker-ring': string
}

const referenceImages = [
  { label: 'Front', src: '/references/little-guy/front.png' },
  { label: 'Side', src: '/references/little-guy/side.png' },
  { label: 'Back', src: '/references/little-guy/back.png' },
  { label: 'Character Sheet', src: '/references/little-guy/character_sheet.png' },
  { label: 'M60 Sheet', src: '/references/little-guy/M60_character_sheet.png' },
]

const groups: { title: string; keys: LandmarkKey[] }[] = [
  { title: 'Head', keys: ['HeadTop', 'Chin', 'HeadLeft', 'HeadRight'] },
  { title: 'Eyes', keys: ['EyeLeft', 'EyeRight'] },
  { title: 'Torso', keys: ['ShoulderLeft', 'ShoulderRight', 'WaistLeft', 'WaistRight'] },
  { title: 'Legs', keys: ['FeetBottom'] },
]

const landmarkOrder = groups.flatMap((group) => group.keys)

const descriptions: Record<LandmarkKey, string> = {
  HeadTop: 'Top of head/helmet silhouette.',
  Chin: 'Bottom of visible face/head silhouette.',
  HeadLeft: 'Image-left edge of head.',
  HeadRight: 'Image-right edge of head.',
  EyeLeft: 'Left eye as seen in the image.',
  EyeRight: 'Right eye as seen in the image.',
  ShoulderLeft: 'Image-left shoulder edge.',
  ShoulderRight: 'Image-right shoulder edge.',
  WaistLeft: 'Image-left waist/hip edge.',
  WaistRight: 'Image-right waist/hip edge.',
  FeetBottom: 'Lowest visible foot/boot point.',
}

const buildTargets = [
  { id: 'head', label: 'Head', description: 'Generate only the Little Guy head asset.' },
  { id: 'human', label: 'Human', description: 'Generate the full base humanoid.' },
  { id: 'helmet', label: 'Helmet', description: 'Coming next: M1 helmet silhouette.' },
]

function download(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null
  return Boolean(element?.closest('input, textarea, select, button, [contenteditable="true"]'))
}

function computeStyleDNA(source: string, landmarks: Landmarks, imageSize: { width: number; height: number }) {
  const headTop = landmarks.HeadTop
  const chin = landmarks.Chin
  const headLeft = landmarks.HeadLeft
  const headRight = landmarks.HeadRight
  const eyeLeft = landmarks.EyeLeft
  const eyeRight = landmarks.EyeRight
  const shoulderLeft = landmarks.ShoulderLeft
  const shoulderRight = landmarks.ShoulderRight
  const waistLeft = landmarks.WaistLeft
  const waistRight = landmarks.WaistRight
  const feetBottom = landmarks.FeetBottom

  const headHeightPx = headTop && chin ? Math.abs(chin.y - headTop.y) : null
  const totalHeightPx = headTop && feetBottom ? Math.abs(feetBottom.y - headTop.y) : null
  const headWidthPx = headLeft && headRight ? Math.abs(headRight.x - headLeft.x) : null
  const eyeSpacingPx = eyeLeft && eyeRight ? Math.abs(eyeRight.x - eyeLeft.x) : null
  const shoulderWidthPx = shoulderLeft && shoulderRight ? Math.abs(shoulderRight.x - shoulderLeft.x) : null
  const waistWidthPx = waistLeft && waistRight ? Math.abs(waistRight.x - waistLeft.x) : null

  const headHeightRatio = headHeightPx && totalHeightPx ? headHeightPx / totalHeightPx : null
  const headWidthToHeight = headWidthPx && headHeightPx ? headWidthPx / headHeightPx : null
  const eyeHeightFromTopRatio = eyeLeft && headTop && headHeightPx ? (eyeLeft.y - headTop.y) / headHeightPx : null
  const eyeSpacingToHeadWidth = eyeSpacingPx && headWidthPx ? eyeSpacingPx / headWidthPx : null
  const shoulderWidthToHeadWidth = shoulderWidthPx && headWidthPx ? shoulderWidthPx / headWidthPx : null
  const waistWidthToHeadWidth = waistWidthPx && headWidthPx ? waistWidthPx / headWidthPx : null
  const torsoHeightRatio = chin && feetBottom && totalHeightPx ? (feetBottom.y - chin.y) / totalHeightPx : null

  return {
    source,
    imageSize,
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
      torsoHeightRatio,
    },
    blenderHints: {
      totalHeight: 1.35,
      headWidth: headWidthToHeight ? clamp(headWidthToHeight * 0.42, 0.32, 0.55) : 0.42,
      headDepth: 0.36,
      headHeight: 0.42,
      eyeSpacing: eyeSpacingToHeadWidth ? clamp(eyeSpacingToHeadWidth * 0.42, 0.12, 0.28) : 0.18,
      eyeZ: eyeHeightFromTopRatio ? 1.35 - eyeHeightFromTopRatio * 0.42 : 1.03,
      torsoWidth: shoulderWidthToHeadWidth ? clamp(shoulderWidthToHeadWidth * 0.42, 0.20, 0.42) : 0.26,
      waistWidth: waistWidthToHeadWidth ? clamp(waistWidthToHeadWidth * 0.42, 0.18, 0.38) : 0.24,
      legLength: 0.27,
    },
  }
}

function ModelPreview({ modelUrl }: { modelUrl: string | null }) {
  const mountRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    mount.innerHTML = ''

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0d0f15')

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.01, 100)
    camera.position.set(0, -3, 1.2)
    camera.lookAt(0, 0, 0.65)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.75))
    const key = new THREE.DirectionalLight(0xffffff, 1.4)
    key.position.set(2, -4, 4)
    scene.add(key)

    const grid = new THREE.GridHelper(2, 8)
    grid.position.z = -0.02
    scene.add(grid)

    let loaded: THREE.Object3D | null = null

    if (modelUrl) {
      const loader = new GLTFLoader()
      loader.load(
        modelUrl,
        (gltf) => {
          loaded = gltf.scene
          const box = new THREE.Box3().setFromObject(loaded)
          const center = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
          loaded.position.sub(center)
          const maxDim = Math.max(size.x, size.y, size.z) || 1
          loaded.scale.setScalar(1.3 / maxDim)
          scene.add(loaded)
        },
        undefined,
        () => {
          const fallback = new THREE.Mesh(
            new THREE.SphereGeometry(0.45, 12, 8),
            new THREE.MeshStandardMaterial({ color: 0xd2966c, flatShading: true })
          )
          scene.add(fallback)
          loaded = fallback
        }
      )
    } else {
      const placeholder = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 12, 8),
        new THREE.MeshStandardMaterial({ color: 0xd2966c, flatShading: true })
      )
      scene.add(placeholder)
      loaded = placeholder
    }

    let frame = 0
    function animate() {
      frame = requestAnimationFrame(animate)
      if (loaded) loaded.rotation.z += 0.005
      renderer.render(scene, camera)
    }
    animate()

    const resize = () => {
      if (!mount) return
      camera.aspect = mount.clientWidth / Math.max(mount.clientHeight, 1)
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      renderer.dispose()
      mount.innerHTML = ''
    }
  }, [modelUrl])

  return <div ref={mountRef} className="preview3d" />
}

function App() {
  const [selectedImage, setSelectedImage] = useState({ label: 'Front reference', src: '' })
  const [hasFrontReference, setHasFrontReference] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [landmarks, setLandmarks] = useState<Landmarks>({})
  const [imageSize, setImageSize] = useState({ width: 960, height: 540 })
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [showLabels, setShowLabels] = useState(false)
  const [hovered, setHovered] = useState<LandmarkKey | null>(null)
  const [draggingLandmark, setDraggingLandmark] = useState<LandmarkKey | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [spacePressed, setSpacePressed] = useState(false)
  const [rightTab, setRightTab] = useState<'preview' | 'build' | 'measurements' | 'json'>('preview')
  const [selectedBuildTarget, setSelectedBuildTarget] = useState('human')
  const [buildStatus, setBuildStatus] = useState<'idle' | 'building' | 'success' | 'error'>('idle')
  const [modelUrl, setModelUrl] = useState<string | null>(null)
  const dragStart = useRef<Point | null>(null)
  const panStart = useRef<Point | null>(null)
  const suppressClick = useRef(false)
  const canvasRef = useRef<HTMLDivElement | null>(null)

  const currentLandmark = landmarkOrder[currentIndex]
  const completedCount = Object.keys(landmarks).length
  const markerReview = reviewMarkers(landmarks, imageSize)
  const [markerError, setMarkerError] = useState('')

  useEffect(() => {
    localStorage.removeItem(MARKER_REVIEW_KEY)
    setMarkerError('')
    window.dispatchEvent(new Event('low-poly:markers-changed'))
  }, [landmarks, imageSize, selectedImage.src])

  function confirmMarkers() {
    let referenceSet
    try { referenceSet = JSON.parse(localStorage.getItem('low-poly-character-studio.reference-set.v1') ?? '{}') } catch { /* Report the missing input below. */ }
    if (!hasFrontReference || !referenceSet?.references?.front) {
      setMarkerError('Upload a front image or load the example in Expand references before continuing. The canvas preview alone is not a selected reference.')
      return
    }
    if (!markerReview.valid) { setMarkerError(markerReview.error); return }
    try {
      const styleDna = buildHumanoidStyleDna({ source: selectedImage.src, imageSize, landmarks })
      localStorage.setItem(MARKER_REVIEW_KEY, JSON.stringify({ schemaVersion: 'marker-review/v1', confirmedAt: new Date().toISOString(), styleDna }))
      const analysisKey = 'low-poly-character-studio.reference-analysis.v1'
      let previousAnalysis = {}
      try { previousAnalysis = JSON.parse(localStorage.getItem(analysisKey) ?? '{}') } catch { /* Manual review can replace unavailable analysis. */ }
      localStorage.setItem(analysisKey, JSON.stringify({
        ...previousAnalysis,
        schemaVersion: 'humanoid-reference-analysis/v1', modelTypeId: 'humanoid/chibi-v1',
        landmarks, imageSize, reviewSource: 'user', reviewedAt: new Date().toISOString(),
      }))
      window.dispatchEvent(new Event('low-poly:reference-analysis-complete'))
      window.dispatchEvent(new Event('low-poly:markers-confirmed'))
    } catch (error) { setMarkerError(error instanceof Error ? error.message : 'Unable to save marker review.') }
  }
  const styleDNA = useMemo(
    () => computeStyleDNA(selectedImage.src, landmarks, imageSize),
    [selectedImage, landmarks, imageSize]
  )

  function centerImageAtZoom(nextZoom: number, size = imageSize) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const z = clamp(nextZoom, 0.2, 8)
    setZoom(z)
    setPan({
      x: (rect.width - size.width * z) / 2,
      y: (rect.height - size.height * z) / 2,
    })
  }

  function fitImageToCanvas(size = imageSize) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const padding = 24
    const availableWidth = Math.max(1, rect.width - padding * 2)
    const availableHeight = Math.max(1, rect.height - padding * 2)
    const nextZoom = Math.min(availableWidth / size.width, availableHeight / size.height)
    centerImageAtZoom(nextZoom, size)
  }

  function zoomBy(factor: number) {
    centerImageAtZoom(zoom * factor)
  }

  function resetForImage(image: typeof referenceImages[number]) {
    setSelectedImage(image)
    setCurrentIndex(0)
    setLandmarks({})
    requestAnimationFrame(() => fitImageToCanvas())
  }

  function screenToImage(point: Point) {
    return { x: (point.x - pan.x) / zoom, y: (point.y - pan.y) / zoom }
  }

  function removeLandmark(key: LandmarkKey) {
    setLandmarks((previous) => {
      const next = { ...previous }
      delete next[key]
      return next
    })
  }

  function nudgeLandmark(key: LandmarkKey, dx: number, dy: number) {
    setLandmarks((previous) => {
      const point = previous[key]
      if (!point) return previous
      return {
        ...previous,
        [key]: {
          x: clamp(point.x + dx, 0, imageSize.width),
          y: clamp(point.y + dy, 0, imageSize.height),
        },
      }
    })
  }

  useEffect(() => {
    const selectFront = (event: Event) => {
      const front = (event as CustomEvent<{ url: string; width: number; height: number } | null>).detail
      setHasFrontReference(Boolean(front))
      setLandmarks({})
      setCurrentIndex(0)
      if (!front) setSelectedImage({ label: 'Front reference', src: '' })
      if (front) {
        setSelectedImage({ label: 'Uploaded front', src: front.url })
        setImageSize({ width: front.width, height: front.height })
      }
    }
    const applyLandmarks = (event: Event) => {
      const analysis = (event as CustomEvent<{ landmarks: Landmarks; imageSize: { width: number; height: number } }>).detail
      setLandmarks(analysis.landmarks)
      setImageSize(analysis.imageSize)
      setCurrentIndex(0)
      requestAnimationFrame(() => fitImageToCanvas(analysis.imageSize))
    }
    window.addEventListener('low-poly:front-reference-selected', selectFront)
    window.addEventListener('low-poly:apply-landmarks', applyLandmarks)
    return () => {
      window.removeEventListener('low-poly:front-reference-selected', selectFront)
      window.removeEventListener('low-poly:apply-landmarks', applyLandmarks)
    }
  }, [])

  useEffect(() => {
    const handlePanelToggle = () => requestAnimationFrame(() => fitImageToCanvas())
    window.addEventListener('low-poly:reference-panel-toggle', handlePanelToggle)
    return () => window.removeEventListener('low-poly:reference-panel-toggle', handlePanelToggle)
  }, [imageSize.width, imageSize.height])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isEditableTarget(event.target)) return
      event.preventDefault()
      setSpacePressed(true)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') setSpacePressed(false)
    }
    const onBlur = () => setSpacePressed(false)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  function onCanvasClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!hasFrontReference) return
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    if (draggingLandmark || isPanning) return
    const rect = event.currentTarget.getBoundingClientRect()
    const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    const img = screenToImage(screen)
    if (img.x < 0 || img.y < 0 || img.x > imageSize.width || img.y > imageSize.height) return
    setLandmarks((previous) => ({ ...previous, [currentLandmark]: img }))
    setCurrentIndex((index) => Math.min(index + 1, landmarkOrder.length - 1))
  }

  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (!event.ctrlKey && !event.metaKey) return
    zoomBy(event.deltaY < 0 ? 1.1 : 0.9)
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.button !== 1) return
    const target = event.target as HTMLElement
    if (target.closest('[data-landmark]')) return
    if (event.button === 1 || spacePressed || event.shiftKey || event.altKey) {
      event.preventDefault()
      suppressClick.current = true
      setIsPanning(true)
      dragStart.current = { x: event.clientX, y: event.clientY }
      panStart.current = pan
      event.currentTarget.setPointerCapture(event.pointerId)
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (draggingLandmark) {
      const rect = event.currentTarget.getBoundingClientRect()
      const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const img = screenToImage(screen)
      setLandmarks((previous) => ({
        ...previous,
        [draggingLandmark]: { x: clamp(img.x, 0, imageSize.width), y: clamp(img.y, 0, imageSize.height) },
      }))
      return
    }
    if (isPanning && dragStart.current && panStart.current) {
      setPan({
        x: panStart.current.x + event.clientX - dragStart.current.x,
        y: panStart.current.y + event.clientY - dragStart.current.y,
      })
    }
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    setDraggingLandmark(null)
    setIsPanning(false)
    dragStart.current = null
    panStart.current = null
    try { event.currentTarget.releasePointerCapture(event.pointerId) } catch {}
  }

  async function generateTarget() {
    setRightTab('preview')
    setBuildStatus('building')
    try {
      const path = selectedBuildTarget === 'helmet' ? '/build/head' : `/build/${selectedBuildTarget}`
      const response = await fetch(`http://localhost:3001${path}`, { method: 'POST' })
      if (!response.ok) throw new Error(await response.text())
      const result = await response.json()
      setModelUrl(`http://localhost:3001${result.output}?t=${result.builtAt}`)
      setBuildStatus('success')
    } catch {
      setBuildStatus('error')
    }
  }

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1>Low Poly Character Studio</h1>
          <p>Reference landmarks → StyleDNA → Blender-ready proportions</p>
        </div>
        <div className="actions">
          <button onClick={() => download('little_guy_landmarks.json', { source: selectedImage.src, landmarks, imageSize })}>Download Landmarks</button>
          <button onClick={() => download('little_guy_style_dna.json', styleDNA)}>Download StyleDNA</button>
        </div>
      </header>

      <section className="layout">
        <aside className="panel sidebar">
          <h2>References</h2>
          {referenceImages.map((image) => (
            <button key={image.src} className={image.src === selectedImage.src ? 'reference active' : 'reference'} onClick={() => resetForImage(image)}>
              {image.label}
            </button>
          ))}

          <div className="controls">
            <h2>Canvas</h2>
            <button onClick={() => fitImageToCanvas()}>Fit View</button>
            <button onClick={() => setShowLabels((value) => !value)}>{showLabels ? 'Hide Labels' : 'Show Labels'}</button>
            <p>Use the toolbar to zoom without moving the image off center. Hold Space and drag to pan. Drag markers to refine; use arrow keys for one-pixel adjustments.</p>
          </div>

          <h2>Landmarks</h2>
          <p className="hint">Left/right means image-left and image-right, not anatomical character-left.</p>
          {groups.map((group) => (
            <div className="landmarkGroup" key={group.title}>
              <h3>{group.title}</h3>
              {group.keys.map((key) => {
                const index = landmarkOrder.indexOf(key)
                return (
                  <button key={key} className={index === currentIndex ? 'landmark active' : 'landmark'} onClick={() => setCurrentIndex(index)}>
                    <span>{landmarks[key] ? '✓ ' : '□ '}{key}</span>
                    <small>{landmarks[key] ? `${Math.round(landmarks[key]!.x)}, ${Math.round(landmarks[key]!.y)}` : 'unset'}</small>
                  </button>
                )
              })}
            </div>
          ))}
        </aside>

        <section className="workspace">
          <section className="markerReview" aria-label="Marker completion">
            <p role="status">{!hasFrontReference ? 'Choose a front reference in Expand references before continuing. ' : ''}Required markers: {markerReview.placed} of {markerReview.total} placed. {markerReview.valid ? 'Review their positions, then confirm.' : markerReview.error}</p>
            <div>
              <button type="button" onClick={() => { setShowLabels(true); fitImageToCanvas() }}>Review all markers</button>
              <button type="button" disabled={!hasFrontReference || !markerReview.valid} onClick={confirmMarkers}>Confirm markers and continue</button>
            </div>
            {markerError ? <p role="alert">{markerError}</p> : null}
          </section>
          <div className="canvasHeader">
            <div className="current" aria-live="polite">
              <span className="pill">{completedCount}/{landmarkOrder.length}</span>
              Current landmark: <strong>{currentLandmark}</strong>. {descriptions[currentLandmark]}
            </div>
            <div className="canvasToolbar" aria-label="Canvas view controls">
              <button type="button" onClick={() => fitImageToCanvas()}>Fit</button>
              <button type="button" onClick={() => zoomBy(0.8)} aria-label="Zoom out">−</button>
              <button type="button" onClick={() => centerImageAtZoom(1)} title="Reset to 100%">{Math.round(zoom * 100)}%</button>
              <button type="button" onClick={() => zoomBy(1.25)} aria-label="Zoom in">+</button>
              <button type="button" onClick={() => centerImageAtZoom(zoom)}>Center</button>
              <button type="button" onClick={() => setShowLabels((value) => !value)}>{showLabels ? 'Hide labels' : 'Show labels'}</button>
            </div>
          </div>

          <div className="canvasViewport">
            <div
              ref={canvasRef}
              className={`${isPanning ? 'canvas panning' : 'canvas'}${spacePressed ? ' readyToPan' : ''}`}
              onClick={onCanvasClick}
              onWheel={onWheel}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {!hasFrontReference ? <div className="referenceEmptyState"><strong>Upload your character image</strong><p>Choose a front image in the reference panel. We will analyze its shape automatically; marker editing is optional.</p><button type="button" onClick={() => window.dispatchEvent(new Event('low-poly:open-references'))}>Upload image</button></div> : null}
              <div className="imageLayer" style={{ width: imageSize.width, height: imageSize.height, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
                {hasFrontReference ? <img
                  src={selectedImage.src}
                  draggable={false}
                  onLoad={(event) => {
                    const next = { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }
                    setImageSize(next)
                    requestAnimationFrame(() => fitImageToCanvas(next))
                  }}
                /> : null}
                {Object.entries(landmarks).map(([rawKey, point]) => {
                  const key = rawKey as LandmarkKey
                  const selected = key === currentLandmark
                  const visibleLabel = showLabels || selected || hovered === key
                  const hitSize = 26 / zoom
                  const markerStyle: MarkerStyle = {
                    left: point.x,
                    top: point.y,
                    width: hitSize,
                    height: hitSize,
                    marginLeft: -hitSize / 2,
                    marginTop: -hitSize / 2,
                    '--marker-arm': `${12 / zoom}px`,
                    '--marker-core': `${4 / zoom}px`,
                    '--marker-stroke': `${1.25 / zoom}px`,
                    '--marker-ring': `${2 / zoom}px`,
                  }
                  return (
                    <div
                      key={key}
                      data-landmark={key}
                      className={selected ? 'marker selected' : 'marker'}
                      style={markerStyle}
                      role="button"
                      tabIndex={0}
                      aria-label={`${key} landmark. Use arrow keys to nudge; Shift plus arrow moves ten pixels.`}
                      onFocus={() => setCurrentIndex(landmarkOrder.indexOf(key))}
                      onMouseEnter={() => setHovered(key)}
                      onMouseLeave={() => setHovered(null)}
                      onDoubleClick={(event) => {
                        event.stopPropagation()
                        removeLandmark(key)
                      }}
                      onKeyDown={(event) => {
                        const step = event.shiftKey ? 10 : 1
                        const movement: Partial<Record<string, Point>> = {
                          ArrowLeft: { x: -step, y: 0 },
                          ArrowRight: { x: step, y: 0 },
                          ArrowUp: { x: 0, y: -step },
                          ArrowDown: { x: 0, y: step },
                        }
                        const delta = movement[event.key]
                        if (delta) {
                          event.preventDefault()
                          event.stopPropagation()
                          nudgeLandmark(key, delta.x, delta.y)
                        } else if (event.key === 'Delete' || event.key === 'Backspace') {
                          event.preventDefault()
                          event.stopPropagation()
                          removeLandmark(key)
                        }
                      }}
                      onPointerDown={(event) => {
                        event.stopPropagation()
                        event.currentTarget.focus()
                        setDraggingLandmark(key)
                        setCurrentIndex(landmarkOrder.indexOf(key))
                        event.currentTarget.setPointerCapture(event.pointerId)
                      }}
                    >
                      <span className="markerPoint" />
                      {visibleLabel ? <span className="label" style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'left center', left: 16 / zoom }}>{key}</span> : null}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <aside className="panel dnaPanel">
          <div className="tabs">
            <button className={rightTab === 'preview' ? 'tab active' : 'tab'} onClick={() => setRightTab('preview')}>Preview</button>
            <button className={rightTab === 'build' ? 'tab active' : 'tab'} onClick={() => setRightTab('build')}>Build</button>
            <button className={rightTab === 'measurements' ? 'tab active' : 'tab'} onClick={() => setRightTab('measurements')}>Measurements</button>
            <button className={rightTab === 'json' ? 'tab active' : 'tab'} onClick={() => setRightTab('json')}>JSON</button>
          </div>

          {rightTab === 'preview' ? (
            <div className="previewPanel">
              <ModelPreview modelUrl={modelUrl} />
              <p className="status">
                {modelUrl ? 'Showing latest generated GLB.' : 'Generate a target to preview it here.'}
              </p>
            </div>
          ) : rightTab === 'build' ? (
            <div className="buildPanel">
              <h2>Generate</h2>
              <div className="targetTabs">
                {buildTargets.map((target) => (
                  <button
                    key={target.id}
                    className={target.id === selectedBuildTarget ? 'targetTab active' : 'targetTab'}
                    onClick={() => setSelectedBuildTarget(target.id)}
                  >
                    {target.label}
                  </button>
                ))}
              </div>
              <p className="targetDescription">
                {buildTargets.find((target) => target.id === selectedBuildTarget)?.description}
              </p>
              <button className="primary" onClick={generateTarget}>
                {buildStatus === 'building' ? 'Generating...' : `Generate ${buildTargets.find((target) => target.id === selectedBuildTarget)?.label}`}
              </button>
              {buildStatus === 'error' ? (
                <p className="status error">API offline. Start the app with ./scripts/build.sh -dev so the API and Studio run together.</p>
              ) : null}
              {buildStatus === 'success' ? (
                <p className="status success">Build completed. Preview tab updated.</p>
              ) : null}
            </div>
          ) : rightTab === 'measurements' ? (
            <pre>{JSON.stringify(styleDNA.measurements, null, 2)}</pre>
          ) : (
            <pre>{JSON.stringify(styleDNA, null, 2)}</pre>
          )}
        </aside>
      </section>
    </main>
  )
}

export { App }
