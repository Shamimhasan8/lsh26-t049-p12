// Generates 3 realistic receipt PNGs in /public/samples via sharp (SVG -> PNG)
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const W = 480;
const outDir = '/home/z/my-project/public/samples';
fs.mkdirSync(outDir, { recursive: true });

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function receipt({ shop, addr, phone, date, inv, items, subtotal, vat, total, paid, change, payment, footer, tint }) {
  let y = 150;
  y += 90; // date/inv block
  const rows = items.map(([name, qty, price]) => {
    const line = `<text x="48" y="${y}" font-family="DejaVu Sans Mono" font-size="17" fill="#1a1a1a">${esc(name)}</text>
      <text x="${W - 48}" y="${y}" font-family="DejaVu Sans Mono" font-size="17" fill="#1a1a1a" text-anchor="end">${qty} x ${price}</text>`;
    y += 30;
    return line;
  }).join('\n');

  const totals = [
    ['SUBTOTAL', subtotal],
    ['VAT 5%', vat],
    ['TOTAL', total],
    ['PAID', paid],
    ['CHANGE', change],
  ];
  const totalsSvg = totals.map(([label, val], i) => {
    const bold = i === 2;
    const out = `<text x="48" y="${y}" font-family="DejaVu Sans Mono" font-size="${bold ? 21 : 17}" font-weight="${bold ? 'bold' : 'normal'}" fill="#111">${label}</text>
      <text x="${W - 48}" y="${y}" font-family="DejaVu Sans Mono" font-size="${bold ? 21 : 17}" font-weight="${bold ? 'bold' : 'normal'}" fill="#111" text-anchor="end">BDT ${val}</text>
      ${i === 2 ? `<line x1="40" y1="${y + 12}" x2="${W - 40}" y2="${y + 12}" stroke="#111" stroke-width="2"/>` : ''}`;
    y += bold ? 44 : 30;
    return out;
  }).join('\n');

  return `<svg width="${W}" height="${y + 150}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${y + 150}" fill="${tint}"/>
    <rect x="14" y="14" width="${W - 28}" height="${y + 150 - 28}" fill="#ffffff" stroke="#d8d4cc" stroke-width="2"/>
    <text x="${W / 2}" y="64" font-family="DejaVu Sans" font-size="${shop.length > 20 ? 22 : 26}" font-weight="bold" fill="#111" text-anchor="middle">${esc(shop)}</text>
    <text x="${W / 2}" y="90" font-family="DejaVu Sans" font-size="14" fill="#444" text-anchor="middle">${esc(addr)}</text>
    <text x="${W / 2}" y="110" font-family="DejaVu Sans" font-size="14" fill="#444" text-anchor="middle">${esc(phone)}</text>
    <line x1="40" y1="126" x2="${W - 40}" y2="126" stroke="#999" stroke-width="1" stroke-dasharray="6 4"/>
    <text x="48" y="160" font-family="DejaVu Sans Mono" font-size="15" fill="#333">DATE: ${esc(date)}</text>
    <text x="${W - 48}" y="160" font-family="DejaVu Sans Mono" font-size="15" fill="#333" text-anchor="end">INV: ${esc(inv)}</text>
    <line x1="40" y1="176" x2="${W - 40}" y2="176" stroke="#999" stroke-width="1" stroke-dasharray="6 4"/>
    ${rows}
    <line x1="40" y1="${y - 14}" x2="${W - 40}" y2="${y - 14}" stroke="#999" stroke-width="1" stroke-dasharray="6 4"/>
    ${totalsSvg}
    <text x="${W / 2}" y="${y + 10}" font-family="DejaVu Sans Mono" font-size="14" fill="#555" text-anchor="middle">PAYMENT: ${esc(payment)}</text>
    <line x1="40" y1="${y + 26}" x2="${W - 40}" y2="${y + 26}" stroke="#999" stroke-width="1" stroke-dasharray="6 4"/>
    <text x="${W / 2}" y="${y + 56}" font-family="DejaVu Sans" font-size="15" fill="#333" text-anchor="middle">${esc(footer)}</text>
    <text x="${W / 2}" y="${y + 78}" font-family="DejaVu Sans" font-size="13" fill="#777" text-anchor="middle">LofiStack P12 sample receipt</text>
  </svg>`;
}

const specs = [
  {
    file: 'receipt-grocery.png',
    tint: '#f6f4ee',
    shop: 'MEENA BAZAR', addr: 'House 12, Road 5, Dhanmondi, Dhaka 1205', phone: 'Tel: +880 2 9612345',
    date: '2026-08-22', inv: 'MB-88412',
    items: [['RICE MINIKET 5KG', '1', '340.00'], ['SOYABEAN OIL 2L', '2', '620.00'], ['EGGS (DOZEN)', '1', '148.00'], ['ONION 1KG', '2', '190.00'], ['MILK POWDER 500G', '1', '425.00']],
    subtotal: '1,723.00', vat: '86.15', total: '1,809.15', paid: '2,000.00', change: '190.85',
    payment: 'bKASH',
    footer: 'Thank you for shopping with us!',
  },
  {
    file: 'receipt-cafe.png',
    tint: '#f3f1ec',
    shop: 'STAR KABAB & RESTAURANT', addr: 'Plot 7, Gulshan Avenue, Dhaka 1212', phone: 'Tel: +880 1711-223344',
    date: '2026-08-27', inv: 'SK-30217',
    items: [['CHICKEN TIKKA (8PCS)', '2', '480.00'], ['MUTTON BIRYANI', '3', '930.00'], ['BORHANI 500ML', '2', '120.00'], ['FALUDA', '1', '180.00']],
    subtotal: '1,710.00', vat: '171.00', total: '1,881.00', paid: '2,000.00', change: '119.00',
    payment: 'CASH',
    footer: 'Please visit again!',
  },
  {
    file: 'receipt-recharge.png',
    tint: '#f2f0eb',
    shop: 'bKash Mobile Recharge', addr: 'Agent: Riaj Store, Mirpur 10, Dhaka', phone: 'TrxID 9F7CB2XK',
    date: '2026-08-18', inv: 'RC-77104',
    items: [['ROBI RECHARGE 017xxxxxxxx', '1', '500.00']],
    subtotal: '500.00', vat: '0.00', total: '500.00', paid: '500.00', change: '0.00',
    payment: 'bKash Wallet',
    footer: 'Recharge successful. Save your TrxID.',
  },
];

for (const s of specs) {
  const svg = receipt(s);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  fs.writeFileSync(path.join(outDir, s.file), png);
  console.log('wrote', s.file);
}
console.log('done');
