import { assets } from "@/assets/assets";
import {
  getKeyEndpoint,
  getKeyModel,
  getProvider,
} from "@/config/providers";
import { useAppContext } from "@/context/AppContext";
import Image from "next/image";
import Link from "next/link";
import React, { useState } from "react";
import toast from "react-hot-toast";

const PromptBox = ({ isLoading, setIsLoading }) => {
  const [prompt, setPrompt] = useState("");
  const {
    activeKey,
    selectedChat,
    createNewChat,
    appendMessage,
    renameChat,
  } = useAppContext();

  const provider = activeKey ? getProvider(activeKey.provider) : null;
  const model = getKeyModel(activeKey);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendPrompt(e);
    }
  };

  const sendPrompt = async (e) => {
    e.preventDefault();

    const text = prompt.trim();
    if (!text) return;
    if (isLoading) {
      return toast.error("Wait for the previous prompt response");
    }
    if (!activeKey || !activeKey.apiKey.trim()) {
      return toast.error("Add a free API key in the dashboard first");
    }

    const endpoint = getKeyEndpoint(activeKey);
    if (!endpoint) {
      return toast.error("This API key has no endpoint. Edit it in the dashboard.");
    }

    setIsLoading(true);
    setPrompt("");

    // Every conversation lives in this browser; create one on first use.
    const chat = selectedChat || createNewChat();
    const userPrompt = {
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    appendMessage(chat.id, userPrompt);

    if (chat.name === "New Chat") {
      renameChat(chat.id, text.length > 40 ? `${text.slice(0, 40)}…` : text);
    }

    try {
      const history = [...chat.messages, userPrompt]
        .filter(
          (message) =>
            message.content &&
            (message.role === "user" || message.role === "assistant")
        )
        .slice(-20)
        .map(({ role, content }) => ({ role, content }));

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${activeKey.apiKey.trim()}`,
      };
      if (provider.id === "openrouter" && typeof window !== "undefined") {
        headers["HTTP-Referer"] = window.location.origin;
        headers["X-Title"] = "Vexora";
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: history,
          stream: false,
        }),
      });

      if (!response.ok) {
        let detail = "";
        try {
          const errorBody = await response.json();
          detail = errorBody.error?.message || errorBody.message || "";
        } catch {
          // Response body was not JSON.
        }

        const message =
          detail || `${provider.name} request failed (${response.status})`;
        if (response.status === 401 || response.status === 403) {
          throw new Error(
            `${message} Check the key in the API keys dashboard.`
          );
        }
        if (response.status === 404 || /model/i.test(message)) {
          throw new Error(
            `${message} Open the API keys dashboard and use "Load models" to pick an available model.`
          );
        }
        throw new Error(message);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new Error(`${provider.name} returned an empty response`);
      }

      appendMessage(chat.id, {
        role: "assistant",
        content,
        timestamp: Date.now(),
      });
    } catch (error) {
      toast.error(
        error.message || `Could not reach ${provider?.name || "the provider"}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={sendPrompt}
      className={`w-full ${
        selectedChat?.messages?.length > 0 ? "max-w-3xl" : "max-w-2xl"
      } bg-[#404045] p-4 rounded-3xl mt-4 transition-all`}
    >
      <textarea
        onKeyDown={handleKeyDown}
        className="outline-none w-full resize-none overflow-hidden break-words bg-transparent"
        rows={2}
        placeholder="Message Vexora"
        onChange={(e) => setPrompt(e.target.value)}
        value={prompt}
      />

      <div className="flex items-center justify-between gap-3 text-sm">
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-1.5 text-xs text-white/40 transition hover:text-white/70"
        >
          {activeKey ? (
            <>
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: provider.accent }}
              />
              <span className="truncate">
                {provider.name} · {model}
              </span>
            </>
          ) : (
            <span className="truncate text-amber-300/70">
              No API key — add one in the dashboard
            </span>
          )}
        </Link>

        <button
          className={`${prompt ? "bg-primary" : "bg-[#71717a]"} shrink-0 rounded-full p-2 cursor-pointer`}
        >
          <Image
            className="w-3.5 aspect-square"
            src={prompt ? assets.arrow_icon : assets.arrow_icon_dull}
            alt={prompt ? "arrow icon" : "arrow icon dull"}
          />
        </button>
      </div>
    </form>
  );
};

export default PromptBox;
