// Official free-tier Gemini text models.
// Source: https://ai.google.dev/gemini-api/docs/pricing (updated 2026-10-28)
// Only models whose Standard tier shows "Free of charge" for input/output are
// listed. Live, TTS, transcription and image models are excluded because the
// chat UI only sends text.
export const GEMINI_FREE_MODELS = [
  {
    id: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    note: "Newest Flash, best free all-rounder",
  },
  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    note: "Previous Flash, fast and multimodal",
  },
  {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite",
    note: "High-volume, low-latency tasks",
  },
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash-Lite",
    note: "Lightweight everyday prompts",
  },
  {
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash Preview",
    note: "Preview build of Gemini 3 Flash",
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    note: "Older Pro reasoning model",
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    note: "Previous-generation Flash",
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    note: "Previous-generation Lite",
  },
];

export const GEMINI_FREE_MODEL_IDS = GEMINI_FREE_MODELS.map(
  (model) => model.id
);

// Free-tier friendly providers with OpenAI-compatible chat endpoints.
export const PROVIDERS = [
  {
    id: "groq",
    name: "Groq",
    description: "Very fast Llama, GPT-OSS and Qwen models with a free tier.",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    modelsUrl: "https://api.groq.com/openai/v1/models",
    defaultModel: "openai/gpt-oss-120b",
    keyUrl: "https://console.groq.com/keys",
    keyHint: "gsk_...",
    freeTier: "Free tier",
    accent: "#F55036",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description:
      "Google AI Studio free tier. These models are free of charge per Google's pricing page.",
    endpoint:
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    modelsUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    modelsAuth: "query",
    defaultModel: "gemini-3.8-flash",
    models: GEMINI_FREE_MODEL_IDS,
    freeModels: GEMINI_FREE_MODELS,
    docsUrl: "https://ai.google.dev/gemini-api/docs/pricing",
    keyUrl: "https://aistudio.google.com/app/apikey",
    keyHint: "AIza...",
    freeTier: "Free tier",
    accent: "#4285F4",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "One key for many models, including free :free variants.",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    modelsUrl: "https://openrouter.ai/api/v1/models",
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
    keyUrl: "https://openrouter.ai/keys",
    keyHint: "sk-or-v1-...",
    freeTier: "Free models",
    accent: "#8B5CF6",
  },
  {
    id: "cerebras",
    name: "Cerebras",
    description: "Extremely fast inference with a free developer tier.",
    endpoint: "https://api.cerebras.ai/v1/chat/completions",
    modelsUrl: "https://api.cerebras.ai/v1/models",
    defaultModel: "llama-3.3-70b",
    keyUrl: "https://cloud.cerebras.ai",
    keyHint: "csk-...",
    freeTier: "Free tier",
    accent: "#FF6B35",
  },
  {
    id: "mistral",
    name: "Mistral",
    description: "Mistral's free experiment tier for small and large models.",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    modelsUrl: "https://api.mistral.ai/v1/models",
    defaultModel: "mistral-small-latest",
    keyUrl: "https://console.mistral.ai/api-keys",
    keyHint: "Your Mistral API key",
    freeTier: "Free tier",
    accent: "#FF7000",
  },
  {
    id: "custom",
    name: "Custom endpoint",
    description: "Any OpenAI-compatible chat completions endpoint.",
    endpoint: "",
    modelsUrl: "",
    defaultModel: "",
    keyUrl: "",
    keyHint: "sk-...",
    freeTier: "Custom",
    accent: "#64748B",
  },
];

const CUSTOM_PROVIDER = PROVIDERS[PROVIDERS.length - 1];

export const getProvider = (id) =>
  PROVIDERS.find((provider) => provider.id === id) || CUSTOM_PROVIDER;

export const getKeyEndpoint = (key) => {
  if (!key) return "";
  const provider = getProvider(key.provider);
  return (key.endpoint || provider.endpoint || "").trim();
};

export const getKeyModel = (key) => {
  if (!key) return "";
  const provider = getProvider(key.provider);
  return (key.model || provider.defaultModel || "").trim();
};

// Models documented by the provider as free-tier eligible. They are offered
// before calling the provider's /models endpoint, so a new key can be used
// immediately.
export const getPresetModels = (providerId) => {
  const provider = getProvider(providerId);
  return Array.isArray(provider.models) ? provider.models : [];
};

export const getFreeModels = (providerId) => {
  const provider = getProvider(providerId);
  return Array.isArray(provider.freeModels) ? provider.freeModels : [];
};

const NON_CHAT_MODEL = /whisper|orpheus|guard|tts|ocr|moderation|embed/i;

const deriveModelsUrl = (endpoint) => {
  const trimmed = (endpoint || "").trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    url.pathname = url.pathname.replace(/\/chat\/completions\/?$/, "/models");
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

const normalizeModels = (providerId, data) => {
  const list = Array.isArray(data.data)
    ? data.data
    : Array.isArray(data.models)
      ? data.models
      : [];

  const entries = list
    .map((item) =>
      typeof item === "string" ? { id: item } : { ...item, id: item.id || item.name }
    )
    .filter((item) => item.id);

  let ids = entries.map((item) => String(item.id));

  if (providerId === "gemini") {
    ids = entries
      .filter(
        (item) =>
          !item.supportedGenerationMethods ||
          item.supportedGenerationMethods.includes("generateContent")
      )
      .map((item) => String(item.id).replace(/^models\//, ""));
  }

  if (providerId === "openrouter") {
    const free = entries.filter(
      (item) =>
        String(item.id).endsWith(":free") ||
        Number(item.pricing?.prompt) === 0
    );
    if (free.length > 0) ids = free.map((item) => String(item.id));
  }

  if (providerId === "groq") {
    ids = ids.filter((id) => !NON_CHAT_MODEL.test(id));
  }

  return [...new Set(ids)].sort();
};

export const pickDefaultModel = (providerId, ids) => {
  const provider = getProvider(providerId);
  if (ids.includes(provider.defaultModel)) return provider.defaultModel;
  return ids[0] || provider.defaultModel;
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
    response = await fetch(url.toString(), { headers });
  } catch {
    throw new Error("Could not reach the provider. Check the endpoint URL.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      data.error?.message ||
        data.message ||
        `${provider.name} could not list models (${response.status}).`
    );
  }

  return normalizeModels(providerId, data);
}
