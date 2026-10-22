import assert from "node:assert/strict";
import path from "node:path";
import { readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const output =
  process.env.STUDIO_MINIMAL_EVIDENCE_DIR ??
  path.join(root, "image-analysis/output/minimal-studio");
await mkdir(output, { recursive: true });
await rm(path.join(output, "results.json"), { force: true });
// A real loadable GLB fixture, with two synthetic clips appended for playback UI
// coverage. This is test transport data, never a claimed Blender generation.
const original = await readFile(
  path.join(
    root,
    "packages/asset-compiler/libraries/base-human/head/head_v001.glb",
  ),
);
const jsonLength = original.readUInt32LE(12),
  document = JSON.parse(original.subarray(20, 20 + jsonLength).toString());
const binary = original.subarray(28 + jsonLength);
const times = Buffer.from(new Float32Array([0, 1, 2]).buffer);
const positions = Buffer.from(
  new Float32Array([0, 0, 0, 0, 0.04, 0, 0, 0, 0]).buffer,
);
const offset = binary.length,
  view = document.bufferViews.length,
  accessor = document.accessors.length;
const combined = Buffer.concat([binary, times, positions]);
document.buffers[0].byteLength = combined.length;
document.bufferViews.push(
  { buffer: 0, byteOffset: offset, byteLength: times.length },
  {
    buffer: 0,
    byteOffset: offset + times.length,
    byteLength: positions.length,
  },
);
document.accessors.push(
  {
    bufferView: view,
    componentType: 5126,
    count: 3,
    type: "SCALAR",
    min: [0],
    max: [2],
  },
  { bufferView: view + 1, componentType: 5126, count: 3, type: "VEC3" },
);
document.animations = ["Idle", "Walk"].map((name) => ({
  name,
  channels: [{ sampler: 0, target: { node: 5, path: "translation" } }],
  samplers: [
    { input: accessor, output: accessor + 1, interpolation: "LINEAR" },
  ],
}));
let json = Buffer.from(JSON.stringify(document));
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 32)]);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + combined.length, 8);
header.writeUInt32LE(json.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(combined.length, 0);
binHeader.writeUInt32LE(0x004e4942, 4);
const fixture = Buffer.concat([header, json, binHeader, combined]);
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  headless: true,
});
const results = [];
try {
  for (const viewport of [
    { width: 1366, height: 610 },
    { width: 390, height: 700 },
    { width: 320, height: 640 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let payload,
      finish,
      failed = false;
    const gate = new Promise((resolve) => {
      finish = resolve;
    });
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "Content-Type",
    };
    await page.route("**:3001/**", async (route) => {
      const url = new URL(route.request().url()),
        method = route.request().method();
      if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
      if (url.pathname === "/fixture.glb")
        return route.fulfill({
          status: 200,
          headers,
          contentType: "model/gltf-binary",
          body: fixture,
        });
      if (method === "POST" && url.pathname === "/jobs") {
        payload = route.request().postDataJSON();
        return route.fulfill({
          headers,
          json: { ok: true, job: { id: "test-fixture", stages: {} } },
        });
      }
      if (url.pathname.endsWith("/run")) {
        await gate;
        return route.fulfill({
          headers,
          json: {
            ok: true,
            job: { id: "test-fixture", stages: {} },
            metadata: {
              previewUrl: "/fixture.glb",
              downloadUrl: "/fixture.glb",
            },
            validation: {
              valid: !failed,
              errors: failed ? ["Fixture validation failure"] : [],
            },
          },
        });
      }
      return route.fulfill({
        headers,
        json: {
          ok: true,
          job: { id: "test-fixture", stages: { model: { status: "running" } } },
        },
      });
    });
    await page.goto(process.env.STUDIO_URL ?? "http://localhost:5173");
    await page
      .getByRole("heading", { name: "Bring your character to life." })
      .waitFor();
    assert.equal(await page.getByRole("tab").count(), 3);
    assert.equal(await page.locator(".imageLayer").count(), 0);
    await page.screenshot({
      path: path.join(output, `empty-${viewport.width}.png`),
    });
    await page.getByRole("tab", { name: "Animations" }).click();
    await page
      .getByRole("heading", { name: "Your animations will appear here" })
      .waitFor();
    await page.getByRole("tab", { name: "Uploaded image" }).click();
    await page
      .locator("input[type=file]")
      .setInputFiles(
        path.join(
          root,
          "apps/style-studio/public/references/little-guy/front.png",
        ),
      );
    await page
      .getByRole("img", { name: "Uploaded character reference" })
      .waitFor();
    await page.screenshot({
      path: path.join(output, `uploaded-${viewport.width}.png`),
    });
    await page
      .getByRole("button", { name: "Convert to 3D", exact: true })
      .click();
    const confirmation = page.getByRole("button", {
      name: "Yes, create a humanoid",
    });
    await page.waitForFunction(
      () =>
        document.querySelector(".minimalEmpty h2")?.textContent !==
        "Reading your image…",
    );
    if (await confirmation.isVisible()) await confirmation.click();
    await page
      .getByRole("heading", { name: "Converting to a 3D model…", exact: true })
      .waitFor();
    assert.equal(
      await page.getByRole("link", { name: "Download GLB" }).count(),
      0,
    );
    await page.screenshot({
      path: path.join(output, `converting-${viewport.width}.png`),
    });
    // Original image stays accessible during a running build.
    await page.getByRole("tab", { name: "Uploaded image" }).click();
    await page
      .getByRole("img", { name: "Uploaded character reference" })
      .waitFor();
    await page.getByRole("tab", { name: "3D model" }).click();
    finish();
    await page.getByRole("link", { name: "Download GLB" }).waitFor();
    await page.getByRole("tab", { name: "Animations" }).click();
    await page.getByRole("button", { name: "Walk", exact: true }).waitFor();
    await page.getByRole("button", { name: "Walk", exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "Walk", exact: true })
        .getAttribute("aria-pressed"),
      "true",
    );
    await page.getByRole("button", { name: "Pause animation" }).click();
    await page.getByRole("button", { name: "Play animation" }).waitFor();
    await page.screenshot({
      path: path.join(output, `animations-fixture-${viewport.width}.png`),
    });
    assert.ok(payload.input.styleDna.landmarks.FeetBottom);
    assert.equal(payload.input.referenceSet.userIntent.decision, "skipped");
    assert.equal(
      await page.evaluate(
        () =>
          document.querySelector(".minimalStudio").scrollWidth <= innerWidth,
      ),
      true,
    );
    // A failed validation cannot expose a previous download.
    failed = true;
    await page.getByRole("tab", { name: "Uploaded image" }).click();
    await page
      .getByText("Add a description (optional)", { exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Describe the character" })
      .fill("A compact humanoid character with two legs.");
    assert.equal(
      await page.getByRole("link", { name: "Download GLB" }).count(),
      0,
    );
    await page
      .getByRole("button", { name: "Convert to 3D", exact: true })
      .click();
    await page.waitForFunction(
      () => !document.querySelector(".minimalSpinner"),
    );
    if (await confirmation.isVisible()) await confirmation.click();
    await page
      .getByRole("alert")
      .filter({ hasText: "Fixture validation failure" })
      .waitFor();
    assert.equal(
      await page.getByRole("link", { name: "Download GLB" }).count(),
      0,
    );
    assert.equal(payload.input.referenceSet.userIntent.decision, "described");
    assert.equal(
      payload.input.referenceSet.description,
      "A compact humanoid character with two legs.",
    );
    await page.getByRole("tab", { name: "Uploaded image" }).focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(
      await page
        .getByRole("tab", { name: "3D model" })
        .getAttribute("aria-selected"),
      "true",
    );
    assert.deepEqual(errors, []);
    results.push({
      viewport,
      passed: true,
      mockedJobTransport: true,
      realGlbLoader: true,
      blenderExecuted: false,
    });
    console.log(
      `${viewport.width}x${viewport.height}: minimal upload, conversion, preview, real fixture playback and validation failure passed`,
    );
    await page.close();
  }
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify(
      {
        suite: "minimal-studio/v1",
        commit: process.env.GITHUB_SHA ?? null,
        runId: process.env.GITHUB_RUN_ID ?? null,
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
