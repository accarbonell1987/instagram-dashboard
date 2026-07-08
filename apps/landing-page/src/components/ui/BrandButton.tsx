import { Button } from "@core/ui";
import { cn } from "@core/ui/lib";
import type { BrandButtonProps } from "@/lib/types";

const variantClasses: Record<string, string> = {
  primary:
    "bg-[--color-accent] text-white hover:brightness-110 border border-transparent shadow-[0_2px_8px_-2px_rgba(225,48,108,0.3)] focus-visible:outline-[--color-accent]",
  ghost:
    "bg-surface border border-border-default text-text-default hover:bg-surface-hi",
};

const sizeClasses: Record<string, string> = {
  sm: "h-8 text-sm px-4",
  md: "h-10 text-sm px-5",
  lg: "h-12 text-[15px] px-7",
};

export function BrandButton({
  variant = "primary",
  size = "md",
  href,
  children,
  className,
  type = "button",
  "aria-label": ariaLabel,
  ...rest
}: BrandButtonProps & Record<string, unknown>) {
  const classes = cn(
    "font-display font-medium rounded-btn transition-all duration-200 active:scale-[0.97]",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );

  if (href) {
    return (
      <Button variant="ghost" size="default" asChild className={classes}>
        <a href={href} aria-label={ariaLabel} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
          {children}
        </a>
      </Button>
    );
  }

  return (
    <Button
      type={type}
      variant="ghost"
      size="default"
      className={classes}
      aria-label={ariaLabel}
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </Button>
  );
}
