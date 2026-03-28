---
name: phase-runner
description: Use when the task is organized into multiple development phases or milestones and Codex should continue from one phase to the next automatically, only pausing for high-risk actions.
---

# Goal

Execute staged development work continuously across phases without asking for confirmation after each normal phase.

## Workflow

1. Read `PROJECT_STATUS.md` and identify the current actionable phase.
2. Restate the phase objective briefly before doing substantial work.
3. Inspect the relevant code and complete the phase inside the current workspace.
4. Update `PROJECT_STATUS.md` with:
   - completed work
   - changed files
   - validation results
   - next phase
5. Run the validation relevant to the phase before moving on.
6. If validation passes and no high-risk action is required, continue directly to the next requested phase or the next natural phase.
7. Keep changes incremental and reviewable at each phase boundary.

## Pause Only If

- deleting many files
- changing project structure irreversibly
- accessing directories outside the allowed workspace
- requiring network or paid external APIs
- validation fails and recovery is uncertain

## Output Rules

- Do not ask for confirmation after each normal phase.
- Keep summaries concise.
- Prefer incremental, reviewable changes.
- Always keep `PROJECT_STATUS.md` synchronized with real completion state.
