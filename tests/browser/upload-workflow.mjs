import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}),
  headless: true,
})
try {
  for (const viewport of [{ width: 1366, height: 610 }, { width: 390, height: 700 }]) {
    const page = await browser.newPage({ viewport })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.addInitScript(() => {
      localStorage.setItem('low-poly-character-studio.model-type.v1', 'humanoid/chibi-v1')
      localStorage.setItem('low-poly-character-studio.reference-set.v1', JSON.stringify({ references: { front: { fileName: 'stale.png' } } }))
    })
    await page.goto(process.env.STUDIO_URL ?? 'http://localhost:5173')
    await page.getByRole('button', { name: 'Continue as guest', exact: true }).click()
    await page.locator('.landingEntryChoice').first().click()
    await page.getByRole('heading', { name: 'Add reference images', exact: true }).waitFor()
    assert.equal(await page.locator('.imageLayer img').count(), 0, 'new sessions must not display a default image')
    assert.equal(await page.getByRole('button', { name: 'Confirm markers and continue', exact: true }).isEnabled(), false)
    const inputs = page.locator('input[type=file]')
    await inputs.first().setInputFiles(path.join(root, 'apps/style-studio/public/references/little-guy/front.png'))
    await page.waitForFunction(() => Boolean(localStorage.getItem('low-poly-character-studio.character-image-assessment.v1')))
    // This fixture has wide margins; the generic classifier abstains. The user
    // confirms the type rather than placing eleven markers manually.
    const suggest = page.getByRole('button', { name: 'This is a humanoid — suggest its shape', exact: true })
    await suggest.click()
    await page.waitForFunction(() => document.querySelectorAll('.imageLayer [data-landmark]').length === 11)
    // Removing and replacing the front input must clear stale suggestions.
    await page.getByRole('button', { name: 'Expand references', exact: true }).click()
    await page.getByRole('button', { name: 'Remove', exact: true }).first().click()
    await page.waitForFunction(() => !document.querySelector('.imageLayer img'))
    assert.equal(await page.getByRole('button', { name: 'Confirm markers and continue', exact: true }).isEnabled(), false)
    await inputs.first().setInputFiles(path.join(root, 'apps/style-studio/public/references/little-guy/front.png'))
    await suggest.click()
    await page.waitForFunction(() => document.querySelectorAll('.imageLayer [data-landmark]').length === 11)
    const source = await page.locator('.imageLayer img').getAttribute('src')
    // Adding an optional reference must not revoke the front image's object URL.
    await page.getByRole('button', { name: 'Expand references', exact: true }).click()
    await inputs.nth(1).setInputFiles(path.join(root, 'apps/style-studio/public/references/little-guy/side.png'))
    await page.waitForFunction(() => Boolean(JSON.parse(localStorage.getItem('low-poly-character-studio.reference-set.v1')).references.side))
    await page.evaluate(async (url) => { const response = await fetch(url); if (!response.ok) throw new Error('Front URL was revoked') }, source)
    await page.getByRole('button', { name: 'Collapse references', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm markers and continue', exact: true }).click()
    await page.getByRole('heading', { name: 'Review character shape', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Confirm Chibi Humanoid', exact: true }).click()
    await page.getByRole('button', { name: 'Generate character', exact: true }).waitFor()
    assert.equal(await page.locator('.imageLayer').count(), 0)
    let payload
    await page.route('http://localhost:3001/jobs', async (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      payload = route.request().postDataJSON()
      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Smoke test stops before Blender execution.' }) })
    })
    await page.getByRole('button', { name: 'Generate character', exact: true }).click()
    await page.getByText('Smoke test stops before Blender execution.', { exact: true }).waitFor()
    assert.equal(payload.input.styleDna.schema, 'humanoid-style-dna/v1')
    assert.ok(payload.input.styleDna.landmarks.FeetBottom)
    assert.deepEqual(errors, [])
    console.log(`${viewport.width}x${viewport.height}: empty start, automatic suggestions, optional reference, confirmation, persisted build input passed`)
    await page.close()
  }
} finally { await browser.close() }
