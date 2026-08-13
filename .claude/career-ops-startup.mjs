import { execSync } from 'child_process';

let update = '', doctor = '';

try {
  update = execSync('node update-system.mjs check', { encoding: 'utf8' }).trim();
} catch {
  update = '{"status":"offline"}';
}

try {
  doctor = execSync('node doctor.mjs --json', { encoding: 'utf8' }).trim();
} catch {
  doctor = '{"onboardingNeeded":false}';
}

const ctx = `CAREER-OPS STARTUP CHECKS (SessionStart hook):
update-system.mjs: ${update}
doctor.mjs: ${doctor}

INSTRUCTION: Display the cost×benefit funnel exactly as specified in AGENTS.md "Startup Display — Cost×Benefit Funnel" section. If doctor shows onboardingNeeded=true, enter onboarding mode instead. If update-system shows status=update-available, show the update notice first.`;

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: ctx
  }
}));
