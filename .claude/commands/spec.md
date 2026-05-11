---
description: Generate a detailed feature spec from requirements and codebase
argument-hint: <feature name or description>
allowed-tools: Read, Write, Edit, Glob, Grep, WebFetch, Task
disable-model-invocation: true
---

Read CLAUDE.md and docs/magicmirror-sdk.md first.

Generate a detailed feature spec for: $ARGUMENTS

## Step 1: Gather context

Ask me these questions (skip any I've already answered in the description above):
1. What problem does this solve for the user?
2. Which service areas of the codebase does this touch?
3. Are there any constraints I already know about (backward compatibility, performance, security)?
4. Is there a PM ticket or rough requirements doc I can reference? (If so, I'll paste it.)

## Step 2: Analyse the codebase

Based on the service areas identified:
1. Read the relevant source directories to understand existing patterns
2. Identify the files and interfaces this feature will likely touch
3. Note any existing code that can be reused or extended
4. Identify cross-service contracts that may be affected

For complex features touching 3+ service areas, use parallel sub-agents to investigate different angles simultaneously (data model, API layer, test coverage, similar patterns). Synthesise the findings before generating the spec.

## Step 3: Generate the spec

Write a detailed feature spec to `docs/features/{feature-name}.spec.md`. The spec must be detailed enough for an agent to implement without further clarification:

**Requirements**: specific and testable. Each requirement should be one behaviour. Include error cases and edge cases explicitly, not as an afterthought.

**Acceptance criteria**: written in Given-When-Then format where possible. Each criterion maps to at least one test. Include security criteria (auth, tenant isolation, input validation, package gating) for any feature that touches APIs or data.

**Test cases**: concrete examples with actual input values and expected output values. Not pseudocode. Not "should work correctly." Real values the test suite will use.

**Implementation notes**: specific technical guidance. Name the patterns to follow, the libraries to use, the files to extend. Call out pitfalls the implementing agent is likely to hit.

**Deliverables**: exact file paths, not vague descriptions. "src/domains/verification.py" not "a verification module."

## Step 4: Review

Show me the complete spec and ask me to review before writing to disk. Highlight any decisions I need to make (tradeoffs, scope questions, ambiguous requirements).

## Rules:
- Do not start implementing the feature. This command produces a spec only.
- Do not invent requirements. If something is ambiguous, ask me.
- Do not add scope beyond what I described. If you think something is missing, flag it as a question.
