"use client";
import { useAppContext } from "@/context/AppContext";
import { useGitHub } from "@/context/GitHubContext";
import { useState } from "react";
import toast from "react-hot-toast";

const shortSha = (sha) => (sha ? sha.slice(0, 7) : "");

const STATUS = {
  committed: {
    dot: "bg-emerald-400",
    title: "text-white",
    className: "border-emerald-400/25 bg-emerald-400/5",
  },
  pending: {
    dot: "bg-primary animate-pulse",
    title: "text-white",
    className: "border-white/10 bg-white/5",
  },
  failed: {
    dot: "bg-red-400",
    title: "text-red-200",
    className: "border-red-400/25 bg-red-400/5",
  },
  blocked: {
    dot: "bg-amber-400",
    title: "text-amber-200",
    className: "border-amber-400/25 bg-amber-400/5",
  },
  ready: {
    dot: "bg-primary",
    title: "text-white",
    className: "border-primary/25 bg-primary/5",
  },
  review: {
    dot: "bg-amber-400",
    title: "text-amber-200",
    className: "border-amber-400/25 bg-amber-400/5",
  },
  unchanged: {
    dot: "bg-white/40",
    title: "text-white/80",
    className: "border-white/10 bg-white/[0.03]",
  },
};

const CommitCard = ({ action, chatId, messageId }) => {
  const { updateChat } = useAppContext();
  const { github, connected, saveProjectFiles } = useGitHub();
  const [busy, setBusy] = useState(false);

  if (!action) return null;

  const style = STATUS[action.status] || STATUS.unchanged;
  const files = action.files || [];
  const deletions = action.deletions || [];
  const paths = action.paths || [];
  const deletedPaths = action.deletedPaths || [];
  const changed = paths.length + deletedPaths.length;
  const where =
    action.owner && action.repo
      ? `${action.owner}/${action.repo}@${action.branch || "main"}`
      : github.repo
        ? `${github.repo.owner}/${github.repo.name}@${github.repo.branch}`
        : "";
  const canRetry =
    action.status !== "committed" &&
    action.status !== "pending" &&
    (files.length > 0 || deletions.length > 0) &&
    connected &&
    Boolean(github.repo);

  const updateAction = (patch) => {
    if (!chatId || !messageId) return;
    updateChat(chatId, (chat) => ({
      ...chat,
      messages: chat.messages.map((message) =>
        message.id === messageId
          ? { ...message, action: { ...message.action, ...patch } }
          : message
      ),
    }));
  };

  const commit = async () => {
    setBusy(true);
    updateAction({ status: "pending", error: "" });
    try {
      const result = await saveProjectFiles(
        files,
        action.message || "Vexora: update project files",
        { deletions }
      );
      updateAction({ status: "committed", result, error: "" });
      toast.success(
        `Committed ${result.files} file${result.files === 1 ? "" : "s"} to ${
          result.branch
        }`
      );
    } catch (error) {
      updateAction({ status: "failed", error: error.message });
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  const title = (() => {
    if (action.status === "committed") {
      return `Committed ${changed} change${changed === 1 ? "" : "s"} to ${where}`;
    }
    if (action.status === "pending") {
      return `Committing ${changed} change${changed === 1 ? "" : "s"} to ${where}…`;
    }
    if (action.status === "failed") {
      return "Commit failed — nothing was saved";
    }
    if (action.status === "blocked") {
      return "Nothing was committed — the token is read-only";
    }
    if (action.status === "review") {
      const first = action.warnings?.[0];
      if (!first) return "Review before committing";
      return first.reason === "fence"
        ? `Review before committing — ${first.path} looks cut off`
        : `Review before committing — ${first.path} is much shorter`;
    }
    if (action.status === "unchanged") {
      return "No commit — nothing was saved";
    }
    return changed
      ? `${changed} file${changed === 1 ? "" : "s"} ready — not committed yet`
      : "No files to commit";
  })();

  return (
    <section className="mb-6 w-full max-w-3xl pl-0 sm:pl-12">
      <div className={`rounded-2xl border px-4 py-3 text-xs ${style.className}`}>
        <div className="flex items-start gap-2.5">
          <span
            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`}
          />
          <div className="min-w-0 flex-1">
            <p className={`font-medium ${style.title}`}>{title}</p>

            {action.status === "committed" && action.result ? (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/45">
                <span className="font-mono text-white/70">
                  {shortSha(action.result.sha)}
                </span>
                <span>·</span>
                <span>{action.result.files} written</span>
                {action.result.deleted ? (
                  <>
                    <span>·</span>
                    <span>{action.result.deleted} deleted</span>
                  </>
                ) : null}
                {action.result.url ? (
                  <a
                    href={action.result.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    View commit on GitHub →
                  </a>
                ) : null}
              </p>
            ) : null}

            {action.error ? (
              <p
                className={`mt-1 text-[11px] leading-5 ${
                  action.status === "failed"
                    ? "text-red-300/80"
                    : "text-white/50"
                }`}
              >
                {action.error}
              </p>
            ) : null}

            {action.status === "ready" && !github.repo ? (
              <p className="mt-1 text-[11px] text-white/50">
                Choose a repository in the chat box, then commit these files.
              </p>
            ) : null}

            {action.omitted ? (
              <p className="mt-1 text-[11px] text-white/40">
                The file contents were too large to keep in chat history. Ask
                Vexora to regenerate them to commit again.
              </p>
            ) : null}

            {changed ? (
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px]">
                {paths.slice(0, 12).map((path) => (
                  <li key={path} className="text-emerald-300/80">
                    + {path}
                  </li>
                ))}
                {deletedPaths.slice(0, 12).map((path) => (
                  <li key={path} className="text-red-300/70">
                    − {path}
                  </li>
                ))}
                {changed > 24 ? (
                  <li className="text-white/35">
                    +{changed - 24} more
                  </li>
                ) : null}
              </ul>
            ) : null}

            {files.length > 0 ? (
              <details className="mt-2 text-[11px] text-white/50">
                <summary className="cursor-pointer select-none hover:text-white/80">
                  View prepared files ({files.length})
                </summary>
                <div className="mt-2 space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.path}
                      className="overflow-hidden rounded-lg border border-white/10"
                    >
                      <p className="border-b border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] text-white/60">
                        {file.path}
                      </p>
                      <pre className="max-h-72 overflow-auto bg-black/20 p-2 font-mono text-[10px] leading-4 text-white/75">
                        <code>{file.content}</code>
                      </pre>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}

            {canRetry ? (
              <button
                type="button"
                onClick={commit}
                disabled={busy}
                className="mt-2.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] text-white/75 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy
                  ? "Committing…"
                  : action.status === "review"
                    ? "Commit anyway"
                    : action.status === "failed" ||
                        action.status === "blocked"
                      ? "Retry commit"
                      : "Commit to GitHub"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};

export default CommitCard;
