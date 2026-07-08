import { Card } from '@core/ui';
import type { ReactNode, ComponentProps } from 'react';

interface GlowCardProps extends ComponentProps<typeof Card> {
  children: ReactNode;
  glowColor?: 'pink' | 'orange' | 'purple' | 'cyan';
}

const glowMap = {
  pink: 'var(--shadow-glow-pink)',
  orange: 'var(--shadow-glow-orange)',
  purple: '0 0 30px rgba(88, 28, 135, 0.2)',
  cyan: '0 0 30px rgba(6, 182, 212, 0.15)',
};

export function GlowCard({ children, glowColor = 'pink', className = '', ...props }: GlowCardProps) {
  return (
    <Card
      className={`gradient-card transition-shadow ${className}`}
      style={{
        boxShadow: glowMap[glowColor],
        transition: `box-shadow var(--duration-normal) var(--ease-out-expo)`,
      }}
      {...props}
    >
      {children}
    </Card>
  );
}
