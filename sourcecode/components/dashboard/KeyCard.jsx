"use client";
import { useState } from "react";
import { fetchProviderModels, getProvider } from "@/config/providers";
import toast from "react-hot-toast";

const maskKey = (value) => {
  const key = (value || "").trim();
  if (!key) return "No key saved";
  if (key.length <= 10) return `${key.slice(0, 3)}••••`;
  return `${key.slice(0, 6)}••••••${key.slice(-4)}`;
};

const KeyCard = ({ item, active, onUse, onEdit, onDelete }) => {
  const provider = getProvider(item.provider);
  const [testing, setTesting] = useState(false);

  const testKey = async () => {
    setTesting(true);
    try {
      const result = await fetchProviderModels(
        item.provider,
        item.apiKey,
        item.endpoint
      );
      toast.success(
        `${provider.name} key works — ${result.models.length} models available`
      );
    } catch (error) {
      toast.error(error.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 transition ${
        active
          ? "border-primary/60 bg-primary/[0.07]"
          : "border-white/10 bg-[#2a2b30] hover:border-white/20"
      }`}
    >
      <div
        className="absolute inset-x-0 top-0 h-1"
        style={{
          background: `linear-gradient(90deg, ${provider.accent}, transparent)`,
        }}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold"
            style={{
              backgroundColor: `${provider.accent}22`,
              color: provider.accent,
              boxShadow: `inset 0 0 0 1px ${provider.accent}44`,
            }}
          >
            {provider.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-white">{item.label}</p>
            <p className="mt-0.5 truncate text-xs text-white/40">
              {provider.name} · {provider.freeTier}
            </p>
          </div>
        </div>
        {active && (
          <span className="shrink-0 rounded-full bg-primary/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
            Active
          </span>
        )}
      </div>

      <div className="mt-4 space-y-2">
        <p className="font-mono text-xs text-white/50">
          {maskKey(item.apiKey)}
        </p>
        <p className="inline-block max-w-full truncate rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-white/60">
          {item.model}
        </p>
        {provider.id === "custom" && item.endpoint && (
          <p className="truncate text-[11px] text-white/30">{item.endpoint}</p>
        )}
      </div>

      <div className="mt-5 flex items-center gap-2 border-t border-white/5 pt-4">
        <button
          type="button"
          onClick={() => onUse(item)}
          disabled={active}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            active
              ? "cursor-default bg-white/5 text-white/30"
              : "bg-primary text-white hover:opacity-90"
          }`}
        >
          {active ? "In use" : "Use this key"}
        </button>
        <button
          type="button"
          onClick={testKey}
          disabled={testing}
          className="rounded-lg px-3 py-1.5 text-xs text-white/60 hover:bg-white/5 hover:text-white disabled:opacity-50"
        >
          {testing ? "Testing…" : "Test"}
        </button>
        <button
          type="button"
          onClick={() => onEdit(item)}
          className="rounded-lg px-3 py-1.5 text-xs text-white/60 hover:bg-white/5 hover:text-white"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(item)}
          className="ml-auto rounded-lg px-3 py-1.5 text-xs text-red-400/80 hover:bg-red-500/10 hover:text-red-300"
        >
          Delete
        </button>
      </div>
    </div>
  );
};

export default KeyCard;
