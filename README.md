# TSL Node Editor

Node-based editor for building Three.js TSL (Three.js Shading Language) materials with WebGPU preview and export.

Live Demo: https://takahirox.github.io/tsl-node-editor/

## Features

- Visual node graph for TSL materials
- WebGPU live preview + code viewer
- Material and geometry outputs
- Function node creation and reuse
- GLTF geometry/material/texture nodes
- Export to TSL, material, or app output (JS/TS)

## Requirements

- Node.js 18+
- Browser with WebGPU support (Chrome 113+ / Edge 113+)

## Getting Started

```bash
npm install
npm run dev
```

## Notes

- This is an experimental project and has not been thoroughly tested.
- Development follows a vibe-coding approach. Pull requests are not accepted.
- Issue reports and feature requests are welcome and appreciated.

## Collaboration guidance

For Issue authors and maintainer-authorized development (the public PR policy above still applies):

- [Issue template](.github/ISSUE_TEMPLATE/issue.md)
- [Pull request template](.github/pull_request_template.md)
- [Development flow and English collaboration-language policy](docs/development-flow.md)
- [Review and merge guidelines](docs/review-guidelines.md)
- [AI agent entry point](AGENTS.md)

## License

MIT
