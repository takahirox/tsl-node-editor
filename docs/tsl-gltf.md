# glTF TSL import and export

The editor uses published loader/exporter **0.4.1** with Three.js **0.186.1** and
its **0.186.0** types. Exports use `THREE_materials_tsl` Draft **2.0** and record
the concrete NodeMaterial type. Both the glTF text viewer and GLB download use
the same exporter configuration and include every populated node slot for each
material. The text viewer abbreviates long buffer URIs for display; use the GLB
download for a complete, re-importable asset.

## Imported material graphs

Connect a GLTF Material node's **baseColor** output directly to the material
output's **baseColor** input to preview and re-export the entire imported TSL
material. Basic, Standard and Physical types, ordinary PBR/extension properties,
all imported graph slots and shared inputs survive. The preview clones material
state and keeps the imported asset intact. Explicit roughness, metalness and
vertex-output connections override those slots on the preview.

The baseColor, roughness, metalness, emissive, opacity and alphaTest pins also
return the corresponding imported node graphs when connected elsewhere. Other
pins continue exposing ordinary material values/textures. Imported graphs remain
opaque GLTF Material assets; they are not expanded into editable palette nodes.
The generated TSL/Material/App JavaScript views still describe the editor's
ordinary pin values, so use **glTF output/GLB download** to retain imported TSL
graphs. This migration does not add a general TSL-to-JavaScript decompiler.

## Supported graph scope and errors

The upstream serializer/resolver pair supports shared TSL node objects,
Const/Uniform numeric, boolean, color, vector and matrix literals, Attribute,
Math and Operator nodes. An **AttributeNode** serializer adapter preserves explicit
node types; imports require nonempty attribute names and supported value types,
with missing/null types retaining geometry-based inference.
The editor supplies paired **VarNode**, **ConvertNode**,
**JoinNode** and **SplitNode** adapters, needed by r186's public constructors and
swizzles. Adapter arguments, required links and allowed link properties are
validated before publishing an imported material replacement. Literal and
attribute nodes reject all links so file data cannot overwrite their values.
Const/Uniform literal constructor metadata also requires supported value types,
shape-compatible node types and valid precision; missing/null node types retain
Three.js inference.

Texture sampling/buffer nodes, Fn/ShaderCall/function/closure nodes, noise nodes
and other unadapted classes cannot currently be exported as glTF graphs.
Ordinary glTF texture properties and GLTF geometry/material/texture nodes still
load, including KTX2 through the existing loader. Exporting a graph with an
unsupported class reports an error in the glTF text viewer or download toast;
it does not produce a successful asset with missing nodes. Dynamic editor
uniforms export their current literal values, not their frame/object callbacks.
Functions that expand into supported editor graphs can be exported; those that
produce unsupported shader classes cannot.

Unsupported encodings (including Draft v1.0), missing/unknown/incompatible
material types, invalid references/cycles, unsupported operations and malformed
adapter inputs report fallback diagnostics in the toast UI. The plugin retains
the original ordinary glTF material, including supported PBR extensions and
textures, and applies no partial TSL graph. Ordinary fallback values are stored
separately from graph results; arbitrary graphs are not baked into PBR values.

## Reproducible integration checks

```sh
npm ci
npm run build
npm run lint
npm run check:tsl
```

`check:tsl` runs six locked-package publication probes and 615 checks against the
same editor import/export/preview functions used by `App.tsx`. It generates
fixtures in memory, uses real Three.js loaders/exporters/plugins, and shims only
browser file I/O primitives. Operation regressions cover missing and malformed
MathNode/OperatorNode references, extra operands and unknown link properties,
preserved ordinary PBR values and useful diagnostics, as well as valid unary
operations and both atan forms. Wrapper, literal and attribute regressions
reject unexpected links (including constructor metadata overwrites) in both
glTF and GLB, preserving the complete ordinary material and parser cache.
Literal metadata regressions cover unsupported/malformed types, incompatible
value shapes and invalid precision, alongside valid inferred/explicit types
and re-exports.
Attribute metadata regressions cover explicit/inferred shader types through
import, preview pins and re-export, and reject malformed names/types with ordinary
PBR and parser-cache preservation in both formats.
The KTX2 fixture uses the
real KTX2Loader and checks
pixel data/dependency identity for ordinary and reconstructed TSL materials. It
uses an uncompressed 1x1 texture and does not exercise Basis-worker transcoding.
The checked-in Basis assets match the locked Three.js assets.

## Reproducible browser UI checks

Use a dedicated, disposable Chrome profile and Node.js 22+ for the browser runner
(which uses the built-in WebSocket client). The application and integration
checks remain compatible with the deployment's Node.js 20.19 tooling.

Start Vite in one terminal:

```sh
npm run dev -- --host 127.0.0.1
```

On macOS, launch a separate local headless browser in another terminal:

```sh
task_browser_profile=$(mktemp -d)
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  --headless=new --remote-debugging-port=9223 \
  --user-data-dir="$task_browser_profile" --no-first-run --no-default-browser-check \
  --window-size=1600,1200 --enable-unsafe-webgpu --use-angle=swiftshader \
  http://127.0.0.1:5173/
```

Adapt the Chrome executable path for other platforms. Then run:

```sh
npm run check:tsl:browser
```

The runner uses only the page at the selected local editor URL, seeds an isolated
IndexedDB storage slot, and drives the real UI through six Basic/Standard/Physical
glTF/GLB cases. It checks loaded material readiness, drawable WebGPU canvas size,
preview graph preservation, glTF text output and the downloaded GLB. It captures
uncaught exceptions and renderer/shader console errors. Close this dedicated
browser and stop Vite afterward. Optional positional arguments select the local
debugger URL and editor URL (for example different localhost ports).
Two additional WebGPU checks compare actual pixels on fixed preview geometry in
fresh renderer contexts before export, in the imported preview and after re-export
for an explicitly typed scalar attribute. They confirm that an inferred vector
attribute produces different pixels. The runner suspends the editor's animation
loop during these independent material comparisons.

These checks do not perform the optional subjective visual comparison on physical
GPU hardware or the required GitHub Pages verification after deployment.
