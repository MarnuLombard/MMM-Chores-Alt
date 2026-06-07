---
description: Implement the next unit of work from the phase plan
argument-hint: <unit ref e.g. 2.3>
allowed-tools: Read, Write, Edit, MultiEdit, Glob, Grep, Bash, TodoWrite
disable-model-invocation: true
---

Read CLAUDE.md and docs/magicmirror-sdk.md first.
Then read the requirements: check docs/features/ for a matching feature spec.
Then read the current plan in docs/plans/ to understand the unit breakdown and what has already been completed.

Implement the following unit of work: $ARGUMENTS

Before writing code:
1. State what you're going to build
2. List the files you'll create or modify
3. List any assumptions you're making beyond what's in the project plan or feature spec
4. Wait for my approval

After approval, if this unit introduces new behaviour:
1. Write failing tests against the acceptance criteria in the project plan or feature spec before implementing
2. Confirm the tests fail for the right reason

Then implement the unit:
1. Write the implementation code
2. Run all existing tests to check for regressions
3. Run linting and type checking
4. Report results

Do not modify files outside the scope of this unit without asking first.
Do not add dependencies without asking first.
Do not add abstractions not specified in the plan.
