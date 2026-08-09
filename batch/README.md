# Batch Processing

Process multiple job offers in parallel via headless workers. Each worker runs the full evaluation pipeline (A-G report + PDF + tracker line) autonomously. The runner supports Claude Code and Codex; select one with `--cli` or `CAREER_OPS_CLI`.

To make Codex the persistent default for this workspace, add `CAREER_OPS_CLI=codex` to `.env`. For a single run, use `--cli codex` instead.

Codex workers use the Codex CLI's configured default model unless `--model` is
provided explicitly. An explicit `--model` override always takes precedence.
They run unattended in the workspace-write sandbox, with network access for JD
retrieval and MCP servers disabled to keep parallel workers isolated.

## Quick Start

1. **Add offers** to `batch-input.tsv` (tab-separated: `id`, `url`, `source`, `notes`):

   ```tsv
   id	url	source	notes
   1	https://jobs.example.com/role-a	LinkedIn	
   2	https://greenhouse.io/company/role-b	Greenhouse	priority
   ```

2. **Dry run** to preview what will be processed:

   ```bash
   ./batch/batch-runner.sh --dry-run
   ```

3. **Run the batch**:

   ```bash
   ./batch/batch-runner.sh --cli codex
   ```

4. **Results** are automatically merged into `data/applications.md`, processed offers are reconciled out of the `data/pipeline.md` inbox, and integrity is verified with `verify-pipeline.mjs` at the end of the run.

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--parallel N` | `1` | Number of concurrent headless workers |
| `--cli NAME` | `CAREER_OPS_CLI` or `claude` | Worker CLI: `claude` or `codex` |
| `--dry-run` | off | Preview pending offers without processing |
| `--retry-failed` | off | Only retry offers marked as `failed` in state |
| `--resume-paused` | off | Resume offers paused after a worker session/rate limit |
| `--start-from N` | `0` | Skip offers with ID below N |
| `--limit N` | `0` | Max number of offers to process in this run (0 = no limit) |
| `--max-retries N` | `2` | Max retry attempts per offer before giving up |
| `--rate-limit-sleep N` | `300` | Seconds to wait before retrying a transient rate-limited worker; use `0` to pause the batch immediately |

## Directory Layout

```
batch/
  batch-runner.sh          # Orchestrator script
  batch-prompt.md          # Prompt template sent to each worker
  batch-input.tsv          # Input offers (you create this)
  batch-state.tsv          # Processing state (auto-managed, resumable)
  logs/                    # Per-offer worker logs ({report_num}-{id}.log)
  tracker-additions/       # TSV lines produced by workers
    merged/                # TSVs already merged into applications.md
```

## How It Works

1. **batch-runner.sh** reads `batch-input.tsv` and `batch-state.tsv` to determine which offers need processing.
2. For each pending offer, it assigns a report number and launches a Claude Code or Codex worker with `batch-prompt.md` as the instructions (placeholders like `{{URL}}`, `{{REPORT_NUM}}` are resolved).
3. Each worker evaluates the offer, writes a report to `reports/`, generates a PDF to `output/`, and writes a tracker TSV to `tracker-additions/`.
4. After all workers finish, batch-runner calls `merge-tracker.mjs` to merge TSVs into `data/applications.md`, `reconcile-pipeline.mjs` to move processed offers out of the `data/pipeline.md` inbox, and `verify-pipeline.mjs` to check integrity.

## Tracker Merge

Workers write one TSV per offer to `batch/tracker-additions/`. The merge script (`npm run merge`) handles:

- Deduplication by company + role fuzzy match and report number
- Column order conversion (TSV has status before score; applications.md has score before status)
- In-place updates when a re-evaluation scores higher than the existing entry
- Moving processed TSVs to `tracker-additions/merged/`

Run `npm run merge` manually if you need to merge outside of a batch run.

## Pipeline Reconcile

Batch mode reads offers from `batch-input.tsv`, but the `data/pipeline.md` inbox is a separate list. Without reconciliation, an offer evaluated by a batch run stays in the pipeline "Pendientes" section and gets surfaced again on the next scan or `/career-ops pipeline` run -- producing duplicate reports.

`reconcile-pipeline.mjs` (run as `npm run reconcile`) closes that gap: after the tracker merge, every `completed` or `skipped` offer in `batch-state.tsv` whose URL is still in pipeline "Pendientes" is moved to "Procesadas" with its report link and score (entries without a report file on disk are left in place). It is idempotent -- safe to run after every batch, or manually.

## Resumability

`batch-state.tsv` tracks the status of every offer (`pending`, `processing`, `completed`, `failed`, `skipped`, `rate_limited`, `paused_rate_limit`). If the batch is interrupted, re-running `batch-runner.sh` picks up where it left off -- completed offers are skipped automatically. `rate_limited` is a non-completed state used while the runner waits before retrying, so interrupted rate-limited jobs are eligible on the next normal run.

`paused_rate_limit` is different: it means the selected worker hit a session or usage limit, so the runner stopped scheduling new offers and preserved the retry count. Resume those rows explicitly after the limit resets:

```bash
./batch/batch-runner.sh --resume-paused
```

A PID-based lock file (`batch-runner.pid`) prevents concurrent batch runs. If a previous run crashed, the stale lock is detected and removed automatically.

## Prerequisites

- `claude` or `codex` in PATH (select with `--cli` or `CAREER_OPS_CLI`)
- Node.js >= 18, Playwright chromium installed (`npm run doctor` to verify)
- `batch-input.tsv` with at least one offer
