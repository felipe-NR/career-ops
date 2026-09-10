import { execSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// Script lives at <repo>/.claude/hooks/ — never trust the hook's cwd, a session
// started in a subdirectory would break every relative path below.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function run(cmd) {
  try {
    // stderr must be piped, not inherited — a child stack trace on the hook's
    // own stderr gets surfaced by the harness as a hook failure.
    const out = execSync(cmd, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 8000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, out: out.trim() };
  } catch (err) {
    const raw = (err.stderr || err.message || String(err)).trim();
    const first = raw.split('\n').find((l) => l.trim()) || 'unknown error';
    return { ok: false, out: '', err: first.slice(0, 200) };
  }
}

const update = run('node update-system.mjs check');
const doctor = run('node doctor.mjs --json');

let onboardingNeeded = false;
let doctorUsable = false;
if (doctor.ok) {
  try {
    onboardingNeeded = JSON.parse(doctor.out).onboardingNeeded === true;
    doctorUsable = true;
  } catch {
    doctorUsable = false;
  }
}

let updateStatus = '';
if (update.ok) {
  try {
    updateStatus = JSON.parse(update.out).status || '';
  } catch {
    updateStatus = '';
  }
}

const FUNNEL = `**Pipeline — Cost×Benefit Funnel**

\`\`\`
scan (zero-token)
  ↓
triage (_brief.md ~2K tokens/vaga — no files written)
  ↓  PASS/MARGINAL only
pipeline (full A-G evaluation — ~30–50K tokens/vaga)
  ↓  score ≥ min_score_pdf only
pdf (tailored CV generation)
  ↓  only when actually applying
apply (form fill via Playwright)
\`\`\`

| Stage | Custo | O que elimina |
|-|-|-|
| \`scan\` | R$ 0 — REST API/Playwright, zero LLM | Volume bruto (centenas de vagas) |
| \`triage\` | Mínimo — 1 arquivo pequeno | DQs óbvios (stack, senioridade, geo) |
| \`pipeline\` | Alto — avaliação completa A-F | Vagas mediocres que passaram no triage |
| \`pdf\` | Médio | Roda só se score ≥ floor |
| \`apply\` | Alto + Playwright | Só quando decidir aplicar — nunca automático |

**Regras de ouro:** nunca pule \`triage\` depois do \`scan\` · nunca rode \`pdf\` antes de checar o score · use \`batch\` (≤3 workers) quando o backlog tiver 5+ vagas · rode \`patterns\` a cada ~20 avaliações acumuladas.`;

// --- What the USER sees (rendered by the harness, not by the model) ---
const banner = [];

if (updateStatus === 'update-available') {
  banner.push(`⬆️  career-ops update available — ${update.out}\n   Your data (CV, profile, tracker, reports) is not touched.`);
}
if (!doctorUsable) {
  banner.push(`⚠️  doctor.mjs did not return usable JSON — setup status UNKNOWN.\n   ${doctor.err || doctor.out || '(no output)'}`);
}
if (!update.ok) {
  banner.push(`⚠️  update-system.mjs check failed: ${update.err}`);
}

if (doctorUsable && onboardingNeeded) {
  banner.push('🚧 career-ops is not set up yet — starting onboarding instead of the usual pipeline.');
} else {
  banner.push(FUNNEL);
}

// --- What the MODEL sees ---
const rules = [
  'The funnel/banner above was ALREADY displayed to the user by the hook itself (systemMessage).',
  'Do NOT reprint it, summarize it, or restate it — go straight to answering the user.',
];
if (!doctorUsable) {
  rules.push('doctor.mjs failed: treat onboarding status as UNKNOWN. Before running any mode that writes files, re-run `node doctor.mjs --json` yourself and resolve it.');
} else if (onboardingNeeded) {
  rules.push('onboardingNeeded=true: enter onboarding mode per AGENTS.md. Do not run evaluations, scans, or any other mode first.');
}
if (updateStatus === 'update-available') {
  rules.push('An update is available and the notice was already shown. Ask the user whether to run `node update-system.mjs apply` or `dismiss`.');
}

const ctx = `CAREER-OPS STARTUP CHECKS (SessionStart hook):
update-system.mjs: ${update.ok ? update.out : `FAILED: ${update.err}`}
doctor.mjs: ${doctor.ok ? doctor.out : `FAILED: ${doctor.err}`}

${rules.map((r) => `- ${r}`).join('\n')}`;

process.stdout.write(JSON.stringify({
  systemMessage: banner.join('\n\n'),
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: ctx,
  },
}));
