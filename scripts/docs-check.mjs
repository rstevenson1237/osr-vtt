#!/usr/bin/env node
// SPEC-052 §4 — the five index/entry invariants. Structure only, never prose: it checks
// that an index agrees with what it points at, not that either reads well.
//
// Exits non-zero and prints one line per violation. Wired as pnpm verify's first step.

import { readFileSync, existsSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (path) => readFileSync(ROOT + path, 'utf8');
const exists = (path) => existsSync(ROOT + path);

const violations = [];
const fail = (msg) => violations.push(msg);

// Pulls the section of `lines` starting after `startPattern` up to (not including) the
// next line matching `endPattern`, or EOF if `endPattern` never matches again.
function section(lines, startPattern, endPattern) {
  const start = lines.findIndex((l) => startPattern.test(l));
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => endPattern.test(l));
  return end === -1 ? rest : rest.slice(0, end);
}

function stripBold(s) {
  return s.replace(/\*\*/g, '').trim();
}

function idsWithDuplicates(ids) {
  const seen = new Map();
  for (const id of ids) seen.set(id, (seen.get(id) ?? 0) + 1);
  return [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);
}

function gaps(ids) {
  const nums = [...new Set(ids.map((id) => Number(id.split('-')[1])))].sort((a, b) => a - b);
  const found = [];
  for (let i = nums[0]; i <= nums[nums.length - 1]; i++) {
    if (!nums.includes(i)) found.push(i);
  }
  return found;
}

// ---------------------------------------------------------------------------
// 1. Every SPEC-nnn row in SPEC.md has a docs/spec/SPEC-nnn.md, and that file's
//    Status line agrees with the index's status column.
// ---------------------------------------------------------------------------
{
  const specLines = read('SPEC.md').split('\n');
  const indexRows = section(specLines, /^## Index/, /^## /);
  const ids = [];
  for (const line of indexRows) {
    const m = line.match(/^\|\s*(SPEC-\d+)\s*\|.*\|\s*(.+?)\s*\|$/);
    if (!m) continue;
    const [, id, statusCell] = m;
    ids.push(id);
    const path = `docs/spec/${id}.md`;
    if (!exists(path)) {
      fail(`SPEC.md indexes ${id} but ${path} does not exist`);
      continue;
    }
    const indexStatus = stripBold(statusCell).split(/\s/)[0];
    const body = read(path);
    const statusLine = body.match(/\*\*Status:\s*([A-Za-z]+)/);
    if (!statusLine) {
      fail(`${path} has no **Status: ...** line`);
      continue;
    }
    if (statusLine[1] !== indexStatus) {
      fail(
        `SPEC.md indexes ${id} as ${indexStatus} but ${path} says ${statusLine[1]}`,
      );
    }
  }
  for (const id of idsWithDuplicates(ids)) fail(`${id} appears more than once in SPEC.md's index`);
  for (const n of gaps(ids)) {
    const id = `SPEC-${String(n).padStart(3, '0')}`;
    if (!read('SPEC.md').includes(id)) {
      fail(`${id} is a gap in the SPEC sequence and is not annotated anywhere in SPEC.md`);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Every DEC-nnn listed under # Closed has a docs/decisions/DEC-nnn.md, and every
//    entry under # Open/# Postponed has its body in DECISIONS.md itself.
// ---------------------------------------------------------------------------
{
  const decLines = read('DECISIONS.md').split('\n');
  const openBody = section(decLines, /^# Open$/, /^# Closed$/);
  const closedBody = section(decLines, /^# Closed$/, /^# Postponed$/);
  const postponedBody = section(decLines, /^# Postponed$/, /^$(?!.)/);

  const openIds = [];
  for (const line of [...openBody, ...postponedBody]) {
    const m = line.match(/^## (DEC-\d+)\b/);
    if (m) openIds.push(m[1]);
  }

  const closedIds = [];
  for (const line of closedBody) {
    const m = line.match(/\*\*(DEC-\d+)\*\*.*?`docs\/decisions\/(DEC-\d+)\.md`/);
    if (!m) continue;
    const [, id, linkedId] = m;
    if (id !== linkedId) {
      fail(`DECISIONS.md's Closed section links ${id} to docs/decisions/${linkedId}.md`);
      continue;
    }
    closedIds.push(id);
    if (!exists(`docs/decisions/${id}.md`)) {
      fail(`DECISIONS.md's Closed section links ${id} but docs/decisions/${id}.md does not exist`);
    }
  }

  for (const id of idsWithDuplicates(closedIds)) {
    fail(`${id} is linked more than once in DECISIONS.md's Closed section`);
  }
  for (const id of openIds) {
    if (closedIds.includes(id)) {
      fail(`${id} has a body under Open/Postponed and is also linked under Closed`);
    }
  }
  const allDecIds = [...openIds, ...closedIds];
  for (const n of gaps(allDecIds)) {
    const id = `DEC-${String(n).padStart(3, '0')}`;
    if (!read('DECISIONS.md').includes(id)) {
      fail(`${id} is a gap in the DEC sequence and is not annotated anywhere in DECISIONS.md`);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Every WI-nnn in PLAN-COMPLETED.md §3 has a docs/completed/WI-nnn.md, and no
//    WI-nnn appears in both PLAN.md §2 and PLAN-COMPLETED.md §3.
// ---------------------------------------------------------------------------
{
  const planCompletedText = read('PLAN-COMPLETED.md');
  const completedIds = [...planCompletedText.matchAll(/\*\*(WI-\d+)\*\*/g)].map((m) => m[1]);
  for (const id of completedIds) {
    if (!exists(`docs/completed/${id}.md`)) {
      fail(`PLAN-COMPLETED.md §3 lists ${id} but docs/completed/${id}.md does not exist`);
    }
  }
  for (const id of idsWithDuplicates(completedIds)) {
    fail(`${id} appears more than once in PLAN-COMPLETED.md §3`);
  }

  const planLines = read('PLAN.md').split('\n');
  const openRows = section(planLines, /^## 2\. Upcoming work items/, /^## /);
  const openIds = [];
  for (const line of openRows) {
    const m = line.match(/^\|\s*(WI-\d+)\s*\|/);
    if (m) openIds.push(m[1]);
  }
  for (const id of openIds) {
    if (completedIds.includes(id)) {
      fail(`${id} is queued in PLAN.md §2 and also closed in PLAN-COMPLETED.md §3`);
    }
  }
  for (const id of idsWithDuplicates(openIds)) fail(`${id} appears more than once in PLAN.md §2`);

  const allWiIds = [...openIds, ...completedIds];
  const combined = planCompletedText + read('PLAN.md') + read('INTAKE.md') + read('DECISIONS.md');
  for (const n of gaps(allWiIds)) {
    const id = `WI-${String(n).padStart(3, '0')}`;
    if (!combined.includes(id)) {
      fail(`${id} is a gap in the WI sequence and is not annotated anywhere`);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Every IN-nnn appears in exactly one of INTAKE.md §1.1 and §1.2, and has a
//    prose section.
// ---------------------------------------------------------------------------
{
  const intakeText = read('INTAKE.md');
  const intakeLines = intakeText.split('\n');
  const open11 = section(intakeLines, /^### 1\.1 /, /^### /);
  const closed12 = section(intakeLines, /^### 1\.2 /, /^### /);

  const idsIn = (rows) =>
    rows.map((l) => l.match(/^\|\s*(IN-\d+)\s*\|/)).filter(Boolean).map((m) => m[1]);

  const openIds = idsIn(open11);
  const closedIds = idsIn(closed12);

  for (const id of idsWithDuplicates(openIds)) fail(`${id} appears more than once in INTAKE.md §1.1`);
  for (const id of idsWithDuplicates(closedIds)) fail(`${id} appears more than once in INTAKE.md §1.2`);
  for (const id of openIds) {
    if (closedIds.includes(id)) fail(`${id} appears in both INTAKE.md §1.1 and §1.2`);
  }

  const allIds = [...openIds, ...closedIds];
  for (const id of allIds) {
    const occurrences = intakeText.split(id).length - 1;
    if (occurrences < 2) {
      fail(`${id} has an index row in INTAKE.md but no prose section`);
    }
  }
  for (const n of gaps(allIds)) {
    const id = `IN-${String(n).padStart(3, '0')}`;
    if (!intakeText.includes(id)) {
      fail(`${id} is a gap in the IN sequence and is not annotated anywhere in INTAKE.md`);
    }
  }
}

if (violations.length > 0) {
  for (const v of violations) console.error(v);
  console.error(`\ndocs:check: ${violations.length} violation${violations.length === 1 ? '' : 's'}`);
  process.exit(1);
}
