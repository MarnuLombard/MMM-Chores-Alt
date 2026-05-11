---
description: Break a phase or feature spec into 30-minute units of work
argument-hint: <feature name>
allowed-tools: Read, Write, Edit, Glob, Grep, TodoWrite
disable-model-invocation: true
---

Read the requirements for the work being broken down. Check docs/features/ for a feature spec matching it.

Break down the following into units of work: $ARGUMENTS

Each unit should:
- Be completable in roughly 30 minutes
- Have a clear, single deliverable (one file or one function group)
- Be independently testable
- Build on previous units without requiring future units
- Touch at most 3-5 files

Output as a numbered list with:
- Unit name
- Scope description (one sentence)
- Output file(s)
- Dependencies on prior units
- A checkbox for tracking completion

Write the breakdown to docs/plans/ using the filename format phase-N.md (e.g., phase-1.md). Create the directory if it doesn't exist.

Do not overwrite an existing plan file. If one exists, show me the diff between the existing plan and the new one and ask before replacing.

Do NOT implement any of the units. Your only job is to write the plan file.
