## Summary

The editor exported Draft v1.0 TSL data and imported assets without the TSL loader.
Use the corrected published loader/exporter **0.4.1** and the tested Three.js
r186 baseline to support Draft v2.0 glTF/GLB import, preview and re-export.

Both UI export paths now export every populated node slot on each material using
the upstream strict serializer, with paired editor adapters for r186 variable,
conversion, vector-join and swizzle nodes. Imported Basic, Standard and Physical
NodeMaterials retain their complete graphs and ordinary material values through
preview cloning and re-export. Loader failures report useful toast diagnostics
and retain the ordinary glTF material. KTX2 loading remains registered.
Unsupported nodes fail export instead of silently producing incomplete data.

See [support and regression checks](https://github.com/takahirox/tsl-node-editor/blob/docs/issue-3-tsl-publication-blocker/docs/tsl-gltf.md) and
[publication/migration evidence](https://github.com/takahirox/tsl-node-editor/blob/docs/issue-3-tsl-publication-blocker/docs/issue-3-publication-blocker.md) for limits
and reproduction instructions. The former v0.4.0 publication blocker is resolved.

## Outcome

Supported Basic, Standard and Physical NodeMaterials now export Draft v2.0
glTF/GLB with their material types and complete node graphs, and re-import for
preview and re-export. Invalid or unsupported TSL extensions retain the ordinary
glTF material and report diagnostics. Both packages use v0.4.1 as requested in
the [maintainer's Issue update](https://github.com/takahirox/tsl-node-editor/issues/3#issuecomment-6171268446).

## Validation

The implementation checkpoint reports the following checks as passing:

- `npm ci`, `npm run build` and `npm run lint` pass with the migrated lockfile;
  lint retains 20 existing warnings and Vite retains its large-chunk advisory.
- `npm run check:tsl`: six publication probes and 35 editor integration checks
  pass, covering Basic/Standard/Physical glTF/GLB round-trips, preview clones/pins,
  shared graphs, editor adapters, mixed materials, ordinary geometry/PBR/physical
  extensions, actual uncompressed KTX2 imports, complete invalid-extension
  fallback in both formats, and unsupported-node export errors.
- `npm run check:tsl:browser`: six real editor UI round-trips pass in dedicated
  headless Chrome with WebGPU/SwiftShader, including rendered preview, text
  export and GLB download; no uncaught/render validation errors were captured.
- Script syntax and whitespace checks pass.

Publication checks: script syntax and `git diff --check` pass. Application and
browser checks above were performed at the implementation checkpoint and were
not rerun for this description-only publication update.

Optional visual comparison on physical GPU hardware was not performed.
Uncompressed KTX2 parsing and registration are covered; Basis-worker transcoding
is not exercised by these fixtures. Unsupported graph classes and generated
JavaScript preview limitations are documented.

## Related Issues

Closes #3

Keep this PR draft and unmerged during review. Issue #3 remains open; its required
post-deployment verification is pending and must still be recorded after deployment.

## Required post-merge verification

Pending actual deployment: verify the GitHub Pages editor loads and its glTF
import/export flow works. Pre-merge checks do not establish deployment success.
