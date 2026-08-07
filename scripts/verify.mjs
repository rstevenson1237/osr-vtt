#!/usr/bin/env node
// Batched verification, quiet on success.
//
// Why this exists: an agent session pays for every line a command prints, on that
// turn and on every turn after it. A green suite has nothing to say, so this
// captures each step's output and prints it only when the step fails. See
// CLAUDE.md → "Cheap turns".
//
//   pnpm verify        lint + typecheck + unit
//   pnpm verify:all    the above, plus rules/store/e2e against the emulator
//
// Exit code is the first failing step's, so `&&` chains and CI behave normally.

import { spawn } from 'node:child_process';

const TAIL_LINES = 40;

const SUITES = {
  quick: [
    ['lint', ['pnpm', 'lint']],
    ['typecheck', ['pnpm', 'typecheck']],
    ['unit', ['pnpm', 'test:unit']],
  ],
  all: [
    ['lint', ['pnpm', 'lint']],
    ['typecheck', ['pnpm', 'typecheck']],
    ['emulator suites', ['pnpm', 'test:all:emulators']],
  ],
};

const suite = process.argv[2] === 'all' ? 'all' : 'quick';

function run(command) {
  return new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    child.on('error', (err) => resolve({ code: 1, output: `${output}\n${err.message}` }));
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
  });
}

function tail(output) {
  const lines = output.split('\n');
  const dropped = Math.max(0, lines.length - TAIL_LINES);
  const shown = lines.slice(-TAIL_LINES).join('\n');
  return dropped ? `… ${dropped} earlier lines omitted …\n${shown}` : shown;
}

for (const [name, command] of SUITES[suite]) {
  const started = Date.now();
  const { code, output } = await run(command);
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  if (code !== 0) {
    console.error(`FAIL ${name} (${seconds}s)\n`);
    console.error(tail(output));
    console.error(`\nFAIL ${name}. Re-run that step alone for full output: ${command.join(' ')}`);
    process.exit(code);
  }
  console.log(`ok   ${name} (${seconds}s)`);
}

console.log(suite === 'all' ? 'all suites green' : 'lint + typecheck + unit green');
