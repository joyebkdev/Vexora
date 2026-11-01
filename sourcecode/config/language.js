// Some models are trained mainly on one language (Groq's allam-2-7b is an
// Arabic-first model) and answer in it even when the user writes English.
// Every request therefore carries an explicit language rule so replies follow
// the language of the latest user message.
//
// The rule is deliberately short and positive: small models such as ALLaM are
// documented as working best without a long, negative system prompt, and a
// wall of restrictions makes them parrot the user's message instead.

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
    return "The user wrote in Arabic, so reply in Arabic.";
  }

  return (
    `The user wrote in ${script} script, so reply in that same language. ` +
    "Do not switch to Arabic."
  );
};

// Prepends the rule without touching stored messages, so old chats with an
// Arabic answer do not keep the conversation stuck in Arabic.
// `retry` is used for the single retry: it repeats the rule as a hard
// requirement and appends a short reminder to the last user turn, because
// small models often follow the final user message more closely than the
// system prompt.
export const withLanguageRule = (messages, latestUserMessage, retry = false) => {
  const instruction = getLanguageInstruction(latestUserMessage);
  const system = retry
    ? "You are Vexora, a helpful assistant. Your previous reply was not a good " +
      "answer. Reply again in the user's language with a complete, useful " +
      "response. Do not repeat the user's message or reply with only a greeting. " +
      instruction
    : "You are Vexora, a helpful assistant. Reply in the user's language with " +
      "a complete, useful answer. Never repeat the user's message or reply " +
      "with only a greeting. " +
      instruction;

  const prepared = messages.map((message) => ({ ...message }));
  const last = prepared[prepared.length - 1];
  if (retry && last?.role === "user") {
    prepared[prepared.length - 1] = {
      ...last,
      content:
        `${last.content}\n\n` +
        "(Please answer this message properly in my language. " +
        "Do not repeat my words.)",
    };
  }

  return [{ role: "system", content: system }, ...prepared];
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

const normalizeText = (value) =>
  (value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

// Weak models sometimes answer "hello" with "hello" instead of replying.
// Detecting the echo lets the chat retry once with a direct instruction.
export const needsUsefulReply = (userText, replyText) => {
  const user = normalizeText(userText);
  const reply = normalizeText(replyText);
  if (!reply || !user) return false;
  return reply === user;
};
