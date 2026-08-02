'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

interface AnimatedTextProps {
  text: string;
  className?: string;
  as?: 'p' | 'h1' | 'h2' | 'h3' | 'span';
}

export function AnimatedText({ text, className = '', as: Tag = 'p' }: AnimatedTextProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <Tag className={className}>{text}</Tag>;
  }

  const chars = text.split('');

  return (
    <Tag className={className} style={{ position: 'relative' }}>
      {/* Invisible placeholders for layout stability */}
      <span ref={ref} aria-hidden="true" style={{ visibility: 'hidden' }}>
        {text}
      </span>
      {/* Absolute animated characters */}
      <span aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
        <AnimatedChars chars={chars} containerRef={ref} />
      </span>
      {/* Screen reader accessible text */}
      <span className="sr-only">{text}</span>
    </Tag>
  );
}

function AnimatedChars({ chars, containerRef }: { chars: string[]; containerRef: React.RefObject<HTMLDivElement | null> }) {
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 0.8', 'end 0.3'],
  });

  return (
    <>
      {chars.map((char, i) => (
        <AnimatedChar
          key={i}
          char={char}
          progress={scrollYProgress}
          start={i / chars.length}
          end={(i + 1) / chars.length}
        />
      ))}
    </>
  );
}

function AnimatedChar({
  char,
  progress,
  start,
  end,
}: {
  char: string;
  progress: MotionValue<number>;
  start: number;
  end: number;
}) {
  const opacity = useTransform(progress, [start, end], [0.2, 1]);
  return <motion.span style={{ opacity }}>{char === ' ' ? '\u00A0' : char}</motion.span>;
}
