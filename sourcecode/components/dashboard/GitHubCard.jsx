"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { githubTokenUrl, listRepositories } from "@/config/github";
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
    selectRepository,
    setBranch,
    createRepository,
    refreshWriteAccess,
    saveProjectFiles,
  } = useGitHub();

  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [repos, setRepos] = useState([]);
  const [mode, setMode] = useState("existing");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrivate, setNewPrivate] = useState(true);

  // Load the account's repositories after connecting, or when the token
  // changes. Repo lists are fetched straight from GitHub in the browser.
  useEffect(() => {
    if (!ready || !github.token) return;
    let active = true;

    listRepositories(github.token)
      .then((list) => {
        if (active) setRepos(list);
      })
      .catch((err) => {
        if (active) setError(err.message);
      });

    return () => {
      active = false;
    };
  }, [ready, github.token]);

  const loadRepos = useCallback(async () => {
    if (!github.token) return;
    setBusy("repos");
    setError("");
    try {
      setRepos(await listRepositories(github.token));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }, [github.token]);

  const selectedFullName = useMemo(() => {
    if (!github.repo) return "";
    const match = repos.find(
      (repo) =>
        repo.owner === github.repo.owner && repo.name === github.repo.name
    );
    return match?.fullName || `${github.repo.owner}/${github.repo.name}`;
  }, [github.repo, repos]);

  const selectedRepoIsMissing =
    Boolean(github.repo) &&
    !repos.some(
      (repo) =>
        repo.owner === github.repo.owner && repo.name === github.repo.name
    );

  const repoUrl =
    github.repo?.htmlUrl ||
    (github.repo
      ? `https://github.com/${github.repo.owner}/${github.repo.name}`
      : "");

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
    setRepos([]);
    setMode("existing");
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

  const handleSelect = (event) => {
    const repo = repos.find((item) => item.fullName === event.target.value);
    if (repo) selectRepository(repo);
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setError("");
    setBusy("create");
    try {
      const repo = await createRepository({
        name: newName,
        description: newDescription,
        private: newPrivate,
      });
      setRepos((prev) => [
        repo,
        ...prev.filter((item) => item.fullName !== repo.fullName),
      ]);
      setMode("existing");
      setNewName("");
      setNewDescription("");
      toast.success(`Created ${repo.fullName}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const handleCheckWrite = async () => {
    setError("");
    setBusy("check");
    try {
      const repo = await refreshWriteAccess();
      if (repo.canPush === true) {
        toast.success("Write access confirmed");
      } else if (repo.canPush === false) {
        setError(
          "This token can read the repository but cannot push. Use a token with Contents read and write access."
        );
      } else {
        toast.success("Repository checked");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  };

  const handleTestSave = async () => {
    if (!github.user || !github.repo) return;
    setError("");
    setBusy("save");
    try {
      const result = await saveProjectFiles(
        [
          {
            path: ".vexora/connection.json",
            content: `${JSON.stringify(
              {
                app: "Vexora",
                account: github.user.login,
                repository: `${github.repo.owner}/${github.repo.name}`,
                branch: github.repo.branch,
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
          <h2 className="text-lg font-medium">Project repository</h2>
          <p className="mt-1 max-w-2xl text-sm text-white/40">
            Save the code Vexora generates to a GitHub repository you own.
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

            <div className="mt-5 border-t border-white/10 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Repository</h3>
                <div className="flex items-center gap-3 text-xs">
                  {busy === "repos" ? (
                    <span className="text-white/35">Loading…</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={loadRepos}
                    disabled={Boolean(busy)}
                    className="text-primary hover:underline disabled:opacity-40"
                  >
                    Refresh list
                  </button>
                </div>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                <select
                  id="github-repo"
                  value={selectedFullName}
                  onChange={handleSelect}
                  className={inputClass}
                >
                  <option value="">Select a repository…</option>
                  {selectedRepoIsMissing ? (
                    <option value={selectedFullName}>
                      {selectedFullName}
                    </option>
                  ) : null}
                  {repos.map((repo) => (
                    <option key={repo.fullName} value={repo.fullName}>
                      {repo.fullName}
                      {repo.private ? " (private)" : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setMode((value) =>
                      value === "new" ? "existing" : "new"
                    )
                  }
                  disabled={Boolean(busy)}
                  className={secondaryButton}
                >
                  {mode === "new" ? "Cancel" : "+ New repository"}
                </button>
              </div>

              {mode === "new" ? (
                <form
                  onSubmit={handleCreate}
                  className="mt-3 space-y-3 rounded-2xl border border-white/10 bg-black/10 p-4"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="github-new-name" className={labelClass}>
                        Repository name
                      </label>
                      <input
                        id="github-new-name"
                        type="text"
                        value={newName}
                        onChange={(event) => setNewName(event.target.value)}
                        placeholder="my-vexora-project"
                        autoComplete="off"
                        spellCheck={false}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="github-new-description"
                        className={labelClass}
                      >
                        Description (optional)
                      </label>
                      <input
                        id="github-new-description"
                        type="text"
                        value={newDescription}
                        onChange={(event) =>
                          setNewDescription(event.target.value)
                        }
                        placeholder="Built with Vexora"
                        autoComplete="off"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-white/60">
                    <input
                      type="checkbox"
                      checked={newPrivate}
                      onChange={(event) => setNewPrivate(event.target.checked)}
                      className="accent-primary"
                    />
                    Private repository
                  </label>
                  <button
                    type="submit"
                    disabled={Boolean(busy) || !newName.trim()}
                    className={primaryButton}
                  >
                    {busy === "create"
                      ? "Creating repository…"
                      : "Create repository"}
                  </button>
                </form>
              ) : null}

              {github.repo ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="github-branch" className={labelClass}>
                      Branch
                    </label>
                    <input
                      id="github-branch"
                      type="text"
                      value={github.repo.branch}
                      onChange={(event) => setBranch(event.target.value)}
                      placeholder="main"
                      autoComplete="off"
                      spellCheck={false}
                      className={inputClass}
                    />
                    <p className="mt-1.5 text-[11px] text-white/35">
                      Generated files are committed to this branch.
                    </p>
                  </div>

                  <div>
                    <p className={labelClass}>Write access</p>
                    <p
                      className={`text-xs ${
                        github.repo.canPush === true
                          ? "text-emerald-400"
                          : github.repo.canPush === false
                            ? "text-red-400"
                            : "text-white/40"
                      }`}
                    >
                      {github.repo.canPush === true
                        ? "Confirmed — Vexora can commit to this repository."
                        : github.repo.canPush === false
                          ? "This token cannot push to this repository."
                          : "Not checked yet."}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleCheckWrite}
                        disabled={Boolean(busy)}
                        className={secondaryButton}
                      >
                        {busy === "check" ? "Checking…" : "Check write access"}
                      </button>
                      <button
                        type="button"
                        onClick={handleTestSave}
                        disabled={Boolean(busy)}
                        className={secondaryButton}
                      >
                        {busy === "save" ? "Saving…" : "Test save"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-xs text-white/35">
                  Choose an existing repository or create a new one to enable
                  project saves.
                </p>
              )}

              {github.repo ? (
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-white/35">
                  <a
                    href={repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    Open repository →
                  </a>
                  {github.lastSync ? (
                    <span>
                      Last save:{" "}
                      {github.lastSync.at
                        ? new Date(github.lastSync.at).toLocaleString()
                        : "just now"}{" "}
                      · {github.lastSync.files} file
                      {github.lastSync.files === 1 ? "" : "s"} ·{" "}
                      {github.lastSync.branch}
                      {github.lastSync.url ? (
                        <>
                          {" · "}
                          <a
                            href={github.lastSync.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                          >
                            View commit
                          </a>
                        </>
                      ) : null}
                    </span>
                  ) : (
                    <span>No saves yet.</span>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {error ? <p className="mt-3 text-xs text-red-400">{error}</p> : null}
      </div>
    </section>
  );
}
