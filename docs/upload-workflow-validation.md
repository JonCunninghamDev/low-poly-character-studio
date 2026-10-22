# Upload-first automatic shape workflow

New Studio sessions start with an empty image canvas and an open upload panel. Bundled references are available only through the explicit Load Little Guy example action. Persisted upload metadata cannot restore a browser blob URL after refresh, so the UI requests an upload again rather than displaying a default image as though it were the user's reference.

Uploading a front image automatically runs the existing local image assessment. When it selects a supported humanoid type, the humanoid adapter supplies shape landmarks automatically. When classification abstains or proposes an unsupported type, the UI keeps the evidence visible. The user can explicitly identify a front-facing humanoid to obtain automatic humanoid shape suggestions; this choice is recorded as a user selection and does not change the classifier's evidence. This does not implement tree generation or a general vision model.

Users review the suggested shape and can correct markers if needed. Confirmation requires a registered front reference and valid geometry. The shell re-reads persisted input on confirmation, preventing a missed initial event from leaving the user on the upload step. Applying inferred landmarks updates React state directly rather than simulating eleven canvas clicks. Pending analysis is invalidated on input changes. Optional side/back uploads preserve the front image's object URL.

## Repeatable browser check

With Node 22 and pnpm 9.15.9:

```bash
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm dev
```

In another terminal, run `pnpm studio:e2e:test`. An existing Chromium executable can be used with `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium pnpm studio:e2e:test`.

The test runs at 1366x610 and 390x700. It checks empty startup despite stale metadata, image upload, automatic assessment, type-confirmed automatic landmarks without manual placement, preservation after an optional reference upload, successful marker/type confirmation, and persisted generation input after editor unmount. It intercepts the build request and stops before Blender; it does not validate actual model output.

The local silhouette adapter produces heuristic suggestions. Real Blender generation, rig/animation quality, image fidelity, and final GLB acceptance require separate generation and visual validation.
