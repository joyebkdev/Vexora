import { assets } from "@/assets/assets";
import ModelPicker from "@/components/ModelPicker";
import {
  describeProviderError,
  getKeyEndpoint,
  getKeyModel,
  getProvider,
  isUnavailableModel,
} from "@/config/providers";
import { useAppContext } from "@/context/AppContext";
import Image from "next/image";
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
    updateChat,
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
    if (!model) {
      return toast.error("Choose a model below the chat box first.");
    }
    if (isUnavailableModel(activeKey.provider, model)) {
      return toast.error(
        "That model is no longer available. Pick another one below the chat box."
      );
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

    let assistantId = null;
    let streamed = "";
    let reader = null;

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
          stream: true,
        }),
      });

      if (!response.ok) {
        let errorBody = null;
        try {
          errorBody = await response.json();
        } catch {
          // Response body was not JSON.
        }

        const message = describeProviderError(
          provider.id,
          response.status,
          errorBody
        );
        if (response.status === 404 || /model/i.test(message)) {
          throw new Error(`${message} Pick another model below the chat box.`);
        }
        if (
          provider.id !== "gemini" &&
          (response.status === 401 || response.status === 403)
        ) {
          throw new Error(
            `${message} Check the key in the API keys dashboard.`
          );
        }
        throw new Error(message);
      }

      // Show the assistant bubble immediately and grow it as tokens arrive,
      // so slow reasoning models still feel responsive.
      const assistant = appendMessage(chat.id, {
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      });
      assistantId = assistant.id;

      const addDelta = (text) => {
        if (!text) return;
        streamed += text;
        updateChat(chat.id, (current) => ({
          ...current,
          messages: current.messages.map((message) =>
            message.id === assistantId
              ? { ...message, content: streamed }
              : message
          ),
        }));
      };

      const consumeLine = (rawLine) => {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) return;

        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") return;

        let event;
        try {
          event = JSON.parse(payload);
        } catch {
          return;
        }

        if (event.error) {
          throw new Error(
            describeProviderError(provider.id, event.error.code || 500, event)
          );
        }

        const delta = event.choices?.[0]?.delta?.content;
        if (typeof delta === "string") addDelta(delta);
      };

      const contentType = response.headers.get("content-type") || "";

      if (response.body && /text\/event-stream/i.test(contentType)) {
        reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() || "";
          lines.forEach(consumeLine);
        }

        buffer += decoder.decode();
        if (buffer.trim()) consumeLine(buffer);
      } else {
        // Some OpenAI-compatible endpoints ignore `stream` and return JSON.
        const data = await response.json();
        addDelta(data.choices?.[0]?.message?.content || "");
      }

      if (!streamed.trim()) {
        throw new Error(`${provider.name} returned an empty response`);
      }
    } catch (error) {
      if (reader) reader.cancel().catch(() => {});
      if (assistantId && !streamed.trim()) {
        updateChat(chat.id, (current) => ({
          ...current,
          messages: current.messages.filter(
            (message) => message.id !== assistantId
          ),
        }));
      }
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
        <ModelPicker />

        <button
          type="submit"
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
