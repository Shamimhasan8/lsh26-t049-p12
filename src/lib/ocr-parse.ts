// Deterministic parser for Tesseract TSV output -> receipt fields with
// per-field confidence. Pure function: same TSV in, same fields out.
// Rule: NEVER invent a value. Missing/low-confidence fields are returned as
// null with uncertain=true and a reason, so the UI can ask the user to fix.

export interface OcrWord {
  text: string;
  conf: number; // 0..100 from tesseract
  lineIndex: number;
  wordIndex: number;
}

export interface OcrLine {
  index: number;
  text: string;
  conf: number; // average word confidence 0..100
}

export interface OcrField {
  value: string | null;
  confidence: number; // 0..1
  uncertain: boolean;
  reason: string;
}

export interface OcrResult {
  fields: {
    shop: OcrField;
    amount: OcrField;
    date: OcrField;
  };
  lines: OcrLine[]; // for the "what OCR saw" transparency panel
  engine: string;
}

const NOISE = /^(receipt|invoice|tax|vat|inv|customer|cashier|tel|phone|fax|www\.|powered|sample|thank|please|visit|change|paid|payment|bdt|tk|taka)/i;
const DATE_NOISE = /^date:/i;

export function parseOcrTsv(tsv: string, engine = 'Tesseract 5.5'): OcrResult {
  const rows = tsv.split('\n').map(r => r.split('\t'));
  // TSV header: level page block par line word left top width height conf text
  const linesMap = new Map<number, { texts: string[]; confs: number[]; top: number }>();
  for (const r of rows) {
    if (r.length < 12) continue;
    const level = Number(r[0]);
    if (level !== 5) continue; // word level
    const text = (r[11] || '').trim();
    if (!text) continue;
    const conf = Number(r[10]);
    const lineNum = Number(r[4]);
    const top = Number(r[7]);
    const entry = linesMap.get(lineNum) || { texts: [], confs: [], top };
    entry.texts.push(text);
    entry.confs.push(Number.isFinite(conf) ? conf : 0);
    entry.top = Math.min(entry.top, top);
    linesMap.set(lineNum, entry);
  }
  const lines: OcrLine[] = [...linesMap.values()]
    .sort((a, b) => a.top - b.top)
    .map((e, i) => ({
      index: i,
      text: e.texts.join(' '),
      conf: e.confs.reduce((a, b) => a + b, 0) / Math.max(1, e.confs.length),
    }));

  return {
    fields: {
      shop: extractShop(lines),
      amount: extractAmount(lines),
      date: extractDate(lines),
    },
    lines: lines.slice(0, 14),
    engine,
  };
}

function extractShop(lines: OcrLine[]): OcrField {
  for (const line of lines.slice(0, 6)) {
    const text = line.text.trim();
    if (text.length < 3) continue;
    const stripped = text.replace(DATE_NOISE, '').trim();
    if (NOISE.test(stripped)) continue;
    if (!/[A-Za-z]{3}/.test(stripped)) continue; // must contain letters
    const confidence = Math.min(1, line.conf / 100);
    return {
      value: stripped,
      confidence,
      uncertain: confidence < 0.65,
      reason: confidence < 0.65 ? 'Low OCR confidence — please verify the shop name.' : 'Read from the top of the receipt.',
    };
  }
  return { value: null, confidence: 0, uncertain: true, reason: 'Shop name not recognized — please enter it manually.' };
}

function parseAmountToken(tok: string): number | null {
  const cleaned = tok.replace(/[^\d.,]/g, '');
  if (!cleaned || !/\d/.test(cleaned)) return null;
  // Normalize "1,809.15" / "1.809,15" / "1809" -> 1809.15
  let norm = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    norm = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (cleaned.includes(',')) {
    norm = cleaned.replace(/,/g, '');
  }
  const n = Number.parseFloat(norm);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractAmount(lines: OcrLine[]): OcrField {
  const amountRe = /(?:bdt|tk|taka|৳)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i;

  // Pass 1: a line explicitly labelled TOTAL / GRAND TOTAL / AMOUNT DUE (not subtotal)
  for (const line of [...lines].reverse()) {
    if (!/total|amount\s*due|payable/i.test(line.text)) continue;
    if (/sub\s*total/i.test(line.text)) continue;
    const m = line.text.match(new RegExp(amountRe.source, 'gi'));
    if (!m) continue;
    // take the last (usually the amount sits right of the label)
    for (let i = m.length - 1; i >= 0; i--) {
      const n = parseAmountToken(m[i]);
      if (n != null) {
        const confidence = Math.min(1, line.conf / 100);
        return {
          value: n.toFixed(2),
          confidence,
          uncertain: confidence < 0.65,
          reason: `Found after the TOTAL label (read ${m[i].trim()}).`,
        };
      }
    }
  }

  // Pass 2: biggest number on the receipt, flagged for review — never silent.
  let best: { n: number; conf: number; text: string } | null = null;
  for (const line of lines) {
    const m = line.text.match(new RegExp(amountRe.source, 'gi'));
    if (!m) continue;
    for (const tok of m) {
      const n = parseAmountToken(tok);
      if (n != null && (!best || n > best.n)) best = { n, conf: line.conf, text: tok };
    }
  }
  if (best) {
    return {
      value: best.n.toFixed(2),
      confidence: Math.min(0.5, best.conf / 100), // capped: estimation, not a read
      uncertain: true,
      reason: `No TOTAL label found — this is the largest number seen (${best.text}). Please verify before saving.`,
    };
  }
  return { value: null, confidence: 0, uncertain: true, reason: 'Amount not recognized — please enter it manually.' };
}

function extractDate(lines: OcrLine[]): OcrField {
  const iso = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/;
  const dmy = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/;
  for (const line of lines) {
    let m = line.text.match(iso);
    let year: number, month: number, day: number;
    if (m) {
      year = Number(m[1]); month = Number(m[2]); day = Number(m[3]);
    } else {
      m = line.text.match(dmy);
      if (!m) continue;
      day = Number(m[1]); month = Number(m[2]); year = Number(m[3]);
      if (month > 12 && day <= 12) { const t = month; month = day; day = t; }
    }
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) continue;
    const iso2 = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const confidence = Math.min(1, line.conf / 100);
    return {
      value: iso2,
      confidence,
      uncertain: confidence < 0.65,
      reason: confidence < 0.65 ? 'Low OCR confidence — please verify the date.' : 'Found on the receipt.',
    };
  }
  return { value: null, confidence: 0, uncertain: true, reason: 'Date not recognized — please enter it manually.' };
}
