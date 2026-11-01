// Providers use OpenAI-compatible chat endpoints. Model lists and free-tier
// eligibility are discovered at runtime, so new or retired models do not need
// code changes.

export const PROVIDERS = [
  {
    id: "groq",
    name: "Groq",
    description: "Very fast Llama, GPT-OSS and Qwen models with a free tier.",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    modelsUrl: "https://api.groq.com/openai/v1/models",
    keyUrl: "https://console.groq.com/keys",
    keyHint: "gsk_...",
    keyPattern: /^gsk_[A-Za-z0-9]{20,}$/,
    freeTier: "Free tier",
    accent: "#F55036",
    docsUrl: "https://console.groq.com/docs/models",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description:
      "Google AI Studio free tier. Free models come from Google's official pricing page.",
    endpoint:
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    modelsUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    modelsAuth: "query",
    keyUrl: "https://aistudio.google.com/app/apikey",
    keyHint: "AIza...",
    keyPattern: /^AIza[0-9A-Za-z_-]{35}$/,
    freeTier: "Free tier",
    accent: "#4285F4",
    // Google's /models API does not expose price/free-tier data, so the
    // official pricing page is parsed by /api/free-models.
    freeFilter: "gemini-docs",
    docsUrl: "https://ai.google.dev/gemini-api/docs/pricing",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description:
      "One key for many models. Free models are detected from live pricing data.",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    modelsUrl: "https://openrouter.ai/api/v1/models",
    keyUrl: "https://openrouter.ai/keys",
    keyHint: "sk-or-v1-...",
    keyPattern: /^sk-or-v1-[0-9a-f]{20,}$/i,
    freeTier: "Free models",
    accent: "#8B5CF6",
    freeFilter: "openrouter-pricing",
    docsUrl: "https://openrouter.ai/models?max_price=0",
  },
  {
    id: "cerebras",
    name: "Cerebras",
    description: "Extremely fast inference with a free developer tier.",
    endpoint: "https://api.cerebras.ai/v1/chat/completions",
    modelsUrl: "https://api.cerebras.ai/v1/models",
    keyUrl: "https://cloud.cerebras.ai",
    keyHint: "csk-...",
    keyPattern: /^csk-[A-Za-z0-9_-]{20,}$/,
    freeTier: "Free tier",
    accent: "#FF6B35",
    docsUrl: "https://inference-docs.cerebras.ai/models/overview",
  },
  {
    id: "mistral",
    name: "Mistral",
    description: "Mistral's free experiment tier for small and large models.",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    modelsUrl: "https://api.mistral.ai/v1/models",
    keyUrl: "https://console.mistral.ai/api-keys",
    keyHint: "Your Mistral API key",
    keyPattern: /^[A-Za-z0-9_-]{24,}$/,
    freeTier: "Free tier",
    accent: "#FF7000",
    docsUrl: "https://docs.mistral.ai/getting-started/models/models_overview/",
  },
  {
    id: "custom",
    name: "Custom endpoint",
    description: "Any OpenAI-compatible chat completions endpoint.",
    endpoint: "",
    modelsUrl: "",
    keyUrl: "",
    keyHint: "sk-...",
    freeTier: "Custom",
    accent: "#64748B",
  },
];

const CUSTOM_PROVIDER = PROVIDERS[PROVIDERS.length - 1];

// Models that a provider still advertises (or still lists on its pricing page)
// but no longer serves to API keys. They are hidden from every model list so a
// chat can never select a dead model. Keep this list small and explicit; every
// other model comes from the provider's live endpoint.
//
// Gemini 2.5 Pro/Flash/Flash-Lite remain on Google's pricing page but return
// "model not found" for new keys.
const UNAVAILABLE_MODEL_PATTERNS = {
  gemini: [/^gemini-2\.5-(pro|flash|flash-lite)(-\d+)?$/i],
};

export const isUnavailableModel = (providerId, modelId) => {
  const patterns = UNAVAILABLE_MODEL_PATTERNS[providerId];
  if (!patterns) return false;
  const id = (modelId || "").trim();
  return patterns.some((pattern) => pattern.test(id));
};

// Sampling hints, not model discovery. A few small models are much more
// reliable at the values their model card recommends instead of the API
// defaults (temperature 1, top_p 1). ALLaM-2-7B currently echoes the user's
// words at the defaults and answers properly around 0.6/0.9.
const MODEL_SAMPLING = [
  { pattern: /(^|\/)allam-2-7b$/i, temperature: 0.6, topP: 0.9 },
];

export const getModelSampling = (modelId) => {
  const id = (modelId || "").trim();
  const match = MODEL_SAMPLING.find((entry) => entry.pattern.test(id));
  if (!match) return null;
  return {
    ...(match.temperature !== undefined ? { temperature: match.temperature } : {}),
    ...(match.topP !== undefined ? { top_p: match.topP } : {}),
  };
};

export const getProvider = (id) =>
  PROVIDERS.find((provider) => provider.id === id) || CUSTOM_PROVIDER;

export const getKeyEndpoint = (key) => {
  if (!key) return "";
  const provider = getProvider(key.provider);
  return (key.endpoint || provider.endpoint || "").trim();
};

export const getKeyModel = (key) => {
  if (!key) return "";
  return (key.model || "").trim();
};

// Used only to decide when it is safe to auto-fetch models while the user is
// still typing a key. Manual "Refresh models" still accepts any value.
export const isLikelyKey = (providerId, value) => {
  const provider = getProvider(providerId);
  const key = (value || "").trim();
  if (!key) return false;
  return provider.keyPattern
    ? provider.keyPattern.test(key)
    : key.length >= 8;
};

// Google returns the reason for a rejected key in error.details, and the
// OpenAI-compatible endpoint wraps errors in an array. Without this the UI
// would only show "request failed (400)".
const GEMINI_KEY_HINTS = {
  API_KEY_INVALID:
    "Create a new key at https://aistudio.google.com/app/apikey and paste it again.",
  API_KEY_HTTP_REFERRER_BLOCKED:
    "This key is restricted to other websites. In Google Cloud Console either allow http://localhost:3000 or remove the website restriction.",
  API_KEY_IP_ADDRESS_BLOCKED:
    "This key is restricted to specific IP addresses, so it cannot be used from the browser.",
  API_KEY_SERVICE_BLOCKED:
    "This key is restricted to other APIs. Allow the Generative Language API for this key.",
  API_KEY_EXPIRED:
    "This key has expired. Create a new key in Google AI Studio.",
  SERVICE_DISABLED:
    "The Generative Language API is disabled for this key's project. Enable it in Google Cloud Console.",
  PERMISSION_DENIED:
    "Google denied the request for this key. Check its API and website restrictions.",
  RESOURCE_EXHAUSTED:
    "The free-tier quota for this key is used up. Wait for it to reset or pick another model.",
};

const getErrorObject = (data) => {
  if (Array.isArray(data)) return getErrorObject(data[0]);

  const candidate =
    data?.error ||
    data?.choices?.[0]?.error ||
    (data?.choices?.[0]?.finish_reason === "error"
      ? data.choices[0]
      : null);
  if (!candidate) return null;

  // A few providers nest the real error one level deeper.
  if (candidate.error && !candidate.message && !candidate.code) {
    return getErrorObject(candidate);
  }
  return candidate;
};

// Some upstreams report their error as a JSON string inside the message.
const unwrapMessage = (message) => {
  const text = (message || "").trim();
  if (!/^[[{]/.test(text)) return text;

  try {
    const parsed = JSON.parse(text);
    const nested = getErrorObject(parsed) || parsed;
    if (typeof nested?.message === "string" && nested.message.trim()) {
      return nested.message.trim();
    }
    if (typeof nested?.error === "string" && nested.error.trim()) {
      return nested.error.trim();
    }
  } catch {
    // Not JSON after all.
  }
  return text;
};

const OPENROUTER_HINTS = {
  provider_unavailable:
    "The upstream provider failed while answering. Retry once, or pick another free model.",
  provider_overloaded:
    "The upstream provider is overloaded. Try again in a moment or pick another model.",
  timeout: "The upstream provider timed out. Try again or pick another model.",
  server:
    "The upstream provider hit an internal error. Try again or pick another model.",
  unmapped:
    "The upstream provider returned an unexpected error. Try again or pick another model.",
  rate_limit_exceeded:
    "The rate limit for this key or free model is used up. Wait for it to reset.",
  content_policy_violation:
    "The provider's content filter declined this request.",
  refusal: "The model refused this request.",
  authentication:
    "OpenRouter rejected the key. Check it in the API keys dashboard.",
  payment_required:
    "This key has no credits for the selected model. Pick a free model.",
};

const TRANSIENT_ERROR_TYPES = new Set([
  "provider_unavailable",
  "provider_overloaded",
  "timeout",
  "server",
  "unmapped",
]);

export const isTransientProviderError = (status, data) => {
  const error = getErrorObject(data);
  const type = error?.metadata?.error_type;
  if (type && TRANSIENT_ERROR_TYPES.has(type)) return true;
  return [502, 503, 504].includes(Number(status));
};

export const describeProviderError = (providerId, status, data) => {
  const error = getErrorObject(data);
  const message = unwrapMessage(error?.message || data?.message || "");
  const reason =
    error?.details?.find((detail) => detail?.reason)?.reason ||
    (/valid api key/i.test(message) ? "API_KEY_INVALID" : "");
  const errorType = error?.metadata?.error_type || "";
  const providerName = error?.metadata?.provider_name || "";

  if (providerId === "gemini") {
    if (GEMINI_KEY_HINTS[reason]) {
      return `${message || "Google rejected the request."} ${GEMINI_KEY_HINTS[reason]}`;
    }
    if (status === 429) {
      return `${message || "Google rate-limited this key."} ${
        GEMINI_KEY_HINTS.RESOURCE_EXHAUSTED
      }`;
    }
  }

  if (providerId === "openrouter") {
    const hint = OPENROUTER_HINTS[errorType];
    if (hint) {
      const body = message || "OpenRouter returned an error.";
      return providerName ? `${body} (${providerName}) ${hint}` : `${body} ${hint}`;
    }
    if (status === 429) {
      return `${message || "OpenRouter rate-limited this key."} ${
        OPENROUTER_HINTS.rate_limit_exceeded
      }`;
    }
  }

  if (message) return message;
  if (status === 429) {
    return "Rate limit reached. Wait a moment or pick another model.";
  }
  return `${getProvider(providerId).name} request failed (${status}).`;
};

const NON_CHAT_MODEL =
  /whisper|orpheus|guard|tts|ocr|moderation|embed|rerank|audio|realtime|transcribe|lyria|music|speech|dall-e|gpt-image|imagen|veo|sora|kling|runway|flux|stable-diffusion|content-safety|scaledown\/(?:extract|summarize)/i;

const deriveModelsUrl = (endpoint) => {
  const trimmed = (endpoint || "").trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    url.pathname = url.pathname.replace(
      /\/chat\/completions\/?$/,
      "/models"
    );
    return url.pathname.endsWith("/models") ? url.toString() : "";
  } catch {
    return "";
  }
};

export const getModelsUrl = (providerId, endpoint) => {
  const provider = getProvider(providerId);
  if (provider.modelsUrl) return provider.modelsUrl;
  return deriveModelsUrl(endpoint);
};

// Google's model API does not report pricing. This endpoint parses the
// official pricing page on the server (CORS-safe) and returns the text models
// whose pricing table says "Free of charge".
export async function fetchOfficialFreeModelIds(providerId) {
  const response = await fetch(
    `/api/free-models?provider=${encodeURIComponent(providerId)}`,
    { cache: "no-store" }
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || "Could not load the provider's official free-tier list."
    );
  }
  if (!Array.isArray(data.models) || data.models.length === 0) {
    throw new Error(
      data.warning ||
        "The provider's official free-tier list is empty right now."
    );
  }

  return new Set(data.models);
}

const extractEntries = (data) => {
  const list = Array.isArray(data.data)
    ? data.data
    : Array.isArray(data.models)
      ? data.models
      : [];

  return list
    .map((item) =>
      typeof item === "string"
        ? { id: item }
        : { ...item, id: item.id || item.name }
    )
    .filter((item) => item.id);
};

// Auto-selection order: free models first, then the lowest-latency family, then
// the newest version. This keeps a new key from defaulting to a heavy
// reasoning model such as Gemini 3.8 Flash when a Flash-Lite model is available.
const hasModelToken = (model, words) =>
  words.some((word) =>
    new RegExp(`(^|[-_/])${word}($|[-_/])`).test(model)
  );

const modelSpeedRank = (id) => {
  const model = id.toLowerCase();
  if (hasModelToken(model, ["reasoning", "thinking"])) return 4;
  if (hasModelToken(model, ["lite", "mini", "nano", "small"])) return 0;
  if (hasModelToken(model, ["preview", "experimental", "exp"])) return 3;
  if (hasModelToken(model, ["flash", "turbo", "instant", "fast"])) return 2;
  if (hasModelToken(model, ["pro", "opus", "large", "max"])) return 4;
  return 3;
};

const modelVersion = (id) => {
  const model = id.includes("/") ? id.slice(id.lastIndexOf("/") + 1) : id;
  const match = model.match(/(\d+)(?:\.(\d+))?/);
  return match ? Number(match[1]) * 100 + Number(match[2] || 0) : 0;
};

const compareModels = (a, b) => {
  const freeDelta = Number(b.free === true) - Number(a.free === true);
  if (freeDelta !== 0) return freeDelta;

  const speedDelta = modelSpeedRank(a.id) - modelSpeedRank(b.id);
  if (speedDelta !== 0) return speedDelta;

  const versionDelta = modelVersion(b.id) - modelVersion(a.id);
  if (versionDelta !== 0) return versionDelta;

  return a.id.localeCompare(b.id);
};

const normalizeModels = (providerId, data, freeIds) => {
  const entries = extractEntries(data);
  const models = [];

  for (const item of entries) {
    let id = String(item.id);

    if (providerId === "gemini") {
      if (
        item.supportedGenerationMethods &&
        !item.supportedGenerationMethods.includes("generateContent")
      ) {
        continue;
      }
      id = id.replace(/^models\//, "");
    }

    if (NON_CHAT_MODEL.test(id)) continue;
    if (isUnavailableModel(providerId, id)) continue;

    let free = null;
    if (providerId === "gemini" && freeIds) {
      free = freeIds.has(id);
    } else if (providerId === "openrouter") {
      free =
        id.endsWith(":free") ||
        Number(item.pricing?.prompt) === 0 ||
        Number(item.pricing?.completion) === 0;
    }

    models.push({ id, free });
  }

  // Dedupe while keeping the provider's order, then put free models first.
  const unique = [];
  const seen = new Set();
  for (const model of models) {
    if (seen.has(model.id)) continue;
    seen.add(model.id);
    unique.push(model);
  }

  return unique.sort(compareModels);
};

// OpenRouter publishes per-provider health. Free models have a single
// provider, so when that endpoint is down the model can only fail. Check those
// endpoints at load time and hide the ones that are down; they reappear as soon
// as the provider recovers.
const OPENROUTER_HEALTH_TTL = 10 * 60 * 1000;
const openRouterHealth = new Map();

const isEndpointDown = (endpoint) => {
  if (typeof endpoint.status === "number" && endpoint.status < 0) return true;
  const uptime = endpoint.uptime_last_30m;
  return typeof uptime === "number" && uptime < 50;
};

const isOpenRouterModelOffline = async (modelId) => {
  const cached = openRouterHealth.get(modelId);
  if (cached && Date.now() - cached.at < OPENROUTER_HEALTH_TTL) {
    return cached.offline;
  }

  try {
    // Do not encode the colon: `model:free/endpoints` targets the free variant.
    const response = await fetch(
      `https://openrouter.ai/api/v1/models/${modelId}/endpoints`,
      { cache: "no-store" }
    );
    if (!response.ok) return false;

    const data = await response.json().catch(() => null);
    const endpoints = data?.data?.endpoints || [];
    if (endpoints.length === 0) return false;

    const offline = endpoints.every(isEndpointDown);
    openRouterHealth.set(modelId, { at: Date.now(), offline });
    return offline;
  } catch {
    // Fail open: a status lookup error must never hide usable models.
    return false;
  }
};

export async function fetchProviderModels(providerId, apiKey, endpoint) {
  const provider = getProvider(providerId);
  const trimmedKey = (apiKey || "").trim();
  if (!trimmedKey) throw new Error("Enter an API key first.");

  const modelsUrl = getModelsUrl(providerId, endpoint);
  if (!modelsUrl) {
    throw new Error(
      "This endpoint does not expose a model list. Enter the model manually."
    );
  }

  let url;
  try {
    url = new URL(modelsUrl);
  } catch {
    throw new Error("The endpoint URL is not valid.");
  }

  const headers = {};
  if (provider.modelsAuth === "query") {
    url.searchParams.set("key", trimmedKey);
  } else {
    headers.Authorization = `Bearer ${trimmedKey}`;
  }

  let response;
  try {
    response = await fetch(url.toString(), { headers, cache: "no-store" });
  } catch {
    throw new Error("Could not reach the provider. Check the endpoint URL.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(describeProviderError(providerId, response.status, data));
  }

  let freeIds = null;
  let warning = "";
  let freeFilterApplied = provider.freeFilter === "openrouter-pricing";

  if (provider.freeFilter === "gemini-docs") {
    try {
      freeIds = await fetchOfficialFreeModelIds(providerId);
      freeFilterApplied = true;
    } catch (error) {
      warning = `${error.message} Showing all models this key can access.`;
    }
  }

  const models = normalizeModels(providerId, data, freeIds);
  let visibleModels = models;
  let offlineModels = [];

  if (providerId === "openrouter") {
    const freeModels = models.filter((model) => model.free === true);
    const checks = await Promise.all(
      freeModels.map(async (model) => [
        model.id,
        await isOpenRouterModelOffline(model.id),
      ])
    );
    offlineModels = checks
      .filter(([, offline]) => offline)
      .map(([id]) => id);

    if (offlineModels.length > 0) {
      const hidden = new Set(offlineModels);
      visibleModels = models.filter((model) => !hidden.has(model.id));
      const note =
        `${offlineModels.length} free model` +
        `${offlineModels.length === 1 ? " is" : "s are"} offline at ` +
        "OpenRouter and hidden until it recovers.";
      warning = warning ? `${warning} ${note}` : note;
    }
  }

  return {
    models: visibleModels,
    offlineModels,
    freeFilterApplied,
    warning,
    source: provider.docsUrl || modelsUrl,
    fetchedAt: Date.now(),
  };
}
