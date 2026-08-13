import { readFileSync } from 'fs';
import { join } from 'path';
import { pass, fail, ROOT } from './helpers.mjs';
import { buildStartupPayload } from '../.codex/hooks/career-ops-startup.mjs';

const hooksPath = join(ROOT, '.codex', 'hooks.json');

try {
  const config = JSON.parse(readFileSync(hooksPath, 'utf8'));
  const group = config.hooks?.SessionStart?.[0];
  const handler = group?.hooks?.[0];
  if (
    group?.matcher === '^startup$' &&
    handler?.type === 'command' &&
    handler.command?.includes('.codex/hooks/career-ops-startup.mjs') &&
    handler.commandWindows?.includes('.codex\\hooks\\career-ops-startup.mjs') &&
    handler.timeout >= 16
  ) {
    pass('Codex startup-only SessionStart hook is registered for Unix and Windows with a bounded timeout');
  } else {
    fail('Codex SessionStart hook registration is incomplete');
  }
} catch (err) {
  fail(`Codex hooks.json is not valid JSON: ${err.message}`);
}

const updater = readFileSync(join(ROOT, 'update-system.mjs'), 'utf8');
const systemPaths = (updater.match(/SYSTEM_PATHS\s*=\s*\[([\s\S]*?)\]/) || [, ''])[1];
const dataContract = readFileSync(join(ROOT, 'DATA_CONTRACT.md'), 'utf8');
if (
  systemPaths.includes("'.codex/hooks.json'") &&
  systemPaths.includes("'.codex/hooks/'") &&
  dataContract.includes('`.codex/hooks.json` / `.codex/hooks/*`')
) {
  pass('Codex startup hook is system-owned and shipped by update-system');
} else {
  fail('Codex startup hook is missing from the system-layer/update contract');
}

const healthy = buildStartupPayload(
  { ok: true, out: '{"status":"up-to-date"}' },
  { ok: true, out: '{"onboardingNeeded":false}' },
);
if (
  healthy.systemMessage.includes('Pipeline — Cost×Benefit Funnel') &&
  healthy.systemMessage.includes('nunca pule `triage`') &&
  healthy.hookSpecificOutput?.hookEventName === 'SessionStart' &&
  healthy.hookSpecificOutput.additionalContext.includes('ALREADY displayed') &&
  healthy.hookSpecificOutput.additionalContext.includes('empty welcome screen')
) {
  pass('Codex first-turn payload renders the funnel and documents lazy SessionStart timing');
} else {
  fail('Codex healthy startup payload is missing the funnel or deduplication context');
}

const onboarding = buildStartupPayload(
  { ok: true, out: '{"status":"up-to-date"}' },
  { ok: true, out: '{"onboardingNeeded":true}' },
);
if (
  onboarding.systemMessage.includes('starting onboarding') &&
  !onboarding.systemMessage.includes('Pipeline — Cost×Benefit Funnel') &&
  onboarding.hookSpecificOutput.additionalContext.includes('onboardingNeeded=true')
) {
  pass('Codex startup payload enters onboarding instead of showing the funnel');
} else {
  fail('Codex onboarding gate did not suppress the normal startup funnel');
}

const failedDoctor = buildStartupPayload(
  { ok: false, out: '', err: 'offline' },
  { ok: false, out: '', err: 'doctor failed' },
);
if (
  failedDoctor.systemMessage.includes('setup status UNKNOWN') &&
  failedDoctor.hookSpecificOutput.additionalContext.includes('treat onboarding status as UNKNOWN')
) {
  pass('Codex startup payload fails closed when doctor output is unusable');
} else {
  fail('Codex startup payload fails open when doctor output is unusable');
}
