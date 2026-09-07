// Receipt OCR endpoint (R2). Server-side only: calls the vision model with
// the uploaded receipt image and returns STRICT JSON fields. The model never
// touches the ledger — its output lands in the client's review form where a
// human confirms or corrects every field before it is added.

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export const maxDuration = 60;

const PROMPT = `You are a precise receipt-OCR extraction engine for Bangladeshi expense tracking.
Look at the receipt image and extract exactly these fields. Rules:
- "shop": merchant/shop name as printed (title case). If unreadable, null.
- "date": transaction/receipt date as "YYYY-MM-DD". If the year is missing or ambiguous, infer the most plausible year consistent with the date printed. If no date at all, null.
- "amount_bdt": the GRAND TOTAL paid, as a plain string with exactly 2 decimals like "1234.50" (BDT, no currency symbol, no thousands separators). If only items + VAT are listed, sum them. If unreadable, null.
- "category": choose exactly one of ["Food","Groceries","Rent","Transport","Utilities","Mobile","Health","Education","Entertainment","Clothing","Other"] — the best fit for this receipt.
- "items": up to 5 line items as "name x qty = amount" strings, or [] if none readable.
- "confidence": your overall confidence 0..1 for shop/date/amount together.
- "notes": one short sentence about anything uncertain (smudged print, ambiguous total, etc).
Respond with ONLY a single JSON object, no markdown fences, no commentary:
{"shop": string|null,"date": string|null,"amount_bdt": string|null,"category": string,"items": string[],"confidence": number,"notes": string}`;

interface OcrFields {
  shop: string | null;
  date: string | null;
  amount_bdt: string | null;
  category: string;
  items: string[];
  confidence: number;
  notes: string;
}

function extractJson(text: string): OcrFields | null {
  const cleaned = text.replace(/```json/gi, '```').split('```').join('\n');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    return {
      shop: typeof obj.shop === 'string' && obj.shop.trim() ? obj.shop.trim() : null,
      date: typeof obj.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(obj.date) ? obj.date : null,
      amount_bdt: typeof obj.amount_bdt === 'string' && /^-?\d+(\.\d{1,2})?$/.test(obj.amount_bdt.trim()) ? obj.amount_bdt.trim() : null,
      category: typeof obj.category === 'string' && obj.category.trim() ? obj.category.trim() : 'Other',
      items: Array.isArray(obj.items) ? obj.items.map(String).slice(0, 5) : [],
      confidence: typeof obj.confidence === 'number' ? Math.max(0, Math.min(1, obj.confidence)) : 0.5,
      notes: typeof obj.notes === 'string' ? obj.notes : '',
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let imageDataUrl = '';
  try {
    const body = (await req.json()) as { imageDataUrl?: string };
    imageDataUrl = typeof body.imageDataUrl === 'string' ? body.imageDataUrl : '';
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (!imageDataUrl.startsWith('data:image/')) {
    return NextResponse.json({ ok: false, error: 'Send { imageDataUrl: "data:image/png;base64,..." }.' }, { status: 400 });
  }

  try {
    const zai = await ZAI.create();
    let fields: OcrFields | null = null;
    let raw = '';

    for (let attempt = 0; attempt < 2 && fields === null; attempt++) {
      const completion = await zai.chat.completions.createVision({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: attempt === 0 ? PROMPT : `${PROMPT}\nIMPORTANT: reply with the raw JSON object only.` },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          },
        ],
        thinking: { type: 'disabled' },
      });
      raw = completion.choices[0]?.message?.content ?? '';
      fields = extractJson(raw);
    }

    if (fields === null) {
      return NextResponse.json({
        ok: true,
        fields: null,
        raw,
        error: 'The vision model did not return parsable JSON. Enter the fields manually below.',
      });
    }
    return NextResponse.json({ ok: true, fields, raw });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown OCR error';
    return NextResponse.json({ ok: false, error: `OCR failed: ${message}` }, { status: 502 });
  }
}
