// Every suite is plain functions, no model and no browser, so this runs offline in a second.
import { failureCount } from './check.mjs';

// One at a time, so suites that await do not interleave their output.
for (const suite of ['parser', 'zip', 'whatsapp', 'measures', 'qr']) await import(`./${suite}.mjs`);

const failures = failureCount();
console.log(`\n${failures ? `FAIL: ${failures} check(s) failed` : 'PASS'}`);
process.exit(failures ? 1 : 0);
