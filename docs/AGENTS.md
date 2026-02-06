# Agent Instructions (scope: `docs/` and subdirectories)

## Ownership
- Architecture notes, runbooks, plans, migration docs, incident learnings.

## Mandatory References
- `docs/AGENT_GROUNDING_PROTOCOL.md` (global grounding and escalation process).
- `docs/ADMIN_PANEL_MISTAKE_LEDGER.md` (admin reliability learnings and evidence standard).
- `medusadocs/INDEX.md` (primary Medusa v2 task docs for agent implementation).

## Update Rules
- Keep docs concise and operationally useful.
- Prefer append/update over creating duplicate docs for the same topic.
- When behavior changes in launchers/admin stability, update the relevant doc reference.

## High-Value References
- Incident learnings: `docs/ADMIN_PANEL_MISTAKE_LEDGER.md`
- Architecture: `docs/ARCHITECTURE.md`
- API: `docs/API_REFERENCE.md`

## Do Not
- Do not dump long transcripts into docs.
- Do not leave ambiguous "works now" claims without verification context.

## Learning Loop Maintenance
- If a new failure mode or near-miss is discovered, add:
  - symptom,
  - root cause,
  - verified fix,
  - prevention rule.
- If the prevention rule should change agent behavior, propagate it to:
  - `AGENTS.md` / nested `AGENTS.md`,
  - `claude.md`,
  - `.serena/memories/*.md` as needed.