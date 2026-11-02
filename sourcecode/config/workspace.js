// Vexora cannot run GitHub commands by itself: the model only returns text.
// This module defines the small file protocol the model must use when it wants
// to change project files, parses those blocks out of a reply, and adds the
// rules that keep the model from claiming work the app has not confirmed.
//
// Protocol (one block per file). Four backticks are required so a file that
// itself contains three-backtick code fences (a README, for example) is not
// cut off at the first inner fence:
//
//   ````vexora-file path=src/App.jsx
//   ...complete file content...
//   ````
//
//   ````vexora-delete path=old/file.js
//   ````

import { getGitHubContext } from "@/config/github";

const BLOCK_OPEN = /^(`{3,})[ \t]*vexora-(file|delete)\b([^\n]*)$/i;
const BLOCK_CLOSE = /^(`{3,})[ \t]*$/;

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
  const lines = source.split(/\r?\n/);
  const keep = new Array(lines.length).fill(true);
  const files = new Map();
  const deletions = new Set();
  let unterminated = false;

  for (let index = 0; index < lines.length; index++) {
    const open = lines[index].match(BLOCK_OPEN);
    if (!open) continue;

    const fenceLength = open[1].length;
    let closeIndex = -1;
    for (let scan = index + 1; scan < lines.length; scan++) {
      const close = lines[scan].match(BLOCK_CLOSE);
      // Only a fence at least as long as the opener can close the block. This
      // lets a four-backtick block contain ordinary three-backtick code.
      if (close && close[1].length >= fenceLength) {
        closeIndex = scan;
        break;
      }
    }

    if (closeIndex === -1) {
      // Never guess the end of an unfinished file.
      unterminated = true;
      break;
    }

    const kind = open[2].toLowerCase();
    const attributes = open[3] || "";
    let body = lines.slice(index + 1, closeIndex).join("\n");

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
    } else if (path) {
      // A file whose own code fences are unbalanced was probably cut off by
      // an outer three-backtick fence. Flag it so the app asks before saving.
      const fenceLines = (body.match(/^`{3,}[^\n]*$/gm) || []).length;
      files.set(path, {
        path,
        content: body.replace(/\n$/, ""),
        suspiciousFence: fenceLines % 2 === 1,
      });
    }

    for (let line = index; line <= closeIndex; line++) keep[line] = false;
    index = closeIndex;
  }

  // A file that is written also exists, so a delete for the same path loses.
  files.forEach((_file, path) => deletions.delete(path));

  const cleaned = lines
    .filter((_line, index) => keep[index])
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const fileList = [...files.values()];
  const deletionList = [...deletions];

  return {
    files: fileList,
    deletions: deletionList,
    paths: fileList.map((file) => file.path),
    text: cleaned,
    unterminated,
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

const ACCESS_CLAIM =
  /(?:\bi(?:'m| am)\s+(?:already\s+)?connected\b|\bi\s+(?:have|'ve got|got)\s+(?:read\/?write|read and write|write|read|full)\s+access\b|\bi\s+can\s+(?:access|read|modify|push\s+to)\s+(?:your|the|any)\s+repo(?:sitory)?\b)/i;

// The app owns the GitHub connection; the model must not claim it does.
export const claimsRepositoryAccess = (text) =>
  ACCESS_CLAIM.test(String(text || ""));

export const ACCESS_NOTICE =
  "> Vexora holds the GitHub connection, not the assistant. This reply works from the repository snapshot Vexora read with your token.";

const accessRule = `Access: Vexora, not you, holds the user's GitHub token and performs every GitHub read and commit. You cannot browse GitHub, call its API, or reach any repository. Never say you are connected to GitHub, that you have access, or that you can open other repositories. If the user asks about access, explain that Vexora can read the selected repository and commit to it with their connected token, and that you work only from the repository snapshot Vexora includes with each request.`;

const writeRules = (repo) => `${accessRule}

Project files: the user's workspace is ${repo.owner}/${repo.name} on branch ${repo.branch}. When the user asks you to create or change project files, write each file as its own fenced block. Use FOUR backticks for the outer fence so code fences inside the file survive:

\`\`\`\`vexora-file path=<repository-relative path>
<complete file content>
\`\`\`\`

To delete a file, use a four-backtick block too:

\`\`\`\`vexora-delete path=<repository-relative path>
\`\`\`\`

Rules:
- Always use four backticks around a file block, even when the file itself contains three-backtick code blocks. Never put four backticks inside the file content.
- Only emit a block for a file you are actually changing, and include the whole file, never a diff or a fragment.
- Use relative paths with forward slashes. Never use absolute paths, drive letters or "..".
- Vexora applies these blocks and commits them to the selected branch. You cannot run git, commit or push on your own.
- Never say files were saved, committed, pushed or finished, and never invent commit hashes or links. The app appends the real commit result after it runs.
- When changing an existing file, start from the snapshot content and return the complete updated file. Never ask the user to paste a file that is already in the snapshot.
- If a file you need is not in the snapshot, say Vexora did not include it and ask for it by path. Never guess its contents.
- Put a short summary before the blocks, and do not repeat file contents outside the blocks.
- Do not emit file blocks when you are only explaining, reviewing or answering a question.`;

export const formatRepositorySnapshot = (snapshot, error = "") => {
  if (error) {
    return `Repository snapshot unavailable: ${error} Do not guess file contents; tell the user the repository read failed.`;
  }
  if (!snapshot) return "";
  if (snapshot.empty) {
    return "Repository snapshot: the selected branch has no files yet.";
  }

  const lines = [
    `Repository snapshot read from GitHub for this request (branch ${snapshot.branch}).`,
    `${snapshot.totalPaths} file${
      snapshot.totalPaths === 1 ? "" : "s"
    } in the tree${
      snapshot.totalPaths > snapshot.paths.length
        ? ` (showing the first ${snapshot.paths.length})`
        : ""
    }: ${snapshot.paths.join(", ")}`,
  ];

  if (snapshot.files.length) {
    lines.push("File contents as they exist on GitHub right now:");
    snapshot.files.forEach((file) => {
      lines.push(`--- ${file.path} ---\n${file.content}`);
    });
  } else {
    lines.push(
      "No file contents were loaded for this request. Do not invent file contents."
    );
  }

  if (snapshot.omitted) {
    lines.push(
      `${snapshot.omitted} more file${
        snapshot.omitted === 1 ? " was" : "s were"
      } not loaded into this snapshot.`
    );
  }

  return lines.join("\n\n");
};

export const getWorkspacePrompt = (github, snapshot = null, snapshotError = "") => {
  const context = getGitHubContext(github);
  const repo = github?.repo;
  if (!context || !github?.user?.login || !repo?.owner || !repo?.name) {
    return context;
  }

  const snapshotText = formatRepositorySnapshot(snapshot, snapshotError);
  return [
    context,
    writeRules({
      owner: repo.owner,
      name: repo.name,
      branch: repo.branch || repo.defaultBranch || "main",
    }),
    snapshotText,
  ]
    .filter(Boolean)
    .join("\n\n");
};
