// ============================================================
// Shared TypeScript interfaces for InstaMetrics Landing Page
// ============================================================

// --- Icon ---
export interface IconProps {
  size?: number;
  className?: string;
  'aria-hidden'?: boolean;
}

// --- Logo ---
export interface LogoProps {
  idPrefix: string;
  className?: string;
  size?: number;
}

// --- BrandButton ---
export type ButtonVariant = 'primary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface BrandButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  'aria-label'?: string;
  type?: 'button' | 'submit' | 'reset';
}

// --- Eyebrow ---
export type EyebrowVariant = 'default' | 'beam' | 'danger' | 'warn' | 'success' | 'accent' | 'mono';

export type EyebrowDisplay = 'beam' | 'dot';

export interface EyebrowProps {
  children: React.ReactNode;
  variant?: EyebrowVariant;
  display?: EyebrowDisplay;
  className?: string;
}

// --- SectionHead ---
export interface SectionHeadProps {
  eyebrow?: React.ReactNode;
  eyebrowVariant?: EyebrowVariant;
  eyebrowDisplay?: EyebrowDisplay;
  heading: React.ReactNode;
  lead?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
}

// --- PulseDot ---
export type PulseDotColor = 'default' | 'blue' | 'accent' | 'success' | 'danger' | 'warn';

export interface PulseDotProps {
  color?: PulseDotColor;
  className?: string;
}

// --- KpiCard ---
export interface KpiData {
  label: string;
  value: string;
  delta: string;
  deltaUp: boolean;
  highlight?: boolean;
}

export interface KpiCardProps {
  data: KpiData;
  className?: string;
}

// --- StarRating ---
export interface StarRatingProps {
  rating?: number;
  max?: number;
  className?: string;
}

// --- AccentItalic ---
export interface AccentItalicProps {
  children: React.ReactNode;
  className?: string;
}

// --- Pricing ---
export interface PricingAmount {
  free: string;
  pro: string;
  business: string;
  agency: string;
}

// --- Social Proof ---
export interface SocialProofStat {
  label: string;
  value: string;
}

// --- Instagram KPI (dashboard mockup) ---
export interface InstagramKpi {
  label: string;
  value: string;
  change: string;
  positive: boolean;
}

// --- Locale ---
export type Locale = 'es' | 'en' | 'pt';
