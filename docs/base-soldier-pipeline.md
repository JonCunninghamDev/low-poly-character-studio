# Base soldier pipeline

Low Poly Character Studio owns the reusable base soldier and its later dressable
variants. The product-owner direction of October 23, 2026 prioritizes the base
milestone in #81 / PR #93 before uniforms or role equipment. The existing Studio
pipeline and canonical `humanoid-basic-v1` rig remain the implementation boundary.
The independent `/home/crowbottom/soldier-v2` prototype is exploratory evidence,
not an approved generator, canonical skeleton, or production asset.

## First milestone

Build the named Gold Standard Chibi configuration, skin it to the existing rig,
export its A-pose/idle/walk/wave clips, and review the neutral silhouette and joint
behavior against `gold-standard-humanoid-chibi.md`. Separate clothing remains part
of the style kit; rifleman, medic, radio, helmet, and backpack variants follow
base acceptance. The first milestone does not claim automatic reconstruction
from image pixels, a completed outfit system, or the full semantic action pack.

Use the repository's pinned Engineering Platform contract and normal issue branch
-> tested PR -> `develop` route. `main` promotion remains a human decision. No
change to the adopted platform version, authority, CI requirements, or acceptance
standard is introduced here.

## Reproduce a review

Install the repository-pinned Blender with `pnpm blender:setup`, use `blender` on
PATH, or explicitly select an installation through `BLENDER_COMMAND` / `--blender`.
There is no dependency on Snap or a fixed machine-specific installation path.
Record the actual Blender version; an override is not proof of pinned-toolchain
compatibility.

```bash
pnpm style-kit:test
pnpm style-kit:review --fixture gold-standard \
  --output-dir image-analysis/output/base-soldier-review-001
```

Omit `--fixture` to exercise all three representative configurations, including
alternate head, eyes, mouth, hair, clothing, and bounded proportion controls.
Repeat `--fixture` to select a subset. Always choose a new output directory;
existing and failed runs are preserved rather than erased.

Optional local reference evidence:

```bash
BLENDER_COMMAND=/absolute/path/to/blender pnpm style-kit:review \
  --fixture gold-standard \
  --reference-dir /absolute/path/to/images-assets \
  --output-dir image-analysis/output/base-soldier-review-002
```

This records hashes of `gold-standard-front.png`, `gold-standard-side.png`, and
`gold-standard-back.png`. Images remain local and are not copied or committed.
They are visual comparison evidence; the generator consumes the complete saved
style configuration. The same configuration reproduces geometry without images.

## Stage handoffs and evidence

Each fixture writes its exact `style-configuration.json`, then runs the existing:

1. model worker -> Blend, GLB, generation metadata and selected source-part IDs;
2. rig worker -> canonical rig, weighted mesh, rig metadata and GLB;
3. animation worker -> animated Blend/GLB and clip metadata;
4. rig reviewer -> five turnaround views, evaluated wireframe and isolated-joint
   diagnostics;
5. animation reviewer -> sixteen sampled frames across the four supported clips.

Style-kit rigging uses `--generation-metadata` from the model stage. This restores
its full resolved DNA, including proportion overrides, and checks the sidecar
against the metadata embedded in the Blend. Supplying unrelated sidecars fails.
The legacy `--style-dna` rig path remains available for non-style-kit jobs.

`review-run.json` records source/configuration/output hashes, Git head and local
diff state, actual Blender version, platform pin, each command/exit status,
reference hashes, and limited GLB structural checks. Checkpoints persist after
stages; failures preserve logs and previous outputs. Structural completion is
separate from visual acceptance, which remains `pending` until actual review.
These checks are not a full Khronos glTF conformance validator.

Outputs stay under ignored `image-analysis/output/`. Do not commit reference
images, generated private assets, or large Blend/GLB binaries. CI evidence must
still be downloaded and directly inspected before a visual implementation is
considered integration-ready; local renders do not substitute for that gate.

## Initial inspection and next work

The first local gold-standard rig review exposed visible gaps: facial features
float ahead of the face in side view, the shirt is long and flat, feet are blocky,
and raised-shoulder deformation collapses. This baseline is **not visually
accepted**. Review the same views after each focused correction, including side
and back views and isolated shoulder/hip diagnostics. No claim is made that the
scratch prototype or existing preset already meets the gold standard.

The base should pass silhouette, facet/triangle-budget, clothing fit, neutral
pose, joint motion, and portable rig/animation review before outfit development.
The existing Studio UI/reference-assessment work in #86 / PR #95 remains separate.

## Later damage reactions

The product owner also wants convincing bullet and explosion reactions. Preserve
the canonical skeleton and clean joint weights so a game-engine integration can
add localized hit animations, animation-to-ragdoll blending, collision bodies,
joint limits, directional impulses, and recovery states. Physics and damage logic
belong to the runtime integration; they are not provided by this Blender review
pipeline. Wounds and clothing damage are a separate presentation layer. No damage
system, engine choice, or Brothers in Arms fidelity claim is included in this PR.
