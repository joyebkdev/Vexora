// Some models are trained mainly on one language (Groq's allam-2-7b is an
// Arabic-first model) and answer in it even when the user writes English.
// Every request therefore carries an explicit language rule so replies follow
// the language of the latest user message.

const ARABIC = "Arabic";
const LATIN = "Latin";

const SCRIPTS = [
  {
    name: ARABIC,
    pattern: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g,
  },
  { name: "Hebrew", pattern: /[\u0590-\u05FF]/g },
  { name: "Cyrillic", pattern: /[\u0400-\u04FF]/g },
  { name: "Greek", pattern: /[\u0370-\u03FF]/g },
  { name: "Japanese", pattern: /[\u3040-\u30FF]/g },
  { name: "Korean", pattern: /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/g },
  { name: "Chinese", pattern: /[\u4E00-\u9FFF]/g },
  { name: "Devanagari", pattern: /[\u0900-\u097F]/g },
  { name: "Thai", pattern: /[\u0E00-\u0E7F]/g },
];

const LATIN_LETTER = /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/g;
const ARABIC_LETTER = SCRIPTS[0].pattern;

const countScriptLetters = (value, pattern) =>
  (value.match(pattern) || []).length;

// Returns the dominant non-Latin script in the message, or "Latin" when the
// message is written in Latin letters (English, Spanish, French, ...).
export const detectScript = (text) => {
  const value = (text || "").trim();
  if (!value) return LATIN;

  let dominant = { name: LATIN, count: 0 };
  for (const script of SCRIPTS) {
    const count = countScriptLetters(value, script.pattern);
    if (count > dominant.count) dominant = { name: script.name, count };
  }
  return dominant.name;
};

export const getLanguageInstruction = (latestUserMessage) => {
  const script = detectScript(latestUserMessage);

  if (script === ARABIC) {
    return "The user writes in Arabic. Reply in Arabic unless they explicitly ask for another language.";
  }

  return (
    `The user writes in ${script} script, not Arabic. Reply in the same ` +
    "language and script as the user. Do not answer in Arabic unless the " +
    "user explicitly asks for Arabic or for a translation."
  );
};

// Prepends the rule without touching stored messages, so old chats with an
// Arabic answer do not keep the conversation stuck in Arabic.
// `force` is used for the single retry: it repeats the rule as a hard
// requirement for models that otherwise ignore the first instruction.
export const withLanguageRule = (messages, latestUserMessage, force = false) => {
  const instruction = getLanguageInstruction(latestUserMessage);
  const forceNote = force
    ? " This is a hard requirement: your previous attempt used the wrong " +
      "language, so every sentence of this reply must use the language above."
    : "";

  return [
    {
      role: "system",
      content:
        "You are Vexora, a helpful assistant. Always reply in the language the " +
        "user writes in. " +
        instruction +
        forceNote,
    },
    ...messages,
  ];
};

// Arabic-first models sometimes ignore the system rule. This detects the
// mismatch (user wrote Latin, reply came back mostly Arabic) so the chat can
// retry once instead of showing an answer in the wrong language.
export const needsLanguageRetry = (userText, replyText) => {
  if (detectScript(userText) === ARABIC) return false;

  const reply = replyText || "";
  const arabic = countScriptLetters(reply, ARABIC_LETTER);
  if (arabic < 12) return false;

  const latin = countScriptLetters(reply, LATIN_LETTER);
  return arabic > latin;
};
