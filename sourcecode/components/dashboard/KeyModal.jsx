"use client";
import { useEffect, useState } from "react";
import {
  PROVIDERS,
  fetchProviderModels,
  getProvider,
  isLikelyKey,
  isUnavailableModel,
} from "@/config/providers";
import toast from "react-hot-toast";

const blankForm = (providerId = "groq") => {
  const provider = getProvider(providerId);
  return {
    provider: provider.id,
    label: "",
    apiKey: "",
    model: "",
    endpoint: "",
  };
};

const KeyModal = ({ open, initial, onClose, onSave }) => {
  const [form, setForm] = useState(blankForm());
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState([]);
  const [modelInfo, setModelInfo] = useState(null);
  const [freeOnly, setFreeOnly] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState("");

  const provider = getProvider(form.provider);
  const isCustom = form.provider === "custom";
  const visibleModels = freeOnly
    ? models.filter((model) => model.free !== false)
    : models;
  const freeCount = models.filter((model) => model.free === true).length;
  const selectedModel = models.find((model) => model.id === form.model);
  const modelSummary = modelInfo?.freeFilterApplied
    ? `${freeCount} free models · ${models.length} total, fetched live from ${provider.name}`
    : provider.id === "custom"
      ? `${models.length} models available from this endpoint, fetched live`
      : `${models.length} models available on the free tier, fetched live from ${provider.name}`;

  // Always fetch live. Google's free-tier list is resolved on the server via
  // /api/free-models; every other provider is read from its official /models
  // endpoint with the key the user entered.
  async function loadModels(options = {}) {
    const providerId = options.providerId || form.provider;
    const apiKey = (options.apiKey ?? form.apiKey).trim();
    const endpoint = options.endpoint ?? form.endpoint;
    const silent = options.silent ?? false;

    if (!apiKey) {
      if (!silent) setError("Enter an API key first.");
      return;
    }
    if (providerId === "custom" && !endpoint.trim()) {
      if (!silent) setError("Enter the endpoint URL first.");
      return;
    }

    setLoadingModels(true);
    setError("");
    try {
      const result = await fetchProviderModels(providerId, apiKey, endpoint);
      setModels(result.models);
      setModelInfo(result);

      if (result.models.length === 0) {
        setError("No chat models were returned for this key.");
        return;
      }

      const available = freeOnly
        ? result.models.filter((model) => model.free !== false)
        : result.models;

      setForm((prev) => {
        if (result.models.some((model) => model.id === prev.model)) {
          return prev;
        }
        return { ...prev, model: available[0]?.id || "" };
      });

      if (!silent) {
        toast.success(
          `Loaded ${result.models.length} models from ${getProvider(providerId).name}`
        );
      }
    } catch (loadError) {
      setModels([]);
      setModelInfo(null);
      setError(loadError.message);
    } finally {
      setLoadingModels(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        provider: initial.provider,
        label: initial.label || "",
        apiKey: initial.apiKey || "",
        model: initial.model || "",
        endpoint: initial.endpoint || "",
      });
    } else {
      setForm(blankForm());
    }
    setModels([]);
    setModelInfo(null);
    setFreeOnly(true);
    setError("");
    setShowKey(false);
  }, [open, initial]);

  // Fetch once the key looks complete. Debounced so typing never spams the
  // provider. Manual "Refresh models" still works for any key format.
  useEffect(() => {
    if (!open) return;
    if (!isLikelyKey(form.provider, form.apiKey)) return;
    if (form.provider === "custom" && !form.endpoint.trim()) return;

    const timer = setTimeout(() => {
      loadModels({
        providerId: form.provider,
        apiKey: form.apiKey,
        endpoint: form.endpoint,
        silent: true,
      });
    }, 900);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form.apiKey, form.provider, form.endpoint]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const setField = (name, value) =>
    setForm((prev) => ({ ...prev, [name]: value }));

  const changeProvider = (id) => {
    const nextProvider = getProvider(id);

    // Keys are provider-specific, so never carry one across to another
    // provider. This also stops a half-typed key from being sent elsewhere.
    setForm({
      provider: nextProvider.id,
      label: "",
      apiKey: "",
      model: "",
      endpoint: "",
    });
    setModels([]);
    setModelInfo(null);
    setError("");
  };

  const changeFreeOnly = (checked) => {
    setFreeOnly(checked);
    const available = checked
      ? models.filter((model) => model.free !== false)
      : models;
    setForm((prev) =>
      available.some((model) => model.id === prev.model)
        ? prev
        : { ...prev, model: available[0]?.id || "" }
    );
  };

  const save = () => {
    if (!form.apiKey.trim()) {
      setError("API key is required.");
      return;
    }
    if (!form.model.trim()) {
      setError("Refresh models and choose one, or type a model ID.");
      return;
    }
    if (isUnavailableModel(form.provider, form.model)) {
      setError(
        "That model is no longer available at this provider. Pick another one."
      );
      return;
    }
    if (isCustom) {
      if (!form.endpoint.trim()) {
        setError("Endpoint URL is required for a custom provider.");
        return;
      }
      try {
        new URL(form.endpoint.trim());
      } catch {
        setError("Enter a valid endpoint URL.");
        return;
      }
    }

    onSave({
      provider: form.provider,
      label: form.label.trim() || provider.name,
      apiKey: form.apiKey.trim(),
      model: form.model.trim(),
      endpoint: isCustom ? form.endpoint.trim() : "",
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#212327] p-6 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">
              {initial ? "Edit API key" : "Add API key"}
            </h2>
            <p className="mt-1 text-xs text-white/45">
              Stored only in this browser. Requests go directly to the provider.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xl leading-none text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <div>
            <label
              htmlFor="key-provider"
              className="mb-1.5 block text-sm text-white/75"
            >
              Provider
            </label>
            <select
              id="key-provider"
              value={form.provider}
              onChange={(event) => changeProvider(event.target.value)}
              className="w-full rounded-xl bg-[#404045] px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-primary"
            >
              {PROVIDERS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} — {option.freeTier}
                </option>
              ))}
            </select>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs">
              <span className="text-white/40">{provider.description}</span>
              {provider.keyUrl && (
                <a
                  href={provider.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-primary hover:underline"
                >
                  Get a free key →
                </a>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="key-label"
              className="mb-1.5 block text-sm text-white/75"
            >
              Label
            </label>
            <input
              id="key-label"
              type="text"
              value={form.label}
              onChange={(event) => setField("label", event.target.value)}
              placeholder={provider.name}
              autoComplete="off"
              className="w-full rounded-xl bg-[#404045] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label
              htmlFor="key-value"
              className="mb-1.5 block text-sm text-white/75"
            >
              API key
            </label>
            <div className="flex items-center gap-2">
              <input
                id="key-value"
                type={showKey ? "text" : "password"}
                value={form.apiKey}
                onChange={(event) => setField("apiKey", event.target.value)}
                placeholder={provider.keyHint}
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-xl bg-[#404045] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowKey((current) => !current)}
                className="shrink-0 rounded-xl px-3 py-2 text-xs text-white/70 hover:bg-white/10"
              >
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {isCustom && (
            <div>
              <label
                htmlFor="key-endpoint"
                className="mb-1.5 block text-sm text-white/75"
              >
                Chat completions endpoint
              </label>
              <input
                id="key-endpoint"
                type="url"
                value={form.endpoint}
                onChange={(event) => setField("endpoint", event.target.value)}
                placeholder="https://api.example.com/v1/chat/completions"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-xl bg-[#404045] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="key-model" className="text-sm text-white/75">
                Model
              </label>
              <button
                type="button"
                onClick={() => loadModels()}
                disabled={loadingModels}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                {loadingModels ? "Loading…" : "Refresh models"}
              </button>
            </div>
            <input
              id="key-model"
              type="text"
              value={form.model}
              onChange={(event) => setField("model", event.target.value)}
              list="key-model-options"
              placeholder="Models load from the provider"
              autoComplete="off"
              spellCheck={false}
              className="mt-1.5 w-full rounded-xl bg-[#404045] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <datalist id="key-model-options">
              {visibleModels.map((model) => (
                <option key={model.id} value={model.id} />
              ))}
            </datalist>

            {modelInfo?.freeFilterApplied && models.length > 0 && (
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs text-white/50">
                <input
                  type="checkbox"
                  checked={freeOnly}
                  onChange={(event) => changeFreeOnly(event.target.checked)}
                  className="accent-primary"
                />
                Free models only ({freeCount})
              </label>
            )}

            {error ? (
              <p className="mt-2 text-xs text-red-400">{error}</p>
            ) : models.length > 0 ? (
              <p className="mt-2 text-xs text-white/40">{modelSummary}</p>
            ) : (
              <p className="mt-2 text-xs text-white/40">
                Enter your key and models load automatically from{" "}
                {provider.name}&apos;s official model list.
              </p>
            )}

            {modelInfo?.warning ? (
              <p className="mt-1 text-xs text-amber-300/70">
                {modelInfo.warning}
              </p>
            ) : null}

            {selectedModel?.free === true && modelInfo?.freeFilterApplied ? (
              <p className="mt-1 text-[11px] text-emerald-400/70">
                This model is listed as free by the provider.
              </p>
            ) : null}
            {selectedModel?.free === false ? (
              <p className="mt-1 text-[11px] text-amber-300/70">
                This model is not listed as free. It may require billing.
              </p>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              {initial ? "Save changes" : "Add key"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default KeyModal;
