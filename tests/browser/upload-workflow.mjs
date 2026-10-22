import assert from 'node:assert/strict'
import path from 'node:path'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const evidence = process.env.STUDIO_E2E_EVIDENCE_DIR ?? path.join(root, 'image-analysis/output/upload-workflow')
await mkdir(evidence, { recursive: true })
await rm(path.join(evidence, 'results.json'), { force: true })
const results = []
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
  headless: true,
})
try {
  for (const viewport of [{ width: 1366, height: 610 }, { width: 390, height: 700 }]) {
    const page = await browser.newPage({ viewport })
    // The intake proof runs without an API or Blender process. Only its final
    // submission is intercepted below to inspect the real generated payload.
    await page.route('http://localhost:3001/**', (route) => route.abort('connectionrefused'))
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript(() => {
      localStorage.setItem('low-poly-character-studio.model-type.v1', 'humanoid/chibi-v1')
      localStorage.setItem('low-poly-character-studio.reference-set.v1', JSON.stringify({ description: 'Stale description from another upload', references: { front: { fileName: 'stale.png' } } }))
    })
    const legacyUrl = new URL(process.env.STUDIO_URL ?? 'http://localhost:5173')
    legacyUrl.searchParams.set('advanced', '1')
    await page.goto(legacyUrl.href)
    await page.getByRole('button', { name: 'Continue as guest', exact: true }).click()
    await page.locator('.landingEntryChoice').first().click()
    await page.getByRole('heading', { name: 'Add reference images', exact: true }).waitFor()
    assert.equal(await page.locator('.imageLayer img').count(), 0, 'new sessions must not display a default image')
    const confirm = page.getByRole('button', { name: 'Confirm markers and continue', exact: true })
    assert.equal(await confirm.isEnabled(), false)
    const inputs = page.locator('input[type=file]')
    const description = page.getByRole('textbox', { name: 'Describe the character' })
    const analyze = page.getByRole('button', { name: 'Analyze image', exact: true })
    const skip = page.getByRole('button', { name: 'Analyze without description', exact: true })
    const front = path.join(root, 'apps/style-studio/public/references/little-guy/front.png')
    const readReference = () => page.evaluate(() => JSON.parse(localStorage.getItem('low-poly-character-studio.reference-set.v1')))
    const waitAssessment = () => page.waitForFunction(() => Boolean(localStorage.getItem('low-poly-character-studio.character-image-assessment.v1')))
    const finishSuggestions = async () => {
      const suggest = page.getByRole('button', { name: 'This is a humanoid — suggest its shape', exact: true })
      if (await suggest.isVisible()) await suggest.click()
      await page.waitForFunction(() => document.querySelectorAll('.imageLayer [data-landmark]').length === 11)
    }
    const expandReferences = async () => {
      const expand = page.getByRole('button', { name: 'Expand references', exact: true })
      if (await expand.isVisible()) await expand.click()
    }

    await inputs.first().setInputFiles(front)
    await description.waitFor()
    assert.equal(await description.inputValue(), '', 'a new upload must not inherit an old image description')
    assert.equal(await analyze.isEnabled(), false)
    assert.equal(await page.evaluate(() => localStorage.getItem('low-poly-character-studio.character-image-assessment.v1')), null, 'upload must wait for a description decision')
    assert.equal((await readReference()).userIntent, null)
    await page.getByRole('heading', { name: 'Add reference images', exact: true }).waitFor()
    await page.screenshot({ path: path.join(evidence, `pending-${viewport.width}.png`) })

    await description.fill('A compact humanoid character. It stands upright and moves on two legs.')
    await analyze.click()
    await waitAssessment()
    const described = await readReference()
    assert.equal(described.userIntent.decision, 'described')
    assert.equal(described.userIntent.referenceId, described.references.front.id)
    assert.equal(described.userIntent.origin, 'user-provided')
    const assessment = await page.evaluate(() => JSON.parse(localStorage.getItem('low-poly-character-studio.character-image-assessment.v1')))
    assert.deepEqual(assessment.userIntent, described.userIntent)
    assert.equal(assessment.userPrior.description, described.description)
    await finishSuggestions()
    await confirm.click()
    await page.getByRole('heading', { name: 'Review character shape', exact: true }).waitFor()
    assert.ok(await page.evaluate(() => localStorage.getItem('low-poly-character-studio.marker-review.v1')))
    // A changed description must revoke the reviewed result before it can be reused.
    await expandReferences()
    await description.fill('A tree, despite the humanoid-looking reference.')
    assert.equal((await readReference()).userIntent, null)
    assert.equal(await page.evaluate(() => localStorage.getItem('low-poly-character-studio.character-image-assessment.v1')), null)
    assert.equal(await page.evaluate(() => localStorage.getItem('low-poly-character-studio.marker-review.v1')), null)
    assert.equal(await confirm.isEnabled(), false)
    assert.equal(await page.locator('.imageLayer [data-landmark]').count(), 0, 'editing intent must clear old shape suggestions')
    await page.getByRole('heading', { name: 'Add reference images', exact: true }).waitFor()
    await skip.click()
    await waitAssessment()
    const skipped = await readReference()
    assert.equal(skipped.userIntent.decision, 'skipped')
    assert.equal('description' in skipped.userIntent, false)
    assert.equal('description' in skipped, false)
    const imageOnly = await page.evaluate(() => JSON.parse(localStorage.getItem('low-poly-character-studio.character-image-assessment.v1')))
    assert.equal(imageOnly.userPrior, undefined)
    assert.deepEqual(imageOnly.userIntent, skipped.userIntent)
    await finishSuggestions()

    // Removing/replacing even the same file requires a fresh decision and ID.
    await expandReferences()
    await page.getByRole('button', { name: 'Remove', exact: true }).first().click()
    await page.waitForFunction(() => !document.querySelector('.imageLayer img'))
    assert.equal(await confirm.isEnabled(), false)
    await inputs.first().setInputFiles(front)
    await description.waitFor()
    const replacement = await readReference()
    assert.notEqual(replacement.references.front.id, skipped.references.front.id)
    assert.equal(replacement.userIntent, null)
    assert.equal(await page.evaluate(() => localStorage.getItem('low-poly-character-studio.character-image-assessment.v1')), null)
    await skip.click()
    await waitAssessment()
    await finishSuggestions()
    const source = await page.locator('.imageLayer img').getAttribute('src')
    await expandReferences()
    await inputs.nth(1).setInputFiles(path.join(root, 'apps/style-studio/public/references/little-guy/side.png'))
    await page.waitForFunction(() => Boolean(JSON.parse(localStorage.getItem('low-poly-character-studio.reference-set.v1')).references.side))
    await page.evaluate(async (url) => { const response = await fetch(url); if (!response.ok) throw new Error('Front URL was revoked') }, source)
    await page.getByRole('button', { name: 'Collapse references', exact: true }).click()
    await page.screenshot({ path: path.join(evidence, `review-${viewport.width}.png`) })
    await confirm.click()
    await page.getByRole('heading', { name: 'Review character shape', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Confirm Chibi Humanoid', exact: true }).click()
    await page.getByRole('button', { name: 'Generate character', exact: true }).waitFor()
    assert.equal(await page.locator('.imageLayer').count(), 0)
    let payload
    await page.route('http://localhost:3001/jobs', async (route) => {
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'Content-Type' }
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
      if (route.request().method() !== 'POST') return route.continue()
      payload = route.request().postDataJSON()
      await route.fulfill({ status: 400, headers, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Smoke test stops before Blender execution.' }) })
    })
    await page.getByRole('button', { name: 'Generate character', exact: true }).click()
    await page.getByText('Smoke test stops before Blender execution.', { exact: true }).waitFor()
    assert.equal(payload.input.styleDna.schema, 'humanoid-style-dna/v1')
    assert.ok(payload.input.styleDna.landmarks.FeetBottom)
    assert.equal(payload.input.referenceSet.userIntent.decision, 'skipped')
    assert.equal(payload.input.referenceSet.userIntent.referenceId, payload.input.referenceSet.references.front.id)
    assert.deepEqual(errors, [])
    results.push({ viewport, passed: true, checks: ['empty start', 'explicit described analysis', 'edit invalidation', 'explicit image-only skip', 'replacement identity', 'optional reference', 'confirmed generation payload'], blenderExecuted: false })
    console.log(`${viewport.width}x${viewport.height}: describe/skip, provenance, invalidation and generation input passed`)
    await page.close()
  }
  await writeFile(path.join(evidence, 'results.json'), JSON.stringify({
    suite: 'reference-intake/v1',
    githubCommit: process.env.GITHUB_SHA ?? null,
    githubRunId: process.env.GITHUB_RUN_ID ?? null,
    results,
  }, null, 2) + '\n')
} finally { await browser.close() }
