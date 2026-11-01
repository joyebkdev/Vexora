// Some models are trained mainly on one language (Groq's allam-2-7b is an
// Arabic-first model) and answer in it even when the user writes English.
// Every request therefore carries an explicit language rule so replies follow
// the language of the latest user message.
//
// The rule must name a real language ("English"), never a writing system.
// ALLaM reads "reply in Latin script" literally and answers in ancient Latin,
// so script names are only used internally for detection.

const ARABIC = "Arabic";
const LATIN = "Latin";
const ENGLISH = "English";

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

const LATIN_LANGUAGES = [
  {
    name: ENGLISH,
    words: new Set(
      ("hello hi hey the and is are am you your yours how what why who when " +
        "where can could would please thanks thank this that these those with " +
        "for my me i a an to of in it its not no yes do does did have has had " +
        "was were be been being good help need want tell explain write give " +
        "about from on at or if but so we they he she there here okay ok")
        .split(" ")
    ),
  },
  {
    name: "Italian",
    words: new Set(
      ("ciao salve grazie come stai buongiorno buonasera sono sei che cosa " +
        "perche perché questo questa con per mio mia ti mi un una il lo la gli " +
        "le di da in su non si bene aiuto aiutare spiegare scrivere favore prego")
        .split(" ")
    ),
  },
  {
    name: "Spanish",
    words: new Set(
      ("hola gracias como cómo estas estás que qué por para este esta con mi tu " +
        "un una el la los las de en no si sí bien ayuda ayudar explicar " +
        "escribir favor")
        .split(" ")
    ),
  },
  {
    name: "French",
    words: new Set(
      ("bonjour salut merci comment ca ça va je tu il elle nous vous ils elles " +
        "le la les un une des de du en et est pas oui bien aide aider expliquer " +
        "ecrire écrire plait plaît")
        .split(" ")
    ),
  },
  {
    name: "German",
    words: new Set(
      ("hallo danke wie geht ich du er sie es wir ihr der die das ein eine und " +
        "ist nicht ja gut hilfe helfen erklaren erklären schreiben bitte")
        .split(" ")
    ),
  },
  {
    name: "Portuguese",
    words: new Set(
      ("ola olá obrigado obrigada como voce você esta está que por para com meu " +
        "minha um uma o a os as de em nao não sim bem ajuda ajudar explicar " +
        "escrever favor")
        .split(" ")
    ),
  },
  {
    // Detection only. The chat never asks for Latin; this profile catches a
    // model that falls back to it.
    name: LATIN,
    words: new Set(
      ("et in est non ad cum sed quod qui quae quia tibi mihi te me nos vos sum " +
        "es sunt esse habere facere dicere respondero respondeo responde " +
        "auxilium latinum latina quomodo possem possum scriptum utiliter " +
        "quaestor dare lingua salve")
        .split(" ")
    ),
  },
];

const tokenize = (value) =>
  (value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

const scoreLanguage = (tokens, words) =>
  tokens.reduce((score, token) => score + (words.has(token) ? 1 : 0), 0);

const detectLatinLanguage = (value) => {
  const tokens = tokenize(value);
  let best = { name: ENGLISH, score: 0 };

  for (const language of LATIN_LANGUAGES) {
    const score = scoreLanguage(tokens, language.words);
    if (score > best.score) best = { name: language.name, score };
  }

  // Short or ambiguous text (for example "hi") is treated as English, since
  // that is the language most users of this app write in.
  return best.score > 0 ? best : { name: ENGLISH, score: 0 };
};

// Returns the language the user most likely wrote in.
export const detectLanguage = (text) => {
  const script = detectScript(text);
  if (script !== LATIN) return script;
  return detectLatinLanguage(text).name;
};

export const getLanguageInstruction = (latestUserMessage) => {
  const language = detectLanguage(latestUserMessage);

  if (language === ARABIC) {
    return "The user wrote in Arabic, so reply in Arabic.";
  }

  return `The user wrote in ${language}, so reply in ${language}.`;
};

// Prepends the rule without touching stored messages, so old chats with an
// Arabic answer do not keep the conversation stuck in Arabic.
// `retry` is used for the single retry: it repeats the rule as a hard
// requirement and appends a short reminder to the last user turn, because
// small models often follow the final user message more closely than the
// system prompt.
export const withLanguageRule = (messages, latestUserMessage, retry = false) => {
  const language = detectLanguage(latestUserMessage);
  const instruction = getLanguageInstruction(latestUserMessage);
  const system = retry
    ? "You are Vexora, a helpful assistant. Your previous reply was not a good " +
      "answer. Reply again in a complete, useful way. Do not repeat the user's " +
      `message or reply with only a greeting. ${instruction}`
    : "You are Vexora, a helpful assistant. Reply with a complete, useful " +
      "answer. Never repeat the user's message or reply with only a greeting. " +
      instruction;

  const prepared = messages.map((message) => ({ ...message }));
  const last = prepared[prepared.length - 1];
  if (retry && last?.role === "user") {
    prepared[prepared.length - 1] = {
      ...last,
      content:
        `${last.content}\n\n` +
        `(Please answer this message properly in ${language}. ` +
        "Do not repeat my words.)",
    };
  }

  return [{ role: "system", content: system }, ...prepared];
};

// Arabic-first models sometimes ignore the system rule. This detects the
// mismatch (user wrote Latin, reply came back mostly Arabic) so the chat can
// retry once instead of showing an answer in the wrong language.
export const needsLanguageRetry = (userText, replyText) => {
  const expected = detectLanguage(userText);
  const reply = replyText || "";
  if (!reply.trim()) return false;

  if (expected !== ARABIC) {
    const arabic = countScriptLetters(reply, ARABIC_LETTER);
    const latin = countScriptLetters(reply, LATIN_LETTER);
    if (arabic >= 12 && arabic > latin) return true;
  }

  const nonLatin = SCRIPTS.some((script) => script.name === expected);
  const isLatinLanguage = !nonLatin;

  if (isLatinLanguage) {
    const detected = detectLatinLanguage(reply);
    if (detected.name === expected) return false;

    // Classical Latin is never the desired answer; other modern languages need
    // a clearer signal before spending a second request.
    if (detected.name === LATIN) return detected.score >= 3;
    return detected.score >= 4;
  }

  return false;
};

// Weak models sometimes answer "hello" with "hello" instead of replying.
// Detecting the echo lets the chat retry once with a direct instruction.
export const needsUsefulReply = (userText, replyText) => {
  const user = tokenize(userText).join(" ");
  const reply = tokenize(replyText).join(" ");
  if (!reply || !user) return false;
  return reply === user;
};
