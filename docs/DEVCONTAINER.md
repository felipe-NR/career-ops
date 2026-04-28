# Run career-ops in a devcontainer

This guide explains how to run career-ops inside an isolated devcontainer that uses Nix (via the `flake.nix` already in the repo) to provision Node, Playwright, and related tooling. The same devcontainer works with OpenCode, Claude Code, and any other AI agent that can attach to a running container.

## Why

- **Isolation** — career-ops evaluates job offers against your personal CV, profile, and tracker. Running it in a container keeps those files on your host disk while the runtime (Node, Playwright, Nix) lives in an ephemeral container.
- **Reproducibility** — the container pins Node 24.15.0 and uses the project's `flake.nix` (pinned via `flake.lock`) so every run matches the author's environment.
- **Cross-agent** — the same `.devcontainer/devcontainer.json` is reused by the [`opencode-devcontainers`](https://github.com/athal7/opencode-devcontainers) plugin (OpenCode) and by the VS Code Dev Containers extension (Claude Code, Cursor, Windsurf, etc.).

## Prerequisites

| Requirement | Why |
|-|-|
| Docker (or compatible runtime) | Runs the container |
| `@devcontainers/cli` (`npm i -g @devcontainers/cli`) | Required by OpenCode plugin and the CLI fallback |
| VS Code + Dev Containers extension | Recommended for Claude Code |
| (optional) `opencode` CLI | OpenCode integration |
| (optional) `openpackage` (`npm i -g openpackage`) | Port OpenCode configs to Claude Code |

## OpenCode — native plugin

1. Install the [opencode-devcontainers](https://github.com/athal7/opencode-devcontainers) plugin globally by adding it to `~/.config/opencode/opencode.json`:

   ```json
   {
     "plugin": ["opencode-devcontainers"]
   }
   ```

2. Open the project:

   ```bash
   cd career-ops
   opencode
   ```

3. Create an isolated worktree (recommended for career-ops — see [Data persistence](#data-persistence)):

   ```text
   /worktree main
   ```

   OpenCode creates `~/.local/share/opencode/worktree/career-ops/main/`, copies gitignored files from the main repo (so your `cv.md`, `config/profile.yml`, `portals.yml`, `data/`, `reports/` come along), and runs `direnv allow` automatically.

4. If you prefer a full devcontainer clone (no worktree), use `/devcontainer main` instead — but note you'll need to manually copy your personal files into the clone. See [Data persistence](#data-persistence).

5. Commands like `/career-ops-scan` now run inside the isolated workspace.

## Claude Code — via openpackage

OpenPackage can migrate compatible configs between platforms. For career-ops the practical goal is to reuse the same devcontainer from Claude Code; the migration step is optional and only useful if you had OpenCode-specific configs you want to mirror.

1. Install openpackage:

   ```bash
   npm i -g openpackage
   ```

2. (Optional) Migrate any OpenCode configs you already have into Claude Code equivalents:

   ```bash
   opkg migrate --from opencode --to claude
   ```

   This copies rules, commands, skills, and MCP entries — it does **not** port the `opencode-devcontainers` plugin itself (see [Limitations](#limitations)).

3. Open the project in VS Code with the Dev Containers extension installed, then use **"Dev Containers: Reopen in Container"**. VS Code builds the image from `.devcontainer/devcontainer.json`.

4. Inside the container, open an integrated terminal and run `claude`. The Claude Code CLI now runs inside the container, with Nix, Node 24.15.0, Playwright, and the project's `flake.nix` already loaded.

## Claude Code — marketplace (experimental)

Claude Code supports installing plugins from GitHub marketplaces:

```text
/plugin marketplace add https://github.com/athal7/opencode-devcontainers
/plugin install opencode-devcontainers
```

This path only works if the plugin exposes a Claude-compatible interface. `opencode-devcontainers` was written against `@opencode-ai/plugin`, so the marketplace install may fail or have missing commands. Treat this as experimental and fall back to the VS Code Dev Containers flow above if it doesn't work.

## CLI fallback (any agent)

If you don't use an IDE, you can drive the container directly:

```bash
npm i -g @devcontainers/cli
cd career-ops
devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . bash
```

Inside the container shell:

```bash
direnv allow .      # first run only
claude              # or opencode, or gemini
```

## Data persistence

Your personal files live on the host, not in the container:

| Path | Who writes it | Location |
|-|-|-|
| `cv.md`, `config/profile.yml`, `portals.yml`, `modes/_profile.md`, `article-digest.md` | You | Host (mounted into container) |
| `data/applications.md`, `data/pipeline.md`, `data/scan-history.tsv` | Pipeline | Host |
| `reports/`, `output/`, `interview-prep/` | Pipeline | Host |
| `node_modules/`, `.direnv/` | Container runtime | Inside container only (rebuilt) |
| Nix store (`/nix`) | Nix | Named volume `career-ops-nix-store` (persisted across rebuilds) |

Destroying the container does **not** delete your personal files. See [DATA_CONTRACT.md](../DATA_CONTRACT.md) for the full data layering model.

**Worktree vs. clone (OpenCode users):** `opencode-devcontainers` supports both `/worktree` and `/devcontainer` commands. Worktrees copy gitignored files automatically, which matches career-ops' data contract perfectly — prefer `/worktree main` over `/devcontainer main`.

## Troubleshooting

**First build is slow (~5 min).** Nix downloads the flake inputs and Playwright browsers. Subsequent rebuilds reuse the `career-ops-nix-store` volume and take seconds.

**`direnv: error .envrc is blocked`.** Run `direnv allow .` inside the container.

**Playwright fails with browser mismatch.** The `flake.nix` pins `playwright-core` to the version provided by nixpkgs. If you see version errors, run `direnv reload` and try again.

**OpenCode clone missing `cv.md`/`config/profile.yml`.** You used `/devcontainer` instead of `/worktree`. Either switch to worktrees or manually copy your files into `~/.local/share/opencode/clone/career-ops/main/`.

**`Error response from daemon: unable to find user vscode: no matching entries in passwd file`.** The devcontainer CLI is reusing a cached container built from a different `devcontainer.json`. Find and remove it:

```bash
docker ps -a --filter "label=devcontainer.local_folder=$(pwd)"
docker rm -f <CONTAINER_ID>
devcontainer up --workspace-folder .
```

**`node --version` shows a different version inside vs. outside the Nix shell.** Expected. The devcontainer feature installs Node 24.15.0 at system level; `flake.nix` provides `nodejs-slim` (currently 24.14.0) which overrides `PATH` whenever `direnv` loads the flake. Both paths work — the pinned 24.15.0 is only relevant for commands that run before direnv activates.

**`claude` / `claude-glm` aliases not found.** These are added by `post-create.sh` during container setup. If missing, rerun `.devcontainer/post-create.sh` or rebuild the container.

**`claude-glm` fails with missing auth token or settings file.** The devcontainer no longer bind-mounts `~/.claude`. During setup, `post-create.sh` calls `.devcontainer/render-claude-settings.mjs`, which renders `/home/vscode/.claude/settings-glm.json` from `.devcontainer/claude-settings-glm.template.json` using values from `.env` via `direnv`. Set `CLAUDE_GLM_AUTH_TOKEN` in `.env`, then rerun `.devcontainer/post-create.sh`.

**`claude` shows `Invalid bearer token` even after `/login`.** Check `.env` and remove `ANTHROPIC_AUTH_TOKEN` from the shell environment. Keep GLM credentials under `CLAUDE_GLM_AUTH_TOKEN` so the standard `claude` alias stays on login-based auth while `claude-glm` keeps using `/home/vscode/.claude/settings-glm.json`.

## Limitations

- `opencode-devcontainers` is an OpenCode-specific npm plugin using `@opencode-ai/plugin`. `opkg migrate` ports configs (rules, commands, skills, MCPs) — it does not transpile OpenCode plugin runtimes into Claude Code plugins. For Claude Code, the supported path is the standard Dev Containers flow, which relies on the same `.devcontainer/devcontainer.json` in this repo.
- The Nix store is shared across container rebuilds via a named Docker volume. Deleting that volume (`docker volume rm career-ops-nix-store`) forces a full Nix re-download on the next build.
