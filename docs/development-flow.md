# Development Flow

This guidance applies to maintainers and AI agents working on authorized changes to
TSL Node Editor. The [README](../README.md#notes) policy that public pull requests
are not accepted still applies; Issue reports and feature requests are welcome.
The PR flow below is for maintainer-authorized work.

## Collaboration language

Use **English** for newly authored templates, development/review/merge documentation,
AI instructions, Issue and PR titles and bodies, review comments, and commit messages.
This convention does not require translating historical content or changing product localization.

## 1. Start with an Issue

Use the [Issue template](../.github/ISSUE_TEMPLATE/issue.md) to capture the problem,
expected outcome, relevant context, reproduction steps where applicable, and concrete
completion criteria. An assignee or owner field is not required.

The source Issue defines scope. Choose the smallest change that fully addresses it.
Clarify genuinely blocking ambiguity before dependent work; do not invent requirements.

Default to acceptance criteria an AI agent can execute and verify. Require human
confirmation, physical-device testing, subjective evaluation, or external approval
only when necessary for the actual Issue. Explain why and what result is expected.
Separate optional validation from mandatory completion criteria.

Mandatory pre-merge acceptance must be achievable and verifiable before merge.
Checks possible only after merge must not be pre-merge approval conditions. Record
genuinely necessary post-merge work separately, rather than adding it routinely.
For a change requiring verification of a merge-triggered deployment, validate the
implementation and applicable builds before merge, then verify publication after merge.
This separation does not waive implementation requirements or applicable pre-merge checks.

## 2. Implement and validate

Work from the current default branch, `main`, or the assigned worktree and upstream
commit when a workflow provides them. Preserve useful existing code and instructions.
Keep changes focused; avoid unrelated refactoring, speculative frameworks, and
dependency or CI changes unless the Issue needs them.

The repository uses npm with `package-lock.json`, React, TypeScript, Three.js, and Vite.
For work needing application tooling, install the locked dependencies with `npm ci`.
The existing deployment workflow uses Node.js 20.19.0; use a Node version compatible
with the locked dependencies. See [package.json](../package.json) for available scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Run `tsc -b` and build the application with Vite. |
| `npm run lint` | Run ESLint; the configuration targets TypeScript/TSX source. |
| `npm run preview` | Serve a local production build with Vite. |
| `npm run check:tsl` | Run locked-package publication probes and Node-based editor import/export/preview integration checks. |
| `npm run check:tsl:browser` | Check actual-editor glTF/GLB import, WebGPU preview, export/download and attribute pixels. |
| `npm run check:workspace:browser` | Check workspace interactions, responsive layout, storage and generated-app viewer behavior. |

There is no `npm test` script, dedicated unit/component suite, or configured Markdown
linter. The browser runners need Node.js 22+, Vite and a dedicated disposable Chrome
profile; see [TSL check setup](tsl-gltf.md#reproducible-browser-ui-checks) and
[workspace check setup](workspace-validation.md#reproduce). Run them sequentially
when sharing a page. Choose checks based on the changed files and the Issue. For
application changes, build and lint where relevant, and check affected behavior as
needed. Apply the [test and CI performance principles](#test-and-ci-performance-principles)
when choosing validation. Do not invent commands or claim unperformed checks.

For templates/documentation-only changes, inspect Markdown and template syntax,
resolve links and anchors, check whitespace with `git diff --check` (including staged
files with `git diff --cached --check`), and review consistency against the Issue.
Use available Markdown tooling when applicable. These changes require no new runtime
tests, application build, browser/GPU/device confirmation, or deployed-site verification.

### Test and CI performance principles

**Detect the required failures at the lightest appropriate layer, without redundant
execution.** Preserve required behavior, regression assertions and meaningful
integration coverage when moving or consolidating checks.

1. **Prefer the lightest meaningful layer.** For future tests, cover calculations,
   branches and broad data combinations with fast unit/component checks that catch
   concrete defects rather than mirror implementation. Use the existing Node-based
   `check:tsl` for real loader/exporter boundaries; reserve browser/WebGPU checks for
   DOM interactions, storage, downloads, renderer behavior and pixels that need them.
2. **Choose combinations deliberately.** Use representative cases for distinct paths
   through glTF/GLB, material types, graph states, viewport sizes and output modes.
   Expand combinations exhaustively where interactions require it, rather than
   automatically crossing every dimension. Retain required format/material
   regressions and browser coverage when redistributing checks.
3. **Match validation to the change.** Documentation needs the Markdown/link/whitespace
   checks above. UI changes need affected workspace/browser checks; core graph or
   import/export changes need relevant TSL integration checks and browser/WebGPU
   coverage at affected boundaries. Build/CI changes need applicable configuration
   and build validation. Give fast feedback first, then complete applicable regression
   validation before merge; keep optional checks separate. The only current workflow
   builds and publishes Pages on `main` pushes or manual dispatch; there is no PR CI
   workflow. Publication is a separate responsibility: record genuinely required
   deployment verification after merge, without deferring applicable pre-merge checks.
4. **Reuse work and avoid duplicate execution.** Reuse builds, fixtures, downloads and
   expensive setup when inputs match, with suitable cache keys and isolation. Pages
   already caches npm downloads and passes a build artifact to deployment. Future CI
   should avoid equivalent push/PR runs for the same revision and cancel superseded
   runs when safe, preserving deployment ordering. Measure resource use before adding
   parallel workers; browser suites sharing a page must remain sequential.
5. **Review added confidence and cost together.** Identify the additional defect a
   new or expanded check detects, existing coverage supplying the same assurance,
   and execution/maintenance cost. Watch repeated browser, renderer or TypeScript
   compiler setup, large model/texture fixtures, long rendering loops and growing
   Cartesian products. Consolidate redundant work while retaining meaningful assertions.
6. **Maintain an execution-time budget.** No measured normal-CI timing baseline or
   target is recorded here. Establish one from actual runs during separately scoped
   test/CI performance work, then monitor growth and investigate overruns. Track elapsed
   feedback time, total runner/computation time and queue time separately. Revisit
   validation structure and duplication as costs grow while retaining required coverage;
   this policy adds no benchmark requirement, universal time limit or new merge gate.

Changes to test implementations, workflows, caches or worker counts require separately
scoped implementation work; these principles alone do not authorize them.

## 3. Create a Pull Request for the Issue

Use the [PR template](../.github/pull_request_template.md) and target `main` unless
the authorized workflow specifies another base. Explain the problem, resulting behavior,
focused changes, related Issues, and validation actually performed. Report failed,
skipped, and unperformed checks accurately, including reasons. Separate optional
validation and pending required post-merge verification from pre-merge results.

Use an English commit message that describes what changed and why, referencing the
source Issue. Claim to close an Issue only when the implementation fully addresses it.
For intentionally partial work, state the remaining scope and keep the Issue open.
Pending checks possible only after merge do not make a complete implementation partial.

## 4. Review and revise as needed

Follow the [review guidelines](review-guidelines.md). Review completeness against
the source Issue, correctness, unnecessary scope, and appropriate validation.
Fix agent-fixable findings and review the updated PR again.

When necessary human input is missing, record the specific question, why it blocks
progress, and the expected answer or evidence. Use the workflow's wait path and resume
when an answer arrives; do not repeatedly request code fixes for missing human input.

## 5. Merge and record any required follow-up

Approve and merge when the implementation and mandatory pre-merge checks are
sufficient and no blocking review findings remain, within the authorization of the
current workflow. Instructions that restrict a node to implementation and a local
commit take precedence over this general flow.

The [deployment workflow](../.github/workflows/deploy.yml) publishes GitHub Pages
on pushes to `main` or manual dispatch. Pre-merge checks cannot prove that deployment
or publication succeeded. When the Issue genuinely requires post-merge verification,
keep it pending until performed, then record actual results, failures, and follow-up.
For templates/documentation-only Issues, required post-merge verification is normally None.

The normal flow is Issue → implementation → PR → review → revision as needed → merge,
followed by post-merge verification only when required.
