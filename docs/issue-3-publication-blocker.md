# Issue #3: published v0.4.0 runtime blocker

The migration in [Issue #3](https://github.com/takahirox/tsl-node-editor/issues/3)
is **blocked and incomplete**. On 2026-10-14, both requested npm packages were
available as v0.4.0, but their published `dist` files implemented Draft v1.0.
Their bundled READMEs described Draft v2.0. No compatible newer release appeared
in the registry version lists at the time of this check.

## Verified evidence

Installed the registry packages with `three@0.186.1` and
`@types/three@0.186.0`, then exercised their exported runtime APIs:

- The exporter emitted `version: "1.0"` and omitted `materialType` for Basic,
  Standard and Physical NodeMaterials with a uniform color graph.
- The real GLTFLoader with the published loader plugin and its default resolver
  returned ordinary materials for valid v2.0 input for all three families.
  It did not reconstruct the graph or report an unsupported-version diagnostic.
- The exporter declaration retained the removed `version` option; the loader
  declaration retained `materialType` and `supportedVersions` and omitted the
  documented v2.0 `materialTypes` mapping. The runtime matched those old APIs.
- The upstream source at `main` contained the new v2.0 implementations. The
  installed package entrypoints resolve to `dist/index.js`, not that source.

Registry artifact identifiers:

| Package | Published at (UTC) | `dist.integrity` |
| --- | --- | --- |
| `@takahirox/gltf-three-materials-tsl-exporter@0.4.0` | 2026-10-14 09:32:36.305 | `sha512-D1cexuiSnk3ulxx7E1qe5ut2UQpVct0T+n7+dOE/s9bVqj5zT8cd5OuMt28yp87Xwwib66wBq6gmzJx61OC8IA==` |
| `@takahirox/gltf-three-materials-tsl-loader@0.4.0` | 2026-10-14 09:31:23.986 | `sha512-Mud9kNxNfcrLQf0sldY/EDrG8ZcLSiDfuYjhLgFZnUFRU3Z4H5wxLstuqaiCN2q/uXVqEmCWrMImQ3375RckWA==` |

The dependency experiment was reverted. Production source, package.json and the
lockfile retain the upstream checkpoint's behavior. Changing just the version
field, using the old loader options, or installing unpublished upstream source
would not satisfy the Issue's compatibility and publication requirements.

## Reproduce the publication check

From the repository root, use a separate temporary install so the editor's
dependency files stay intact:

```sh
probe_dir=$(mktemp -d)
npm install --prefix "$probe_dir" --ignore-scripts --no-audit --no-fund \
  @takahirox/gltf-three-materials-tsl-exporter@0.4.0 \
  @takahirox/gltf-three-materials-tsl-loader@0.4.0 three@0.186.1
node scripts/check-tsl-publication.mjs "$probe_dir"
```

The script is a publication gate, separate from the application's checks. It
asserts v2.0 encoding, material type and graph entrypoint on exported materials,
and uses the actual GLTFLoader to assert v2.0 reconstruction. All six assertions
failed against the artifacts above, as expected for this blocker. It does not
replace the full glTF/GLB, fallback, resource or editor regression coverage still
required by the Issue.

## Checkpoint validation

- Restored upstream lockfile: `npm ci` passed.
- Restored application: `npm run build` passed.
- `npm run lint` failed with 13 existing errors and 20 warnings in unchanged
  `src/App.tsx` (unused bindings and `prefer-const` errors).
- Isolated publication probe: six failures reproduced against the registry
  packages. This is expected blocker evidence, not a passing migration test.
- `node --check scripts/check-tsl-publication.mjs` and `git diff --check` passed.

## Resume requirements

1. Publish rebuilt compatible loader/exporter artifacts upstream, ensuring the
   package runtime and declarations agree with the v2.0 README. Confirm the
   corrected registry release and its supported APIs before installing it.
2. Resume the entire editor migration: dependencies, both exporter paths,
   loader registration and diagnostics, imported NodeMaterial preview and
   re-export, paired node adapters or documented limitations, and regression
   coverage. The current glTF material node reads ordinary values; review its
   handling of imported node slots so reconstructed graphs survive editor use.
3. Adapt r186 TSL APIs/types. The exploratory upgraded build failed, including
   removed `atan2` and more specific node return types; lint also reported
   existing source errors. Complete `npm ci`, build, lint and Issue acceptance
   checks after implementation.
4. Keep the required GitHub Pages import/export verification pending until the
   actual post-merge deployment. Optional WebGPU visual comparison was not run.

No upstream publication, push, pull request, merge or comment was performed.
