import { readFileSync } from 'fs';
import { join } from 'path';
import { pass, fail, ROOT } from './helpers.mjs';

// Codex startup hooks were deliberately removed in d5e61e3. Keep coverage on
// the startup integration that still ships (Claude Code) and pin the removal
// so a stale test can never import a deleted .codex module and abort test-all.
const settingsPath = join(ROOT, '.claude', 'settings.json');
const hookPath = join(ROOT, '.claude', 'hooks', 'career-ops-startup.mjs');

try {
  const config = JSON.parse(readFileSync(settingsPath, 'utf8'));
  const group = config.hooks?.SessionStart?.[0];
  const handler = group?.hooks?.[0];
  if (
    handler?.type === 'command' &&
    handler.command?.includes('.claude/hooks/career-ops-startup.mjs') &&
    handler.timeout >= 8
  ) {
    pass('Claude SessionStart hook is registered with a bounded timeout');
  } else {
    fail('Claude SessionStart hook registration is incomplete');
  }
} catch (err) {
  fail(`Claude settings.json is not valid JSON: ${err.message}`);
}

const updater = readFileSync(join(ROOT, 'update-system.mjs'), 'utf8');
const systemPaths = (updater.match(/SYSTEM_PATHS\s*=\s*\[([\s\S]*?)\]/) || [, ''])[1];
const userPaths = (updater.match(/USER_PATHS\s*=\s*\[([\s\S]*?)\]/) || [, ''])[1];
if (
  userPaths.includes("'.claude/settings.json'") &&
  userPaths.includes("'.claude/hooks/'")
) {
  pass('local Claude startup hook is protected from system updates');
} else {
  fail('local Claude startup hook is not protected by update-system USER_PATHS');
}

if (
  !systemPaths.includes("'.codex/hooks.json'") &&
  !systemPaths.includes("'.codex/hooks/'")
) {
  pass('removed Codex startup hook is not referenced by update-system');
} else {
  fail('update-system still references the removed Codex startup hook');
}

const hookSource = readFileSync(hookPath, 'utf8');
if (
  hookSource.includes('Pipeline — Cost×Benefit Funnel') &&
  hookSource.includes('ALREADY displayed') &&
  hookSource.includes('onboardingNeeded=true') &&
  hookSource.includes('setup status UNKNOWN')
) {
  pass('Claude startup hook retains funnel deduplication and fail-closed onboarding guidance');
} else {
  fail('Claude startup hook is missing funnel, deduplication, or fail-closed guidance');
}
