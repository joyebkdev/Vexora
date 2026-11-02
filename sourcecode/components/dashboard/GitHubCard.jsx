"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { githubTokenUrl } from "@/config/github";
import { useGitHub } from "@/context/GitHubContext";

const inputClass =
  "w-full rounded-xl bg-[#404045] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:ring-2 focus:ring-primary";
const labelClass = "mb-1.5 block text-sm text-white/75";
const primaryButton =
  "rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary/20 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";
const secondaryButton =
  "rounded-xl border border-white/10 px-3 py-2 text-xs text-white/70 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40";
const dangerButton =
  "rounded-xl border border-red-400/20 px-3 py-2 text-xs text-red-300/80 transition hover:bg-red-400/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40";

export default function GitHubCard() {
  const {
    ready,
    github,
    connected,
    connect,
    disconnect,
    refreshAccount,
  } = useGitHub();

  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const handleConnect = async (event) => {
    event.preventDefault();
    setError("");
    setBusy("connect");
    try {
      const user = await connect(token);
      setToken("");
      setShowToken(false);
      toast.success(`Connected as @${user.login}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const handleDisconnect = () => {
    const confirmed = window.confirm(
      "Disconnect GitHub and remove the token from this browser?"
    );
    if (!confirmed) return;
    disconnect();
    setError("");
    toast.success("GitHub disconnected");
  };

  const handleRefreshAccount = async () => {
    setError("");
    setBusy("account");
    try {
      await refreshAccount();
      toast.success("GitHub connection is valid");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">GitHub</h2>
          <p className="mt-1 max-w-2xl text-sm text-white/40">
            Connect once here, then choose the project repository from the chat
            box next to the model picker.
          </p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/40">
          GitHub
        </span>
      </div>

      <div className="mt-4 rounded-3xl border border-white/10 bg-[#2a2b30] p-5 sm:p-6">
        {!ready ? (
          <p className="text-sm text-white/40">Loading GitHub settings…</p>
        ) : !connected ? (
          <form className="space-y-4" onSubmit={handleConnect}>
            <div>
              <p className="text-base font-medium">Connect GitHub</p>
              <p className="mt-1 text-sm text-white/45">
                The token stays in this browser and is sent only to{" "}
                <span className="text-white/70">api.github.com</span>. Vexora
                never forwards it to a server.
              </p>
            </div>

            <div>
              <label htmlFor="github-token" className={labelClass}>
                Personal access token
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="github-token"
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="github_pat_... or ghp_..."
                  autoComplete="off"
                  spellCheck={false}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => setShowToken((value) => !value)}
                  className={secondaryButton}
                >
                  {showToken ? "Hide" : "Show"}
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-white/35">
                Use a fine-grained token with{" "}
                <span className="text-white/60">Contents: read and write</span>{" "}
                for the repository, plus{" "}
                <span className="text-white/60">Administration</span> if you
                want Vexora to create repositories. A classic token with the{" "}
                <code className="text-white/60">repo</code> scope also works.{" "}
                <a
                  href={githubTokenUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  Create a token →
                </a>
              </p>
            </div>

            <button
              type="submit"
              disabled={Boolean(busy) || !token.trim()}
              className={primaryButton}
            >
              {busy === "connect" ? "Checking token…" : "Connect GitHub"}
            </button>
          </form>
        ) : (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold uppercase text-primary">
                  {github.user.login.slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-medium">@{github.user.login}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/40">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Connected · token stored in this browser
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRefreshAccount}
                  disabled={Boolean(busy)}
                  className={secondaryButton}
                >
                  Re-check
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={Boolean(busy)}
                  className={dangerButton}
                >
                  Disconnect
                </button>
              </div>
            </div>

            <p className="mt-4 border-t border-white/10 pt-4 text-xs leading-5 text-white/40">
              {github.repo ? (
                <>
                  The chat is saving to{" "}
                  <span className="text-white/70">
                    {github.repo.owner}/{github.repo.name}
                  </span>{" "}
                  on{" "}
                  <code className="text-white/70">{github.repo.branch}</code>.
                  Change the repository or branch from the chat box.
                </>
              ) : (
                "Choose a repository from the chat box, next to the model picker, to enable project saves."
              )}
            </p>
          </div>
        )}

        {error ? <p className="mt-3 text-xs text-red-400">{error}</p> : null}
      </div>
    </section>
  );
}
