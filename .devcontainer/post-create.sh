#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="${WORKSPACE:-/workspaces/career-ops}"

# Hook direnv into interactive shells so `cd` into the workspace auto-loads the flake.
if ! grep -q 'direnv hook bash' ~/.bashrc 2>/dev/null; then
  echo 'eval "$(direnv hook bash)"' >> ~/.bashrc
fi
if [ -f ~/.zshrc ] && ! grep -q 'direnv hook zsh' ~/.zshrc 2>/dev/null; then
  echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc
fi

cd "$WORKSPACE"

# Trust the project's .envrc so nix develop loads automatically.
direnv allow .

# Pre-warm the Nix store and npm deps via direnv so the first evaluation is fast.
direnv exec . npm install

# Playwright browsers normally come from nixpkgs (see flake.nix). Fall back to
# npm-managed install if the Nix path isn't available yet.
if ! direnv exec . node -e "require('playwright-core')" >/dev/null 2>&1; then
  direnv exec . npx playwright install chromium --with-deps || true
fi

# Install Claude Code CLI globally
npm install -g @anthropic-ai/claude-code

# Render claude-glm settings from a versioned template + project .env.
mkdir -p /home/vscode/.claude
CLAUDE_SETTINGS_TEMPLATE="$WORKSPACE/.devcontainer/claude-settings-glm.template.json"
CLAUDE_SETTINGS_OUTPUT="/home/vscode/.claude/settings-glm.json"
CLAUDE_SETTINGS_RENDERER="$WORKSPACE/.devcontainer/render-claude-settings.mjs"

if [ -f "$CLAUDE_SETTINGS_TEMPLATE" ] && [ -f "$CLAUDE_SETTINGS_RENDERER" ]; then
  direnv exec . node "$CLAUDE_SETTINGS_RENDERER" \
    --template "$CLAUDE_SETTINGS_TEMPLATE" \
    --output "$CLAUDE_SETTINGS_OUTPUT"

  if [ -f "$CLAUDE_SETTINGS_OUTPUT" ]; then
    chmod 600 "$CLAUDE_SETTINGS_OUTPUT"
  fi
fi

# Add claude aliases to both bash and zsh (container paths)
# Bell notification workaround: In SSH→Docker setups, the terminal bell from Stop hooks
# (printf '\a') does not reach the host terminal. Claude Code's internal notification
# system DOES work when AskUserQuestion is shown. The agreed workaround is for Claude
# to end responses with a mock AskUserQuestion (2-3 options like OK/Done) to trigger
# the bell. This is configured via auto-memory (feedback_bell_notification.md).
# The Stop hook is still included in the settings template as a fallback for local setups.
for rcfile in "$HOME/.bashrc" "$HOME/.zshrc"; do
  if [ ! -f "$rcfile" ]; then
    continue
  fi
  if ! grep -q 'alias claude=' "$rcfile" 2>/dev/null; then
    echo "alias claude='claude --effort max --dangerously-skip-permissions'" >> "$rcfile"
  fi
  if ! grep -q 'alias claude-glm=' "$rcfile" 2>/dev/null; then
    echo "alias claude-glm='claude --settings /home/vscode/.claude/settings-glm.json --effort max --dangerously-skip-permissions'" >> "$rcfile"
  fi
done
