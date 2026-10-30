# Local Setup (Windows ARM64)

This project runs entirely in the browser with **multiple free-tier AI
providers**. No database, accounts, backend routes or environment variables are
needed.

## Run

```powershell
cd C:\Users\iamjoyeb\Desktop\Projects\Vexora\sourcecode
npm run dev
```

Open http://localhost:3000, click **API keys** in the sidebar (or go to
http://localhost:3000/dashboard), and add a free key from Groq, Google Gemini,
OpenRouter, Cerebras or Mistral. Chats and keys are saved in this browser's
`localStorage`.

## What changed from upstream

- Removed Clerk auth (`middleware.ts`, `ClerkProvider`, user buttons).
- Removed MongoDB (`models/`, `config/db.js`) and all `/api/chat/*` routes.
- Removed `@clerk/nextjs`, `mongoose`, `svix`, `openai` and `axios`.
- Chats, selection, rename and delete are handled in
  `context/AppContext.jsx` and persisted to `localStorage`.
- Added a `/dashboard` page and `components/dashboard/*` for managing multiple
  provider keys, models and the active key.
- Uses free-tier providers from `config/providers.js` (Groq, Gemini, OpenRouter,
  Cerebras, Mistral) plus any custom OpenAI-compatible endpoint.
- `.env.local` / `.env.example` are no longer used.

## Windows ARM64 note (already applied)

This machine is Windows on ARM64 with Node 26. The Microsoft Visual C++
Redistributable was missing, which broke the native binaries used by Next.js
(`@next/swc-win32-arm64-msvc`) and Tailwind (`lightningcss`).

The required ARM64 DLLs were extracted to:

```
%LOCALAPPDATA%\vc-runtime-arm64
```

and that folder was prepended to the **user** `PATH`. Restart open terminals to
pick it up. Alternatively install the official redistributable as admin:

```powershell
winget install --id Microsoft.VCRedist.2015+.arm64
```

## Browser storage keys

| Key | Contents |
| --- | --- |
| `vexora:chats` | All conversations and messages |
| `vexora:selected-chat` | Last selected chat id |
| `vexora:api-keys` | Saved provider keys, labels, endpoints and models |
| `vexora:active-key` | Id of the key currently used by the chat |

Older `vexora:settings` and `deepseek-clone:*` data is migrated automatically to
these keys the first time Vexora loads.

To wipe everything: DevTools → Application → Local Storage → delete the keys,
or use "Clear site data" in the browser.

## Provider notes

- Free tiers are rate-limited; errors are shown as toasts in the app.
- Add keys from **API keys** in the sidebar. **Load models** fetches the models
  each key can actually access.
- Groq: default model is `openai/gpt-oss-120b`; Llama 3.3 70B is Enterprise-only
  on Groq, so prefer the loaded list.
- OpenRouter: only `:free`/zero-cost models are listed when available.
- Gemini: the dashboard lists models that support `generateContent`.
- Each key is sent only to the provider that owns it. Custom keys use the
  endpoint you enter.
