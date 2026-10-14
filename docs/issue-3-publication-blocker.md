# Issue #3: publication blocker resolved

The earlier published v0.4.0 artifacts contained Draft v1.0 runtime code despite
v2.0 documentation. The maintainer's [Issue #3 update](https://github.com/takahirox/tsl-node-editor/issues/3#issuecomment-6171268446)
requires **v0.4.1** for both packages and asks that the Issue remain open until
all acceptance criteria are satisfied. Do not install v0.4.0.

## Current evidence

Registry queries for both exact v0.4.1 package versions succeed. The editor now
locks exporter/loader **0.4.1**, `three` **0.186.1** and `@types/three` **0.186.0**.
The lockfile records the registry URLs and integrity hashes. Installed package
entrypoints and declarations implement the v2.0 APIs: the exporter supplies the
actual material type, and the loader requires a resolver and chooses the type
from each extension. No removed version/materialType/supportedVersions options
are used.

The six publication probes now pass: Basic, Standard and Physical exports emit
version `2.0`, correct material types and graph entrypoints; the real loader
reconstructs each material and its uniform color node without diagnostics.

```sh
npm ci
node scripts/check-tsl-publication.mjs
```

An optional directory argument probes a separate npm install instead of the
locked editor dependencies. Both plugin manifest versions must be `0.4.1`.

## Editor migration and verification

Both UI export paths use the strict upstream serializer with the editor's paired
r186 Var/Convert/Join/Split adapters. The loader registers the corresponding
resolver and routes fallback diagnostics to the toast UI. Imported TSL materials
retain their full material state and node slots in preview and re-export.
See [glTF support and reproducible checks](tsl-gltf.md) for supported nodes,
limitations and browser reproduction instructions.

Verified in the assigned worktree:

- `npm ci` passes with the migrated lockfile.
- `npm run build` passes; Vite reports its existing large-chunk advisory.
- `npm run lint` passes with 20 existing hook-dependency warnings and no errors.
- `npm run check:tsl` passes six publication probes and 35 editor integration
  checks: glTF/GLB round-trips, preview clones/pins, shared graphs, paired
  adapters, mixed-material slots, ordinary PBR/extensions/geometry, actual
  uncompressed KTX2 texture loading, invalid-extension fallback in both formats,
  and unsupported-node export errors.
- `npm run check:tsl:browser` passes six actual UI cases in a dedicated headless
  Chrome with WebGPU/SwiftShader: Basic/Standard/Physical glTF and GLB imports,
  rendered previews, text exports and GLB downloads retain their entire graphs.
  The runner checks canvas dimensions and captures uncaught/render validation
  errors. This verifies rendering behavior, not a subjective visual comparison.
- Script syntax and `git diff --check` pass.

The later fallback-fix checkpoint reports `npm ci`, build and lint passing, plus
199 editor integration checks. It adds operation-specific required-input and
reference validation for MathNode/OperatorNode before applying imported TSL
materials. Malformed graphs preserve ordinary PBR values and emit diagnostics;
valid unary operations and both atan forms retain their round-trips. The six
publication probes and six browser UI checks above are evidence from the earlier
implementation checkpoint; browser checks were not rerun for the fallback fix.

The publication blocker and missing editor implementation are resolved. Optional
visual comparison on a physical GPU was not performed. Real Basis-worker
transcoding is not covered by the uncompressed KTX2 fixture; the bundled Basis
transcoder assets match the locked r186 assets byte-for-byte.

## Required follow-up

Keep Issue #3 open. The required GitHub Pages import/export verification remains
pending until the actual post-merge deployment. Publication updates the existing
draft PR with the fallback fix and current validation evidence; it does not merge
or verify deployment.
The updated reviewable PR body is in [issue-3-pr-body.md](issue-3-pr-body.md).
