# Issue #5 workspace validation

Validated locally on 2026-10-16 with Node.js 24.12.0 and a dedicated disposable
headless Chrome profile against `http://127.0.0.1:5173/`. No repository dependencies
were added or upgraded. No saved-project schema changes were made.

## Commands and results

| Check | Result |
| --- | --- |
| `npm ci` | Passed; installed the locked dependencies. npm reported 15 dependency audit findings; dependency remediation is outside this UI change. |
| `npm run build` | Passed TypeScript and Vite production build. Vite retains its large-chunk warning. |
| `npm run lint` | Passed with zero errors and 19 hook dependency warnings. Compared against the upstream source with ESLint: 20 warnings before, 19 after, no new warning messages. |
| `npm run check:tsl` | Passed publication checks and all 651 editor integration checks, including ordinary/TSL glTF and GLB, Draft v2.0, fallbacks, geometry, textures and actual KTX2Loader pixels. |
| `npm run check:tsl:browser -- http://127.0.0.1:9335 http://127.0.0.1:5173/` | Passed six actual-editor import/preview/text export/GLB download combinations (Basic, Standard and Physical; glTF and GLB). Both explicit AttributeNode WebGPU pixel comparisons passed before export, in imported preview, and after re-export. Updated only the relocated output button's label in this existing runner. |
| `npm run check:workspace:browser -- http://127.0.0.1:9335 http://127.0.0.1:5173/` | Passed the workspace interactions below with no browser runtime errors. |
| `git diff --check` | Passed. |

## Workspace smoke coverage

The new browser runner uses real pointer input for dragging, panning, connecting,
wheel navigation and selected controls; real keyboard input selects cards and
checks visible focus. It also uses DOM button activation and native input/change
events for form workflows. It seeds only its own test slots in the disposable
profile, then exercises the editor's actual IndexedDB loading and autosave paths.

- **1440 × 1000 desktop:** concurrent graph/preview bounds; fit all cards;
  node search automatically reveals results; no-results guidance; add node;
  Undo/Redo; keyboard selection and focus; inspector scalar edit updates the card.
- **Independent output dock:** node drag, background drag, wheel pan, Ctrl-wheel
  zoom, zoom buttons, disconnect and reconnect while output stays open. Connection
  endpoints match visible pin centers. TSL/material/app/glTF output and generated-app
  iframe rendering work; the existing suite checks actual downloads and TSL syntax.
- **Groups/functions:** group, collapse, fit collapsed group, expand, ungroup;
  make function, edit function, aligned function wires, back to graph, expand
  function and Auto Layout.
- **1024 × 844:** desktop graph remains available alongside the right dock.
- **768, 390 and 320 × 844:** switch Nodes/Graph/Inspector/Preview/Output; search
  remains available; node cards stay absolute; graph viewport stays usable; fit and
  connection alignment work after switching panels. Inspector edits made while the
  graph is hidden remain connected correctly on return. Preview canvas resizes to
  the visible panel. No horizontal page overflow.
- **Storage:** existing schema-v2 record loads; edits autosave and survive reload;
  create slot, switch/load, clear and delete (including confirmation dialogs).

The implementation also fixes invalid nested group buttons, bounds collapsed-group
height, measures function pins and avoids measuring hidden compact canvases. Initial
slot state now comes directly from the persisted slot, avoiding overlapping default
and selected-slot loads at startup. These changes support the reorganized workflows
without changing serialization or shader/rendering behavior.

## Visual evidence

Screenshots from the checked implementation and its browser smoke fixture:

- [Desktop: graph, output, live preview and inspector](images/workspace-desktop.png)
- [390px graph](images/workspace-compact-graph.png)
- [390px live preview](images/workspace-compact-preview.png)

Screenshots were visually inspected for panel separation, legibility, preview content
and navigation access. They are examples, not a baseline image comparison.

## Reproduce

Use Node.js 22+ for the browser runners' built-in WebSocket client. Start Vite:

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Launch a dedicated browser profile on an unused debugging port (macOS example;
adapt the executable path on other platforms):

```sh
task_browser_profile=$(mktemp -d)
'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  --headless=new --remote-debugging-address=127.0.0.1 --remote-debugging-port=9335 \
  --user-data-dir="$task_browser_profile" --no-first-run --no-default-browser-check \
  --disable-extensions --enable-unsafe-webgpu http://127.0.0.1:5173/
```

Run the suites sequentially because they manipulate the same dedicated page:

```sh
npm run check:workspace:browser -- http://127.0.0.1:9335 http://127.0.0.1:5173/
npm run check:tsl:browser -- http://127.0.0.1:9335 http://127.0.0.1:5173/
```

## Limitations and pending work

No mandatory local checks were skipped. Physical-device GPU review, lightweight
user testing and before/after screenshots for multiple graph sizes were optional
and were not performed. Headless WebGPU rendering and pixel readback did run;
they do not establish visual correctness across physical GPU/browser combinations.

**Required post-merge verification is pending:** after an authorized merge/deployment,
verify the GitHub Pages workflow and publication, then smoke-check the deployed graph,
preview and export controls. This node does not push, open a PR, merge, comment or
trigger deployment, so it cannot complete that verification.
