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
MathNode and OperatorNode inputs are validated before applying a TSL material;
malformed or missing references, extra operands and unknown link properties
preserve the ordinary material and report the operation and input in the
diagnostic. Valid unary operations and both atan forms continue to round-trip.
Wrapper, literal and attribute nodes also reject unexpected links, including
links that could overwrite validated constructor metadata or literal values.
ConstNode and UniformNode metadata is checked before upstream resolution:
unsupported value types, shape-incompatible node types and invalid precision
report diagnostics and preserve the ordinary material and parser cache.
AttributeNode serialization preserves explicit node types through export, import,
preview and re-export. Imports validate nonempty attribute names and supported
node types before resolution; malformed metadata preserves the ordinary material
and parser cache, while missing/null node types retain geometry-based inference.
JoinNode import/export requires a concrete value type or an inferred type;
conversion unions are rejected with diagnostics before applying TSL. ConvertNode
continues to support conversion unions.

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

The upstream fix node reports these results for the latest JoinNode validation
fix in its assigned worktree:

- `npm ci`, `npm run build` and `npm run lint` pass with the migrated lockfile;
  lint retains 20 existing warnings and Vite retains its large-chunk advisory.
- Six publication probes and 651 editor integration checks pass, covering
  Basic/Standard/Physical glTF/GLB round-trips, preview clones/pins,
  shared graphs, editor adapters, mixed materials, ordinary geometry/PBR/physical
  extensions, actual uncompressed KTX2 imports, complete invalid-extension
  fallback in both formats, malformed MathNode/OperatorNode references, extra
  operands and unknown link properties, valid unary operations and both atan
  forms, unexpected wrapper/literal/attribute links and constructor metadata
  overwrites, malformed literal valueType/nodeType/precision metadata,
  valid inferred/explicit literal types and re-exports,
  explicit/inferred attribute types and re-exports, malformed attribute names
  and types in both formats, invalid JoinNode conversion unions and metadata,
  valid inferred/explicit JoinNode types and ConvertNode unions,
  complete ordinary-material/parser-cache preservation, and
  unsupported-node export errors.
- `npm run check:tsl:browser`: six real editor UI round-trips pass in dedicated
  headless Chrome with WebGPU/SwiftShader, including rendered preview, text
  export and GLB download; no uncaught/render validation errors were captured.
  These browser checks were rerun successfully after the AttributeNode fixes;
  they were not rerun after the subsequent JoinNode validation fix.
- Two WebGPU pixel comparisons pass for explicitly typed scalar attributes
  before export, in imported preview and after re-export; inferred vector
  attributes produce different pixels as expected. These use headless
  Chrome/WebGPU/SwiftShader rather than physical GPU hardware.
- Script syntax and whitespace checks pass.

Publication checks: script syntax and `git diff --check` pass. Runtime results
above are inherited from the upstream checkpoints; application and browser checks
were not rerun for this PR publication update.

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
