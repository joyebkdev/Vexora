"use client";
import KeyCard from "@/components/dashboard/KeyCard";
import KeyModal from "@/components/dashboard/KeyModal";
import { PROVIDERS, getProvider } from "@/config/providers";
import { useAppContext } from "@/context/AppContext";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";

const Stat = ({ label, value, hint }) => (
  <div className="rounded-2xl border border-white/10 bg-[#2a2b30] p-5">
    <p className="text-xs uppercase tracking-[0.15em] text-white/35">{label}</p>
    <p className="mt-2 truncate text-xl font-semibold text-white">{value}</p>
    <p className="mt-1 truncate text-xs text-white/35">{hint}</p>
  </div>
);

export default function DashboardPage() {
  const {
    keys,
    activeKey,
    addKey,
    updateKey,
    deleteKey,
    setActiveKey,
  } = useAppContext();
  const [modal, setModal] = useState({ open: false, key: null });

  const activeProvider = activeKey
    ? getProvider(activeKey.provider)
    : null;
  const freeProviders = PROVIDERS.filter(
    (provider) => provider.id !== "custom"
  );

  const openAdd = () => setModal({ open: true, key: null });
  const openEdit = (key) => setModal({ open: true, key });
  const closeModal = () => setModal({ open: false, key: null });

  const handleSave = (data) => {
    if (modal.key) {
      updateKey(modal.key.id, data);
      toast.success("API key updated");
    } else {
      const created = addKey(data);
      if (created) setActiveKey(created.id);
      toast.success(`${getProvider(data.provider).name} key added`);
    }
    closeModal();
  };

  const handleUse = (key) => {
    setActiveKey(key.id);
    toast.success(`Now using ${key.label}`);
  };

  const handleDelete = (key) => {
    const confirmed = window.confirm(
      `Delete "${key.label}"? This cannot be undone.`
    );
    if (!confirmed) return;
    deleteKey(key.id);
    toast.success("API key deleted");
  };

  return (
    <div className="min-h-screen bg-[#292a2d] text-white">
      <header className="border-b border-white/5 bg-[#212327]">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/vexora-icon.png"
              width={36}
              height={36}
              alt="Vexora"
              className="h-9 w-9"
            />
            <span className="text-lg font-semibold tracking-tight">Vexora</span>
          </Link>
          <Link
            href="/"
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
          >
            ← Back to chat
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Workspace
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              API keys
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/45">
              Bring free-tier keys from multiple providers. Pick one active key
              and Vexora will use its provider and model for every chat.
            </p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary/20 transition hover:opacity-90"
          >
            + Add API key
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat
            label="Saved keys"
            value={keys.length}
            hint={keys.length ? "Stored in this browser" : "Add your first key"}
          />
          <Stat
            label="Active provider"
            value={activeProvider?.name || "None"}
            hint={activeKey?.model || "No key selected yet"}
          />
          <Stat
            label="Free providers"
            value={freeProviders.length}
            hint="Groq, Gemini, OpenRouter, Cerebras, Mistral"
          />
        </div>

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">
              Your keys
              {keys.length > 0 && (
                <span className="ml-2 text-sm text-white/30">
                  {keys.length}
                </span>
              )}
            </h2>
            {keys.length > 0 && (
              <button
                type="button"
                onClick={openAdd}
                className="text-xs text-primary hover:underline"
              >
                + Add another
              </button>
            )}
          </div>

          {keys.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-white/50">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="7.5" cy="15.5" r="4.5" />
                  <path d="m11 12 9-9m-3 3 3 3m-6 0 3 3" />
                </svg>
              </div>
              <p className="mt-4 font-medium">No API keys yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-white/40">
                Add a free key from Groq, Google Gemini, OpenRouter, Cerebras,
                or Mistral to start chatting.
              </p>
              <button
                type="button"
                onClick={openAdd}
                className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium hover:opacity-90"
              >
                Add your first key
              </button>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {keys.map((key) => (
                <KeyCard
                  key={key.id}
                  item={key}
                  active={activeKey?.id === key.id}
                  onUse={handleUse}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-medium">Free-tier providers</h2>
          <p className="mt-1 text-sm text-white/40">
            Create a key with the provider, then add it above.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {freeProviders.map((provider) => (
              <div
                key={provider.id}
                className="rounded-2xl border border-white/10 bg-[#2a2b30] p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{provider.name}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{
                      backgroundColor: `${provider.accent}1f`,
                      color: provider.accent,
                    }}
                  >
                    {provider.freeTier}
                  </span>
                </div>
                <p className="mt-2 min-h-[2.5rem] text-xs leading-5 text-white/40">
                  {provider.description}
                </p>
                {provider.freeModels?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] uppercase tracking-wide text-white/30">
                      Free models
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {provider.freeModels.slice(0, 4).map((model) => (
                        <span
                          key={model.id}
                          className="rounded-md bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/50"
                        >
                          {model.id}
                        </span>
                      ))}
                      {provider.freeModels.length > 4 && (
                        <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40">
                          +{provider.freeModels.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {provider.keyUrl ? (
                    <a
                      href={provider.keyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-xs text-primary hover:underline"
                    >
                      Get a free key →
                    </a>
                  ) : null}
                  {provider.docsUrl ? (
                    <a
                      href={provider.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-xs text-white/40 hover:text-white/70 hover:underline"
                    >
                      Official pricing →
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <p className="mt-10 text-center text-[11px] leading-5 text-white/25">
          Keys are stored in this browser&apos;s localStorage. They are only sent
          to the provider you selected, never to a Vexora server.
        </p>
      </main>

      <KeyModal
        open={modal.open}
        initial={modal.key}
        onClose={closeModal}
        onSave={handleSave}
      />
    </div>
  );
}
