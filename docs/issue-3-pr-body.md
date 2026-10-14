## Summary

The published v0.4.0 loader/exporter artifacts contain Draft v1.0 runtime code despite documenting Draft v2.0, blocking the compatible published-package migration required by Issue #3.

Add an isolated publication probe for Basic, Standard and Physical NodeMaterial export/import, with evidence and reproduction instructions in `docs/issue-3-publication-blocker.md`. Fix the 13 existing application lint errors that blocked validation, preserving coordinate-independent graph signatures and existing error handling.

## Outcome

**Blocked and incomplete — draft, do not merge.** The probe exposes exports with version "1.0" and missing `materialType`, and v2.0 imports that return ordinary materials without reconstructing graphs. The production dependencies and TSL integration still use their existing versions and behavior; the migration is not implemented.

Remaining scope: confirm corrected compatible published packages, align dependencies and Three.js, update both exporter paths, register the loader and diagnostics, preserve imported graphs through preview/re-export, adapt supported nodes, and add glTF/GLB round-trip and fallback regression coverage. This PR does not yet satisfy Issue #3's pre-merge acceptance criteria. The upstream-maintainer publication question remains pending; no answer or successful migration result is inferred.

## Validation

Reported by the latest upstream fix checkpoint (registry and runtime probes were not rerun during this publication):

- Registry version lists still end at 0.4.0, and both artifact integrity hashes match the recorded blocker.
- All six isolated runtime probes using Three.js 0.186.1 fail: Basic, Standard and Physical exports emit version "1.0" without `materialType`, and valid v2.0 imports return ordinary materials. These failures reproduce the blocker; they are not passing migration tests.
- `node --check scripts/check-tsl-publication.mjs` and worktree/staged whitespace checks pass.

Verified for this PR update: publication-probe syntax and whitespace checks pass. Only the PR description artifact changed since the previous published head; no additional application changes were made.

The preceding review reports that `npm ci`, `npm run build`, and `npm run lint` pass with the existing locked dependencies; lint retains 20 warnings. These checks do not validate the requested migrated packages. They were not rerun for this documentation-only revision.

An earlier exploratory r186 build failed on TSL API/type changes, and the dependency experiment was reverted. Full migration, ordinary glTF/KTX2 preservation, glTF/GLB round-trips, shared graphs, and fallback/error acceptance remain unverified. Optional WebGPU visual comparison was not performed. The blocker document's checkpoint validation section records the earlier lint failure; the later lint fixes and passing review results supersede that result.

## Related Issues

Related to #3

The current implementation is partial: keep the PR draft and Issue #3 open until the remaining migration and pre-merge acceptance checks are complete. Do not merge this checkpoint.

## Required post-merge verification

Pending actual deployment: verify the GitHub Pages editor loads and its glTF import/export flow works. Pre-merge checks do not establish deployment success.
