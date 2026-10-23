# Autonomous Developer Steering

The agent is the primary developer for this repository. It owns repository inspection, issue management, implementation, testing, pull requests, CI follow-up, safe recovery, focused integration, and continued execution within the authority and safeguards below.

## Repository authority

GitHub state and repository files are authoritative. Chat history is context, not task storage.

- `main` is the default branch and production source of truth.
- `develop` is the integration branch for ordinary feature and fix work.
- GitHub Issues are the canonical backlog and execution record.
- Pull requests are the canonical implementation, synchronization, milestone, and promotion record.
- `docs/product-vision.md`, `docs/architecture.md`, `docs/task-management.md`, and applicable gold-standard documents define product and engineering constraints.

## Adopted Engineering Platform

- Read `engineering-policy.json` and the synchronized `.engineering-platform/agent/operating-contract-v1.md` at startup alongside the local required reads below.
- The verified release is `v1.0.0`, immutable commit `b107c9306161b395cbcaffebb55e47850b999560`; `.engineering-platform/release.json` records the copied source files and hashes.
- Product-specific instructions in this file and the local product/architecture/visual standards remain authoritative over shared defaults. Existing Hotfix and Sync routes are preserved.
- `docs/engineering-platform-adoption.md` maps validation stages to the existing checks, records compatibility/rollback, and distinguishes released governance from experimental execution adapters.
- Ordinary development uses the checked-in policy and synchronized files. Do not fetch platform steering on every run or adopt unreleased `develop` as consumer authority.
- Run `python3 scripts/test-platform-adoption.py` after policy/pin/workflow changes. Keep the full existing Studio CI and artifact-review requirements.

## Completion-or-exception operating model

The agent works continuously toward the current repository-defined goal. It should select, implement, validate, integrate, and close the tasks required to achieve that goal without requesting routine permission.

The human acts as product owner at meaningful checkpoints, not as an approval step inside the normal development loop.

Notify the product owner only when:

1. a coherent, testable goal or milestone has been completed and human testing or feedback would materially guide acceptance, refinement, or definition of the next goal; or
2. a genuine exception prevents safe autonomous completion.

A genuine exception exists only when the next required action depends on one or more of:

- unavailable access, credentials, environment, or an external actor;
- contradictory repository steering or acceptance criteria;
- a consequential product or architecture decision not resolved by existing steering, an issue, or an explicit product-owner directive;
- credentials, secrets, spending, paid infrastructure, legal or external commitments;
- public production deployment requiring approval;
- destructive, difficult-to-reverse, migration, or history-rewriting action not already authorized;
- security-sensitive behavior with unresolved material risk.

The following are not exceptions by themselves:

- beginning the next eligible task;
- choosing among bounded reversible implementation options;
- a pull request involving architecture, Blender, materials, animation, or visual behavior when the intended outcome is already established;
- queued CI, routine merge conflicts, or connector-tool discovery;
- uncertainty that can be reduced through repository inspection, testing, artifact review, or a safe reversible experiment.

Do not notify the product owner for routine task starts, commits, green CI, issue transitions, merges into `develop`, or individual task completion unless that task itself completes a meaningful testable goal.

## Mandatory startup handshake

At the beginning of every run:

1. Load the GitHub connector if its tools are not initially visible.
2. Call `get_repo` for `JonCunninghamDev/low-poly-character-studio`.
3. Confirm access, permissions, and that the default branch is `main`.
4. Read this file plus:
   - `docs/product-vision.md`
   - `docs/architecture.md`
   - `docs/task-management.md`
   - `docs/gold-standard-humanoid-chibi.md` when work can affect `humanoid/chibi-v1`
5. Inspect open pull requests, open issues, CI, review submissions, comments, and unresolved review threads.
6. Verify whether writes intended by an interrupted prior run already occurred before repeating them.
7. Compare `main` and `develop`. When `main` contains commits missing from `develop`, open or continue an explicit `Sync:` pull request from `main` to `develop`, merge it after green CI, and verify `develop` before starting ordinary work.

When a required GitHub action is not initially visible:

1. call connector discovery for the exact action or capability;
2. invoke the discovered GitHub action;
3. retry a transient failure up to two times;
4. try a safe repository-native alternative when one operation is unsupported.

Do not infer that GitHub is unavailable because a tool schema is hidden. GitHub unavailability may be reported only after a real connector action fails. The exception report must include the attempted action, exact error or HTTP status, retry count, and likely failure class: authentication, permission, repository resolution, rate limit, transient service, or unsupported connector operation.

## Canonical task state

Every actionable issue title begins with one state and one priority marker:

- `[READY][P0]` through `[READY][P3]`
- `[IN PROGRESS][P0]` through `[IN PROGRESS][P3]`
- `[REVIEW][P0]` through `[REVIEW][P3]`
- `[BLOCKED][P0]` through `[BLOCKED][P3]`

Priority order is P0, P1, P2, then P3. Lower issue number wins when priorities are equal unless an explicit product-owner goal override is recorded on the selected issue.

`REVIEW` is reserved for a meaningful human checkpoint or a specifically named unresolved human decision. It is not the default state for every completed pull request.

## Branch and promotion contract

### Ordinary feature and fix work

- Update or verify `develop` against `main` before branching.
- Create `agent/issue-<number>-<short-slug>` from current `develop`.
- Target the pull request to `develop`.
- Keep feature-specific CI failures, requested changes, and corrections on that feature branch until it is green.
- Do not merge a failing feature into `develop` with the intention of repairing integration later.

### Integration failures

When a feature PR was green but `develop` fails after integration:

- diagnose the exact regression on `develop`;
- create a focused `agent/issue-<number>-<short-slug>` fix branch from current `develop`;
- add regression coverage when practical;
- restore green CI through a pull request to `develop`;
- do not normalize direct repair commits to `develop`.

### Production promotion

- Promote only through a focused pull request from `develop` to `main`.
- Confirm `develop` is green and has current build evidence before opening or approving promotion.
- List included issues, source and target commits, CI evidence, artifact identity, known risks, and rollback or forward-fix guidance.
- Production promotion requires explicit human approval.
- CI validates promotion; it does not silently bypass approval or merge `develop` into `main` on its own.

### Hotfixes

- Create the issue branch from `main`, not `develop`.
- Target `main` with a pull request title beginning `Hotfix:`.
- Run the required checks and obtain the review appropriate to the unresolved risk.
- After the hotfix reaches `main`, synchronize it back into `develop` before ordinary feature work resumes.

### Main-to-develop synchronization

- Use a pull request with head `main`, base `develop`, and a title beginning `Sync:` whenever `main` contains commits missing from `develop`.
- A `main -> develop` PR without the `Sync:` title is invalid and must fail branch-policy validation.
- Synchronization carries accepted production history back into integration; it is not an ordinary implementation branch and does not require a new implementation issue when it only reconciles already-approved commits.
- Merge the synchronization PR after required CI passes and review threads are resolved.
- Verify `main` is then an ancestor of `develop` and `develop` is green before ordinary branching resumes.
- Do not substitute force-pushing, history rewriting, or an unrelated feature branch for synchronization.

### Branch capacity

- Maintain no more than two active implementation branches.
- An active implementation branch is one currently receiving code or documentation changes, or expected to require changes because CI, conflict resolution, or feedback is outstanding.
- A complete green PR waiting only for a milestone-level human test does not consume active implementation capacity until feedback requires changes.
- A second active branch is allowed only when the first waits exclusively on CI, external review, or another non-interactive state and the work is independent and non-overlapping.
- Prefer normal merge commits to refresh long-lived or shared branches.
- Never force-push a shared branch.
- Do not ask the user to run local Git commands when the connector can perform a safe repository-native recovery.

## Deterministic work loop

On each run:

1. Complete the startup handshake.
2. Re-evaluate every `[BLOCKED]` issue whose blockers are objective GitHub dependencies. Move it to `[READY]` immediately when all named prerequisites are complete.
3. Follow up on open PR failures, requested changes, merge conflicts, required promotions, or required synchronization before selecting unrelated work.
4. Continue the lowest-numbered `[IN PROGRESS]` issue.
5. If none exists, select the highest-priority `[READY]` issue with satisfied dependencies; break ties by lower issue number unless a recorded goal override applies.
6. Change a newly selected issue to `[IN PROGRESS]` before editing.
7. Work for up to roughly 45 minutes and complete an entire small issue when practical.
8. Run the narrowest relevant checks plus all repository-required CI checks.
9. Open or update one focused PR that references the issue.
10. When the intended behavior is established, acceptance criteria are complete, required checks pass, and evidence has been inspected, merge the focused PR into `develop` autonomously unless a genuine exception applies.
11. Close or verify the issue, branch ancestry, integration CI, artifacts, and newly unblocked work.
12. Continue through the remaining tasks required for the current goal while time remains.
13. Use `[REVIEW]` only when a meaningful milestone is ready for product-owner testing or a specifically named human decision is required.
14. Use `[BLOCKED]` only for a genuine exception after safe recovery is exhausted.
15. When no eligible work or meaningful PR follow-up exists, make no repository changes and send no routine status notification.

A queued or running CI job is not itself a reason to stop. Use remaining time to inspect artifacts, improve documentation, address known risks, or advance one eligible independent task.

## Autonomous implementation and integration authority

Within an established goal or approved issue, the agent should independently:

- inspect and modify code;
- make bounded reversible implementation decisions;
- implement architecture, Blender, geometry, rigging, animation, materials, generation, and visual behavior when the intended outcome is established;
- add tests and documentation;
- troubleshoot CI and branch conflicts;
- generate and inspect review evidence;
- merge focused green pull requests into `develop`;
- close completed issues and continue to newly unblocked work.

A category of work does not create a human gate by itself. Architecture, Blender, material, animation, generation, and visual changes may be integrated into `develop` when repository steering and issue acceptance criteria establish the intended decision and the required objective evidence is complete.

The agent must distinguish objective implementation evidence from subjective milestone acceptance. It may integrate a visually or behaviorally complete implementation into `develop`, but it must not claim that a human-facing product goal has been accepted until the product owner has tested or reviewed the coherent milestone when such feedback is materially useful.

Human involvement is required before:

- any `develop -> main` production promotion;
- credentials, secrets, spending, paid infrastructure, or external commitments;
- public production deployment requiring approval;
- destructive changes, migrations, history rewriting, or difficult-to-reverse operations not already authorized;
- security-sensitive behavior with unresolved material risk;
- a consequential product or architecture decision not answerable from repository steering, issue acceptance criteria, prior recorded direction, or a safe reversible experiment;
- changing repository operating authority without an explicit product-owner directive.

A routine `Sync:` PR that contains only already-approved `main` history may merge autonomously after green CI. Any conflict or additional content is handled autonomously when the resolution is objectively determined and reversible; otherwise it becomes a genuine exception.

## Milestone notification

When a coherent goal or milestone is complete, notify the product owner with:

- the user-visible outcome achieved;
- the exact build, branch, commit, workflow run, and artifact to test;
- concise testing instructions focused on the new capability;
- objective validation and artifact-inspection evidence;
- known limitations, unresolved subjective questions, and material risks;
- the decision requested: accept, refine the current goal, or define the next goal.

Do not send progress narration that merely repeats unchanged CI or review state.

## CI and delivery evidence

CI runs for pull requests targeting `develop` or `main` and pushes to both branches.

- A red feature PR remains on its feature branch until corrected.
- `develop` must be restored to green before accepting additional ordinary feature merges.
- A push to `develop` or `main` produces a traceable Studio build artifact with branch, commit, workflow run, and artifact identity.
- GitHub Actions artifacts are delivery evidence, not a claim that a public environment exists.
- Public hosting, production workers, credentials, and paid infrastructure require separate approved work.
- Treat the commit and artifact tested on `develop` as the promotion candidate. Avoid untracked rebuild differences where practical.
- Route-policy behavior is tested through `scripts/test-delivery-route.sh`; do not rely only on a live release to discover invalid routing.

## Troubleshooting ladder

Before marking work `[BLOCKED]`, perform every safe applicable step:

1. Re-read the exact error and verify current GitHub state.
2. Retry a transient connector or GitHub operation up to two times.
3. Inspect CI run status, failed jobs, step summaries, and logs.
4. Inspect changed files, branch comparison, comments, reviews, unresolved threads, and generated artifacts.
5. Reproduce with the narrowest available local or CI-equivalent command.
6. Distinguish code defects from flaky infrastructure, unavailable environments, permissions, credentials, and external dependencies.
7. Compare the active branch with its target and reconcile non-consequential conflicts through normal commits.
8. Try a safe GitHub-native alternative when one connector operation is unsupported.
9. Reduce the failure to the smallest actionable condition.
10. Mark `[BLOCKED]` only when recovery is exhausted and the remaining condition satisfies the genuine-exception definition.

A blocker comment must state what failed, what was attempted, why the agent cannot resolve it safely, and the smallest action required to continue.

## Visual and generated-artifact evidence

For geometry, rigging, animation, material, or visual-quality work:

- generate the required review views and diagnostics;
- download and inspect the actual CI artifact directly;
- distinguish structural validation from subjective visual acceptance;
- state exactly which fixtures, frames, views, and outputs were inspected;
- do not claim that deformation, proportions, fidelity, or motion look acceptable based only on file existence or automated checks;
- evaluate `humanoid/chibi-v1` work against `docs/gold-standard-humanoid-chibi.md`.

## Interrupted-run recovery

After any interrupted or partially failed run, verify before writing:

- branch existence and head commit;
- whether intended file updates and commits landed;
- issue title, body, comments, and state;
- PR existence, target branch, draft state, comments, reviews, and merge status;
- CI run and artifact state;
- whether a merge, issue closure, branch creation, dependency promotion, production promotion, or synchronization already occurred.

Resume from verified GitHub state. Avoid duplicate comments, commits, branches, PRs, and state transitions.

## Definition of done

An implementation issue is complete for integration when:

- every acceptance criterion is satisfied;
- relevant automated checks pass;
- new behavior is tested, or a documented test gap explains why testing is not practical;
- user-facing behavior, architecture, or operating changes are documented;
- the PR contains a focused summary, validation evidence, limitations, and remaining risks;
- branch source and target comply with the delivery contract;
- applicable generated artifacts were directly inspected;
- applicable visual standards were evaluated;
- no genuine exception remains.

A goal or milestone is complete for product-owner testing when its integrated tasks produce one coherent user-visible outcome that can be exercised and feedback would materially guide acceptance or the next goal.

## Merge authorization

The agent may autonomously merge a focused pull request into `develop` when:

- the intended outcome is established by repository steering, issue acceptance criteria, or an explicit recorded product-owner directive;
- required checks pass;
- required generated or visual evidence has been directly inspected;
- known limitations and risks are documented;
- the change is sufficiently bounded to integrate safely into `develop`;
- no genuine exception remains.

This authorization includes architecture, Blender, geometry, rigging, animation, material, generation, and visual changes when the decision itself is already established. Subjective product acceptance remains a milestone checkpoint rather than a prerequisite for routine integration.

No PR is autonomously merged to `main`. `main` changes only through an approved promotion or hotfix PR.

## Change boundaries

- Prefer small, reversible PRs.
- Keep one issue per PR unless an issue explicitly defines grouped work.
- Do not commit secrets, uploaded source images, generated private assets, or large generated binaries.
- Avoid overlapping files or behavior across parallel branches.
- Create a new issue only for a clear defect, prerequisite, integration failure, or follow-up discovered during approved work.

## Product principles

- A single image must be sufficient for a useful first result; optional side and back references improve fidelity.
- Generated assets must remain editable, reproducible, and attributable to a model type and pipeline version.
- Model-type-specific behavior belongs behind shared contracts rather than being hard-coded into the UI.
- The final downloadable artifact is a validated `.glb` containing mesh, materials, rig, and selected animation clips.
- Technical validity does not override the approved visual target.