# Base soldier pipeline validation, October 23, 2026

Progresses #81 / draft PR #93. This is pipeline evidence, not visual acceptance of
the named Gold Standard configuration or completion of the part-library issue.

## Local evidence

Base: `develop` at `5af23cbf59f10be5dd6ed574b6a1e191765f32b8`, synchronized into
the existing issue-81 branch without rewriting history. Platform adoption remains
`v1.0.0` / `b107c9306161b395cbcaffebb55e47850b999560`.

Completed local runs (ignored outputs):

| Run | Configuration | Export triangles | Skin | Clips |
| --- | --- | ---: | ---: | --- |
| `base-soldier-gold-review-03` | gold-standard | 2,858 | 1 | A-pose, idle, walk, wave |
| `base-soldier-variants-review-04` | broad-cheek | 2,766 | 1 | A-pose, idle, walk, wave |
| `base-soldier-variants-review-04` | tapered | 2,858 | 1 | A-pose, idle, walk, wave |

Each completed configuration generated model, rig and animated Blend/GLB outputs,
22 rig-review images and 16 animation-review frames. Manifests record actual
commands, source/configuration/output hashes and working-tree state. The initial
baseline run was interrupted and is not counted as a completed run.

The local installation reports Blender **5.2.2 LTS**, while the repository pins
**5.2.0**. Snap Blender executes the worker code but hangs during native shutdown
with `pa_write() ... Operation not permitted` in this environment. Local completed
runs used an **uncommitted temporary launcher** that runs each worker with
`runpy.run_path`, reports Python exceptions as failure, flushes logs, and exits
the worker process before native audio teardown. This launcher is not part of the
product, is not a test of normal process teardown, and is not evidence of pinned
Blender CI compatibility. CI uses the existing pinned setup and normal executable.
The project accepts `BLENDER_COMMAND` or `--blender`; it does not require Snap.

## Checks

- New style configuration/serialization/review regression checks pass, including
  invalid inputs, exact resolved rig proportions, truncated or external-resource
  GLBs, failed-worker evidence, and refusal to overwrite a prior run.
- Existing StyleDNA, rig, underarm weights, animation, manifest, branch-route and
  platform-adoption tests pass. Governance used cached dependencies in a temporary
  Python 3.13 environment; checked-in requirements were unchanged.
- Model registry, pipeline contracts, semantic analysis, all six API suites,
  configured UI workflow/reference/animation/responsive suites and production UI
  build pass locally using Node 22.23.1.
- A broader sweep ran 30 check commands: 29 passed; the extra, unconfigured
  `guided-studio-shell.test.ts` suite fails one stale source-regex expectation for
  `currentStepIndexFor(frontReady, analysisReady, buildReady, buildStep)`. Its
  source and implementation are unchanged relative to `develop`; no unrelated UI
  repair was included. The configured CI suites remain the integration gate.
- TypeScript tests used `node --import tsx` because the `tsx` CLI's auxiliary IPC
  socket fails with EPERM in the local sandbox. No test assertions were skipped.
- Python compilation, shell syntax and `git diff --check` pass.

## Direct visual inspection

Inspected gold-standard front, three-quarter front, side, three-quarter back,
back, evaluated wireframe, isolated shoulder and isolated hip views. Inspected
broad-cheek front, side and isolated shoulder, plus tapered front and side.
The independently inspected views are still below the visual standard: floating
facial features, exposed crown through the hair cap, oversized flat clothing
panels, green block-like briefs, blocky feet, and shoulder collapse. Generated
animation frames exist but have not been exhaustively visually accepted.

No actual CI artifact or real-time viewport screenshot is claimed as inspected
by this local report. Updated CI must generate the new style-kit artifacts and
those artifacts must be directly reviewed before integration. Keep the PR draft
and #81 in progress; do not claim the visual milestone, merge readiness, full
Khronos glTF conformance, or production promotion.
