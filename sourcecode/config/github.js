// GitHub integration. Everything here runs in the browser: the personal access
// token is sent directly to api.github.com and never to a Vexora server.
//
// Saving uses GitHub's Git Data API (blobs -> tree -> commit -> ref) so a whole
// generated project is committed in one atomic commit instead of one request
// per file through the Contents API.

const API_BASE = "https://api.github.com";
const API_VERSION = "2022-11-28";
const REPO_ACCESS_SCOPE =
  "https://github.com/settings/personal-access-tokens/new";

export class GithubError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "GithubError";
    this.status = status;
    this.data = data;
  }
}

export const githubTokenUrl = REPO_ACCESS_SCOPE;

const normalizeToken = (token) => {
  const value = typeof token === "string" ? token.trim() : "";
  if (!value) throw new GithubError("A GitHub token is required.", 401);
  return value;
};

const readBody = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const errorMessage = (status, data) => {
  const message = typeof data?.message === "string" ? data.message : "";

  if (status === 401) {
    return "GitHub rejected this token. It may be invalid, expired, or revoked.";
  }
  if (status === 403) {
    if (/rate limit/i.test(message)) {
      return "GitHub's API rate limit was reached. Wait a minute and try again.";
    }
    if (/resource not accessible|permission|forbidden/i.test(message)) {
      return "This token does not have permission for that action. Use a token with Contents read and write access.";
    }
    return message || "GitHub denied this request. Check the token's permissions.";
  }
  if (status === 404) {
    return message || "Not found. Check the repository name and that the token can access it.";
  }
  if (status === 409) {
    return message || "The repository is empty.";
  }
  if (status === 422) {
    return message || "GitHub rejected the request. Check the repository and branch settings.";
  }
  return message || `GitHub request failed (${status}).`;
};

export async function githubRequest(
  path,
  { token, method = "GET", body } = {}
) {
  const accessToken = normalizeToken(token);
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": API_VERSION,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  const data = await readBody(response);
  if (!response.ok) {
    throw new GithubError(errorMessage(response.status, data), response.status, data);
  }
  return data;
}

const cleanPath = (value) => {
  const path = String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim();

  if (!path) throw new GithubError("Every file needs a path.", 400);
  if (
    path.split("/").some((part) => part === "." || part === "..") ||
    path.includes("\0")
  ) {
    throw new GithubError(`Unsafe file path: ${path}`, 400);
  }
  return path;
};

const cleanBranch = (value) => {
  const branch = String(value || "").trim();
  if (!branch) throw new GithubError("A branch name is required.", 400);
  if (
    /[\s~^:?*[\]\\]/.test(branch) ||
    branch.includes("..") ||
    branch.includes("@{") ||
    branch.startsWith("/") ||
    branch.endsWith("/") ||
    branch.endsWith(".lock")
  ) {
    throw new GithubError("Enter a valid branch name.", 400);
  }
  return branch;
};

const encodeRefPath = (branch) =>
  branch
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

const toBase64 = (text) => {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

const normalizeRepository = (repo = {}) => {
  const [fallbackOwner, fallbackName] = String(repo.full_name || "").split("/");
  const owner = repo.owner?.login || fallbackOwner || "";
  const name = repo.name || fallbackName || "";

  return {
    owner,
    name,
    fullName: repo.full_name || `${owner}/${name}`,
    defaultBranch: repo.default_branch || "main",
    private: Boolean(repo.private),
    canPush: repo.permissions ? Boolean(repo.permissions.push) : null,
    htmlUrl: repo.html_url || "",
    description: repo.description || "",
    updatedAt: repo.updated_at || repo.pushed_at || "",
  };
};

export async function validateToken(token) {
  const user = await githubRequest("/user", { token });
  if (!user?.login) {
    throw new GithubError("GitHub did not return an account for this token.", 401);
  }
  return {
    login: user.login,
    name: user.name || "",
    avatarUrl: user.avatar_url || "",
    htmlUrl: user.html_url || "",
  };
}

// Text injected into the chat system prompt so the model knows which workspace
// and repository it is helping with. Returns an empty string when GitHub is not
// connected, so chats that do not use GitHub stay unchanged.
export const getGitHubContext = (github) => {
  const user = github?.user;
  if (!user?.login) return "";

  const repo = github?.repo;
  if (!repo?.owner || !repo?.name) {
    return (
      `Workspace context: GitHub is connected as @${user.login}, but no project ` +
      "repository is selected yet. The user can choose one from the repository " +
      "menu next to the model picker under the chat box."
    );
  }

  const access =
    repo.canPush === true
      ? "Write access is confirmed"
      : repo.canPush === false
        ? "The token is read-only, so project files cannot be committed until it gets write access"
        : "Write access has not been checked yet";
  const branch = repo.branch || repo.defaultBranch || "main";

  return (
    `Workspace context: GitHub is connected as @${user.login}. The selected ` +
    `project repository is ${repo.owner}/${repo.name} on branch ${branch}. ` +
    `${access}. Generated project files can be committed to this repository. ` +
    "When you share project code, include complete file paths. Never claim a " +
    "file was saved unless the app confirms it."
  );
};

export async function listRepositories(token) {
  const repos = await githubRequest(
    "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
    { token }
  );

  if (!Array.isArray(repos)) return [];

  return repos
    .map(normalizeRepository)
    .filter((repo) => repo.owner && repo.name)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function getRepository(token, owner, repo) {
  if (!owner || !repo) {
    throw new GithubError("Choose a repository first.", 400);
  }
  const data = await githubRequest(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    { token }
  );
  return normalizeRepository(data);
}

export async function checkWriteAccess(token, owner, repo) {
  return getRepository(token, owner, repo);
}

export async function createRepository(
  token,
  { name, description = "", private: isPrivate = false } = {}
) {
  const repoName = String(name || "")
    .trim()
    .replace(/\s+/g, "-");

  if (!repoName) {
    throw new GithubError("A repository name is required.", 400);
  }

  const data = await githubRequest("/user/repos", {
    token,
    method: "POST",
    body: {
      name: repoName,
      description: description.trim() || undefined,
      private: Boolean(isPrivate),
      // A README gives the repository an initial commit and branch, so the
      // first save can update the branch instead of bootstrapping an empty repo.
      auto_init: true,
    },
  });

  return normalizeRepository(data);
}

const getBranchSha = async (token, base, branch) => {
  try {
    const ref = await githubRequest(
      `${base}/git/ref/heads/${encodeRefPath(branch)}`,
      { token }
    );
    return ref?.object?.sha || null;
  } catch (error) {
    // 409 means the repository has no commits yet; 404 means this branch does
    // not exist. Both are expected when starting a project.
    if (error instanceof GithubError && (error.status === 404 || error.status === 409)) {
      return null;
    }
    throw error;
  }
};

/**
 * Commit a set of project files to a repository branch in one commit.
 *
 * @param {object} options
 * @param {string} options.token  GitHub personal access token
 * @param {string} options.owner  Repository owner (user or org)
 * @param {string} options.repo   Repository name
 * @param {string} [options.branch] Branch to write to
 * @param {string} [options.baseBranch] Branch to start from if `branch` is new
 * @param {Array<{path: string, content: string}>} options.files
 * @param {string[]} [options.deletions] Paths to remove in the same commit
 * @param {string} [options.message] Commit message
 * @returns {Promise<{sha: string, branch: string, url: string, files: number, deleted: number}>}
 */
export async function saveProjectFiles({
  token,
  owner,
  repo,
  branch = "main",
  baseBranch,
  files = [],
  deletions = [],
  message = "Update project files",
} = {}) {
  if (!owner || !repo) {
    throw new GithubError("Choose a repository first.", 400);
  }

  const targetBranch = cleanBranch(branch);
  const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const seen = new Set();
  const normalizedFiles = files.map((file) => {
    const path = cleanPath(file?.path);
    if (seen.has(path)) {
      throw new GithubError(`Duplicate file path: ${path}`, 400);
    }
    seen.add(path);
    return {
      path,
      content: file?.content == null ? "" : String(file.content),
    };
  });

  const deletedPaths = [...new Set(deletions.map(cleanPath))].filter(
    (path) => !seen.has(path)
  );

  if (normalizedFiles.length === 0 && deletedPaths.length === 0) {
    throw new GithubError("There are no files to save.", 400);
  }

  // Reuse the current branch tip, or start a new branch from baseBranch so a
  // brand-new branch keeps the repository's history and files.
  const branchSha = await getBranchSha(token, base, targetBranch);
  let parentSha = branchSha;
  if (!parentSha && baseBranch) {
    const baseName = String(baseBranch).trim();
    if (baseName && baseName !== targetBranch) {
      parentSha = await getBranchSha(token, base, baseName);
    }
  }

  let baseTree = null;
  if (parentSha) {
    const parent = await githubRequest(`${base}/git/commits/${parentSha}`, {
      token,
    });
    baseTree = parent?.tree?.sha || null;
  }

  const blobs = await Promise.all(
    normalizedFiles.map(async (file) => {
      const blob = await githubRequest(`${base}/git/blobs`, {
        token,
        method: "POST",
        body: { content: toBase64(file.content), encoding: "base64" },
      });
      return {
        path: file.path,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      };
    })
  );

  const treeEntries = [
    ...blobs,
    ...deletedPaths.map((path) => ({
      path,
      mode: "100644",
      type: "blob",
      sha: null,
    })),
  ];

  const tree = await githubRequest(`${base}/git/trees`, {
    token,
    method: "POST",
    body: baseTree
      ? { base_tree: baseTree, tree: treeEntries }
      : { tree: treeEntries },
  });

  const commit = await githubRequest(`${base}/git/commits`, {
    token,
    method: "POST",
    body: {
      message,
      tree: tree.sha,
      parents: parentSha ? [parentSha] : [],
    },
  });

  if (branchSha) {
    try {
      await githubRequest(`${base}/git/refs/heads/${encodeRefPath(targetBranch)}`, {
        token,
        method: "PATCH",
        body: { sha: commit.sha, force: false },
      });
    } catch (error) {
      if (error instanceof GithubError && error.status === 422) {
        throw new GithubError(
          "The branch changed on GitHub while saving. Try again to include the latest commit.",
          409
        );
      }
      throw error;
    }
  } else {
    await githubRequest(`${base}/git/refs`, {
      token,
      method: "POST",
      body: { ref: `refs/heads/${targetBranch}`, sha: commit.sha },
    });
  }

  return {
    sha: commit.sha,
    branch: targetBranch,
    url:
      commit.html_url ||
      `https://github.com/${owner}/${repo}/commit/${commit.sha}`,
    files: normalizedFiles.length,
    deleted: deletedPaths.length,
  };
}
