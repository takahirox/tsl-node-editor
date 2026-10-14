# Review Guidelines

Use this guidance for maintainer-authorized reviews, including AI reviews, together
with the [development flow](development-flow.md). Write review comments in English
as required by the [collaboration-language policy](development-flow.md#collaboration-language).

## Review against the source Issue

Read the source Issue, its context and acceptance criteria, the PR description, and
the actual diff. Verify that every requirement the PR claims to resolve is addressed.
Do not approve a PR as closing an Issue when required implementation is missing.
Intentionally partial work must be identified and leave the Issue open.

Check for unnecessary scope, unrelated refactoring, speculative abstractions or
frameworks, and dependency, CI, or policy changes with no demonstrated need.
Prefer the smallest change that fully solves the stated problem.

## Check correctness and validation

Verify the resulting behavior and compatibility with the existing architecture.
Check that documentation matches the implementation and useful existing instructions
are preserved. For collaboration files, also check English language, template syntax,
working links and anchors, whitespace, and consistency across the README, AI entry
point, templates, and guidance.

Use the actual [repository tooling](development-flow.md#2-implement-and-validate)
and checks appropriate to the changed files. Check that validation claims describe
what was actually performed, including failures, skips, and unperformed checks.
Documentation-only changes require no new runtime tests, unrelated application
builds, browser/GPU/device confirmation, or deployed-site verification.

## Separate pre-merge acceptance and post-merge verification

Require mandatory pre-merge acceptance to be achievable and verifiable before merge.
Keep optional validation separate. Human-only criteria require a necessary reason
and a concrete expected result; do not invent human approval requirements.

Checks possible only after merge, such as verifying merge-triggered deployment or
publication, must not be pre-merge approval conditions. Record genuinely necessary
post-merge verification separately as pending until performed. Pre-merge evidence
does not prove deployment or publication succeeded. This separation preserves all
implementation requirements and applicable pre-merge checks.

## Choose the review outcome

- **Agent-fixable findings:** Request concrete fixes for missing implementation,
  correctness problems, unnecessary scope, broken links, or insufficient applicable
  validation. Identify the requirement, location, impact, and expected correction.
  Review the updated PR and new evidence again after revision.
- **Waiting for necessary human input:** Record the specific question, why an agent
  cannot resolve it, and the answer or evidence needed. Distinguish this state from
  agent-fixable findings. Use the workflow's wait path until the answer arrives,
  then resume review. Do not send the same missing human confirmation through a
  repeated code-fix loop; continue independent review where useful.
- **Ready to merge:** Approve when the implementation fully addresses the claimed
  Issue scope, the change is correct and focused, mandatory pre-merge checks are
  sufficient and pass, and no blocking findings or necessary human input remain.
  Optional suggestions and pending checks possible only after merge do not block
  approval. Merge when authorized by the current workflow; respect any node-specific
  restriction to review or local work.

## Report required post-merge results honestly

If post-merge verification is required by the Issue, keep it pending until performed,
then record actual results, including failures and necessary follow-up. Do not report
deployment or publication as successful based on pre-merge validation alone.
For templates/documentation-only Issues, state None unless there is a concrete reason
for required post-merge work.
