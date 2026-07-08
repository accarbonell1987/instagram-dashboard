"use client";
import { useScrollReveal } from "@/hooks/useScrollReveal";

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "aside" | "li" | "span" | "p";
  delay?: number; // stagger delay in ms
}

export function ScrollReveal({
  children,
  className = "",
  as: Tag = "div",
  delay,
}: ScrollRevealProps) {
  const ref = useScrollReveal<HTMLDivElement>();
  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={`reveal ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
