# Serena Usage Notes for This Repo

## Core Workflow
1. Activate the project before edits.
2. Check onboarding status (`check_onboarding_performed`).
3. If needed, run `onboarding`.
4. Read grounding references before implementation:
   - `AGENTS.md` (+ nearest nested `AGENTS.md`)
   - `docs/AGENT_GROUNDING_PROTOCOL.md`
   - `medusadocs/INDEX.md` -> `medusadocs/00_START_HERE/DECISION_TREE.md`
5. Keep memory corpus current for high-value operational lessons.

## Memory Priorities
- Always keep these memory files current:
  - `project_info.md`
  - `medusa_v2_guardrails.md`
  - `admin_panel_stability.md`
  - `verification_checklist.md`
- Update memories when launch/runtime behavior changes.

## Task Routing Hints
- Backend architecture/rules: `MEDUSA_V2_CONTEXT.md`.
- Admin regressions: `docs/ADMIN_PANEL_MISTAKE_LEDGER.md`.
- Module ownership and commands: root + nested `AGENTS.md` files.
- Use `medusadocs/` as first-stop implementation docs, then query `llms-full.txt` only for uncovered gaps.

## Serena-vs-Text-Search Rule
- Use Serena symbol tools first for:
  - call-chain tracing,
  - cross-file refactors,
  - definition/reference discovery.
- Use `rg` first for:
  - literal string search,
  - quick path discovery.
