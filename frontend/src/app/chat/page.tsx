"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "@/components/chat/message-bubble";
import { RecommendationCard, type RecommendationData } from "@/components/chat/recommendation-card";
import { useWebSocket } from "@/hooks/use-websocket";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
  recommendation?: RecommendationData;
}

const suggestedPrompts = [
  "Analyze my portfolio",
  "Should I buy WEGE3?",
  "Compare PETR4 vs VALE3",
  "My CDB matures next month, where should I reinvest?",
  "How's my allocation balance?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onWsMessage = useCallback((data: unknown) => {
    const msg = data as {
      role?: string;
      content?: string;
      recommendation?: RecommendationData;
    };
    setIsThinking(false);
    if (msg.role === "error") {
      toast.error(msg.content ?? "Chat error");
      return;
    }
    if (typeof msg.content !== "string") return;
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "agent",
        content: msg.content!,
        timestamp: new Date().toLocaleTimeString(),
        recommendation: msg.recommendation,
      },
    ]);
  }, []);

  const { isConnected, sendMessage } = useWebSocket({
    url: "/ws/chat",
    onMessage: onWsMessage,
  });

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText) return;
    if (!isConnected) {
      toast.error("Not connected to chat server. Wait for the green indicator or refresh the page.");
      return;
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageText,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsThinking(true);

    // Send current message with full conversation history
    const history = messages.map((m) => ({
      role: m.role === "agent" ? "assistant" : "user",
      content: m.content,
    }));
    sendMessage({ message: messageText, history });

    // Re-focus after send
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleClear = () => {
    setMessages([]);
    setIsThinking(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col md:h-[calc(100vh-3rem)]">
      {/* Chat header */}
      <div className="flex items-center justify-between border-b border-glass-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-text-primary">AI Investment Assistant</h2>
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
              isConnected
                ? "bg-profit/10 text-profit"
                : "bg-amber-500/10 text-amber-400"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                isConnected ? "bg-profit animate-none" : "bg-amber-400 animate-pulse"
              )}
            />
            {isConnected ? "Connected" : "Reconnecting…"}
          </span>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-text-muted transition-colors hover:bg-glass-hover hover:text-text-secondary"
            title="Clear chat"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-2 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-6">
            <div className="text-center">
              <p className="mt-2 text-sm text-text-muted">
                Ask me about your portfolio, get recommendations, or analyze assets
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestedPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  className="cursor-pointer rounded-full border border-glass-border bg-glass px-4 py-2 text-xs text-text-secondary backdrop-blur-md transition-colors hover:bg-glass-hover hover:text-text-primary"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto max-w-3xl space-y-4">
          <AnimatePresence>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                timestamp={msg.timestamp}
              >
                {msg.recommendation && (
                  <RecommendationCard data={msg.recommendation} />
                )}
              </MessageBubble>
            ))}
          </AnimatePresence>

          {isThinking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-text-muted"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Thinking...</span>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input bar */}
      <div className="border-t border-glass-border bg-glass/50 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              id="chat-message-input"
              name="message"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your investments..."
              className="w-full rounded-xl border border-glass-border bg-glass py-3 pl-4 pr-4 text-sm text-text-primary placeholder:text-text-muted backdrop-blur-md outline-none transition-all focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => handleSend()}
            disabled={!input.trim() || isThinking || !isConnected}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
