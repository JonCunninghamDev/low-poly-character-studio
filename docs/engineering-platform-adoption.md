# Engineering Platform adoption

Character Studio adopts released Engineering Platform `v1.0.0` at immutable commit
`b107c9306161b395cbcaffebb55e47850b999560` through issue #90. The release tag,
latest published non-draft/non-prerelease release, platform `main`, README and
VERSION were verified together before copying files. The release is available at
https://github.com/JonCunninghamDev/engineering-platform/releases/tag/v1.0.0.

The consumer-owned `engineering-policy.json` selects the `node-python-blender`
profile. `.engineering-platform/release.json` inventories the exact unmodified
released contract, validator, schemas and profile sources with SHA-256 digests.
The source validator resolves the local profiles and validates the policy without
network access. Install its development dependency with
`python3 -m pip install -r requirements-platform.txt`, then run:

```bash
python3 scripts/test-platform-adoption.py
```

The adoption tests exercise schema/profile compatibility, copied-file integrity,
pin/workflow consistency, prohibited direct release writes and unchanged local
route scenarios. They deliberately reject newer execution command-binding fields
that are not in the pinned release. These tests validate governance configuration;
they do not assert that image understanding or generated characters are correct.

## Local authority and compatibility

Product vision, architecture, task selection, Blender pipeline, approved Chibi
visual standard, artifact inspection and milestone acceptance stay in local
AGENTS.md and product documents. The synchronized shared contract is a default
below that authority. The machine policy explicitly retains the existing local
Hotfix exception: a titled issue branch can target main with human review and is
then synchronized to develop. Ordinary implementation still targets develop.
The shared integration-first hotfix default does not silently replace this route.

Shared release/security/credential/contract/workflow gates are represented in the
released review vocabulary. Additional local spending, deployment, unresolved
product/security decisions and operating-authority gates are restrictive policy
overrides, retaining the existing local rules. An executor must interpret those
restrictions before using this policy; schema validity alone grants no execution
or approval authority. No public hosting, credential or production setting changes.

Existing `.github/workflows/ci.yml` and `release.yml` are preserved. The added
`platform.yml` calls the released reusable consumer workflow at the full SHA with
read-only contents permission and runs the offline adoption suite under Python
3.12. It does not replace Blender or Studio validation. A platform GitHub outage
can prevent the reusable CI job starting, but it cannot prevent local development,
reading steering or running the checked-in tests.

## Validation stage mapping

The released policy schema describes stage identity/capability/required status;
consumer commands remain in this document and existing workflows. It does not
support the newer managed-execution command-binding fields.

| Policy stage | Consumer-owned commands and evidence |
| --- | --- |
| `platform-adoption` | `python3 scripts/test-platform-adoption.py`, including local delivery-route scenarios |
| `node-contracts` | Existing `studio-build` CI job: frozen pnpm installation; model-types, pipeline-contracts, semantic-analysis, build-jobs, reference-analysis, animation-catalog, final-workflow, model-runner, rig-runner and animation-runner tests; Studio build and responsive review capture |
| `python-contracts` | Existing `source-validation` CI job: shell syntax, route scenarios, StyleDNA, manifest compiler, rig, underarm weights and animation-pack contract tests; Python compilation |
| `blender-review` | Existing `blender-rig-smoke` CI job: pinned Blender setup, real fixture generation, GLB/rig/animation validation and retained review artifacts |

All current-head required checks must pass. Existing generated-artifact review and
human milestone acceptance requirements remain in force. GitHub artifact identity
is build evidence, not proof of a hosted service or subjective product acceptance.

## Governed feature milestone

The next product milestone is a complete Character Studio feature delivered and
validated under Engineering Platform governance. The first bounded candidate is
the #86 description step: upload a reference, describe the subject or explicitly
skip, and preserve that choice as distinct provenance through analysis. Completion
requires executable tests and browser evidence, a traceable PR/CI/build, and a
product-owner checkpoint; it does not imply all #86 image-understanding criteria
or arbitrary morphology generation are complete.

The optional execution coordinator and GitHub gateway merged in platform #79/#80
are **unreleased experimental tools**. They are not synchronized here or made
consumer authority by this adoption. A later verified release/adoption must supply
their command-binding contracts before they can govern a real consumer run. The
fixed host/credential boundary, consumer restrictions and real delivery proof must
also be validated. Do not fabricate an authorized envelope by dropping required
checks, overriding policy restrictions or substituting unreleased schemas.

## Rollback and upgrade

This is the first adoption; there is no prior platform pin. Revert the focused
adoption PR through an ordinary develop-targeting PR to return to the prior local
steering/CI. No application data, generated assets, runtime manifests or lockfile
migration is involved. The original product CI remains available throughout.
Subsequent upgrades must verify a published release, update the immutable pin and
synchronized files/hashes together, identify changed public surfaces, test the
complete consumer suite and state rollback to this exact pin. Never replace the
pin with platform `develop` merely to obtain an experimental execution feature.
