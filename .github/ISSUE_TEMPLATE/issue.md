---
name: Issue
about: Report a problem or propose a change
title: ""
labels: ""
---

<!-- Write the Issue title and body in English. See the development guidance:
https://github.com/takahirox/tsl-node-editor/blob/main/docs/development-flow.md -->

## Problem

Describe the problem and who or what it affects.

## Expected outcome

Describe what should be true when the Issue is resolved.

## Context and reproduction

Add relevant examples, logs, related Issues, and reproduction steps where applicable.
For runtime problems, include relevant environment details and expected versus actual behavior.

## Pre-merge acceptance criteria

List concrete mandatory criteria that can be achieved and verified before merge.
Default to checks an AI agent can execute and verify. Require human confirmation,
physical-device testing, subjective evaluation, or external approval only when
necessary for this Issue; explain why and what result is expected.

- [ ] Describe an observable completion criterion.

Checks possible only after merge must not be pre-merge approval conditions.
For documentation-only changes, check Markdown syntax, links, whitespace, and
consistency; unrelated runtime tests or browser/GPU/device confirmation are not required.

## Optional validation

List useful additional checks separately from mandatory acceptance, or state None.

## Required post-merge verification

Record only genuinely necessary checks possible only after merge, or state None.
For changes that require deployment verification, record publication and published-site
checks here and keep them pending until performed. Pre-merge validation does not
prove deployment succeeded. Do not add these checks routinely for documentation changes.
