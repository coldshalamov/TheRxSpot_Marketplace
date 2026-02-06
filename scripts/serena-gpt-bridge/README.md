# Serena GPT Bridge (Reusable Across Repos)

This toolkit lets one Custom GPT connect to **any** repo you are actively working on, using:

- A static Cloudflare Worker URL in the GPT schema
- A local script that starts Serena + Cloudflare tunnel
- Automatic tunnel handoff to the Worker on each run

If you want the "just run one script and talk to GPT" workflow, use `Run-Serena-For-GPT.ps1`.

If you want a local-only Serena bootstrap (onboarding + memory sync) before GPT exposure, use `Initialize-Serena-MCP.ps1`.

## 1) One-Time Worker Setup

1. Create a Cloudflare Worker project and copy files from `worker/`:
   - `worker/index.ts`
   - `worker/wrangler.toml.example` (rename to `wrangler.toml`)
2. Create a KV namespace and set its ID in `wrangler.toml`.
3. Set a Worker secret:
   - `wrangler secret put UPDATER_TOKEN`
4. Deploy:
   - `wrangler deploy`
5. Keep your Worker URL (example): `https://serena-gpt-proxy.workers.dev`

## 2) Start Bridge For Any Repo

```powershell
.\Start-Serena-Bridge.ps1 `
  -ProjectPath "D:\GitHub\TheRxSpot_Marketplace" `
  -WorkerUrl "https://YOUR_WORKER.workers.dev" `
  -UpdaterToken "YOUR_UPDATER_TOKEN" `
  -SerenaApiKey "serena-secret-key-123456"
```

What this does:
- Starts MCPO + Serena for that repo
- Starts cloudflared tunnel
- Detects current tunnel URL
- Posts it to `https://YOUR_WORKER.workers.dev/_update`
- Generates a GPT-ready schema

## 2b) One-Command Runtime (Recommended)

1. Copy `bridge.config.json.example` to `bridge.config.json` once.
2. Put your values in `bridge.config.json`:
   - `workerUrl`
   - `updaterToken`
   - `serenaApiKey`
3. Run from any repo:

```powershell
D:\GitHub\serena-gpt-bridge\Run-Serena-For-GPT.ps1 -ProjectPath "D:\GitHub\TheRxSpot_Marketplace"
```

After that, use the same Custom GPT without editing it again.

## 2c) Initialize Serena MCP Knowledge (Recommended Before First Use)

This repo includes a dedicated initializer that:
- starts a local Serena MCP instance for the target project,
- checks/runs onboarding,
- syncs all `.serena/memories/*.md` files into Serena memory store,
- emits a summary JSON with onboarding + inventory details.

Run from this repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\serena-gpt-bridge\Initialize-Serena-MCP.ps1 -ProjectPath .
```

Useful flags:
- `-Port 8011` (or another free local port)
- `-SkipMemorySync` (onboarding only)
- `-UseMcpWriteMemory` (force sync via `write_memory` API calls instead of local memory discovery)
- `-ForceOnboarding`
- `-KeepServerRunning` (leave local MCP running after initialization)

## 3) Use One Stable GPT Action

- In your GPT action schema, always use the generated:
  - `output\schema_for_custom_gpt.latest.json`
- This schema always points to your Worker URL (stable).
- Keep GPT bearer key equal to `-SerenaApiKey`.

## 4) Stop Current Session

```powershell
.\Stop-Serena-Bridge.ps1
```

## Files Written

- `output\active-session.json`
- `output\<repo>_<timestamp>\session.json`
- `output\schema_for_custom_gpt.latest.json`

## Security Notes

- Only share Worker URL, never `UPDATER_TOKEN`.
- Keep `SerenaApiKey` private (this is your GPT Action bearer key).
- Worker accepts updates only with `UPDATER_TOKEN`.
