import { assets } from "@/assets/assets";
import ModelPicker from "@/components/ModelPicker";
import {
  describeProviderError,
  getKeyEndpoint,
  getKeyModel,
  getModelSampling,
  getProvider,
  isTransientProviderError,
  isUnavailableModel,
} from "@/config/providers";
import { needsLanguageRetry, needsUsefulReply, withLanguageRule } from "@/config/language";
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
  const sampling = getModelSampling(model);

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
    let reader = null;
    let displayed = "";

    // Show the assistant bubble immediately and grow it as tokens arrive, so
    // slow reasoning models still feel responsive.
    const ensureAssistantBubble = () => {
      if (assistantId) return assistantId;
      const assistant = appendMessage(chat.id, {
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      });
      assistantId = assistant.id;
      return assistantId;
    };

    const setAssistantText = (content) => {
      displayed = content;
      updateChat(chat.id, (current) => ({
        ...current,
        messages: current.messages.map((message) =>
          message.id === assistantId ? { ...message, content } : message
        ),
      }));
    };

    // One streaming request. Kept separate so an answer in the wrong language,
    // or a transient provider failure, can be retried without duplicating the
    // fetch/stream handling.
    const streamOnce = async (requestMessages) => {
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
          messages: requestMessages,
          stream: true,
          ...sampling,
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
        // Only a genuinely missing model needs a new model. Provider hints
        // also mention "model", so match the upstream wording instead of the
        // word itself.
        const modelMissing =
          response.status === 404 ||
          /no endpoints? found|model (?:not found|does not exist|is not available|is unavailable)|not a valid model|unknown model/i.test(
            message
          );
        if (modelMissing) {
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

        const error = new Error(message);
        error.transient = isTransientProviderError(
          response.status,
          errorBody
        );
        throw error;
      }

      ensureAssistantBubble();

      let streamed = "";
      let reasoned = "";
      let finishReason = "";
      const addDelta = (text) => {
        if (!text) return;
        streamed += text;
        setAssistantText(streamed);
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

        const choice = event.choices?.[0];
        // OpenRouter puts mid-stream provider errors at the top level, but
        // some providers attach them to the choice instead.
        const streamError = event.error || choice?.error;
        if (streamError) {
          const error = new Error(
            describeProviderError(
              provider.id,
              streamError.code || event.code || 500,
              event
            )
          );
          error.transient = isTransientProviderError(
            streamError.code || 500,
            event
          );
          throw error;
        }

        if (choice?.finish_reason) finishReason = choice.finish_reason;
        const delta = choice?.delta;
        if (typeof delta?.content === "string") addDelta(delta.content);
        if (typeof delta?.reasoning === "string") reasoned += delta.reasoning;
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
        // OpenRouter also answers 200 with an error body when the upstream
        // provider fails after the headers were sent.
        const data = await response.json().catch(() => null);
        const providerError =
          data?.error || data?.choices?.[0]?.error || null;

        if (providerError) {
          const status = providerError.code || response.status;
          const error = new Error(
            describeProviderError(provider.id, status, data)
          );
          error.transient = isTransientProviderError(status, data);
          throw error;
        }

        const choice = data?.choices?.[0];
        addDelta(
          choice?.message?.content || choice?.message?.refusal || ""
        );
      }

      if (!streamed.trim()) {
        if (reasoned.trim() || finishReason === "length") {
          throw new Error(
            `${provider.name} spent its whole output budget on reasoning before writing an answer. Pick another model.`
          );
        }

        const error = new Error(
          `${provider.name} returned an empty response. The provider may still be warming up.`
        );
        error.transient = true;
        throw error;
      }

      return streamed;
    };

    // Providers occasionally fail on the first request (cold start, overload,
    // a flaky upstream). Retry those once before showing an error.
    let transientRetried = false;
    const runCompletion = async (requestMessages) => {
      try {
        return await streamOnce(requestMessages);
      } catch (error) {
        if (!error.transient || transientRetried) throw error;
        transientRetried = true;
        reader = null;
        setAssistantText("");
        await new Promise((resolve) => setTimeout(resolve, 700));
        return await streamOnce(requestMessages);
      }
    };

    try {
      const history = [...chat.messages, userPrompt]
        .filter(
          (message) =>
            message.content &&
            (message.role === "user" || message.role === "assistant")
        )
        .slice(-20)
        .map(({ role, content }) => ({ role, content }));

      const reply = await runCompletion(withLanguageRule(history, text));

      // Arabic-first models such as Groq's allam-2-7b can ignore the system
      // rule, and small models sometimes just echo the user's words. Retry
      // once with the rule repeated instead of showing that as the answer.
      if (needsLanguageRetry(text, reply) || needsUsefulReply(text, reply)) {
        reader = null;
        setAssistantText("");
        await runCompletion(withLanguageRule(history, text, true));
      }
    } catch (error) {
      if (reader) reader.cancel().catch(() => {});
      if (assistantId && !displayed.trim()) {
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
