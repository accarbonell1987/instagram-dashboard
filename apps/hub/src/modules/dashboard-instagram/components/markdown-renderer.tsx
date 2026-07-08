'use client';

import type { JSX } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

import { Separator } from '@core/ui';

// ─── Shared style tokens ──────────────────────────────────────────────────────

const headingBase = 'font-semibold text-foreground leading-snug';
const headingStyles: Record<string, string> = {
  h1: `${headingBase} text-lg mt-3 mb-1 first:mt-0`,
  h2: `${headingBase} text-base mt-3 mb-1 first:mt-0`,
  h3: `${headingBase} text-sm mt-2 mb-1 first:mt-0`,
  h4: `${headingBase} text-xs mt-2 mb-0.5 first:mt-0`,
};

// ─── Component ────────────────────────────────────────────────────────────────

interface MarkdownRendererProps {
  content: string;
}

/**
 * Renders Markdown safely in chat messages.
 *
 * Security: uses rehype-sanitize to strip dangerous HTML.
 * Streaming: react-markdown handles partial/incomplete Markdown gracefully — it
 * renders whatever fragment is parseable without throwing.
 */
export function MarkdownRenderer({ content }: MarkdownRendererProps): JSX.Element {
  return (
    <div
      className={
        `space-y-1.5 text-sm leading-relaxed ` +
        // Prose-like spacing for block elements
        `[&_p:not(:last-child)]:mb-1 [&_p]:leading-relaxed` +
        // Lists
        `[&_ol]:ml-4 [&_ol]:list-decimal [&_ul]:ml-4 [&_ul]:list-disc` +
        `[&_ol]:list-outside [&_ul]:list-outside` +
        `[&_li]:mt-0.5` +
        // Bold / italic
        `[&_strong]:text-foreground [&_strong]:font-semibold` +
        // Inline code
        `[&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5` +
        `[&_code]:font-mono [&_code]:text-xs` +
        // Code blocks
        `[&_pre]:rounded-md [&_pre]:bg-zinc-900 [&_pre]:p-3` +
        `[&_pre]:overflow-x-auto [&_pre]:text-xs [&_pre]:text-zinc-100` +
        `[&_pre]:font-mono [&_pre]:leading-relaxed` +
        `[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-xs [&_pre_code]:text-zinc-100` +
        // Blockquotes
        `[&_blockquote]:border-muted-foreground/30 [&_blockquote]:border-l-2` +
        `[&_blockquote]:text-muted-foreground [&_blockquote]:pl-3 [&_blockquote]:italic` +
        // Tables
        `[&_table]:w-full [&_table]:text-left [&_table]:text-xs` +
        `[&_thead]:border-border [&_thead]:border-b` +
        `[&_th]:text-muted-foreground [&_th]:px-2 [&_th]:py-1 [&_th]:font-medium` +
        `[&_td]:border-border/50 [&_td]:border-t [&_td]:px-2 [&_td]:py-1` +
        // Links
        `[&_a]:text-primary [&_a]:decoration-primary/40 [&_a]:underline` +
        `[&_a]:hover:decoration-primary`
      }
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          h1: ({ children, ...props }) => (
            <h1 className={headingStyles['h1']} {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className={headingStyles['h2']} {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className={headingStyles['h3']} {...props}>
              {children}
            </h3>
          ),
          h4: ({ children, ...props }) => (
            <h4 className={headingStyles['h4']} {...props}>
              {children}
            </h4>
          ),
          a: ({ href, children, ...props }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
              {children}
            </a>
          ),
          hr: () => <Separator className="my-2" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
