# Admin Panel Stability Memory

- Primary reference: `docs/ADMIN_PANEL_MISTAKE_LEDGER.md`.
- When debugging admin login/render issues, prove success with:
  1. visible post-login UI,
  2. no critical browser errors,
  3. successful auth calls,
  4. repeatable runs.
- Treat launcher/runtime config (`ports`, `admin.path`) as part of root-cause analysis.
