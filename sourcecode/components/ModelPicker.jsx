"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  fetchProviderModels,
  getKeyModel,
  getProvider,
  isUnavailableModel,
} from "@/config/providers";
import { useAppContext } from "@/context/AppContext";

// Reuse a fetched list for a few minutes so reopening the picker is instant.
const CACHE_TTL = 5 * 60 * 1000;

const Chevron = ({ open }) => (
  <svg
    className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
    viewBox="0 0 12 12"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M2.5 4.5 6 8l3.5-3.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Check = () => (
  <svg
    className="h-3.5 w-3.5 shrink-0 text-primary"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="m3 8.5 3.2 3.2L13 4.8"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ModelPicker = () => {
  const { activeKey, updateKey } = useAppContext();
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState([]);
  const [modelInfo, setModelInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [freeOnly, setFreeOnly] = useState(true);
  const [loaded, setLoaded] = useState({ keyId: null, at: 0 });
  const rootRef = useRef(null);
  const searchRef = useRef(null);

  const provider = activeKey ? getProvider(activeKey.provider) : null;
  const current = getKeyModel(activeKey);

  const loadModels = async ({ force = false } = {}) => {
    if (!activeKey) return;
    if (
      !force &&
      loaded.keyId === activeKey.id &&
      Date.now() - loaded.at < CACHE_TTL
    ) {
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await fetchProviderModels(
        activeKey.provider,
        activeKey.apiKey,
        activeKey.endpoint
      );
      setModels(result.models);
      setModelInfo(result);
      setLoaded({ keyId: activeKey.id, at: Date.now() });
      setFreeOnly(result.freeFilterApplied);
      if (result.models.length === 0) {
        setError("No chat models were returned for this key.");
      } else {
        const savedModel = getKeyModel(activeKey);
        const savedIsListed = result.models.some(
          (model) => model.id === savedModel
        );
        if (!savedModel || !savedIsListed) {
          // Never chosen, retired, or hidden because its provider is offline:
          // start with the fastest available model so the chat works now.
          updateKey(activeKey.id, { model: result.models[0].id });
        }
      }
    } catch (loadError) {
      setModels([]);
      setModelInfo(null);
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  // Load the live list the first time the picker opens for this key.
  useEffect(() => {
    if (!open || !activeKey) return;
    loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeKey?.id]);

  // Reset the cached list when the active key changes.
  useEffect(() => {
    setModels([]);
    setModelInfo(null);
    setError("");
    setLoaded({ keyId: null, at: 0 });
  }, [activeKey?.id]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const visibleModels = useMemo(() => {
    const term = query.trim().toLowerCase();
    return models.filter((model) => {
      if (freeOnly && model.free === false) return false;
      return !term || model.id.toLowerCase().includes(term);
    });
  }, [models, query, freeOnly]);

  if (!activeKey) {
    return (
      <Link
        href="/dashboard"
        className="flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs text-amber-300/70 transition hover:bg-white/5 hover:text-amber-200"
      >
        <span className="truncate">No API key — add one in the dashboard</span>
      </Link>
    );
  }

  const choose = (modelId) => {
    updateKey(activeKey.id, { model: modelId });
    setOpen(false);
  };

  const summary = loading
    ? "Loading models…"
    : error
      ? error
      : modelInfo?.freeFilterApplied
        ? `${visibleModels.length}${freeOnly ? ` of ${models.length}` : ""} models · ${provider.name}`
        : `${visibleModels.length} models · ${provider.name}`;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={current || "Choose a model"}
        className="flex max-w-full min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs text-white/40 transition hover:bg-white/5 hover:text-white/80"
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: provider.accent }}
        />
        <span className={`truncate ${current ? "font-mono text-[11px]" : ""}`}>
          {current || "Select a model"}
        </span>
        <Chevron open={open} />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Choose a model"
          className="absolute bottom-full left-0 z-50 mb-2 w-[min(24rem,calc(100vw-2.5rem))] overflow-hidden rounded-xl border border-white/10 bg-[#212327] shadow-2xl"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/5 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2 text-xs text-white/70">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: provider.accent }}
              />
              <span className="truncate">Models · {provider.name}</span>
            </div>
            <button
              type="button"
              onClick={() => loadModels({ force: true })}
              disabled={loading}
              className="shrink-0 text-[11px] text-primary hover:underline disabled:opacity-50"
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          <div className="space-y-2 px-3 pt-2.5">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              placeholder="Search models"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-white/10 bg-[#404045] px-2.5 py-1.5 text-xs text-white outline-none placeholder:text-white/30 focus:border-primary/60"
            />
            {modelInfo?.freeFilterApplied ? (
              <label className="flex cursor-pointer items-center gap-2 pb-1 text-[11px] text-white/45">
                <input
                  type="checkbox"
                  checked={freeOnly}
                  onChange={(event) => setFreeOnly(event.target.checked)}
                  className="accent-primary"
                />
                Free models only
              </label>
            ) : null}
          </div>

          <div className="max-h-64 overflow-y-auto px-1.5 pb-1.5">
            {loading && models.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-white/40">
                Fetching the live model list…
              </p>
            ) : visibleModels.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-white/40">
                {models.length === 0
                  ? "No models loaded yet."
                  : "No models match this search."}
              </p>
            ) : (
              visibleModels.map((model) => {
                const selected = model.id === current;
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => choose(model.id)}
                    title={model.id}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                      selected
                        ? "bg-primary/15 text-white"
                        : "text-white/65 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="truncate font-mono text-[11px]">
                      {model.id}
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-1.5">
                      {model.free === true ? (
                        <span className="rounded bg-emerald-400/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-400/80">
                          Free
                        </span>
                      ) : null}
                      {selected ? <Check /> : null}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-white/5 px-3 py-2 text-[11px]">
            <p className={error ? "text-red-400" : "text-white/35"}>
              {summary}
            </p>
            {modelInfo?.warning ? (
              <p className="mt-1 text-amber-300/70">{modelInfo.warning}</p>
            ) : null}
            {isUnavailableModel(provider.id, current) ? (
              <p className="mt-1 text-amber-300/70">
                This model is no longer available. Pick a replacement.
              </p>
            ) : null}
            <Link
              href="/dashboard"
              className="mt-1.5 inline-block text-white/40 hover:text-white/70 hover:underline"
            >
              Manage API keys →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ModelPicker;
