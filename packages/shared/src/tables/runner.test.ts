import { describe, expect, it } from 'vitest';
import {
  buildRegistry,
  parseTableCsv,
  parseTableJson,
  pickRow,
  rollOnTable,
  tableFromRandomTable,
  type ParsedTable,
} from './runner.js';

/** Deterministic rng returning scripted values in order (cycling). */
function scriptedRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe('pickRow', () => {
  const table: ParsedTable = {
    name: 'T',
    rows: [
      { weight: 3, text: 'A' },
      { weight: 1, text: 'B' },
    ],
  };

  it('honors weights', () => {
    expect(pickRow(table, scriptedRng([0.1]))?.text).toBe('A'); // roll 0.4 into weight-3 A
    expect(pickRow(table, scriptedRng([0.9]))?.text).toBe('B'); // roll 3.6 → past A into B
  });

  it('returns null for an empty table', () => {
    expect(pickRow({ name: 'E', rows: [] }, Math.random)).toBeNull();
  });
});

describe('parseTableJson', () => {
  it('parses a table + subtables into a registry', () => {
    const raw = {
      name: 'Wandering Monsters',
      rows: ['A [[table:Goblinoids]] warband', 'Nothing'],
      subtables: [{ name: 'Goblinoids', rows: ['goblins', 'hobgoblins'] }],
    };
    const { table, registry } = parseTableJson(raw);
    expect(table.name).toBe('Wandering Monsters');
    expect(table.rows).toHaveLength(2);
    expect(registry.get('goblinoids')?.rows).toHaveLength(2);
    expect(registry.get('wandering monsters')).toBeTruthy();
  });

  it('accepts weighted-object rows and a JSON string', () => {
    const { table } = parseTableJson(
      JSON.stringify({ name: 'W', rows: [{ weight: 5, text: 'common' }, 'rare'] }),
    );
    expect(table.rows[0]).toEqual({ weight: 5, text: 'common' });
    expect(table.rows[1]).toEqual({ weight: 1, text: 'rare' });
  });
});

describe('parseTableCsv', () => {
  it('reads a weight header', () => {
    const table = parseTableCsv('weight,result\n3,foo\n1,bar [[1d4]]', 'Treasure');
    expect(table.name).toBe('Treasure');
    expect(table.rows).toEqual([
      { weight: 3, text: 'foo' },
      { weight: 1, text: 'bar [[1d4]]' },
    ]);
  });

  it('treats a headerless list as weight-1 rows', () => {
    const table = parseTableCsv('alpha\nbeta\ngamma');
    expect(table.rows.map((r) => r.text)).toEqual(['alpha', 'beta', 'gamma']);
    expect(table.rows.every((r) => r.weight === 1)).toBe(true);
  });

  it('honors quoted fields with embedded commas', () => {
    const table = parseTableCsv('weight,result\n1,"a gem, faceted and cold"');
    expect(table.rows[0]?.text).toBe('a gem, faceted and cold');
  });
});

describe('rollOnTable — nested rolls', () => {
  const main: ParsedTable = { name: 'Main', rows: [{ weight: 1, text: 'X [[table:Sub]] Y [[1d6]]' }] };
  const sub: ParsedTable = { name: 'Sub', rows: [{ weight: 1, text: 'alpha' }, { weight: 1, text: 'beta' }] };
  const registry = buildRegistry([main, sub]);

  it('resolves a nested table ref and an inline dice roll deterministically', () => {
    // rng: [0]→main row0, [0.75]→sub row1 (beta), [0.5]→1d6 face floor(3)+1=4
    const result = rollOnTable(main, registry, scriptedRng([0, 0.75, 0.5]));
    expect(result.text).toBe('X beta Y 4');
    // Trace reads outermost-first.
    expect(result.steps[0]).toEqual({ table: 'Main', text: 'X beta Y 4' });
    expect(result.steps.some((s) => s.table === 'Sub' && s.text === 'beta')).toBe(true);
  });

  it('leaves unknown table refs and unparseable tokens literal', () => {
    const t: ParsedTable = { name: 'T', rows: [{ weight: 1, text: 'a [[table:Nope]] b [[xyz]]' }] };
    const result = rollOnTable(t, buildRegistry([t]), scriptedRng([0]));
    expect(result.text).toBe('a [[table:Nope]] b [[xyz]]');
  });

  it('does not run away on self-referential tables (depth guard)', () => {
    const loop: ParsedTable = { name: 'Loop', rows: [{ weight: 1, text: 'x [[table:Loop]]' }] };
    const result = rollOnTable(loop, buildRegistry([loop]), scriptedRng([0]));
    // Terminates and still produces a string (leftover token at max depth).
    expect(typeof result.text).toBe('string');
    expect(result.text.startsWith('x ')).toBe(true);
  });
});

describe('tableFromRandomTable', () => {
  it('lifts a Firestore RandomTable doc into a runnable table', () => {
    const parsed = tableFromRandomTable({ id: 't1', name: 'Doc', rows: ['one', 'two'] });
    expect(parsed).toEqual({
      name: 'Doc',
      rows: [
        { weight: 1, text: 'one' },
        { weight: 1, text: 'two' },
      ],
    });
  });
});
