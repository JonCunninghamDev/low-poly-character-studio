# Product Vision

## Purpose

Low Poly Character Studio is an assisted character creator and iterative capability authoring environment for producing usable, stylized 3D characters.

A user can start from one or more reference images or from an approved preset. Reference analysis proposes a configuration inside a designed style family: reusable rig-compatible parts plus bounded proportion controls. The user can refine that appearance without opening Blender, generate and rig the character, review what the system believes its functional anatomy can do, watch those inferred capabilities demonstrated, correct the assumptions, rerun the affected behavior, and save a validated reusable character asset. Saved assets can also be assembled into named, versioned packages that are testable locally before download.

The first supported model type is a stylized Chibi humanoid. The system must be designed so additional character morphologies can provide their own style kits and satisfy the same semantic capability contract without inheriting humanoid-specific visual parts, bones, or animation assumptions.

## Product experience direction

The default experience is a minimal converter, following the product owner's latest direction and Sprite Sheet Maker reference. A simple header leads directly into one workspace with three views: **Uploaded image**, **3D model**, and **Animations**.

Users upload and preview an image, choose **Convert to 3D**, see honest conversion progress, then inspect the real generated model and its available animation clips. The original image remains accessible throughout. Description is optional guidance. Uncertain model interpretation receives one plain-language confirmation; unsupported shapes and failed validation stay explicit.

The permanent step navigator, marker lists, readiness panels, model-type catalog, diagnostics and account/guest gate do not appear in the default path. The existing guided workspace remains available through an optional **Advanced editor** link. Technical detail stays there rather than surrounding the primary upload/conversion task. Downloads require validated output. The current generator supports stylized humanoids; this layout does not imply arbitrary morphology or new animation capabilities.

The canonical interaction, responsive, accessibility, completion, and migration specification is `docs/ui-product-experience.md`.

## Character construction model

Supported character styles are authored as reusable **style families**. For `humanoid/chibi-v1`, the product should behave like a focused game character creator rather than an unrestricted mesh editor.

A style family contains:

- a canonical rig and style envelope;
- semantic part slots such as head shape, eyes, nose, mouth, ears, hair, clothing, hands, and feet;
- approved interchangeable variants for those slots;
- a curated set of bounded continuous controls for useful proportion changes such as wider/narrower, longer/shorter, larger/smaller, or higher/lower;
- named presets composed from exact variant selections and parameter values;
- compatibility metadata for rig anchors, deformation behavior, materials, and attachment rules.

Reference-image analysis should resolve to the closest valid style configuration with confidence/evidence. It should prefer selecting and adjusting approved parts over inventing unconstrained topology. The same persisted style configuration must reproduce the same character even when the original reference images are no longer present.

This is intentionally a hybrid system:

- **discrete presets** are preferred for features where intentional art direction matters, such as eyes, hair, mouth, or head style;
- **bounded controls** are preferred for proportion changes where continuous adjustment is useful, such as head width, eye spacing, shoulder width, limb length, or foot size;
- unrestricted vertex-level editing is outside the primary product experience.

## Core user flow

1. **Choose a character style/model type**
   - Browse supported character morphologies and style families.
   - Start with `humanoid/chibi-v1` for the initial implementation.

2. **Start from references or a preset**
   - Allow the user to begin with the named Chibi default/gold-standard preset without uploading an image.
   - For image-assisted creation, require one image for the minimum viable flow and allow optional front, side, back, and detail images for improved fidelity.
   - Normalize orientation, scale, crop, and image metadata.

3. **Analyze the references into a style configuration**
   - Detect or collect landmarks, silhouette, proportions, major colors, style characteristics, and observed semantic parts.
   - Select the closest approved part variants and bounded parameter values with confidence/evidence.
   - Surface ambiguity and out-of-envelope measurements rather than silently inventing geometry.

4. **Customize appearance**
   - Let the user swap approved variants through semantic selectors such as face/head type, eye type, hair type, mouth type, clothing, hands, and feet.
   - Let the user tune a curated set of bounded controls such as head width, eye spacing, torso width, limb proportions, and other safe style parameters.
   - Persist user overrides separately from image-inferred choices.

5. **Assemble the model**
   - Resolve the exact style-kit version, selected variants, and bounded parameters through a deterministic assembler.
   - Preserve canonical rig anchors, deformation expectations, material slots, and the approved Chibi low-poly style envelope.

6. **Rig and skin**
   - Apply the model type's standard rig strategy.
   - Generate or transfer skin weights.
   - Validate joints, hierarchy, transforms, and deformations across supported style configurations.

7. **Infer functional anatomy and capabilities**
   - Identify likely core/root structures, locomotors, support contacts, manipulators/graspers, sensors, and articulators.
   - Derive a versioned capability profile with confidence, assumptions, evidence, and user-overridable values.
   - Keep semantic action intent independent from morphology-specific animation implementations.

8. **Demonstrate the inferred character**
   - Build a deterministic demo plan from the capability profile.
   - Exercise the required character vocabulary: neutral/setup, idle, walk, run, crouch, kneel, sit, jump, climb, fall, death, crawl, and object manipulation.
   - Surface missing prerequisites, uncertain assumptions, and failed demonstrations instead of hiding them.

9. **Review and refine capabilities**
   - Let the user correct role assignments, supported actions, contacts, manipulators, sensors, and other capability parameters without opening Blender.
   - Persist overrides separately from raw inference.
   - Rerun only the downstream stages invalidated by the edit until the user is satisfied.

10. **Save the individual asset**
   - Persist the selected style configuration, character revision, capability profile, animation mappings, validation state, and reproducibility metadata.
   - Download the individual character independently as a portable GLB with embedded or sidecar style/capability metadata.

11. **Assemble packages**
   - Let users group selected saved asset revisions into named, versioned packages.
   - Record exact asset revisions, package configuration, dependencies, and compatibility metadata in a package manifest.

12. **Test and download packages**
   - Load the exact saved package revision in a local sandbox.
   - Exercise included character capabilities and package-level smoke tests before download.
   - Download the validated package as a portable manifest plus its referenced assets and metadata.

## Required character action contract

Every supported character model type targets a shared semantic action vocabulary. The implementation may differ by morphology, but the meaning remains stable:

- neutral/setup
- idle
- walk
- run
- crouch
- kneel
- sit
- jump
- climb
- fall
- death
- crawl
- object manipulation

The semantic contract describes intent and prerequisites. Concrete Blender actions, animation clip names, controllers, retargeting strategies, and procedural motion implementations remain model-type-specific.

## Initial vertical-slice foundation

The repository's existing first vertical slice remains the implementation foundation:

- Model type: `humanoid/chibi-v1`
- Input: one front reference image, with optional side and back references
- Output foundation: one low-poly humanoid `.glb`
- Geometry: recognizable proportions and major color regions
- Rig: standard humanoid skeleton with usable skin weights
- Existing animations: A-pose, idle, walk, and wave
- Existing proportion system: StyleDNA + `LittleGuyDNA` already provide bounded procedural proportion inputs
- Experience: guided upload, analysis, generation, preview, validation, and download
- Reproducibility: build records model type, pipeline version, StyleDNA, and generation settings

The active product goal converts that procedural foundation into a reusable Chibi style kit with named parts/presets and bounded customization, then expands it into capability inference, the full semantic action pack, iterative capability correction, reusable asset revisions, packages, and local package testing.

## Product principles

- **Designed style system first:** Supported styles are built from intentional reusable parts and bounded controls before resorting to novel topology generation.
- **Useful with or without an image:** A user can start from a preset, while a single image can propose a coherent configuration and additional views can improve confidence.
- **Stylized rather than photoreal:** The product optimizes for clean low-poly interpretation, not exact human reconstruction.
- **Presets where art direction matters:** Discrete approved variants are preferred for visually distinctive features that should remain intentional and coherent.
- **Bounded controls where proportion matters:** Continuous edits remain inside validated style and rig envelopes.
- **Deterministic and editable:** The same versioned style kit, configuration, and settings should reproduce the same asset and capability contracts.
- **Semantic before implementation:** User-facing appearance slots and capability intent are stable even when implementation-specific Blender object names, rigs, or motion implementations differ.
- **Inference is reviewable:** Machine assumptions carry confidence and evidence and can be corrected by the user.
- **Model-type extensibility:** Shared pipeline stages operate through model type, style-kit, and capability declarations.
- **Portable output:** Exported GLBs and package manifests should work without repository-specific runtime code where practical.
- **Independent assets, composable packages:** An asset remains usable on its own even when included in multiple packages.
- **Test what will ship:** Local package testing uses the same saved package revision that will be downloaded.
- **Transparent limitations:** The application exposes confidence, assumptions, unsupported features, stale validation, and failures.
- **Guided rather than tool-first:** A first-time user should always understand the current step and next action without learning pipeline terminology.
- **Visual work surface first:** References and generated characters receive the largest usable region, and every required image or model region remains reachable.

## Initial non-goals

- Photorealistic reconstruction
- Film-quality facial rigs
- Cloth, hair, or fluid simulation
- Unrestricted vertex-level modeling as the primary customization experience
- Arbitrary production-ready topology from every possible image
- Automatic support for every body plan before the character capability contract is stable
- Networked multiplayer or a complete game engine inside the package test sandbox
- Cloud-scale rendering or paid production infrastructure before the local pipeline works end to end
- Billing and team workspaces before the core authoring, asset, and package workflows are coherent

## Success criteria

The product direction is successful when a first-time user can start from the Chibi preset or upload a character image, receive an editable configuration of approved parts and bounded proportions, refine the character without Blender, generate and rig a recognizable low-poly model, understand and correct the system's inferred functional anatomy, demonstrate the required semantic actions, save the accepted character independently, combine chosen saved assets into a package, locally test the exact package revision, and download portable reproducible outputs.
