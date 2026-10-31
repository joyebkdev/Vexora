"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getProvider,
  isUnavailableModel,
} from "@/config/providers";

const CHATS_KEY = "vexora:chats";
const SELECTED_KEY = "vexora:selected-chat";
const KEYS_KEY = "vexora:api-keys";
const ACTIVE_KEY_ID = "vexora:active-key";

// Fallback used by the previous single-key build; migrated on first load.
const LEGACY_SETTINGS_KEY = "vexora:settings";
const LEGACY_KEYS = {
  chats: "deepseek-clone:chats",
  selected: "deepseek-clone:selected-chat",
  settings: "deepseek-clone:settings",
};
const LEGACY_API_KEYS = ["deepseek-clone:api-key", "vexora:api-key"];

const readStored = (key, legacyKey) => {
  try {
    const current = localStorage.getItem(key);
    if (current !== null) return current;

    if (legacyKey) {
      const legacy = localStorage.getItem(legacyKey);
      if (legacy !== null) {
        localStorage.setItem(key, legacy);
        localStorage.removeItem(legacyKey);
        return legacy;
      }
    }
  } catch {
    // Ignore storage errors.
  }
  return null;
};

export const AppContext = createContext(null);

export const useAppContext = () => useContext(AppContext);

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createChat = () => ({
  id: uid(),
  name: "New Chat",
  messages: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

// Keeps older/renamed fields working and gives every message a stable id.
const normalizeChat = (chat) => ({
  ...chat,
  id: chat.id || chat._id || uid(),
  name: chat.name || "New Chat",
  createdAt: chat.createdAt || Date.now(),
  updatedAt: chat.updatedAt || Date.now(),
  messages: (chat.messages || []).map((message) => ({
    ...message,
    id: message.id || uid(),
  })),
});

const normalizeKey = (key = {}) => {
  const provider = getProvider(key.provider);
  const model =
    typeof key.model === "string" && key.model.trim()
      ? key.model.trim()
      : "";

  return {
    id: key.id || uid(),
    provider: provider.id,
    label: (key.label || provider.name).trim() || provider.name,
    apiKey: typeof key.apiKey === "string" ? key.apiKey : "",
    // Drop models the provider no longer serves so the chat asks for a
    // replacement instead of failing on every request.
    model: isUnavailableModel(provider.id, model) ? "" : model,
    endpoint: typeof key.endpoint === "string" ? key.endpoint : "",
    createdAt: key.createdAt || Date.now(),
  };
};

export const AppContextProvider = ({ children }) => {
  const [chats, setChats] = useState([]);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [keys, setKeys] = useState([]);
  const [activeKeyId, setActiveKeyId] = useState(null);
  const [ready, setReady] = useState(false);

  // Load everything from this browser once, on mount.
  useEffect(() => {
    let storedChats = [];
    try {
      const raw = readStored(CHATS_KEY, LEGACY_KEYS.chats);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) storedChats = parsed.map(normalizeChat);
      }
    } catch {
      storedChats = [];
    }

    if (storedChats.length === 0) storedChats = [createChat()];

    // Write immediately so a dev-mode double mount cannot create a second chat.
    try {
      localStorage.setItem(CHATS_KEY, JSON.stringify(storedChats));
    } catch {
      // Ignore storage errors.
    }

    setChats(storedChats);

    // Drop the very old single API key entries from earlier builds.
    try {
      LEGACY_API_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch {
      // Ignore storage errors.
    }

    let storedKeys = [];
    try {
      const rawKeys = localStorage.getItem(KEYS_KEY);
      if (rawKeys) {
        const parsed = JSON.parse(rawKeys);
        if (Array.isArray(parsed)) storedKeys = parsed.map(normalizeKey);
      }
    } catch {
      storedKeys = [];
    }

    storedKeys = storedKeys.filter((key) => key.apiKey.trim());

    // Migrate the previous single Groq key + model into the key dashboard.
    if (storedKeys.length === 0) {
      try {
        const rawSettings = readStored(
          LEGACY_SETTINGS_KEY,
          LEGACY_KEYS.settings
        );
        if (rawSettings) {
          const old = JSON.parse(rawSettings);
          if (old?.apiKey?.trim()) {
            storedKeys = [
              normalizeKey({
                provider: "groq",
                label: "Groq",
                apiKey: old.apiKey,
                model: old.model,
              }),
            ];
          }
        }
        localStorage.removeItem(LEGACY_SETTINGS_KEY);
        localStorage.removeItem(LEGACY_KEYS.settings);
      } catch {
        // Ignore malformed legacy settings.
      }
    }

    setKeys(storedKeys);

    // Write immediately so migrations survive a dev-mode double mount.
    try {
      localStorage.setItem(KEYS_KEY, JSON.stringify(storedKeys));
    } catch {
      // Ignore storage errors.
    }

    let storedActive = null;
    try {
      storedActive = localStorage.getItem(ACTIVE_KEY_ID);
    } catch {
      storedActive = null;
    }
    setActiveKeyId(
      storedKeys.some((key) => key.id === storedActive)
        ? storedActive
        : (storedKeys[0]?.id ?? null)
    );

    const storedSelected = readStored(SELECTED_KEY, LEGACY_KEYS.selected);
    const selectedExists = storedChats.some(
      (chat) => chat.id === storedSelected
    );
    setSelectedChatId(selectedExists ? storedSelected : storedChats[0].id);
    setReady(true);
  }, []);

  // Persist chats to localStorage on every change.
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
    } catch {
      // Storage can be full or disabled (private mode); keep the UI usable.
    }
  }, [chats, ready]);

  useEffect(() => {
    if (!ready || !selectedChatId) return;
    try {
      localStorage.setItem(SELECTED_KEY, selectedChatId);
    } catch {
      // Ignore storage errors.
    }
  }, [selectedChatId, ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEYS_KEY, JSON.stringify(keys));
    } catch {
      // Ignore storage errors.
    }
  }, [keys, ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      if (activeKeyId) localStorage.setItem(ACTIVE_KEY_ID, activeKeyId);
      else localStorage.removeItem(ACTIVE_KEY_ID);
    } catch {
      // Ignore storage errors.
    }
  }, [activeKeyId, ready]);

  // Keep the active key pointing at a key that still exists.
  useEffect(() => {
    if (!ready) return;
    if (keys.length === 0) {
      if (activeKeyId !== null) setActiveKeyId(null);
      return;
    }
    if (!keys.some((key) => key.id === activeKeyId)) {
      setActiveKeyId(keys[0].id);
    }
  }, [keys, activeKeyId, ready]);

  const addKey = useCallback((input) => {
    const key = normalizeKey(input);
    setKeys((prev) => [...prev, key]);
    setActiveKeyId((prev) => prev ?? key.id);
    return key;
  }, []);

  const updateKey = useCallback((id, patch) => {
    setKeys((prev) =>
      prev.map((key) =>
        key.id === id ? normalizeKey({ ...key, ...patch, id }) : key
      )
    );
  }, []);

  const deleteKey = useCallback((id) => {
    setKeys((prev) => prev.filter((key) => key.id !== id));
    setActiveKeyId((prev) => (prev === id ? null : prev));
  }, []);

  const setActiveKey = useCallback((id) => {
    setActiveKeyId(id);
  }, []);

  const selectChat = useCallback((id) => {
    setSelectedChatId(id);
  }, []);

  const updateChat = useCallback((id, updater) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === id
          ? { ...updater(chat), updatedAt: Date.now() }
          : chat
      )
    );
  }, []);

  const createNewChat = useCallback(() => {
    const chat = createChat();
    setChats((prev) => [chat, ...prev]);
    setSelectedChatId(chat.id);
    return chat;
  }, []);

  const appendMessage = useCallback(
    (chatId, message) => {
      const nextMessage = {
        ...message,
        id: message.id || uid(),
        timestamp: message.timestamp || Date.now(),
      };
      updateChat(chatId, (chat) => ({
        ...chat,
        messages: [...chat.messages, nextMessage],
      }));
      return nextMessage;
    },
    [updateChat]
  );

  const renameChat = useCallback(
    (id, name) => {
      const trimmed = (name || "").trim();
      if (!trimmed) return false;
      updateChat(id, (chat) => ({ ...chat, name: trimmed }));
      return true;
    },
    [updateChat]
  );

  const deleteChat = useCallback(
    (id) => {
      const remaining = chats.filter((chat) => chat.id !== id);
      const nextChats = remaining.length > 0 ? remaining : [createChat()];
      setChats(nextChats);
      if (selectedChatId === id) {
        setSelectedChatId(nextChats[0].id);
      }
    },
    [chats, selectedChatId]
  );

  const selectedChat =
    chats.find((chat) => chat.id === selectedChatId) || chats[0] || null;
  const activeKey =
    keys.find((key) => key.id === activeKeyId) || keys[0] || null;

  const value = {
    chats,
    selectedChat,
    selectChat,
    createNewChat,
    appendMessage,
    updateChat,
    renameChat,
    deleteChat,
    keys,
    activeKey,
    activeKeyId,
    addKey,
    updateKey,
    deleteKey,
    setActiveKey,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
