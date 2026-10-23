import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sourceUrl = new URL('./StudioShell.tsx', import.meta.url)
const cssUrl = new URL('./guided-studio-shell.css', import.meta.url)


test('guided shell exposes the approved seven-step workflow and stable regions', async () => {
  const source = await readFile(sourceUrl, 'utf8')

  assert.match(source, /Choose character type/)
  assert.match(source, /Add reference images/)
  assert.match(source, /Place markers/)
  assert.match(source, /Review character shape/)
  assert.match(source, /Generate character/)
  assert.match(source, /Rig and animate/)
  assert.match(source, /Review and export/)
  assert.match(source, /guidedStepRail/)
  assert.match(source, /guidedMainWorkspace/)
  assert.match(source, /guidedInspector/)
  assert.match(source, /Guest project/)
})

test('guided shell preserves the working pipeline surfaces', async () => {
  const source = await readFile(sourceUrl, 'utf8')

  assert.match(source, /VerticalSliceReadinessPanel/)
  assert.match(source, /VerticalSliceBuildWorkflow/)
  assert.match(source, /ReferenceWorkspace/)
  assert.match(source, /<App \/>/)
  assert.match(source, /stepState\(index, currentStepIndex\)/)
})

test('persisted readiness and build phase advance dedicated guided steps', async () => {
  const source = await readFile(sourceUrl, 'utf8')

  assert.match(source, /currentStepIndexFor\(frontReady, analysisReady && markersConfirmed, buildReady && markersConfirmed, buildStep\)/)
  assert.match(source, /low-poly:reference-set-change/)
  assert.match(source, /low-poly:reference-analysis-complete/)
  assert.match(source, /if \(!frontReady\) return 1/)
  assert.match(source, /if \(!analysisReady\) return 2/)
  assert.match(source, /if \(!buildReady\) return 3/)
  assert.match(source, /guidedBuildIndex\(buildStep\)/)
  assert.match(source, /activeStep=\{buildStep\}/)
  assert.doesNotMatch(source, /Generate character · setup required/)
})

test('guided shell collapses navigation and inspector without horizontal page flow', async () => {
  const css = await readFile(cssUrl, 'utf8')

  assert.match(css, /grid-template-columns: 238px minmax\(0, 1fr\) 300px/)
  assert.match(css, /@media \(max-width: 1180px\)/)
  assert.match(css, /@media \(max-width: 760px\)/)
  assert.match(css, /\.guidedStepRail\.isOpen/)
  assert.match(css, /\.guidedInspector\.isOpen/)
  assert.match(css, /overflow: hidden/)
})

test('marker step keeps the reference canvas dominant and removes premature build surfaces', async () => {
  const css = await readFile(cssUrl, 'utf8')

  assert.match(css, /guidedStudioStep--2 \.referenceWorkspace > \.app > \.topbar/)
  assert.match(css, /guidedStudioStep--2 \.referenceWorkspace \.dnaPanel/)
  assert.match(css, /guidedStudioStep--2 \.referenceWorkspace \.layout/)
  assert.match(css, /grid-template-columns: minmax\(210px, 250px\) minmax\(0, 1fr\)/)
  assert.match(css, /touch-action: none/)
  assert.match(css, /cursor: grab/)
  assert.match(css, /overscroll-behavior: contain/)
})

test('marker step promotes an unmodified drag into the existing pan contract', async () => {
  const source = await readFile(sourceUrl, 'utf8')

  assert.match(source, /DIRECT_PAN_THRESHOLD = 6/)
  assert.match(source, /target\?\.closest\('\[data-landmark\]'\)/)
  assert.match(source, /Math\.hypot\(event\.clientX - candidate\.startX, event\.clientY - candidate\.startY\)/)
  assert.match(source, /new PointerEvent\('pointerdown'/)
  assert.match(source, /shiftKey: true/)
  assert.match(source, /__lowPolyDirectPanProxy/)
  assert.match(source, /drag anywhere outside a marker to pan/)
})
