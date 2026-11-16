import type { Card, CardType, CefrLevel } from './types';

const VALID_LEVELS = new Set<CefrLevel>(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

function normalizeLevel(raw: string | undefined): CefrLevel {
  const upper = (raw ?? 'B1').trim().toUpperCase() as CefrLevel;
  return VALID_LEVELS.has(upper) ? upper : 'B1';
}

function inferType(en: string, explicitType?: string): CardType {
  const t = (explicitType ?? '').trim().toLowerCase();
  if (t === 'word' || t === 'kelime') return 'word';
  if (t === 'sentence' || t === 'cümle' || t === 'cumle') return 'sentence';
  return en.trim().split(/\s+/).length >= 3 ? 'sentence' : 'word';
}

function makeUserCardId(en: string, index: number): string {
  const slug = en
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  return `u_${Date.now().toString(36)}_${index}_${slug || 'card'}`;
}

/** Parse a single CSV line handling quoted fields with commas or escaped quotes. */
function splitCsvLine(line: string, delimiter: string): string[] {
  if (delimiter === '\t') {
    return line.split('\t').map((cell) => cell.trim());
  }
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

/**
 * Parse JSON, TSV (Anki export), or CSV into user Card objects.
 * Supports:
 * - JSON array of Card-like objects ({ en, acceptedTr/tr, type, level, exampleEn, exampleTr })
 * - TSV/CSV rows: en <sep> tr1;tr2 [<sep> type <sep> level <sep> exampleEn <sep> exampleTr]
 */
export function parseImportedCards(rawText: string): { cards: Card[]; errors: string[] } {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { cards: [], errors: ['Import text is empty.'] };
  }

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const cards: Card[] = [];
      const errors: string[] = [];

      items.forEach((item, idx) => {
        if (!item || typeof item !== 'object') {
          errors.push(`Entry ${idx + 1}: invalid object`);
          return;
        }
        const rec = item as Record<string, unknown>;
        const en = String(rec.en ?? rec.english ?? rec.word ?? '').trim();
        const rawTr = rec.acceptedTr ?? rec.tr ?? rec.turkish ?? rec.meaning;
        const acceptedTr = Array.isArray(rawTr)
          ? rawTr.map((v) => String(v).trim()).filter(Boolean)
          : String(rawTr ?? '')
              .split(/[;|]/)
              .map((v) => v.trim())
              .filter(Boolean);

        if (!en || acceptedTr.length === 0) {
          errors.push(`Entry ${idx + 1}: both "en" and "tr/acceptedTr" fields are required`);
          return;
        }

        cards.push({
          id: String(rec.id ?? '').trim() || makeUserCardId(en, idx),
          type: inferType(en, rec.type ? String(rec.type) : undefined),
          level: normalizeLevel(rec.level ? String(rec.level) : undefined),
          pos: String(rec.pos ?? '').trim(),
          en,
          phonetic: String(rec.phonetic ?? '').trim(),
          acceptedTr,
          exampleEn: String(rec.exampleEn ?? '').trim(),
          exampleTr: String(rec.exampleTr ?? '').trim(),
          source: 'user',
          createdAt: Date.now(),
        });
      });

      return { cards, errors };
    } catch (err) {
      return {
        cards: [],
        errors: [`JSON parse error: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  if (lines.length === 0) {
    return { cards: [], errors: ['No valid lines found.'] };
  }

  const firstLine = lines[0]!;
  const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';

  const cards: Card[] = [];
  const errors: string[] = [];

  lines.forEach((line, idx) => {
    const cols = splitCsvLine(line, delimiter);
    // Skip header line if present
    if (idx === 0 && cols[0]?.toLowerCase() === 'en' && cols[1]?.toLowerCase().includes('tr')) {
      return;
    }
    const en = (cols[0] ?? '').trim();
    const trRaw = (cols[1] ?? '').trim();
    const acceptedTr = trRaw
      .split(/[|;]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!en || acceptedTr.length === 0) {
      errors.push(`Line ${idx + 1}: both English and Turkish columns are required.`);
      return;
    }

    cards.push({
      id: makeUserCardId(en, idx),
      type: inferType(en, cols[2]),
      level: normalizeLevel(cols[3]),
      pos: '',
      en,
      phonetic: '',
      acceptedTr,
      exampleEn: (cols[4] ?? '').trim(),
      exampleTr: (cols[5] ?? '').trim(),
      source: 'user',
      createdAt: Date.now(),
    });
  });

  return { cards, errors };
}

export function exportCardsAsJson(cards: Card[]): string {
  return JSON.stringify(cards, null, 2);
}

export function exportCardsAsTsv(cards: Card[]): string {
  const header = 'en\ttr\ttype\tlevel\texampleEn\texampleTr';
  const rows = cards.map((c) =>
    [
      c.en,
      c.acceptedTr.join(' | '),
      c.type,
      c.level,
      c.exampleEn,
      c.exampleTr,
    ]
      .map((field) => field.replace(/[\t\r\n]+/g, ' ').trim())
      .join('\t')
  );
  return [header, ...rows].join('\n');
}
