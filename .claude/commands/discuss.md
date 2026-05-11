---
description: Capture implementation decisions before coding starts
argument-hint: <feature name>
allowed-tools: Read, Write, Edit, Glob, Grep, WebFetch
disable-model-invocation: true
---

Read CLAUDE.md and docs/magicmirror-sdk.md first.

Discuss implementation decisions for: $ARGUMENTS

## What this step does

The project plan or feature spec describes WHAT to build. This discussion captures HOW you want it built -- the architectural preferences, technical decisions, and constraints that shape every unit in this phase. Without this, the agent makes default choices that may not match your intent.

## Step 1: Identify decision points

Based on the phase or feature spec, identify the gray areas where multiple valid approaches exist. Group them by category:

**Architecture**: which patterns, where to put new code, how components connect
**Data model**: schema design, relationships, migration strategy
**API design**: endpoints, response format, error handling, pagination
**UI/UX** (if applicable): layout, interactions, empty states, loading behaviour
**Security**: auth model, tenant isolation approach, input validation strategy
**Performance**: caching strategy, query approach, expected load

Only surface decisions that genuinely have multiple valid options. Don't ask about things the existing codebase already answers.

## Step 2: Walk through each decision

For each decision point:
1. Explain the options briefly (2-3 max)
2. State which option the existing codebase patterns and ADRs suggest (if any)
3. Ask for my preference

Don't batch all questions at once. Group them by category and wait for my response between groups.

## Step 3: Document decisions

Refactor the spec or project plan to reflect the decisions made. For example, if we decided on a specific API design, update the spec to call that out explicitly in the implementation notes. If we chose a particular architectural pattern, add that to the relevant section.

## Rules:
- Do NOT start implementing. This command captures decisions only.
- Do NOT invent decisions I didn't make. If I say "you decide", document what you chose and why.
- Do NOT ask about things the existing codebase already answers. Read the code first.
- Keep it focused. 5-10 decisions for a typical phase, not 30.
