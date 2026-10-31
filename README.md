# TSL Node Editor

Node-based editor for building Three.js TSL (Three.js Shading Language) materials with WebGPU preview and export.

Live Demo: https://takahirox.github.io/tsl-node-editor/

## Features

- Visual node graph for TSL materials
- WebGPU live preview + code viewer
- Material and geometry outputs
- Function node creation and reuse
- GLTF geometry/material/texture nodes
- [Draft v2.0 TSL glTF/GLB import, preview and export](docs/tsl-gltf.md)
- Export to TSL, material, or app output (JS/TS)

## Requirements

- Node.js 18+
- Browser with WebGPU support (Chrome 113+ / Edge 113+)

## Getting Started

```bash
npm install
npm run dev
```

## Workspace

The desktop workspace keeps the node library on the left, the material graph in the
center, and the live preview and selected-node inspector on the right. Search reveals
matching nodes immediately; use **Nodes** in the header to collapse the library.

- **Project** manages browser-local slots. Changes save automatically; selecting a
  slot loads its graph and assets. Clear/Delete actions still require confirmation.
- **Undo/Redo** live in the header. **Auto Layout**, **Group Selected** and
  **Ungroup Selected** live above the graph. Group cards retain **Make Function**;
  function cards retain **Edit** and **Expand**. Function pin editing is in the library.
- **Fit graph** and zoom controls sit below the graph. Drag the background or scroll
  to pan; Ctrl + scroll zooms around the pointer. Shift-click selects multiple nodes.
  Focus a node and press Enter/Space to select it by keyboard. Delete removes selection;
  Ctrl/Cmd + Z and Ctrl/Cmd + Shift + Z undo and redo.
- Select a node to inspect its label, common values, pins, connections and warnings.
  Specialized geometry, texture/KTX2, material and function controls remain on cards.
  Drag an output pin to an input to connect; click an input to disconnect.
- **Code & export** opens a dock below the graph. Choose TSL, Material, App or glTF,
  JS/TS where applicable, then copy/download. **Viewer** runs the generated app;
  the live preview remains alongside the graph. The glTF option retains the existing
  GLB download behavior described in [TSL glTF documentation](docs/tsl-gltf.md).

At 900px and below, **Graph**, **Nodes**, **Preview**, **Inspector** and **Output**
buttons switch between full-width panels. Graph positions, connections and zoom are
preserved while switching; **Project** and history remain in the header.
See the [layout comparison](docs/workspace-design.md) and
[validation instructions/results](docs/workspace-validation.md).

## Notes

- This is an experimental project and has not been thoroughly tested.
- Development follows a vibe-coding approach. Pull requests are not accepted.
- Issue reports and feature requests are welcome and appreciated.

## Collaboration guidance

For Issue authors and maintainer-authorized development (the public PR policy above still applies):

- [Issue template](.github/ISSUE_TEMPLATE/issue.md)
- [Pull request template](.github/pull_request_template.md)
- [Development flow and English collaboration-language policy](docs/development-flow.md)
- [Test and CI performance principles](docs/development-flow.md#test-and-ci-performance-principles)
- [Review and merge guidelines](docs/review-guidelines.md)
- [AI agent entry point](AGENTS.md)

## License

MIT
