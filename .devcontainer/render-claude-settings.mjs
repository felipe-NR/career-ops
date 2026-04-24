#!/usr/bin/env node

/**
 * render-claude-settings.mjs
 *
 * Renders Claude settings JSON from a template file by replacing
 * {{ENV_VAR}} placeholders with values from process.env.
 *
 * Usage:
 *   node .devcontainer/render-claude-settings.mjs \
 *     --template .devcontainer/claude-settings-glm.template.json \
 *     --output /home/vscode/.claude/settings-glm.json
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const DEFAULTS = {
  ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic',
  API_TIMEOUT_MS: '3000000',
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
  ANTHROPIC_DEFAULT_OPUS_MODEL: 'glm-5.1',
  ANTHROPIC_DEFAULT_SONNET_MODEL: 'glm-4.7',
  ANTHROPIC_DEFAULT_HAIKU_MODEL: 'glm-4.5-air',
};

function parseArgs(argv) {
  const args = argv.slice(2);

  const getValue = (flag) => {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx + 1 >= args.length) {
      return '';
    }
    return args[idx + 1];
  };

  return {
    templatePath: getValue('--template'),
    outputPath: getValue('--output'),
  };
}

function renderTemplate(templateObject) {
  let missingAuthToken = false;
  const unresolvedVars = new Set();

  const rendered = JSON.parse(JSON.stringify(templateObject));

  for (const [key, value] of Object.entries(rendered.env ?? {})) {
    if (typeof value !== 'string') {
      continue;
    }

    rendered.env[key] = value.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, varName) => {
      const fromEnv = process.env[varName];
      if (fromEnv != null && fromEnv !== '') {
        return String(fromEnv);
      }

      if (Object.hasOwn(DEFAULTS, varName)) {
        return DEFAULTS[varName];
      }

      if (varName === 'ANTHROPIC_AUTH_TOKEN') {
        missingAuthToken = true;
        return '';
      }

      unresolvedVars.add(varName);
      return '';
    });
  }

  return { rendered, missingAuthToken, unresolvedVars };
}

function main() {
  const { templatePath, outputPath } = parseArgs(process.argv);

  if (!templatePath || !outputPath) {
    console.error(
      '[render-claude-settings] Missing required arguments: --template <path> --output <path>'
    );
    process.exit(1);
  }

  let template;
  try {
    template = JSON.parse(readFileSync(templatePath, 'utf8'));
  } catch (error) {
    console.error('[render-claude-settings] Failed to read template:', error.message);
    process.exit(1);
  }

  const { rendered, missingAuthToken, unresolvedVars } = renderTemplate(template);

  if (missingAuthToken) {
    console.error(
      '[render-claude-settings] Skipping settings generation: set ANTHROPIC_AUTH_TOKEN in .env'
    );
    process.exit(0);
  }

  if (unresolvedVars.size > 0) {
    console.error(
      `[render-claude-settings] Unresolved placeholders in template: ${Array.from(unresolvedVars).join(', ')}`
    );
    process.exit(1);
  }

  try {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(rendered, null, 2)}\n`);
  } catch (error) {
    console.error('[render-claude-settings] Failed to write output:', error.message);
    process.exit(1);
  }
}

main();