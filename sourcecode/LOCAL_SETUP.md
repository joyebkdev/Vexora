# Local Setup (Windows ARM64)

This project runs with **multiple free-tier AI providers**. Chats and keys live
in the browser. No database, accounts or environment variables are needed. One
small public route (`/api/free-models`) reads Google's pricing page; it never
receives API keys.

## Run

```powershell
cd C:\Users\iamjoyeb\Desktop\Projects\Vexora\sourcecode
npm run dev
```

Open http://localhost:3000, click **API keys** in the sidebar (or go to
http://localhost:3000/dashboard), and add a free key from Groq, Google Gemini,
OpenRouter, Cerebras or Mistral. Chats and keys are saved in this browser's
`localStorage`.

Back in the chat, click the model name under the message box to switch models
for the active key. The menu is fetched live from the provider, searchable, and
marks free models.

## What changed from upstream

- Removed Clerk auth (`middleware.ts`, `ClerkProvider`, user buttons).
- Removed MongoDB (`models/`, `config/db.js`) and all `/api/chat/*` routes.
- Removed `@clerk/nextjs`, `mongoose`, `svix`, `openai` and `axios`.
- Chats, selection, rename and delete are handled in
  `context/AppContext.jsx` and persisted to `localStorage`.
- Added a `/dashboard` page and `components/dashboard/*` for managing multiple
  provider keys, models and the active key.
- Models are loaded at runtime from each provider's official `/models` endpoint;
  no model IDs are hardcoded.
- Added `/api/free-models`, a cached read-only parser for Google's public
  Gemini pricing page.
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
- Add keys from **API keys** in the sidebar. Models load automatically from the
  provider's official model list; use **Refresh models** to reload.
- Groq, Cerebras and Mistral do not publish per-model free flags. Vexora shows
  every chat model the key can access; the provider enforces free-tier limits.
- Gemini 2.5 Pro/Flash/Flash-Lite are hidden (`UNAVAILABLE_MODEL_PATTERNS` in
  `config/providers.js`) because Google no longer serves them to new keys.
- Gemini 3.8 Flash is Google's heavy reasoning model and can respond much slower
  than Flash-Lite. New keys default to the fastest available model; replies
  stream as they are generated so the wait is visible.
- Groq's `allam-2-7b` is an Arabic-first model. Vexora sends a language rule with
  every request (`config/language.js`) that names the detected language
  explicitly. Never mention a writing system: ALLaM reads "Latin script" as the
  Latin language and answers in Latin. If the model still answers in Arabic (or
  Latin) to an English message, the reply is retried once with a stricter rule.
  Replies that only echo your message are retried too, and ALLaM is sent with
  `temperature: 0.6, top_p: 0.9` (`MODEL_SAMPLING` in `config/providers.js`)
  because the API defaults produce repetitive answers for this model.
- OpenRouter: free models are detected live from the `:free` suffix and
  zero-price metadata. Free models whose published endpoint is down
  (`status < 0` or uptime below 50%) are hidden until it recovers, and
  non-chat entries such as `nvidia/nemotron-3.5-content-safety` and
  `scaledown/extract` are filtered out. OpenRouter sometimes returns a provider
  error inside a `200` response; Vexora reads that as an error and retries
  transient failures once instead of showing "empty response".
- Gemini: Google's `/models` API has no pricing data, so Vexora parses the
  official pricing page (https://ai.google.dev/gemini-api/docs/pricing) and
  shows only models marked "Free of charge". If that page cannot be read, the
  dialog warns you and shows the full list.
- Each key is sent only to the provider that owns it. Custom keys use the
  endpoint you enter. `/api/free-models` never receives a key.
