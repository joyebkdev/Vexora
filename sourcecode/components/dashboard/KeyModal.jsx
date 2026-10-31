"use client";
import { useEffect, useState } from "react";
import {
  PROVIDERS,
  fetchProviderModels,
  getFreeModels,
  getPresetModels,
  getProvider,
  pickDefaultModel,
} from "@/config/providers";
import toast from "react-hot-toast";

const blankForm = (providerId = "groq") => {
  const provider = getProvider(providerId);
  return {
    provider: provider.id,
    label: "",
    apiKey: "",
    model: provider.defaultModel,
    endpoint: "",
  };
};

const KeyModal = ({ open, initial, onClose, onSave }) => {
  const [form, setForm] = useState(blankForm());
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState("");

  const provider = getProvider(form.provider);
  const isCustom = form.provider === "custom";
  const presetModels = getPresetModels(form.provider);
  const freeModels = getFreeModels(form.provider);
  const modelOptions = [...new Set([...models, ...presetModels])];

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
    setError("");
    setShowKey(false);
  }, [open, initial]);

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
    setForm((prev) => ({
      provider: nextProvider.id,
      label: "",
      apiKey: prev.apiKey,
      model: nextProvider.defaultModel,
      endpoint: "",
    }));
    setModels([]);
    setError("");
  };

  const loadModels = async () => {
    if (!form.apiKey.trim()) {
      setError("Enter an API key first.");
      return;
    }
    if (isCustom && !form.endpoint.trim()) {
      setError("Enter the endpoint URL first.");
      return;
    }

    setLoadingModels(true);
    setError("");
    try {
      const ids = await fetchProviderModels(
        form.provider,
        form.apiKey,
        form.endpoint
      );
      setModels(ids);
      if (ids.length === 0) {
        setError("No chat models were returned for this key.");
      } else {
        setForm((prev) => ({
          ...prev,
          model: ids.includes(prev.model)
            ? prev.model
            : pickDefaultModel(form.provider, ids),
        }));
        toast.success(`Loaded ${ids.length} models`);
      }
    } catch (loadError) {
      setModels([]);
      setError(loadError.message);
    } finally {
      setLoadingModels(false);
    }
  };

  const save = () => {
    if (!form.apiKey.trim()) {
      setError("API key is required.");
      return;
    }
    if (!form.model.trim()) {
      setError("Model is required.");
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
              <label
                htmlFor="key-model"
                className="text-sm text-white/75"
              >
                Model
              </label>
              <button
                type="button"
                onClick={loadModels}
                disabled={loadingModels}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                {loadingModels ? "Loading…" : "Load models"}
              </button>
            </div>
            <input
              id="key-model"
              type="text"
              value={form.model}
              onChange={(event) => setField("model", event.target.value)}
              list="key-model-options"
              placeholder={provider.defaultModel || "model-id"}
              autoComplete="off"
              spellCheck={false}
              className="mt-1.5 w-full rounded-xl bg-[#404045] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <datalist id="key-model-options">
              {modelOptions.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>

            {freeModels.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-white/55">
                  Official free-tier models
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {freeModels.map((model) => {
                    const selected = form.model === model.id;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        title={model.note}
                        onClick={() => setField("model", model.id)}
                        className={`rounded-lg border px-2 py-1 text-[11px] transition ${
                          selected
                            ? "border-primary bg-primary/20 text-white"
                            : "border-white/10 bg-white/5 text-white/55 hover:border-white/25 hover:text-white"
                        }`}
                      >
                        {model.label}
                      </button>
                    );
                  })}
                </div>
                {provider.docsUrl && (
                  <a
                    href={provider.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-[11px] text-primary hover:underline"
                  >
                    Official free-tier pricing →
                  </a>
                )}
              </div>
            )}

            {error ? (
              <p className="mt-2 text-xs text-red-400">{error}</p>
            ) : (
              <p className="mt-2 text-xs text-white/40">
                {models.length > 0
                  ? `${models.length} models returned by this key.`
                  : freeModels.length > 0
                    ? "Pick one of the free models listed, or load models to see everything this key can access."
                    : provider.id === "openrouter"
                      ? "Load models to pick a free model."
                      : "Use Load models to see what this key can access."}
              </p>
            )}
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
