"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { listRepositories } from "@/config/github";
import { useGitHub } from "@/context/GitHubContext";

// Repositories change less often than models, but the list is still refreshed
// when the user asks for it.
const CACHE_TTL = 2 * 60 * 1000;

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

const RepoIcon = () => (
  <svg
    className="h-3 w-3 shrink-0"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M3 2.5h7.5A1.5 1.5 0 0 1 12 4v9.5H4.5A1.5 1.5 0 0 1 3 12V2.5Z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
    <path
      d="M3 11.5h9M5.5 4.5h4"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  </svg>
);

const GitHubRepoPicker = () => {
  const {
    ready,
    github,
    connected,
    selectRepository,
    setBranch,
    createRepository,
    refreshWriteAccess,
    saveProjectFiles,
  } = useGitHub();

  const [open, setOpen] = useState(false);
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("list");
  const [newName, setNewName] = useState("");
  const [newPrivate, setNewPrivate] = useState(true);
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const loadedAtRef = useRef(0);

  const loadRepos = useCallback(
    async ({ force = false } = {}) => {
      if (!github.token) return;
      if (
        !force &&
        loadedAtRef.current &&
        Date.now() - loadedAtRef.current < CACHE_TTL
      ) {
        return;
      }

      setLoading(true);
      setError("");
      try {
        setRepos(await listRepositories(github.token));
        loadedAtRef.current = Date.now();
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    },
    [github.token]
  );

  // A different token means a different account and repository list.
  useEffect(() => {
    setRepos([]);
    setError("");
    setQuery("");
    setMode("list");
    loadedAtRef.current = 0;
  }, [github.token]);

  useEffect(() => {
    if (!open) return;

    setError("");
    loadRepos();
    if (mode === "list") searchRef.current?.focus();

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery("");
        setMode("list");
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
        setMode("list");
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, mode, loadRepos]);

  const visibleRepos = useMemo(() => {
    const term = query.trim().toLowerCase();
    return repos.filter(
      (repo) => !term || repo.fullName.toLowerCase().includes(term)
    );
  }, [repos, query]);

  const repo = github.repo;

  const toggle = () => {
    if (open) {
      setOpen(false);
      setQuery("");
      setMode("list");
    } else {
      setOpen(true);
    }
  };

  const choose = (item) => {
    selectRepository(item);
    setOpen(false);
    setQuery("");
    setMode("list");
    toast.success(`Repository: ${item.fullName}`);
  };

  const handleCreate = async (event) => {
    event?.preventDefault();
    if (!newName.trim()) return;

    setCreating(true);
    setError("");
    try {
      const created = await createRepository({
        name: newName,
        private: newPrivate,
      });
      setRepos((prev) => [
        created,
        ...prev.filter((item) => item.fullName !== created.fullName),
      ]);
      loadedAtRef.current = Date.now();
      setNewName("");
      setMode("list");
      toast.success(`Created ${created.fullName}`);
    } catch (createError) {
      setError(createError.message);
    } finally {
      setCreating(false);
    }
  };

  const handleCheckAccess = async () => {
    setChecking(true);
    setError("");
    try {
      const checked = await refreshWriteAccess();
      if (checked.canPush === true) {
        toast.success("Write access confirmed");
      } else if (checked.canPush === false) {
        setError(
          "This token cannot push to the repository. Use a token with Contents read and write access."
        );
      } else {
        toast.success("Repository checked");
      }
    } catch (checkError) {
      setError(checkError.message);
    } finally {
      setChecking(false);
    }
  };

  const handleTestSave = async () => {
    if (!repo || !github.user) return;

    setSaving(true);
    setError("");
    try {
      const result = await saveProjectFiles(
        [
          {
            path: ".vexora/connection.json",
            content: `${JSON.stringify(
              {
                app: "Vexora",
                account: github.user.login,
                repository: `${repo.owner}/${repo.name}`,
                branch: repo.branch,
                savedAt: new Date().toISOString(),
              },
              null,
              2
            )}\n`,
          },
        ],
        "Connect Vexora project"
      );
      toast.success(`Saved to ${result.branch}`);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <span className="px-1.5 py-1 text-xs text-white/25">GitHub…</span>
    );
  }

  if (!connected) {
    return (
      <Link
        href="/dashboard"
        title="Connect GitHub in the dashboard"
        className="flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs text-amber-300/70 transition hover:bg-white/5 hover:text-amber-200"
      >
        <RepoIcon />
        <span className="truncate">Connect GitHub</span>
      </Link>
    );
  }

  const label = repo ? `${repo.owner}/${repo.name}` : "Select repository";
  const accessTitle = repo
    ? repo.canPush === true
      ? "write access"
      : repo.canPush === false
        ? "read-only"
        : "access not checked"
    : "";

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={
          repo
            ? `${label} · ${repo.branch} · ${accessTitle}`
            : "Choose a GitHub repository"
        }
        className="flex max-w-full min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs text-white/40 transition hover:bg-white/5 hover:text-white/80"
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            repo
              ? repo.canPush === true
                ? "bg-emerald-400"
                : repo.canPush === false
                  ? "bg-amber-400"
                  : "bg-white/30"
              : "bg-primary/60"
          }`}
        />
        <RepoIcon />
        <span className={`truncate ${repo ? "font-mono text-[11px]" : ""}`}>
          {label}
        </span>
        {repo ? (
          <span className="shrink-0 text-[10px] text-white/25">
            {repo.branch}
          </span>
        ) : null}
        {repo?.canPush === false ? (
          <span className="shrink-0 text-[9px] uppercase tracking-wide text-amber-300/80">
            read-only
          </span>
        ) : null}
        <Chevron open={open} />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Choose a GitHub repository"
          className="absolute bottom-full left-0 z-50 mb-2 w-[min(22rem,calc(100vw-2.5rem))] overflow-hidden rounded-xl border border-white/10 bg-[#212327] shadow-2xl max-sm:fixed max-sm:inset-x-3 max-sm:bottom-36 max-sm:w-auto"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/5 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2 text-xs text-white/70">
              <RepoIcon />
              <span className="truncate">GitHub · @{github.user.login}</span>
            </div>
            <button
              type="button"
              onClick={() => loadRepos({ force: true })}
              disabled={loading}
              className="shrink-0 text-[11px] text-primary hover:underline disabled:opacity-50"
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {mode === "new" ? (
            <div className="space-y-2.5 px-3 py-3">
              <div>
                <label
                  htmlFor="chat-repo-new-name"
                  className="mb-1 block text-[11px] text-white/45"
                >
                  Repository name
                </label>
                <input
                  id="chat-repo-new-name"
                  type="text"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleCreate();
                    }
                  }}
                  placeholder="my-vexora-project"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-lg border border-white/10 bg-[#404045] px-2.5 py-1.5 text-xs text-white outline-none placeholder:text-white/30 focus:border-primary/60"
                />
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-[11px] text-white/55">
                <input
                  type="checkbox"
                  checked={newPrivate}
                  onChange={(event) => setNewPrivate(event.target.checked)}
                  className="accent-primary"
                />
                Private repository
              </label>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="w-full rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {creating ? "Creating repository…" : "Create repository"}
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-2 px-3 pt-2.5">
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.preventDefault();
                  }}
                  placeholder="Search repositories"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-lg border border-white/10 bg-[#404045] px-2.5 py-1.5 text-xs text-white outline-none placeholder:text-white/30 focus:border-primary/60"
                />
              </div>

              <div className="max-h-56 overflow-y-auto px-1.5 py-1.5">
                {loading && repos.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-white/40">
                    Fetching repositories…
                  </p>
                ) : visibleRepos.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-white/40">
                    {repos.length === 0
                      ? "No repositories found. Create one below."
                      : "No repositories match this search."}
                  </p>
                ) : (
                  visibleRepos.map((item) => {
                    const selected =
                      repo?.owner === item.owner && repo?.name === item.name;
                    return (
                      <button
                        key={item.fullName}
                        type="button"
                        onClick={() => choose(item)}
                        title={item.fullName}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                          selected
                            ? "bg-primary/15 text-white"
                            : "text-white/65 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-mono text-[11px]">
                            {item.fullName}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-white/30">
                            {item.private ? "Private" : "Public"}
                            {item.canPush === false ? (
                              <span className="text-amber-300/70">
                                Read-only
                              </span>
                            ) : null}
                          </span>
                        </span>
                        {selected ? <Check /> : null}
                      </button>
                    );
                  })
                )}
              </div>

              {repo ? (
                <div className="border-t border-white/5 px-3 py-2.5">
                  <div>
                    <label
                      htmlFor="chat-repo-branch"
                      className="mb-1 block text-[11px] text-white/45"
                    >
                      Branch
                    </label>
                    <input
                      id="chat-repo-branch"
                      type="text"
                      value={repo.branch}
                      onChange={(event) => setBranch(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.preventDefault();
                      }}
                      placeholder="main"
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full rounded-lg border border-white/10 bg-[#404045] px-2.5 py-1.5 text-xs text-white outline-none placeholder:text-white/30 focus:border-primary/60"
                    />
                  </div>
                  <p
                    className={`mt-1.5 text-[11px] ${
                      repo.canPush === true
                        ? "text-emerald-400/80"
                        : repo.canPush === false
                          ? "text-amber-300/80"
                          : "text-white/35"
                    }`}
                  >
                    {repo.canPush === true
                      ? "Write access confirmed — Vexora can commit here."
                      : repo.canPush === false
                        ? "Read-only token — commits will fail."
                        : "Write access not checked yet."}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCheckAccess}
                      disabled={checking || saving}
                      className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-white/60 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
                    >
                      {checking ? "Checking…" : "Check access"}
                    </button>
                    <button
                      type="button"
                      onClick={handleTestSave}
                      disabled={checking || saving}
                      className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-white/60 transition hover:bg-white/5 hover:text-white disabled:opacity-40"
                    >
                      {saving ? "Saving…" : "Test save"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-t border-white/5 px-3 py-2.5 text-[11px] text-white/35">
                  Choose a repository to enable project saves.
                </div>
              )}
            </>
          )}

          {error ? (
            <p className="px-3 pb-1 text-[11px] text-red-400">{error}</p>
          ) : null}

          {github.lastSync ? (
            <div className="border-t border-white/5 px-3 py-2 text-[11px] text-white/30">
              Last save: {github.lastSync.files} file
              {github.lastSync.files === 1 ? "" : "s"} ·{" "}
              {github.lastSync.branch}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2 border-t border-white/5 px-3 py-2 text-[11px]">
            <button
              type="button"
              onClick={() => {
                setError("");
                setMode(mode === "new" ? "list" : "new");
              }}
              className="text-primary hover:underline"
            >
              {mode === "new" ? "Cancel" : "+ New repository"}
            </button>
            <Link
              href="/dashboard"
              className="text-white/40 hover:text-white/70 hover:underline"
            >
              GitHub settings →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default GitHubRepoPicker;
