# Minimal image-to-3D workspace

The default route is a minimal converter inspired by the product owner's Sprite Sheet Maker example. It replaces the landing/guest/step-navigation entry with three immediately accessible views: **Uploaded image**, **3D model**, and **Animations**. The prior guided workflow is preserved at `?advanced=1&guest=1&modelType=humanoid%2Fchibi-v1`, reachable through **Advanced editor** in a separate tab.

Upload or drop a PNG/JPG/WebP (up to 15 MB), inspect the preview, then choose **Convert to 3D**. A description is optional behind **Add a description**. Conversion first uses the existing generic image assessment and humanoid landmark inference. Any non-humanoid or unresolved heuristic recommendation asks a simple humanoid confirmation instead of a hard rejection. Only explicit user confirmation allows the humanoid generator in that case, and the raw image assessment is preserved separately from that override. An unusable image still stops. Fragmented support evidence (more than four apparent regions) remains unresolved instead of being confidently classified as quadrupedal. No manual markers are required in the minimal path. The current generator remains the existing stylized humanoid pipeline.

The converter creates a real API build job, runs its persisted model/rig/animation/validation/export pipeline, and polls actual stage state for plain-language progress. Uploaded image navigation remains available while it runs. Validated results load their real GLB in an orbitable preview; animation controls come from clips loaded in that file. Play/pause controls the animation mixer. A failed validation never offers a download. This does not add tree generation, new animation packs, arbitrary image reconstruction or public hosting.

## Input and request lifecycle

Every upload has a fresh identity. User conversion records either the trimmed optional description or an image-only decision in `reference-intent/v1`, separate from machine evidence. The existing reference, analysis and style inputs are carried into the real job request. An uncertain humanoid selection is explicit provenance.

Replacing an image, editing guidance or starting another run clears prior output and clips, aborts pending browser requests, and invalidates late results. This does not cancel a job already running on the server. Failed replacement uploads report errors; browser object URLs and Three.js resources are released. There is no restored sample image or stale local-storage result in the default workspace.

The advanced editor retains its stricter describe-or-explicit-skip and marker-review flow from the earlier PR increment. The new minimal default supersedes that earlier mandatory description prompt for ordinary users. API clients and the underlying image-only engine retain their existing optional-description behavior.

## Verification

- `pnpm studio:build`, `pnpm final-workflow:test`, `pnpm reference-analysis:test`, and the adopted governance checks remain required alongside complete CI and real Blender fixture smoke.
- `node tests/browser/minimal-workspace.mjs` exercises the default workspace at 1366×610, 390×700 and 320×640. It covers upload/preview, original-image access during conversion, inferred build input, validated download, GLB loading, actual clip selection/play-pause and validation failure. It also checks horizontal overflow and empty states.
- This UI test mocks job transport and loads a real GLB fixture derived from the checked-in head asset with two synthetic clips. Its head preview is **test data**, not an image-generated character or Blender fidelity proof. Production code uses the real API. Independent real Blender CI remains the generator evidence.
- `pnpm studio:e2e:test` retains the advanced-editor upload/provenance regression test through the explicit advanced route.
- The existing CI capture script runs both browser suites on the built preview and retains screenshots/result manifests in its responsive artifact (`minimal-studio/` and `upload-workflow/`). Standalone browser runs accept `STUDIO_URL`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE` and their respective evidence-directory variables.

This continues PR #95/#86 following the latest product-owner feedback and advances the workspace direction in #85. It uses the adopted released platform steering; it does not claim a managed execution-host run or publish a platform release. Rollback is a focused revert of the feature PR, without a data migration. Product-owner visual acceptance remains a milestone checkpoint.

Regression coverage includes a 164×239 dark-background front crop of the checked-in approved character sheet at laptop and narrow-mobile sizes, plus a non-humanoid silhouette that cannot create a job without confirmation. These crops are produced in browser memory; no new image binary is committed.
