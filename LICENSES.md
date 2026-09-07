# Third-Party Material and AI Disclosure

List material frameworks, libraries, starters, templates, UI kits, fonts, icons and assets used in this repository.

| Name | Version or source URL | Licence | Used for |
|---|---|---|---|
| Next.js | https://nextjs.org (v16, App Router) | MIT | Web framework (frontend + API routes) |
| React | https://react.dev (v19) | MIT | UI runtime |
| TypeScript | https://www.typescriptlang.org (v5) | Apache-2.0 | Type-safe language |
| Tailwind CSS | https://tailwindcss.com (v4) | MIT | Utility-first styling |
| shadcn/ui (New York) | https://ui.shadcn.com | MIT | UI component primitives (buttons, cards, tables, dialogs, tabs, etc.) |
| Radix UI primitives | https://www.radix-ui.com | MIT | Accessible behaviour layer used by shadcn/ui components |
| lucide-react | https://lucide.dev | ISC | Icons |
| z-ai-web-dev-sdk | managed SDK (installed via npm) | Proprietary (managed runtime) | Server-side receipt OCR (vision model) in `/api/ocr` only |
| Geist font | https://vercel.com/font (bundled via next/font) | SIL OFL 1.1 | UI typeface |
| tw-animate-css | https://github.com/wacky6/tw-animate-css (via shadcn scaffold) | MIT | Animation utilities for Tailwind |
| next-themes | https://github.com/pacocoursey/next-themes (scaffold dependency) | MIT | Theme variables (scaffold default; light theme used) |
| Python 3 + Pillow | https://www.python.org / https://python-pillow.org | PSF / HPND | Verification harness + synthetic test receipt generation only (not shipped to the browser) |

## AI tools

Listed in `evaluation-manifest.json` → `ai_tools_used`: (1) GLM vision model via `z-ai-web-dev-sdk` — receipt OCR only, gated by a mandatory human review form; (2) Z.ai GLM AI coding assistant — scaffolding/code generation during the event window. Both verified as described in the manifest.

## Original-work statement

Everything not declared in this file or `EVENT.md` was created by the registered team during the event window.
