#!/usr/bin/env python3
"""Generate a test receipt PNG and exercise the /api/ocr endpoint."""
from PIL import Image, ImageDraw
import base64, io, json, urllib.request

img = Image.new("RGB", (420, 560), "white")
d = ImageDraw.Draw(img)
lines = [
    (30, "MEENA BAZAR", 26),
    (70, "Dhanmondi Branch, Dhaka", 14),
    (100, "Date: 2026-04-15", 14),
    (130, "-----------------------------", 14),
    (160, "Rice 5kg           450.00", 14),
    (190, "Cooking Oil 2L     640.00", 14),
    (220, "Eggs (dozen)       145.00", 14),
    (250, "Milk 1L x2          180.00", 14),
    (280, "-----------------------------", 14),
    (310, "VAT (5%)             70.75", 14),
    (345, "TOTAL          1,485.75 BDT", 22),
    (400, "Thank you for shopping!", 14),
    (430, "bKash accepted", 12),
]
for y, text, size in lines:
    d.text((40, y), text, fill="black", font_size=size)
img.save("scripts/test-receipt.png")

buf = io.BytesIO()
img.save(buf, format="PNG")
b64 = base64.b64encode(buf.getvalue()).decode()
payload = json.dumps({"imageDataUrl": f"data:image/png;base64,{b64}"}).encode()

req = urllib.request.Request("http://localhost:3000/api/ocr", data=payload, headers={"Content-Type": "application/json"})
try:
    with urllib.request.urlopen(req, timeout=90) as r:
        out = json.load(r)
        print(json.dumps(out, indent=1)[:1200])
except Exception as e:
    print("ERROR:", e)
