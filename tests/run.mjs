// Every suite is plain functions, no model and no browser, so this runs offline in a second.
import { failureCount } from './check.mjs';
import './parser.mjs';
import './zip.mjs';

const failures = failureCount();
console.log(`\n${failures ? `FAIL: ${failures} check(s) failed` : 'PASS'}`);
process.exit(failures ? 1 : 0);
