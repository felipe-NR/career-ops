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

# Add claude aliases to both bash and zsh (container paths)
for rcfile in ~/.bashrc ~/.zshrc; do
  if ! grep -q 'alias claude=' "$rcfile" 2>/dev/null; then
    echo "alias claude='claude --effort max'" >> "$rcfile"
  fi
  if ! grep -q 'alias claude-glm=' "$rcfile" 2>/dev/null; then
    echo "alias claude-glm='claude --settings /home/vscode/.claude/settings-glm.json --effort max'" >> "$rcfile"
  fi
done
