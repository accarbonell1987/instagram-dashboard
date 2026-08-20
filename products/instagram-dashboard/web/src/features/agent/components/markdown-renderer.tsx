'use client';

import { Separator } from '@core/ui';
import type { JSX } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';


// ─── Shared style tokens ──────────────────────────────────────────────────────

const headingBase = 'font-semibold text-foreground leading-snug';
const headingStyles: Record<string, string> = {
  h1: `${headingBase} text-lg mt-4 mb-1.5 first:mt-0`,
  h2: `${headingBase} text-base mt-4 mb-1.5 first:mt-0`,
  h3: `${headingBase} text-sm mt-3 mb-1 first:mt-0`,
  h4: `${headingBase} text-xs mt-3 mb-0.5 first:mt-0`,
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
      className={[
        // Joined with spaces by the array, not by hoping each fragment ends in
        // one. Written as `'a' + 'b'` this list silently fused every boundary —
        // `[&_p]:leading-relaxed[&_ol]:ml-4` is one invalid class, not two, and
        // Tailwind emits nothing for it. Half these rules were never applied,
        // including the ones that keep wide content inside the bubble.
        'space-y-1.5 text-sm leading-relaxed',
        // Anything that cannot be wrapped is broken rather than allowed to push
        // the bubble open. This is the visible bug: a long reply ran past the
        // panel and the words were cut off by the edge.
        'min-w-0 break-words [overflow-wrap:anywhere]',
        // Blocks
        '[&_p:not(:last-child)]:mb-1 [&_p]:leading-relaxed',
        // Lists. The agent answers in numbered recommendations, so the markers
        // carry the structure — coloured, they anchor the eye down the list
        // instead of reading as punctuation.
        '[&_ol]:ml-4 [&_ol]:list-decimal [&_ol]:list-outside',
        '[&_ul]:ml-4 [&_ul]:list-disc [&_ul]:list-outside',
        '[&_ol]:marker:font-semibold [&_ol]:marker:text-primary',
        '[&_ul]:marker:text-primary',
        // Items here run two and three lines each; at mt-0.5 they ran together
        // into a wall.
        '[&_li]:mt-2 [&_li:first-child]:mt-0 [&_li]:pl-1',
        // Bold / italic
        '[&_strong]:text-foreground [&_strong]:font-semibold',
        // Inline code. `bg-muted` was invisible: the agent's bubble is
        // `bg-muted` too, so it tinted itself against its own background.
        // Tinting the foreground instead works on whatever the bubble is.
        '[&_code]:bg-foreground/10 [&_code]:text-foreground [&_code]:rounded',
        '[&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs',
        // Code blocks — scroll inside their own box; a long line must not widen
        // the message.
        '[&_pre]:rounded-md [&_pre]:bg-zinc-900 [&_pre]:p-3',
        '[&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:text-xs [&_pre]:text-zinc-100',
        '[&_pre]:font-mono [&_pre]:leading-relaxed',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-xs [&_pre_code]:text-zinc-100',
        // Blockquotes
        '[&_blockquote]:border-primary/40 [&_blockquote]:border-l-2',
        '[&_blockquote]:text-muted-foreground [&_blockquote]:pl-3 [&_blockquote]:italic',
        // Tables — same rule: scroll, never widen.
        '[&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:text-left [&_table]:text-xs',
        '[&_thead]:border-border [&_thead]:border-b',
        '[&_th]:text-muted-foreground [&_th]:px-2 [&_th]:py-1 [&_th]:font-medium',
        '[&_td]:border-border/50 [&_td]:border-t [&_td]:px-2 [&_td]:py-1',
        // Banding, because a dense table of numbers is read across the row.
        '[&_tbody_tr:nth-child(even)]:bg-foreground/[0.04]',
        // Links
        '[&_a]:text-primary [&_a]:decoration-primary/40 [&_a]:underline',
        '[&_a]:hover:decoration-primary',
      ].join(' ')}
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
