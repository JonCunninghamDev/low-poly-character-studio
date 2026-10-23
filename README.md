# Low Poly Character Studio

Low Poly Character Studio is an image-to-asset pipeline for generating stylized, rigged, low-poly 3D models that can be previewed and downloaded as `.glb` files.

## Product goal

A user should be able to:

1. choose a supported model type
2. upload a front reference image, with optional side and back references
3. review or refine inferred style and proportion data
4. run modeling, rigging, animation, validation, and export stages
5. preview the generated asset and its animation clips
6. download one self-contained `.glb`

The first supported model type is `humanoid/chibi-v1`. Its canonical visual target is defined in [`docs/gold-standard-humanoid-chibi.md`](docs/gold-standard-humanoid-chibi.md).

The first animation set targets:

- A-pose
- idle
- walk
- wave

See:

- [`docs/product-vision.md`](docs/product-vision.md)
- [`docs/architecture.md`](docs/architecture.md)
- [`docs/gold-standard-humanoid-chibi.md`](docs/gold-standard-humanoid-chibi.md)
- [`docs/local-vertical-slice.md`](docs/local-vertical-slice.md)
- [`docs/task-management.md`](docs/task-management.md)
- [`AGENTS.md`](AGENTS.md)

## Current implementation

The repository currently contains:

- a React, Vite, and Three.js Studio driven by the model-type registry
- front-reference upload, analysis, explicit model-type confirmation, landmark editing, and editable StyleDNA
- persisted, resumable build jobs exposed through the local API
- a manifest-driven Blender compiler for modeling, rigging, animation, review output, validation, and export
- a viewport-first responsive workspace with persisted stage status
- animated GLB preview, clip selection, structural validation, and validation-gated download

The current `humanoid/chibi-v1` milestone can be exercised locally from the approved reference through one validated animated GLB. Follow [`docs/local-vertical-slice.md`](docs/local-vertical-slice.md) for exact reproduction and human milestone checks.

## Base soldier development

The reproducible preset-to-rig review workflow and its current visual limitations
are documented in [Base soldier pipeline](docs/base-soldier-pipeline.md).
Run `pnpm style-kit:test` for fast contracts and `pnpm style-kit:review --fixture gold-standard --output-dir image-analysis/output/base-review-001` for a new local build and review.

## Local development

Requirements:

- Node.js 22
- pnpm 9
- Blender available as `blender` for generation, or the repository-pinned Blender toolchain

Install dependencies and start the API and Studio:

```bash
pnpm install
pnpm studio
```

Open:

```text
http://localhost:5173/
```

To run only the Studio:

```bash
pnpm studio:ui
```

To install the pinned Blender toolchain and exercise the complete manifest compiler:

```bash
pnpm blender:setup
pnpm manifest-compiler:smoke
```

Focused vertical-slice checks:

```bash
pnpm vertical-slice:test
pnpm pipeline-runner:test
pnpm studio-responsive:test
pnpm studio:build
```

## Delivery

Pull requests and pushes to `develop` or `main` run continuous integration. Green pushes produce traceable Studio build artifacts. Production promotion is a reviewed pull request from `develop` to `main`; a build artifact is delivery evidence, not proof of public deployment.