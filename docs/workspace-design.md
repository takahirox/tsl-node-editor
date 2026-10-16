# Workspace redesign — Issue #5

## Layout comparison (before implementation)

| Direction | Graph + preview | Discoverability | Graph area | Implementation risk | Narrow screens |
| --- | --- | --- | --- | --- | --- |
| Split: palette / graph / preview + inspector | Always simultaneous on desktop | Stable destinations for search, commands and selection | Predictable center; palette can collapse | Low: retain graph coordinates and renderer, give each a separate container | Switch between full-width panels |
| Flexible graph-first: resizable floating/docked preview, collapsible tools, bottom code | Simultaneous, but users must arrange docks | More view-management controls to learn | Largest after adjustment | Higher: resize handles, persistence and pointer arbitration | Multiple resizing rules; floating panels can obscure graph |
| Compact: tabs for graph, library, preview, inspector and output | One active surface at a time | Explicit labels, extra switching | Full available width | Low: CSS visibility preserves mounted editor state | Best fit at limited width |

Choose the **split workspace**, with collapsible palette and a bottom output dock.
Use the compact tabbed direction at 900px and below. The stable split prioritizes
simultaneous feedback and predictable commands without introducing a docking framework.
Keep graph nodes absolutely positioned at every width; hide inactive compact panels
without rewriting node positions or serialized graphs. Keep the renderer mounted and
observe its container size. Code must not disable graph events elsewhere in the workspace.

## Interaction references

- [PlayCanvas](https://playcanvas.com/): graph, rendered result and contextual tools
  inform the split; no visual assets are copied.
- [NodeToy](https://nodetoy.co/): approachable node discovery informs prominent search
  (site unavailable to the reference fetch in this environment).
- [Spline](https://spline.design/) and [Figma](https://www.figma.com/): the Issue's
  hierarchy and contextual-inspector references inform dedicated panel headings.
- [React Flow examples](https://reactflow.dev/examples): explicit zoom/fit controls,
  grouping and navigation patterns. Retain this editor's existing interaction engine;
  a minimap is deferred because fit controls solve navigation without another overlay.
- [Blender](https://www.blender.org/), [Unreal](https://www.unrealengine.com/) and
  [Unity](https://unity.com/): the Issue's established node-editing references inform
  retaining inline values, sockets and function/group editing.

## Implementation boundaries

Global history commands live in the header; graph arrangement/group commands in the
graph toolbar; slots in Project; export formats and the generated-app viewer in Output.
The right inspector shows selection identity, editable label and common scalar/color
values, pin/connection details, warnings, and a focus action. Specialized asset/function
controls remain on cards and in the library. Preserve IndexedDB schema v2 and all
rendering, shader, import/export and history paths.

## Validation

Actual commands and browser results are recorded in [workspace-validation.md](workspace-validation.md).
Required post-merge verification remains **pending**: verify GitHub Pages publication
and smoke-check deployed graph, preview and export controls after deployment occurs.
