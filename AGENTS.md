# AGENTS.md

## Purpose

This repository contains Festify, a legacy Firebase-backed client plus a new self-hosted backend. The current job is to migrate the product in small, verifiable steps without breaking the working deploy.

## Working rules

- Prefer the existing code style and architecture unless a change clearly reduces risk or removes duplication.
- Keep changes scoped to the active migration step. Do not replatform the UI or rewrite unrelated areas while core party flows are still moving.
- Treat Firebase removal as a phased migration, not a big-bang rewrite.
- When a behavior is still needed in production, keep the Firebase path working until the self-hosted path has fully replaced it.
- Update docs when the operational or migration model changes.

## Versioning

Festify stays on `0.x.y` versions until the app is genuinely usable end to end on the self-hosted stack.

Versioning rules:

- `0.x.y` is the active line for this migration.
- Bump `patch` for bug fixes, small refactors, docs-only release notes, and non-behavioral cleanup.
- Bump `minor` for user-visible features, new backend capabilities, or any change that expands the usable surface area.
- Use explicit release notes for any breaking behavior, even while still in `0.x`.
- Do not move to `1.0.0` until the host/admin flow, guest participation, queue management, vote handling, and playback are stable on the self-hosted backend.

Source of truth:

- Frontend version lives in `package.json`.
- Self-hosted backend version lives in `selfhost/package.json`.
- Keep the two versions aligned unless there is a clear reason not to.

## Git and tags

- Make one logical change per commit when possible.
- Prefer short, descriptive commit messages that describe the user-visible or architectural change.
- Commit regularly during a working session — do not let a large batch of unrelated changes accumulate uncommitted.
- Push to the remote at the end of each meaningful milestone (a working feature, a bug fixed, a phase completed).
- Use tags for notable milestones only, not every small step.
- Do not create a release tag unless the code and docs match the intended state.
- If a change affects deployment or migration behavior, update the relevant docs in the same change.
- If a change should be user-visible, add a short entry to [CHANGELOG.md](CHANGELOG.md).
- When a task from [docs/SELF_HOSTED_ROADMAP.md](docs/SELF_HOSTED_ROADMAP.md) is completed, update that roadmap so the status reflects the finished step.

## Migration order

The intended order is:

1. Host/admin path on the self-hosted backend.
2. Host queue, device selection, and playback transfer.
3. Guest join/search/vote flows.
4. Realtime transport.
5. Firebase cleanup and targeted UI modernization.

See:

- [docs/BACKEND_MIGRATION.md](docs/BACKEND_MIGRATION.md)
- [docs/SELF_HOSTED_ROADMAP.md](docs/SELF_HOSTED_ROADMAP.md)
- [docs/DEPLOY_DOCKER.md](docs/DEPLOY_DOCKER.md)

## UI modernization guidance

- Modernize only the screens that are part of the active host and guest workflows.
- Avoid framework churn until the data flow no longer depends on Firebase semantics.
- If a UI change is only cosmetic, defer it until the functional migration step is complete.

## Safety

- Prefer additive changes over destructive ones.
- Avoid deleting Firebase code until the self-hosted replacement is already working.
- Validate the relevant build or runtime path after each migration step.
