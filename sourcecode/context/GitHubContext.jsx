"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  checkWriteAccess,
  createRepository as createRepositoryRequest,
  saveProjectFiles as saveProjectFilesRequest,
  validateToken,
} from "@/config/github";

const STORAGE_KEY = "vexora:github";

const emptyState = {
  token: "",
  user: null,
  repo: null,
  connectedAt: 0,
  lastSync: null,
};

const normalizeUser = (user) => {
  if (!user?.login) return null;
  return {
    login: String(user.login),
    name: typeof user.name === "string" ? user.name : "",
    avatarUrl: typeof user.avatarUrl === "string" ? user.avatarUrl : "",
    htmlUrl: typeof user.htmlUrl === "string" ? user.htmlUrl : "",
  };
};

const normalizeRepo = (repo) => {
  if (!repo?.owner || !repo?.name) return null;
  const defaultBranch =
    typeof repo.defaultBranch === "string" && repo.defaultBranch
      ? repo.defaultBranch
      : "main";
  return {
    owner: String(repo.owner),
    name: String(repo.name),
    branch:
      typeof repo.branch === "string" && repo.branch
        ? repo.branch
        : defaultBranch,
    defaultBranch,
    private: Boolean(repo.private),
    canPush:
      typeof repo.canPush === "boolean" ? repo.canPush : null,
    htmlUrl: typeof repo.htmlUrl === "string" ? repo.htmlUrl : "",
  };
};

const normalizeState = (value) => {
  if (!value || typeof value !== "object") return { ...emptyState };
  return {
    token: typeof value.token === "string" ? value.token : "",
    user: normalizeUser(value.user),
    repo: normalizeRepo(value.repo),
    connectedAt: Number(value.connectedAt) || 0,
    lastSync:
      value.lastSync?.sha && typeof value.lastSync.sha === "string"
        ? {
            sha: value.lastSync.sha,
            branch:
              typeof value.lastSync.branch === "string"
                ? value.lastSync.branch
                : "main",
            url:
              typeof value.lastSync.url === "string" ? value.lastSync.url : "",
            files: Number(value.lastSync.files) || 0,
            deleted: Number(value.lastSync.deleted) || 0,
            message:
              typeof value.lastSync.message === "string"
                ? value.lastSync.message
                : "",
            at: Number(value.lastSync.at) || 0,
          }
        : null,
  };
};

export const GitHubContext = createContext(null);

export const useGitHub = () => useContext(GitHubContext);

export const GitHubProvider = ({ children }) => {
  const [state, setState] = useState(emptyState);
  const [ready, setReady] = useState(false);

  // Load the saved connection once, from this browser only.
  useEffect(() => {
    let stored = { ...emptyState };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) stored = normalizeState(JSON.parse(raw));
    } catch {
      stored = { ...emptyState };
    }
    setState(stored);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be full or disabled (private mode); keep the UI usable.
    }
  }, [state, ready]);

  const connect = useCallback(async (token) => {
    const user = await validateToken(token);
    setState((prev) => {
      const sameUser = prev.user?.login === user.login;
      return {
        token: String(token).trim(),
        user,
        repo: sameUser ? prev.repo : null,
        connectedAt: sameUser && prev.connectedAt ? prev.connectedAt : Date.now(),
        lastSync: sameUser ? prev.lastSync : null,
      };
    });
    return user;
  }, []);

  const disconnect = useCallback(() => {
    setState({ ...emptyState });
  }, []);

  const refreshAccount = useCallback(async () => {
    if (!state.token) throw new Error("Connect GitHub first.");
    const user = await validateToken(state.token);
    setState((prev) => ({ ...prev, user }));
    return user;
  }, [state.token]);

  const selectRepository = useCallback((repo) => {
    if (!repo?.owner || !repo?.name) return;
    setState((prev) => {
      const sameRepo =
        prev.repo?.owner === repo.owner && prev.repo?.name === repo.name;
      const defaultBranch = repo.defaultBranch || repo.branch || "main";
      return {
        ...prev,
        repo: {
          owner: repo.owner,
          name: repo.name,
          branch:
            sameRepo && prev.repo?.branch ? prev.repo.branch : defaultBranch,
          defaultBranch,
          private: Boolean(repo.private),
          canPush:
            typeof repo.canPush === "boolean" ? repo.canPush : null,
          htmlUrl: repo.htmlUrl || prev.repo?.htmlUrl || "",
        },
      };
    });
  }, []);

  const setBranch = useCallback((branch) => {
    setState((prev) =>
      prev.repo
        ? { ...prev, repo: { ...prev.repo, branch: String(branch) } }
        : prev
    );
  }, []);

  const createRepository = useCallback(
    async (input) => {
      if (!state.token) throw new Error("Connect GitHub first.");
      const repo = await createRepositoryRequest(state.token, input);
      selectRepository(repo);
      return repo;
    },
    [state.token, selectRepository]
  );

  const refreshWriteAccess = useCallback(async () => {
    if (!state.token || !state.repo) {
      throw new Error("Choose a repository first.");
    }
    const repo = await checkWriteAccess(
      state.token,
      state.repo.owner,
      state.repo.name
    );
    setState((prev) =>
      prev.repo
        ? {
            ...prev,
            repo: {
              ...prev.repo,
              canPush: repo.canPush,
              defaultBranch: repo.defaultBranch,
              private: repo.private,
              htmlUrl: repo.htmlUrl || prev.repo.htmlUrl,
            },
          }
        : prev
    );
    return repo;
  }, [state.token, state.repo]);

  // Reusable entry point for the future agentic/code-generation flow: pass the
  // generated files and Vexora commits them to the connected repository.
  const saveProjectFiles = useCallback(
    async (files, message = "Update project files", options = {}) => {
      if (!state.token) throw new Error("Connect GitHub first.");
      if (!state.repo) throw new Error("Choose a repository first.");

      const result = await saveProjectFilesRequest({
        token: state.token,
        owner: state.repo.owner,
        repo: state.repo.name,
        branch: state.repo.branch,
        baseBranch: options.baseBranch || state.repo.defaultBranch,
        files,
        deletions: options.deletions || [],
        message,
      });

      setState((prev) => ({
        ...prev,
        lastSync: {
          ...result,
          message,
          at: Date.now(),
        },
      }));
      return result;
    },
    [state.token, state.repo]
  );

  const value = {
    ready,
    github: state,
    connected: Boolean(state.token && state.user),
    connect,
    disconnect,
    refreshAccount,
    selectRepository,
    setBranch,
    createRepository,
    refreshWriteAccess,
    saveProjectFiles,
  };

  return (
    <GitHubContext.Provider value={value}>{children}</GitHubContext.Provider>
  );
};
