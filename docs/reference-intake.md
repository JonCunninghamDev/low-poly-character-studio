# Reference description and image-only intake

After uploading a front reference, the Studio waits for one explicit choice:

- Describe the subject and press **Analyze image**.
- Press **Analyze without description** to assess only the image.

The existing description field remains lightweight. It accepts up to 2,000
characters and is guidance from the user, rather than visual ground truth. A
contradictory description does not confirm a model type or invent missing anatomy.
The image-assessment engine still accepts image-only requests without a description.
An uncertain image can still require an explicit humanoid interpretation before
shape suggestions; other morphologies are not silently sent to a humanoid generator.

## Persistence and invalidation

Each upload has a new reference ID, including replacement with the same filename.
The persisted `reference-set/v1` input carries a separate `reference-intent/v1`
record containing that ID, a `user-provided` origin, decision (`described` or
`skipped`) and decision timestamp. A described decision stores the trimmed text;
a skipped decision stores no description, including any draft text that was
present when skip was clicked. The generic assessment retains a copy of the exact
input decision separately from measured/inferred evidence. The reference set is
included in the generated build-job request, preserving its provenance.

While awaiting a decision, `userIntent` is null. Changing the description or front
image clears the previous assessment, marker review and model-type confirmation.
The user must make a new decision and review the new result. Late asynchronous
results are discarded through the existing analysis-run identity. Adding an
optional side/back view preserves the front decision and its live preview URL.
A new session begins without an uploaded image or a stale description/decision;
source images are not restored from metadata alone.

The Studio navigation, marker confirmation and final generation submission check
that the decision matches the current front ID. These are product-flow guards,
not an authentication or hostile-client security boundary. Existing API clients
and the underlying image-only analyzer do not acquire a mandatory text requirement.
No Blender modeling, rig, animation or final GLB contracts change in this feature.

## Validation and delivery

`pnpm marker-review:test` includes serialization, stale-image, malformed-provenance,
empty/oversized-description and skip-with-draft regression tests. The real browser
workflow runs with `pnpm studio:e2e:test` against a running Studio, optionally using
`STUDIO_URL` and `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. It covers 1366×610 and 390×700,
including described/skip paths, editing confirmed data, removing/replacing the
same file, optional references and the actual generation request payload.

The browser test uses real upload, image analysis and marker review. It intercepts
the final job POST to stop before Blender; it is not evidence that a new uploaded
character was generated or that arbitrary image-to-3D works. The independent
existing Blender fixture smoke remains required CI evidence for the generator.

`scripts/capture-responsive-studio.sh` runs this browser test on the built preview
and retains pending/review screenshots plus `results.json` under `upload-workflow/`
in the existing responsive CI artifact. It requires no live API or Blender process.
For local use the default browser output is `image-analysis/output/upload-workflow`.

This feature progresses Studio #86 under the adopted released Engineering Platform
v1.0.0 steering/policy, while preserving local product rules. It does not complete
all generic assessment criteria in #86, prove the unreleased managed execution
host, promote a platform release or deploy production. Roll back through a focused
revert of the feature PR; no application-data migration is required.
