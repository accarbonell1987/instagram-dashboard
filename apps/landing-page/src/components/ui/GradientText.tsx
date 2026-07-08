import type { ReactNode } from 'react';

interface GradientTextProps {
  children: ReactNode;
  className?: string;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p';
}

export function GradientText({ children, className = '', as: Tag = 'span' }: GradientTextProps) {
  return (
    <Tag
      className={`gradient-text ${className}`}
      style={{
        backgroundSize: '200% 200%',
        animation: 'gradient-shift 4s ease infinite',
      }}
    >
      {children}
    </Tag>
  );
}
