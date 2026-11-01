# Vexora (local-first, multi-provider)

Vexora is a local-first AI chat app built with Next.js, React and Tailwind CSS.

Chats and API keys stay in the browser. It supports free-tier API keys from
multiple providers:

- No accounts or sign-in.
- No database.
- Chats are stored in the browser with `localStorage`.
- API keys are stored in the browser and sent directly to the provider you pick.
- One small public route reads Google's pricing page to detect free-tier Gemini
  models; API keys are never sent to it.

## Features

- **API key dashboard** - add and manage keys for Groq, Google Gemini,
  OpenRouter, Cerebras, Mistral, or any OpenAI-compatible endpoint.
- **One active key** - switch provider only when you need to; every chat uses
  the active key, provider and model.
- **Dynamic model discovery** - models load automatically from each provider's
  official model API when you enter a key. No model IDs are hardcoded, so new or
  retired models appear without updating Vexora.
- **Live free-model detection** - OpenRouter free models are filtered from live
  pricing data, and Gemini's free-tier list is read from Google's official
  pricing page. Other providers expose their whole free-tier-eligible list.
  OpenRouter models whose upstream provider is down are hidden until it recovers.
- **Model picker in chat** - click the model name below the message box to
  switch models for the active key. The list is fetched live, searchable, and
  remembers your choice.
- **Retired model filter** - models the provider no longer serves (for example
  Gemini 2.5 Pro/Flash/Flash-Lite) are hidden, and a saved selection is cleared
  so the chat asks for a working model instead of failing.
- **Fast defaults + streaming** - free lists put Flash-Lite/Mini models first so
  a new key does not default to a heavy reasoning model, and replies stream
  token by token instead of waiting for the full answer.
- **Replies in your language** - every request tells the model to answer in the
  language you wrote in, named explicitly (English, Italian, Arabic, ...) rather
  than a writing system. Arabic-first models such as Groq's `allam-2-7b` can
  ignore that rule, so a mostly-Arabic answer to an English message is retried
  once with the rule repeated. An answer that only echoes your message is
  retried the same way, and ALLaM uses the sampling values from its model card.
- **Provider failure diagnostics** - upstream failures that arrive inside a
  `200` response (OpenRouter does this) are parsed as errors instead of looking
  like an empty answer. Transient failures and empty responses are retried once,
  and the message names the upstream provider when OpenRouter reports one.
- **Chats that persist locally** - reload the page and conversations remain.
- **Multiple chats** - create, rename, delete and switch between conversations.
- **Markdown + code highlighting** - rendered with `react-markdown` and Prism.
- **Responsive layout** - works on desktop and mobile.
- **No database** - only a small read-only route for Google's public pricing
  page.

## Tech stack

- **Frontend**: React 19, Next.js 15 (App Router)
- **Styling**: Tailwind CSS v4
- **State**: React Context API
- **Storage**: Browser `localStorage`
- **AI API**: OpenAI-compatible chat completions, direct from the browser
- **Notifications**: React Hot Toast

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the dev server:

   ```bash
   npm run dev
   ```

3. Open http://localhost:3000

4. Open **API keys** in the sidebar (or http://localhost:3000/dashboard), pick a
   free-tier provider, and paste a key. Models load automatically from that
   provider's official list; choose a free model and click **Add key**.

5. Start chatting. The first message becomes the chat title automatically. To
   switch models, click the model name under the message box and pick from the
   live list; free models are marked with a badge.

### Production build

```bash
npm run build
npm run start
```

## Folder structure

```text
vexora/
├── app/
│   ├── api/
│   │   └── free-models/ # parses Google's public pricing page
│   ├── dashboard/       # API key dashboard
│   ├── globals.css
│   ├── layout.js
│   ├── page.jsx
│   └── prism.css
├── assets/              # SVG icons and images
├── components/
│   ├── dashboard/
│   │   ├── KeyCard.jsx
│   │   └── KeyModal.jsx
│   ├── ChatLabel.jsx
│   ├── Message.jsx
│   ├── ModelPicker.jsx  # live model menu under the chat box
│   ├── PromptBox.jsx
│   └── Sidebar.jsx
├── config/
│   └── providers.js     # providers, endpoints, model discovery
├── context/
│   └── AppContext.jsx   # chats + API keys + localStorage persistence
└── package.json
```

## Data and privacy

- Chats are saved under `vexora:chats` in `localStorage`.
- API keys are saved under `vexora:api-keys`; the selected key id is stored
  under `vexora:active-key`.
- Older `vexora:settings` and `deepseek-clone:*` data is migrated automatically
  on first load.
- Keys are sent **only** to the provider you selected.
- `/api/free-models` fetches Google's public Gemini pricing page on the server
  and caches the parsed free-model list for six hours. It never receives or
  stores API keys.
- Clearing site data in your browser removes all chats and saved keys.
- Chats and keys stay in your browser; there is no server-side history or
  shared database.

## Notes

- Free tiers are rate-limited. If you hit a limit, wait a moment, switch to
  another key/provider in the dashboard, or pick a model with more quota.
- `localStorage` is per browser and per origin. Chats and keys do not sync
  between devices or browsers.
- Private/incognito mode may discard storage when the window closes.
- Models load from the provider's official `/models` endpoint. Use **Refresh
  models** after changing your plan or key.
- Auto-selected models prefer Flash-Lite/Mini, then Flash, then Pro, so a new
  key starts on a fast model. Pick another in the chat's model menu.
- Gemini 2.5 Pro, Flash and Flash-Lite are hidden because Google no longer serves
  them to new API keys even though its pricing page still lists them. Add any
  future retired IDs to `UNAVAILABLE_MODEL_PATTERNS` in `config/providers.js`.
- Replies stream token by token. If a provider ignores streaming, Vexora falls
  back to the full JSON response automatically.
- OpenRouter can send an error inside a `200` response, or an empty stream when
  its upstream provider fails. Vexora parses both as errors, retries transient
  provider failures and empty answers once, and hides free models whose
  OpenRouter endpoint is currently down (`status < 0` or under 50% uptime).
  Hidden models come back automatically when the provider recovers.
- **Load/refresh** filters Groq's non-chat models, Gemini's non-text models, and
  OpenRouter's paid and non-chat models (content-safety classifiers, music, and
  ScaleDown's extraction/summarization models).
- Gemini's free list is parsed live from the official pricing page
  (https://ai.google.dev/gemini-api/docs/pricing). If Google changes the page or
  is temporarily unavailable, Vexora shows all available models and warns you in
  the key dialog instead of guessing.
- Free-tier rules are provider-side and rate-limited. A model listed as free can
  still return quota errors.
- Some model names are plan-specific, so always prefer the live list if a request
  reports that the model does not exist.

## License

MIT. See [LICENSE](LICENSE).

## Credits

Original project: [elyse502/deepseek-clone](https://github.com/elyse502/deepseek-clone)
by [NIYIBIZI Elysée](https://github.com/elyse502).

Modified locally to remove Clerk and MongoDB, use browser storage with multiple
AI providers, add live model discovery, and rebrand the UI as **Vexora**.
