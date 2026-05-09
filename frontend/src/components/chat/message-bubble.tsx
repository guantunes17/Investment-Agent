"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  role: "user" | "agent";
  content: string;
  timestamp?: string;
  children?: ReactNode;
}

// Simple but complete markdown renderer — handles the most common agent output patterns.
function renderMarkdown(text: string): ReactNode {
  const lines = text.split("\n");
  const output: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      output.push(
        <pre
          key={i}
          className="my-2 overflow-x-auto rounded-lg bg-white/5 px-3 py-2 font-mono text-xs leading-relaxed"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      i++; // skip closing ```
      continue;
    }

    // H2 / H3 headers
    if (line.startsWith("### ")) {
      output.push(
        <p key={i} className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
          {inlineRender(line.slice(4))}
        </p>
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      output.push(
        <p key={i} className="mt-3 mb-1 text-sm font-bold text-text-primary">
          {inlineRender(line.slice(3))}
        </p>
      );
      i++;
      continue;
    }

    // Unordered list item
    if (/^[-*] /.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(
          <li key={i} className="ml-4 list-disc">
            {inlineRender(lines[i].slice(2))}
          </li>
        );
        i++;
      }
      output.push(<ul key={`ul-${i}`} className="my-1 space-y-0.5">{items}</ul>);
      continue;
    }

    // Ordered list item
    if (/^\d+\. /.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(
          <li key={i} className="ml-4 list-decimal">
            {inlineRender(lines[i].replace(/^\d+\. /, ""))}
          </li>
        );
        i++;
      }
      output.push(<ol key={`ol-${i}`} className="my-1 space-y-0.5">{items}</ol>);
      continue;
    }

    // Blank line — paragraph break
    if (line.trim() === "") {
      output.push(<div key={i} className="h-2" />);
      i++;
      continue;
    }

    // Regular paragraph
    output.push(
      <p key={i} className="leading-relaxed">
        {inlineRender(line)}
      </p>
    );
    i++;
  }

  return <>{output}</>;
}

// Inline formatting: bold, italic, inline code, links
function inlineRender(text: string): React.ReactNode {
  const pattern = /(\*\*.*?\*\*|\*.*?\*|`[^`]+`|\[.*?\]\(.*?\))/g;
  const parts = text.split(pattern);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={idx}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={idx} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">
          {part.slice(1, -1)}
        </code>
      );
    }
    // Markdown link [label](url)
    const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch) {
      return (
        <a
          key={idx}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline underline-offset-2 hover:opacity-80"
        >
          {linkMatch[1]}
        </a>
      );
    }
    return <span key={idx}>{part}</span>;
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
        <div className="prose-sm">{renderMarkdown(content)}</div>
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
