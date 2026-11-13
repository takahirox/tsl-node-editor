<!-- Write the PR title and body in English. Follow the development and review guidance:
https://github.com/takahirox/tsl-node-editor/blob/main/docs/development-flow.md
https://github.com/takahirox/tsl-node-editor/blob/main/docs/review-guidelines.md -->

## Summary

Explain the problem and the focused changes that address it.

## Outcome

Describe the resulting behavior, with a before/after example when useful.
State any intentionally incomplete scope and remaining work; do not automatically close
the parent Issue for partial work. Pending post-merge-only checks do not make a complete
implementation partial.

## Validation

List the checks actually performed and their results against mandatory pre-merge
acceptance. Report failures, skipped checks, and unperformed checks with reasons.
Keep optional validation separate. Choose checks appropriate to the changed files
and existing repository tooling; documentation-only changes need no unrelated runtime tests.

## Related Issues

Link the source Issue and any related Issues. Use and preserve `Closes #<number>` for a
complete solution with applicable mandatory pre-merge acceptance satisfied, even when
post-merge-only verification is pending. Use a non-closing reference for partial work.

## Required post-merge verification

State None unless the Issue requires checks possible only after merge.
List any such checks separately as pending until performed; pre-merge evidence
does not prove publication or deployment succeeded.
After merge and Issue closure, follow the
[post-merge lifecycle](../docs/development-flow.md#5-merge-and-record-any-required-follow-up)
for accurate evidence and linked defect Issues. Closure does not claim pending checks passed.
