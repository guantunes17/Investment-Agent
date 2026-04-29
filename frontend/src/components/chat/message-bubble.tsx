"use client";

import { motion } from "framer-motion";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  role: "user" | "agent";
  content: string;
  timestamp?: string;
  children?: React.ReactNode;
}

function renderMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|\n- .*|\n\d+\. .*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("\n- ")) {
      return (
        <li key={i} className="ml-4 list-disc">
          {part.slice(3)}
        </li>
      );
    }
    if (/^\n\d+\. /.test(part)) {
      return (
        <li key={i} className="ml-4 list-decimal">
          {part.replace(/^\n\d+\. /, "")}
        </li>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function MessageBubble({ role, content, timestamp, children }: MessageBubbleProps) {
  const isAgent = role === "agent";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex gap-3", isAgent ? "justify-start" : "justify-end")}
    >
      {isAgent && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20">
          <Bot className="h-4 w-4 text-accent" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isAgent
            ? "rounded-tl-sm border border-glass-border bg-glass text-text-primary backdrop-blur-md"
            : "rounded-tr-sm bg-accent text-white"
        )}
      >
        <div className="whitespace-pre-wrap">{renderMarkdown(content)}</div>
        {children}
        {timestamp && (
          <p className={cn("mt-1.5 text-[10px]", isAgent ? "text-text-muted" : "text-white/60")}>
            {timestamp}
          </p>
        )}
      </div>
    </motion.div>
  );
}
