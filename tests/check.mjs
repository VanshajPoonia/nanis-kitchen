// Tiny shared harness so every suite prints the same ok / FAIL lines.
let failures = 0;

export function section(name) {
  console.log(`\n${name}`);
}

export function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
}

export function failureCount() {
  return failures;
}
