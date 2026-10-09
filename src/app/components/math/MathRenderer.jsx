"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import "katex/dist/katex.min.css";

export default function MathRenderer({ text, className = "" }) {
  if (!text) return null;
  // Ensure text is string
  const content = String(text);
  return (
    <div className={`math-renderer break-words ${className}`} dir="ltr">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={{
          p: ({ children }) => <span className="inline">{children}</span>,
          // Keep math inline
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// Helper to check if text contains math delimiters for fallback
export function hasMath(text) {
  if (!text) return false;
  return /\$.*\$|\\frac|\\sqrt|\\pi|\\theta|\\alpha|\\beta/.test(text);
}
