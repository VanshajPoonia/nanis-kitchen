// Copies the print book's fonts from npm into assets/fonts at pinned versions. Run with `npm run fonts`.
// The app is static files with no install step, so the copied fonts are committed.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Fontsource splits each font by script, so only the Indic glyphs are copied, not Latin.
const FONTS = [
  { lang: 'hi', family: 'Noto Serif Devanagari', pkg: '@fontsource/noto-serif-devanagari', version: '5.3.0', subset: 'devanagari' },
  { lang: 'pa', family: 'Noto Serif Gurmukhi', pkg: '@fontsource/noto-serif-gurmukhi', version: '5.3.0', subset: 'gurmukhi' },
  { lang: 'ta', family: 'Noto Serif Tamil', pkg: '@fontsource/noto-serif-tamil', version: '5.3.0', subset: 'tamil' },
];
const WEIGHTS = [400, 700];

const out = fileURLToPath(new URL('../assets/fonts/', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'recipememo-fonts-'));
mkdirSync(out, { recursive: true });

const manifest = [];
const notices = [];
let licenseBody = '';
try {
  for (const font of FONTS) {
    // npm checks the tarball against the registry's integrity hash.
    const tarball = execFileSync('npm', ['pack', `${font.pkg}@${font.version}`, '--pack-destination', tmp, '--silent'], { encoding: 'utf8' }).trim().split('\n').pop();
    const dir = join(tmp, font.subset);
    mkdirSync(dir);
    execFileSync('tar', ['-xzf', join(tmp, tarball), '-C', dir]);
    const name = font.pkg.split('/')[1];
    const files = {};
    for (const weight of WEIGHTS) {
      const file = `${name}-${font.subset}-${weight}-normal.woff2`;
      copyFileSync(join(dir, 'package', 'files', file), join(out, file));
      const bytes = readFileSync(join(out, file));
      files[weight] = { file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    }
    manifest.push({ lang: font.lang, family: font.family, package: `${font.pkg}@${font.version}`, files });
    const [notice, ...body] = readFileSync(join(dir, 'package', 'LICENSE'), 'utf8').split('\n');
    notices.push(notice.split(' NotoSerif')[0].trim());
    licenseBody = body.join('\n');
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

writeFileSync(join(out, 'OFL.txt'), `${notices.join('\n')}\n${licenseBody}`);
writeFileSync(join(out, 'fonts.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const total = manifest.flatMap((m) => Object.values(m.files)).reduce((n, f) => n + f.bytes, 0);
console.log(`Copied ${manifest.length * WEIGHTS.length} fonts, ${(total / 1024).toFixed(0)} KB, to assets/fonts`);
