import { parseDieExpr } from '../dice/engine.js';
import type { RandomTable } from '../types.js';

/**
 * CSV/JSON random-table runner with nested rolls (Plan §7 Phase 4). Referee
 * content only — the app rolls on user-imported tables and resolves the
 * embedded tokens; it never authors or interprets the results as mechanics.
 *
 * A row is plain text that may embed:
 *   - `[[NdM]]` / `[[dM]]`  — an inline dice roll, replaced by its total.
 *   - `[[table:Name]]` / `[[@Name]]` — a nested roll on another table in the
 *     same registry, replaced by that table's resolved result (recursively).
 * Anything else inside `[[ ]]` is left verbatim, so malformed tokens degrade
 * to literal text rather than throwing.
 */

export interface TableRow {
  /** Relative weight for selection; ≥1. A plain list is all-weight-1. */
  weight: number;
  text: string;
}

export interface ParsedTable {
  name: string;
  rows: TableRow[];
}

/** Tables addressable by nested `[[table:Name]]` refs, keyed by lowercased name. */
export type TableRegistry = Map<string, ParsedTable>;

export interface RollStep {
  table: string;
  text: string;
}

export interface TableRollResult {
  /** Fully resolved text with every nested token expanded. */
  text: string;
  /** Trace of each table rolled, outermost first — for a readable log entry. */
  steps: RollStep[];
}

const MAX_DEPTH = 8;
const TOKEN_RE = /\[\[\s*([^\]]+?)\s*\]\]/g;

export function registryKey(name: string): string {
  return name.trim().toLowerCase();
}

export function buildRegistry(tables: Iterable<ParsedTable>): TableRegistry {
  const registry: TableRegistry = new Map();
  for (const table of tables) registry.set(registryKey(table.name), table);
  return registry;
}

// ---- parsing (JSON + CSV) ----

/** A `RandomTable` Firestore doc (`{ rows: string[] }`) → a runnable table. */
export function tableFromRandomTable(doc: RandomTable): ParsedTable {
  return { name: doc.name, rows: doc.rows.map((text) => ({ weight: 1, text })) };
}

interface JsonTableShape {
  name?: unknown;
  rows?: unknown;
  subtables?: unknown;
}

function coerceRows(rows: unknown): TableRow[] {
  if (!Array.isArray(rows)) return [];
  const out: TableRow[] = [];
  for (const row of rows) {
    if (typeof row === 'string') {
      out.push({ weight: 1, text: row });
    } else if (row && typeof row === 'object') {
      const r = row as { weight?: unknown; text?: unknown };
      const weight = typeof r.weight === 'number' && r.weight >= 1 ? Math.floor(r.weight) : 1;
      const text = typeof r.text === 'string' ? r.text : '';
      out.push({ weight, text });
    }
  }
  return out;
}

/**
 * Parses a JSON table file. Accepts either a single table `{ name, rows }`
 * (rows are strings or `{ weight, text }`), optionally with a `subtables`
 * array of the same shape for nested refs. Returns the primary table plus a
 * registry containing it and every subtable.
 */
export function parseTableJson(
  raw: unknown,
  fallbackName = 'Imported Table',
): { table: ParsedTable; registry: TableRegistry } {
  const json: JsonTableShape =
    typeof raw === 'string' ? (JSON.parse(raw) as JsonTableShape) : (raw as JsonTableShape);

  const table: ParsedTable = {
    name: typeof json.name === 'string' && json.name.trim() ? json.name : fallbackName,
    rows: coerceRows(json.rows),
  };
  const tables = [table];
  if (Array.isArray(json.subtables)) {
    for (const sub of json.subtables) {
      const s = sub as JsonTableShape;
      tables.push({
        name: typeof s.name === 'string' ? s.name : 'Subtable',
        rows: coerceRows(s.rows),
      });
    }
  }
  return { table, registry: buildRegistry(tables) };
}

/** Splits one CSV line, honoring double-quoted fields with embedded commas. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

/**
 * Parses a CSV table. A `weight,result` header makes the first column a
 * weight; otherwise each non-empty line is one weight-1 row (last column
 * used when several are present). Inline `[[NdM]]` tokens still resolve —
 * CSV can't carry subtables, so `[[table:…]]` refs need the caller's registry.
 */
export function parseTableCsv(raw: string, name = 'Imported Table'): ParsedTable {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { name, rows: [] };

  const header = splitCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const hasWeight = header[0] === 'weight';
  const body = hasWeight ? lines.slice(1) : lines;

  const rows: TableRow[] = [];
  for (const line of body) {
    const cols = splitCsvLine(line);
    if (hasWeight) {
      const weight = Number.parseInt(cols[0] ?? '1', 10);
      const text = cols.slice(1).join(', ');
      rows.push({ weight: Number.isFinite(weight) && weight >= 1 ? weight : 1, text });
    } else {
      rows.push({ weight: 1, text: cols[cols.length - 1] ?? '' });
    }
  }
  return { name, rows };
}

// ---- rolling ----

/** Picks one row by weight using `rng()` in [0,1). */
export function pickRow(table: ParsedTable, rng: () => number): TableRow | null {
  if (table.rows.length === 0) return null;
  const total = table.rows.reduce((sum, r) => sum + Math.max(1, r.weight), 0);
  let roll = rng() * total;
  for (const row of table.rows) {
    roll -= Math.max(1, row.weight);
    if (roll < 0) return row;
  }
  return table.rows[table.rows.length - 1]!;
}

function rollDiceExpr(expr: string, rng: () => number): number | null {
  const parsed = parseDieExpr(expr);
  if (!parsed) return null;
  let total = 0;
  for (let i = 0; i < parsed.count; i++) total += Math.floor(rng() * parsed.sides) + 1;
  return total;
}

/** Expands every `[[ ]]` token in `text`, recursing into nested tables. */
function resolveText(
  text: string,
  registry: TableRegistry,
  rng: () => number,
  steps: RollStep[],
  depth: number,
): string {
  if (depth > MAX_DEPTH) return text;
  return text.replace(TOKEN_RE, (_match, inner: string) => {
    const token = inner.trim();

    const tableRef = /^(?:table:|@)\s*(.+)$/i.exec(token);
    if (tableRef) {
      const nested = registry.get(registryKey(tableRef[1]!));
      if (!nested) return `[[${token}]]`;
      return rollNested(nested, registry, rng, steps, depth + 1);
    }

    const diceTotal = rollDiceExpr(token, rng);
    if (diceTotal !== null) return String(diceTotal);

    // Not dice and not a known table — leave the raw token untouched.
    return `[[${token}]]`;
  });
}

function rollNested(
  table: ParsedTable,
  registry: TableRegistry,
  rng: () => number,
  steps: RollStep[],
  depth: number,
): string {
  const row = pickRow(table, rng);
  if (!row) return '';
  const resolved = resolveText(row.text, registry, rng, steps, depth);
  steps.push({ table: table.name, text: resolved });
  return resolved;
}

/**
 * Rolls once on `table`, resolving all nested dice/table tokens. `registry`
 * supplies any tables referenced via `[[table:Name]]` (include `table` itself,
 * as `parseTableJson`/`buildRegistry` do). `rng` defaults to `Math.random`.
 */
export function rollOnTable(
  table: ParsedTable,
  registry: TableRegistry = buildRegistry([table]),
  rng: () => number = Math.random,
): TableRollResult {
  const steps: RollStep[] = [];
  const text = rollNested(table, registry, rng, steps, 0);
  // Outermost roll last in `steps`; reverse so the log reads top-down.
  return { text, steps: steps.reverse() };
}
