/**
 * update-reexec-checkout.test.mjs — the self-reexec stage of `apply()` checks
 * out, before the normal checkout, every file the TARGET updater loads. Its
 * list comes from resolveReexecCheckout(): the static-import closure of
 * update-system.mjs plus REEXEC_FALLBACK_FILES, the modules it loads by
 * dynamic import.
 *
 * A fallback file's own static imports must be in that list too. When they
 * were not, cv-templates.mjs gained `import ... from './lib/template-manifest.mjs'`
 * (#3852), the re-exec checked out the new cv-templates.mjs without the new
 * module, and the target updater crashed with ERR_MODULE_NOT_FOUND on
 * `await import('./cv-templates.mjs')` in loadConfiguredTemplateVariants().
 */

import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { pass, fail, rmSync, ROOT } from './helpers.mjs';
import { resolveReexecCheckout, REEXEC_FALLBACK_FILES } from '../update-system.mjs';

console.log('\n🧪 Testing the self-reexec checkout closure...');

function gitIn(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
}

// ── 1. A fixture tree: a fallback file imports a module nothing else names ──
{
  const root = mkdtempSync(join(tmpdir(), 'reexec-checkout-'));
  try {
    const files = {
      'update-system.mjs': "import { helper } from './lib/helper.mjs';\nawait import('./cv-templates.mjs');\n",
      'lib/helper.mjs': 'export const helper = 1;\n',
      'cv-templates.mjs': "import { parseMeta } from './lib/template-manifest.mjs';\nexport { parseMeta };\n",
      'lib/template-manifest.mjs': "import { shared } from './shared.mjs';\nexport const parseMeta = shared;\n",
      'lib/shared.mjs': 'export const shared = 1;\n',
      'lib/unrelated.mjs': 'export const unrelated = 1;\n',
    };
    for (const [path, body] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), body);
    }
    gitIn(root, 'init', '-q');
    gitIn(root, 'add', '.');
    gitIn(root, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-q', '-m', 'fixture');

    const checkout = resolveReexecCheckout('HEAD', 'update-system.mjs', root);

    for (const path of ['update-system.mjs', 'lib/helper.mjs', 'cv-templates.mjs']) {
      if (checkout.includes(path)) pass(`re-exec checkout includes ${path}`);
      else fail(`re-exec checkout omits ${path}: ${JSON.stringify(checkout)}`);
    }
    if (checkout.includes('lib/template-manifest.mjs')) {
      pass('re-exec checkout follows a fallback file\'s static import');
    } else {
      fail(`re-exec checkout omits a fallback file's static import: ${JSON.stringify(checkout)}`);
    }
    if (checkout.includes('lib/shared.mjs')) {
      pass('re-exec checkout follows a fallback file\'s imports transitively');
    } else {
      fail(`re-exec checkout stops one level below a fallback file: ${JSON.stringify(checkout)}`);
    }
    if (!checkout.includes('lib/unrelated.mjs')) {
      pass('re-exec checkout leaves out files nothing imports');
    } else {
      fail('re-exec checkout pulled in a file nothing imports');
    }
    const absent = REEXEC_FALLBACK_FILES.filter((path) => !(path in files));
    if (absent.every((path) => !checkout.includes(path))) {
      pass('re-exec checkout skips fallback files absent from the ref');
    } else {
      fail(`re-exec checkout lists fallback files the ref does not have: ${JSON.stringify(checkout)}`);
    }
    if (new Set(checkout).size === checkout.length) {
      pass('re-exec checkout lists each file once');
    } else {
      fail(`re-exec checkout repeats a file: ${JSON.stringify(checkout)}`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// ── 2. This repository: cv-templates.mjs's own imports ride along ──
{
  const checkout = resolveReexecCheckout('HEAD', 'update-system.mjs');
  const cvTemplates = gitIn(ROOT, 'show', 'HEAD:cv-templates.mjs');
  const imported = [...cvTemplates.matchAll(/\bfrom\s*['"]\.\/([^'"]+)['"]/g)].map((m) => m[1]);
  const missing = imported.filter((path) => !checkout.includes(path));
  if (imported.length > 0 && missing.length === 0) {
    pass(`re-exec checkout covers every static import of cv-templates.mjs (${imported.length})`);
  } else {
    fail(`re-exec checkout omits cv-templates.mjs imports: ${JSON.stringify(missing)}`);
  }
}
