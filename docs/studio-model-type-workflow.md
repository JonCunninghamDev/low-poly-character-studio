# Image to animated asset

The product owner's requested outcome is one uploaded image producing an editable, validated 3D asset with animations appropriate to its model type. Preserve the existing Studio and shared compiler architecture rather than building a parallel application.

## User journey

1. Upload a front image. Side/back references are optional.
2. Assess image quality, subject, morphology and confidence. Suggest supported model types. Ask for confirmation when uncertain; report unsupported types without silently substituting a humanoid.
3. Infer shape, colors, semantic parts and landmarks through the selected type's adapter. Manual marker correction is optional assistance when automated evidence is insufficient, with a clear review/confirmation step.
4. Generate geometry and materials using Blender; rig only parts that support deformation.
5. Offer semantic animation actions supported by the selected type and generated rig. State prerequisites and unavailable actions rather than fabricating successful clips.
6. Preview, inspect validation, and download a self-contained GLB with the selected clips. Preserve input provenance, confirmed edits, job stages and reproducible artifacts.

## Type-specific behavior

| Type | Geometry and rig | Candidate actions |
| --- | --- | --- |
| Humanoid | Body proportions, limbs, articulated skeleton, contact-aware motion | idle, walk, run, kneel, sit, lie down, stand up, wave |
| Tree | Species/shape-informed trunk, branch hierarchy, canopy and optional branch deformation | still, gentle wind sway, stronger wind sway, branch movement |

These are product requirements, not a claim that those generators or clips currently exist. A still tree may legitimately need no animation. Tree movement should be selected explicitly; humanoid motion must never be applied to it.

## Delivery sequence and evidence

- Establish a trustworthy humanoid path first: upload, reviewed shape, explicit marker confirmation, persisted generation handoff, rig/animation, validated preview and GLB download.
- Implement the additional humanoid semantic actions with motion/contact tests and inspected Blender renders.
- Add a tree model type through the shared registry, with its own assessment, parameters, generator, optional rig, supported actions, fixtures and GLB checks. Define the supported tree classes before promising species fidelity.
- Validate UI controls at the reported laptop viewport (~1366x610), short viewports and mobile widths. Check actual behavior and reachability, not CSS text alone.
- A single photograph does not determine hidden geometry uniquely. Expose inferred assumptions and optional additional views instead of claiming exact reconstruction.

## Current limitations

The repository provides a humanoid foundation and local pipeline. Full product acceptance requires real generated artifacts and human review. The cloud's pinned Blender download returns HTTP 403, and GitHub API calls return Forbidden. Local code and planning artifacts are not equivalent to a published release, merged PR, or successful generation on the user's laptop.
