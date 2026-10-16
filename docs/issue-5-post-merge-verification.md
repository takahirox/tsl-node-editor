# Issue #5 post-merge verification

Verified on 2026-10-16 after the authorized merge of
[PR #6](https://github.com/takahirox/tsl-node-editor/pull/6).
This completes the post-merge checks left pending in
[workspace-validation.md](workspace-validation.md).

## Merge and publication

- Issue #5 was read immediately before the merge and confirmed open.
- GitHub merged the expected head `e2f2059ae009fe2a8b8ca6bf3863165b8ae1e9a6`
  using merge commit `3cf2acbf5268f151de667ac2db734c2bc56da879`.
  The commit has two parents, including the expected PR head.
- The merge-triggered [GitHub Pages workflow](https://github.com/takahirox/tsl-node-editor/actions/runs/38900408726)
  completed successfully for that merge commit, including build and deployment.
- The [published editor](https://takahirox.github.io/tsl-node-editor/)
  loaded the redesigned workspace and `assets/main-DL1vgB71.js`.

## Deployed editor smoke checks

Used a dedicated disposable headless Chrome profile with WebGPU enabled and
Chrome DevTools Protocol automation. No dependencies or application code changed.

- At 1440 × 1000, graph and preview occupied separate visible regions; Fit graph
  worked. The preview canvas had a nonzero backing width and reported
  `WebGPU/TSL running`.
- Searching for Number and activating its result added a node.
- Code & export opened generated output. Download output produced a 1,392-byte
  JavaScript TSL file.
- Selecting glTF displayed parseable glTF 2.0 JSON. Download glTF produced a
  96,424-byte GLB with a valid magic number, version and declared length;
  its JSON contained `THREE_materials_tsl`.
- At 390 × 844, Graph and Preview tabs exposed their respective panels;
  Fit graph remained available, the graph and preview canvas were wider than
  250 CSS pixels, and the page had no horizontal overflow.
- No runtime exceptions were observed during the completed search/export/compact
  smoke sequence. The disposable browser was closed afterward.

The initial automation attempted to activate Number before searching, when its
button was not present. The corrected check used node search and passed.

These are focused publication smoke checks, supplementing the pre-merge suites
reported in workspace-validation.md. They do not repeat all integration tests or
establish physical-GPU visual correctness; the latter remains optional.
