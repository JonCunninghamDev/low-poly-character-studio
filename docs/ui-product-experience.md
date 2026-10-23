# Product UI Experience

## Current approved direction: minimal converter

The product owner's latest supplied screenshots and direction supersede the default wizard/landing/sign-in path described later in this document. The default route opens a minimal workspace immediately, with a quiet header and **Uploaded image / 3D model / Animations** navigation. Use a restrained dark palette, one accent, generous space and one primary action. The uploaded image and generated asset dominate their respective views.

- Start with a single upload/drop area. Show the original image after selection, a replace action and **Convert to 3D**. Description is optional and disclosed on demand.
- Show real analysis/conversion progress in the model view. Users can return to the original image while the job runs. Do not simulate completion or fabricate models.
- If the supported humanoid interpretation is uncertain, ask one plain-language confirmation. Keep unsupported generators unavailable. Treat heuristic morphology recommendations as advisory: allow an explicit humanoid confirmation without overwriting the machine evidence, and never silently force a humanoid.
- Display the validated generated GLB with rotation/zoom. Animation controls list clips actually loaded from that GLB and support selection and play/pause. Only validated output gets a download link.
- Errors, replaced inputs and retries must remove stale output/downloads. Late requests cannot replace newer input/results. Aborting the browser request does not claim to cancel an already submitted server job.
- Keep marker placement, workflow steps, readiness panels and technical diagnostics in the existing optional **Advanced editor**, opened separately so the minimal session is preserved.
- Use normal vertical workspace scrolling, including short laptop screens. Every control must be reachable at 320px and 390px widths. Tab navigation supports keyboard and visible focus; respect reduced-motion preferences.

`docs/reference-intake.md` describes implementation, test fixtures and limitations. The sections below document the prior guided experience retained as advanced-editor reference; they are not requirements to restore that complexity to the default workspace.

## Previous guided experience (advanced-editor reference)

## Purpose

Low Poly Character Studio should feel like a polished creative product rather than an internal pipeline console. A first-time visitor should understand what the service creates, why it is useful, how to begin, where they are in the process, and what to do next without learning repository terminology.

This document is the canonical experience direction for the landing page, guest entry, guided workspace, and completion flow.

## Experience principles

- **Show the result first.** Lead with a convincing animated character created by the Studio.
- **One primary task at a time.** The current workflow step owns the center of the screen and one action receives primary emphasis.
- **Plain language outside advanced views.** Users place markers, review shape, generate a character, and export an asset. Internal terms such as StyleDNA, build manifests, and stage artifacts remain available in advanced diagnostics but do not drive primary navigation.
- **Progress is always visible.** Completed, current, available, and future steps are distinguishable at a glance.
- **Complexity appears when useful.** Downloads, diagnostics, validation details, and editable technical data remain hidden until the workflow reaches them.
- **The visual work surface dominates.** Reference images and generated 3D content receive the largest usable region.
- **Every required visual target is reachable.** Landmark placement must never depend on clipped content, hidden scroll areas, undocumented modifier keys, or inaccessible image regions.
- **Guest-first for the current milestone.** Users may enter without an account. The shell leaves room for saved projects and authenticated work later without requiring authentication now.

## Experience surfaces

### 1. Landing page

The landing page explains the product before exposing workflow controls.

#### Header

- Product name and compact brand mark.
- Minimal menu for Product, How it works, and About or equivalent informational destinations.
- `Sign in` as a secondary action.
- `Continue as guest` or `Start creating` as the primary action.

#### Hero

- Clear promise: turn one or more character images into a rigged, animated, portable low-poly character.
- A large looping video or screen recording showing a Studio-created character moving through a small obstacle course.
- The sequence should demonstrate idle, walk or run, turn, jump or step-over motion, and one expressive action such as wave.
- Label the example as created with Low Poly Character Studio. It is product proof, not decorative stock media.
- Primary CTA enters the guest workflow.
- Secondary CTA may explain the workflow or replay the demonstration.

#### Information tiles

Three concise tiles sit below the hero:

1. **Start with references** — one front image works; optional side and back views improve fidelity.
2. **Rigged and animated automatically** — the Studio generates the character, humanoid skeleton, skinning, and starter motion pack.
3. **Portable game-ready output** — preview and download a validated GLB with no repository-specific runtime dependency.

A compact visual pipeline may reinforce the journey:

`References -> Markers -> Character -> Rig and motion -> Validate -> Export`

The landing page must not expose job IDs, StyleDNA JSON, validation internals, or unfinished workflow controls.

### 2. Entry choice

Selecting the primary CTA opens a simple entry choice:

- **Continue as guest** — available and primary for the current product milestone.
- **Sign in** — visually present as a future-compatible route. Until authentication is implemented, it may explain that account-based project saving is not yet available rather than presenting a broken control.

Guest mode creates a local project session and enters the workspace. The interface should state that guest projects are local or temporary when that distinction becomes operationally relevant.

### 3. Guided workspace

The workspace uses three stable regions:

```text
+------------------------------------------------------------------+
| Product | project identity / current step            help / menu |
+------------------------------------------------------------------+
| Steps   |                Main workspace               | Inspector|
|         |                                             |          |
+------------------------------------------------------------------+
```

#### Top bar

- Compact product identity.
- Current project name or `Guest project`.
- Current step name and progress, such as `Step 2 of 7`.
- Help and project-level menu actions.
- No floating download or build controls over the visual workspace.

#### Left workflow navigation

The step list is permanent and uses completed, current, available, and future indicators.

Canonical user-facing steps:

1. **Choose character type**
2. **Add reference images**
3. **Place markers**
4. **Review character shape**
5. **Generate character**
6. **Rig and animate**
7. **Review and export**

The implementation may execute additional pipeline stages internally. Those stages appear as progress details within the relevant user-facing step rather than expanding the primary navigation into engineering terminology.

Rules:

- The current step is visually dominant.
- Completed steps are revisitable when doing so is safe.
- Future steps are visible but not presented as actionable before prerequisites are met.
- A step may show a warning or required-correction state without losing its place in the sequence.
- The step list remains stable across projects to build user familiarity.

#### Main workspace

The center region owns the active task:

- Character type: browsable character-type choice.
- References: drop zone and selected image set.
- Markers: large reference canvas with marker controls.
- Shape review: visualized measurements and bounded corrections.
- Generate: progress and stage summaries.
- Rig and animate: 3D viewport and animation preview.
- Review and export: final viewport, validation summary, and download.

Only the current task receives primary emphasis. Empty preview surfaces and future actions should not consume major space.

#### Inspector

The right panel is contextual:

- Character type: capabilities, reference requirements, and limitations.
- References: image requirements, view roles, and quality tips.
- Markers: current marker, description, visibility, zoom, labels, and placement status.
- Shape review: editable supported proportions and confidence or provenance.
- Generation: pipeline progress, warnings, and advanced diagnostics.
- Rig and animate: clip controls, skeleton summary, and motion warnings.
- Export: validation result, metadata, and downloads.

Advanced technical details may live in a collapsible section. They must not compete with the current primary action.

## Workflow behavior

### Readiness and primary actions

- Show one primary action per step.
- Do not show an enabled confirmation or generation action until prerequisites are satisfied.
- Disabled actions must explain the missing prerequisite nearby.
- `Next` instructions must derive from persisted state and update immediately when an action succeeds.
- Downloads appear only when the underlying artifact exists and is useful.

### Progressive disclosure

Do not expose the following during early reference work unless the user opens advanced diagnostics:

- StyleDNA JSON download;
- build-manifest or stage-result download;
- final validation details;
- animation controls;
- export actions.

The product may summarize internal progress in user language while retaining complete technical data for diagnostics and reproducibility.

### Marker canvas requirements

The July 28 product-owner test stopped because the lower image region could not be reached. The redesigned marker experience must satisfy all of the following:

- `Fit` displays the complete image within the available workspace.
- Zooming never makes any image region permanently unreachable.
- Users can pan with direct pointer or touch interaction without relying solely on an undocumented keyboard modifier.
- Native scrollbars or an equally obvious pan affordance appear whenever content exceeds the viewport.
- `Center` and `Fit` recover a lost view predictably.
- The current marker remains visible and distinguishable over varied imagery.
- Keyboard users can reach canvas controls, select marker targets, and move through the workflow.
- Touch and trackpad behavior is defined for supported narrow layouts.
- The canvas remains the dominant surface during marker placement; an empty 3D preview does not compete for width.

## Responsive behavior

### Wide desktop

- Fixed or collapsible step rail.
- Dominant center workspace.
- Contextual inspector visible or collapsible.
- Internal panel scrolling is explicit and does not clip the canvas.

### Tablet and small desktop

- Step rail may collapse to a labeled progress control.
- The workspace remains first in visual order.
- Inspector becomes a drawer or tabbed panel.
- Only one auxiliary panel should consume major space at a time.

### Mobile and narrow windows

- Current step and primary task appear first.
- Steps open from a progress/navigation control.
- Inspector opens as a full-height drawer or bottom sheet.
- Essential actions remain reachable without horizontal page scrolling.
- Marker placement must support touch pan and zoom while preserving access to all image regions.

### Zoom and accessibility review sizes

Review at minimum:

- 320 x 568
- 768 x 1024
- 1024 x 768
- 1366 x 768
- 1920 x 1080
- 1366 x 768 at 125% and 150% browser zoom

Test keyboard focus order, visible focus, drawer open and close behavior, panel scrolling, canvas reachability, status announcements, and action availability.

## Completion experience

The final step should feel conclusive rather than like another diagnostics panel.

- Display `Character complete` only after required validation succeeds.
- Show the generated model in the largest practical viewport.
- Provide starter clip controls for A-pose, idle, walk, and wave when present.
- Summarize validation in plain language and provide advanced detail on demand.
- Present one primary validated GLB download.
- Present StyleDNA, manifests, reports, and other technical files as secondary or advanced downloads.
- Offer `Start another character` and a future-compatible `Save project` location.

## Visual language

- Preserve the existing dark creative-tool direction unless a later product decision changes it.
- Use the gold accent for active state and primary action.
- Use green for completed or validated state.
- Use restrained blue for information.
- Use neutral gray for future, unavailable, or secondary state.
- Use consistent panel radius, spacing, button hierarchy, and typography.
- Avoid multiple simultaneous high-emphasis banners or buttons.

## Migration strategy

The working pipeline should be migrated behind the new shell in bounded phases rather than rewritten all at once.

### Phase 1: Landing and guest entry

- Add landing page and product proof placeholder capable of accepting the final demonstration video.
- Add sign-in and guest choice.
- Enter the existing Studio through guest mode.

### Phase 2: Guided shell

- Add stable top bar, workflow step rail, main workspace, and inspector regions.
- Create the step-state model and plain-language labels.
- Preserve existing functionality behind the new navigation.

### Phase 3: References and markers

- Move upload and marker workflows into their dedicated steps.
- Make the marker canvas fully reachable with direct pan, zoom, fit, center, and explicit overflow behavior.
- Remove empty preview competition and premature technical downloads.

### Phase 4: Generation through export

- Map analysis and StyleDNA correction into `Review character shape`.
- Map compiler stages into `Generate character` and `Rig and animate`.
- Consolidate validation and downloads into `Review and export`.

### Phase 5: Product proof

- Use the completed Studio to produce the hero character and obstacle-course recording.
- Replace the landing placeholder with the approved product-created demonstration.

Each phase must retain automated contract coverage and generate responsive evidence. A phase may merge into `develop` when its defined behavior and objective evidence are complete. Human product testing occurs when the combined experience forms a coherent milestone.

## Out of scope for this design milestone

- Account storage, authentication provider selection, billing, and team workspaces.
- Public production deployment.
- New character-generation behavior or revised chibi visual standards.
- FBX or `.blend` export promises not already supported by the product contract.
- Marketplace, sharing, collaboration, or asset-library implementation.
