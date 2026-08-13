import { execFileSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// Script lives at <repo>/.codex/hooks/. Hook commands run from the session cwd,
// which may be a subdirectory, so resolve every project path from this file.
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(SCRIPT_PATH), '..', '..');

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

function run(script, args) {
  try {
    const out = execFileSync(process.execPath, [resolve(ROOT, script), ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 8000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, out: out.trim() };
  } catch (err) {
    const raw = String(err.stderr || err.message || err).trim();
    const first = raw.split('\n').find((line) => line.trim()) || 'unknown error';
    return { ok: false, out: '', err: first.slice(0, 200) };
  }
}

function parseJsonResult(result) {
  if (!result.ok) return null;
  try {
    return JSON.parse(result.out);
  } catch {
    return null;
  }
}

export function buildStartupPayload(update, doctor) {
  const updateData = parseJsonResult(update);
  const doctorData = parseJsonResult(doctor);
  const doctorUsable = doctorData !== null && typeof doctorData.onboardingNeeded === 'boolean';
  const onboardingNeeded = doctorUsable && doctorData.onboardingNeeded;
  const updateStatus = updateData?.status || '';

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

  const rules = [
    'The funnel/banner above was ALREADY displayed to the user by the Codex hook itself (systemMessage).',
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

  const ctx = `CAREER-OPS STARTUP CHECKS (Codex SessionStart hook):
update-system.mjs: ${update.ok ? update.out : `FAILED: ${update.err}`}
doctor.mjs: ${doctor.ok ? doctor.out : `FAILED: ${doctor.err}`}

${rules.map((rule) => `- ${rule}`).join('\n')}`;

  return {
    systemMessage: banner.join('\n\n'),
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: ctx,
    },
  };
}

function main() {
  const update = run('update-system.mjs', ['check']);
  const doctor = run('doctor.mjs', ['--json']);
  process.stdout.write(JSON.stringify(buildStartupPayload(update, doctor)));
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
  main();
}
