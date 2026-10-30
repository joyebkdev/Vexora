# Vexora (local-first, multi-provider)

Vexora is a local-first AI chat app built with Next.js, React and Tailwind CSS.

It runs **entirely in the browser** and supports free-tier API keys from
multiple providers:

- No accounts or sign-in.
- No database and no API routes.
- Chats are stored in the browser with `localStorage`.
- API keys are stored in the browser and sent directly to the provider you pick.

## Features

- **API key dashboard** - add and manage keys for Groq, Google Gemini,
  OpenRouter, Cerebras, Mistral, or any OpenAI-compatible endpoint.
- **One active key** - switch provider only when you need to; every chat uses
  the active key, provider and model.
- **Model discovery** - **Load models** asks the provider which models the key
  can use, avoiding "model does not exist" errors.
- **Chats that persist locally** - reload the page and conversations remain.
- **Multiple chats** - create, rename, delete and switch between conversations.
- **Markdown + code highlighting** - rendered with `react-markdown` and Prism.
- **Responsive layout** - works on desktop and mobile.
- **No backend** - nothing to host, connect, or configure.

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
   free-tier provider, paste a key and click **Add key**. Use **Load models** to
   see which models that key can access.

5. Start chatting. The first message becomes the chat title automatically.

### Production build

```bash
npm run build
npm run start
```

## Folder structure

```text
vexora/
├── app/
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
- Clearing site data in your browser removes all chats and saved keys.
- Because everything is client-side, there is no server-side history or shared
  database.

## Notes

- Free tiers are rate-limited. If you hit a limit, wait a moment, switch to
  another key/provider in the dashboard, or pick a model with more quota.
- `localStorage` is per browser and per origin. Chats and keys do not sync
  between devices or browsers.
- Private/incognito mode may discard storage when the window closes.
- **Load models** is provider-aware: it filters Groq's non-chat models, Gemini's
  non-text models, and OpenRouter's paid models where possible.
- Some model names are plan-specific, so always prefer the loaded list if a
  request reports that the model does not exist.

## License

MIT. See [LICENSE](LICENSE).

## Credits

Original project: [elyse502/deepseek-clone](https://github.com/elyse502/deepseek-clone)
by [NIYIBIZI Elysée](https://github.com/elyse502).

Modified locally to remove Clerk, MongoDB and all backend routes, to use
browser storage with multiple AI providers, and to rebrand the UI as **Vexora**.
