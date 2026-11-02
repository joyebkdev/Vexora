// Vexora cannot run GitHub commands by itself: the model only returns text.
// This module defines the small file protocol the model must use when it wants
// to change project files, parses those blocks out of a reply, and adds the
// rules that keep the model from claiming work the app has not confirmed.
//
// Protocol (one block per file):
//
//   ```vexora-file path=src/App.jsx
//   ...complete file content...
//   ```
//
//   ```vexora-delete path=old/file.js
//   ```

import { getGitHubContext } from "@/config/github";

const BLOCK = /```[ \t]*vexora-(file|delete)\b([^\n]*)\r?\n([\s\S]*?)```/gi;

const STORAGE_LIMIT = 200_000;

const unquote = (value) =>
  String(value || "")
    .trim()
    .replace(/^["'`]|["'`]$/g, "");

// Repository paths are relative, use forward slashes and never escape the repo.
export const normalizeRepoPath = (raw) => {
  let value = unquote(raw).replace(/\\/g, "/");
  value = value.replace(/^\.\//, "");
  if (!value || value.length > 400) return "";
  if (value.startsWith("/") || /^[a-zA-Z]:/.test(value)) return "";
  const parts = value.split("/").filter(Boolean);
  if (!parts.length) return "";
  if (parts.some((part) => part === "." || part === "..")) return "";
  return parts.join("/");
};

const readPath = (attributes) => {
  const labelled = attributes.match(
    /(?:^|\s)(?:path|file)\s*[=:]\s*("[^"]+"|'[^']+'|\S+)/i
  );
  if (labelled) return normalizeRepoPath(labelled[1]);

  // Tolerate `vexora-file src/App.jsx` without a `path=` prefix.
  const bare = attributes.match(/(?:^|\s)("[^"]+"|'[^']+'|\S+)/);
  if (bare) return normalizeRepoPath(bare[1]);
  return "";
};

const readDeletePaths = (attributes, content) => {
  const explicit = readPath(attributes);
  if (explicit) return [explicit];

  return String(content || "")
    .split(/\r?\n/)
    .map((line) => normalizeRepoPath(line.split(/\s+/)[0]))
    .filter(Boolean);
};

// Extracts file blocks from a finished reply and returns the remaining prose.
// A block that is still streaming (no closing fence) is left alone on purpose:
// Vexora only commits what the model finished writing.
export const parseWorkspaceChanges = (reply) => {
  const source = String(reply || "");
  const files = new Map();
  const deletions = new Set();

  const pattern = new RegExp(BLOCK.source, "gi");
  let match;
  while ((match = pattern.exec(source))) {
    const kind = match[1].toLowerCase();
    const attributes = match[2] || "";
    let body = match[3] || "";

    // Some models put the path directive on the first line of the body
    // instead of the header line.
    let path = readPath(attributes);
    if (!path) {
      const firstLine = body.split(/\r?\n/, 1)[0] || "";
      if (/(?:^|\s)(?:path|file)\s*[=:]/i.test(firstLine)) {
        path = readPath(firstLine);
        if (path) body = body.slice(firstLine.length).replace(/^\r?\n/, "");
      }
    }

    if (kind === "delete") {
      readDeletePaths(path || attributes, body).forEach((item) =>
        deletions.add(item)
      );
      continue;
    }

    if (!path) continue;
    files.set(path, {
      path,
      content: body.replace(/\r\n/g, "\n").replace(/\n$/, ""),
    });
  }

  // A file that is written also exists, so a delete for the same path loses.
  files.forEach((_file, path) => deletions.delete(path));

  const cleaned = source
    .replace(new RegExp(BLOCK.source, "gi"), "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const fileList = [...files.values()];
  const deletionList = [...deletions];

  return {
    files: fileList,
    deletions: deletionList,
    paths: fileList.map((file) => file.path),
    text: cleaned,
    hasChanges: fileList.length > 0 || deletionList.length > 0,
  };
};

// Chats live in localStorage, so very large generated projects are committed
// but not kept in browser history.
export const toStoredChanges = (parsed) => {
  const size = parsed.files.reduce(
    (total, file) => total + file.content.length,
    0
  );
  const omitted = size > STORAGE_LIMIT;
  return {
    files: omitted ? [] : parsed.files,
    deletions: parsed.deletions,
    paths: parsed.paths,
    omitted,
  };
};

const CLAIM =
  /\b(?:i(?:'ve| have| just| already)?\s+(?:updated|created|added|modified|built|committed|pushed|saved|deleted|renamed|written)|(?:the\s+)?(?:files?|changes?|code|project|repo(?:sitory)?)\s+(?:have|has|is|are|were)\s+(?:now\s+)?(?:been\s+)?(?:saved|committed|pushed|updated|created)|successfully\s+(?:saved|committed|pushed|updated|created|deployed)|committed?\s+(?:successfully|to|on)|pushed\s+(?:to|the|your)|(?:changes|updates?)\s+(?:are|is)\s+(?:now\s+)?(?:live|in\s+(?:the|your)\s+repo)|(?:it|that|this)\s+is\s+(?:now\s+)?(?:done|complete|finished))/i;

// Used to add an app-generated correction when a reply talks about saving or
// pushing but returned no file blocks, so nothing was actually committed.
export const claimsUnconfirmedSave = (text) => CLAIM.test(String(text || ""));

const writeRules = (repo) => `Project files: the user's workspace is ${repo.owner}/${repo.name} on branch ${repo.branch}. When the user asks you to create or change project files, write each file as its own fenced block with this exact header:

\`\`\`vexora-file path=<repository-relative path>
<complete file content>
\`\`\`

To delete a file, use:

\`\`\`vexora-delete path=<repository-relative path>
\`\`\`

Rules:
- Only emit a block for a file you are actually changing, and include the whole file, never a diff or a fragment.
- Use relative paths with forward slashes. Never use absolute paths, drive letters or "..".
- Vexora applies these blocks and commits them to the selected branch. You cannot run git, commit or push on your own.
- Never say files were saved, committed, pushed or finished, and never invent commit hashes or links. The app appends the real commit result after it runs.
- Do not emit file blocks when you are only explaining, reviewing or answering a question.`;

export const getWorkspacePrompt = (github) => {
  const context = getGitHubContext(github);
  const repo = github?.repo;
  if (!context || !github?.user?.login || !repo?.owner || !repo?.name) {
    return context;
  }
  return `${context}\n\n${writeRules({
    owner: repo.owner,
    name: repo.name,
    branch: repo.branch || repo.defaultBranch || "main",
  })}`;
};
