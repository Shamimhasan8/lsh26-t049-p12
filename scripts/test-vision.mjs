// Quick probe: does z-ai-web-dev-sdk support vision (image) input?
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

async function main() {
  const zai = await ZAI.create();
  const b64 = fs.readFileSync('/home/z/my-project/public/samples/receipt-grocery.png').toString('base64');
  try {
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Read this receipt image. Reply with JSON only: {"shop":string,"amount":number,"date":"YYYY-MM-DD","confidence":{"shop":0..1,"amount":0..1,"date":0..1}}' },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    });
    console.log('VISION_OK');
    console.log(completion.choices[0]?.message?.content);
  } catch (e) {
    console.log('VISION_FAIL:', e.message);
  }
}
main();
