import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "../../../lib/utils"

/**
 * A bank account rendered with the visual language of a payment card: a dark
 * slab with two blurred colour rings behind it.
 *
 * The flip is not decoration. The front masks the account number the way a
 * statement would, and the back reveals it — so the gesture matches what a
 * physical card's back is for, instead of borrowing the animation and putting
 * something arbitrary on it.
 *
 * Copy is a prop. This package is shared by every app in the monorepo and by
 * apps the CLI generates, so it must not hardcode one product's language.
 */

const bankAccountCardVariants = cva(
  "relative w-full overflow-hidden rounded-2xl p-6 text-white shadow-lg transition-transform [backface-visibility:hidden]",
  {
    variants: {
      size: {
        default: "aspect-[16/10] max-w-md",
        compact: "aspect-[16/9] max-w-xs p-4 text-sm",
      },
    },
    defaultVariants: { size: "default" },
  },
)

export type BankAccountType = "checking" | "savings"

export interface BankAccountCardLabels {
  accountHolder: string
  accountType: string
  checking: string
  savings: string
  /** Accessible name for the control that flips the card. */
  reveal: string
  hide: string
}

const DEFAULT_LABELS: BankAccountCardLabels = {
  accountHolder: "Account holder",
  accountType: "Account type",
  checking: "Checking",
  savings: "Savings",
  reveal: "Reveal full account number",
  hide: "Hide account number",
}

export interface BankAccountCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onToggle">,
    VariantProps<typeof bankAccountCardVariants> {
  bankName: string
  accountNumber: string
  accountHolder: string
  accountType: BankAccountType
  /** Overrides the built-in English strings. */
  labels?: Partial<BankAccountCardLabels>
  /** Digits left visible when masked. */
  visibleDigits?: number
  /** Set false for a card that never reveals the full number. */
  revealable?: boolean
  /** Accent rings. Default to theme tokens so the card follows the palette. */
  ringFrom?: string
  ringTo?: string
}

function maskAccountNumber(value: string, visibleDigits: number): string {
  const trimmed = value.trim()
  if (trimmed.length <= visibleDigits) return trimmed
  return `•••• ${trimmed.slice(-visibleDigits)}`
}

const BankAccountCard = React.forwardRef<HTMLDivElement, BankAccountCardProps>(
  (
    {
      bankName,
      accountNumber,
      accountHolder,
      accountType,
      labels,
      visibleDigits = 4,
      revealable = true,
      ringFrom = "var(--primary)",
      ringTo = "var(--accent)",
      size,
      className,
      ...props
    },
    ref,
  ) => {
    const [revealed, setRevealed] = React.useState(false)
    const text = { ...DEFAULT_LABELS, ...labels }
    const typeLabel = accountType === "checking" ? text.checking : text.savings

    return (
      <div
        ref={ref}
        className={cn("[perspective:1000px]", className)}
        {...props}
      >
        <div
          className={cn(
            "relative transition-transform duration-700 [transform-style:preserve-3d]",
            revealed && "[transform:rotateY(180deg)]",
          )}
        >
          {/* Front */}
          <div
            className={cn(
              bankAccountCardVariants({ size }),
              "bg-gradient-to-br from-slate-700 to-slate-950",
            )}
          >
            <Rings from={ringFrom} to={ringTo} />

            <div className="relative z-10 flex h-full flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold">{bankName}</span>
                <span className="bg-white/15 rounded-full px-2 py-0.5 text-xs font-medium">
                  {typeLabel}
                </span>
              </div>

              {/* tabular-nums keeps the digits from shifting when they change */}
              <div className="font-mono text-xl tabular-nums tracking-widest">
                {maskAccountNumber(accountNumber, visibleDigits)}
              </div>

              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase opacity-70">
                  {text.accountHolder}
                </div>
                {/* Holders are long and arbitrary — truncate rather than let
                    the name push the card wider than its container. */}
                <div className="truncate uppercase" title={accountHolder}>
                  {accountHolder}
                </div>
              </div>
            </div>
          </div>

          {/* Back */}
          <div
            className={cn(
              bankAccountCardVariants({ size }),
              "absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950 [transform:rotateY(180deg)]",
            )}
            aria-hidden={!revealed}
          >
            <Rings from={ringTo} to={ringFrom} />

            <div className="relative z-10 flex h-full flex-col justify-center gap-2">
              <div className="text-xs font-semibold uppercase opacity-70">
                {bankName} · {typeLabel}
              </div>
              <div className="font-mono text-lg tabular-nums break-all">
                {accountNumber}
              </div>
            </div>
          </div>
        </div>

        {revealable && (
          <button
            type="button"
            onClick={() => {
              setRevealed((current) => !current)
            }}
            className="text-muted-foreground hover:text-foreground mt-2 text-xs underline underline-offset-4"
          >
            {revealed ? text.hide : text.reveal}
          </button>
        )}
      </div>
    )
  },
)
BankAccountCard.displayName = "BankAccountCard"

/** The two blurred accent circles behind the card face. */
function Rings({ from, to }: { from: string; to: string }): React.JSX.Element {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute -left-[17%] -top-12 size-72 rounded-full border-[16px] opacity-60 blur-xl"
        style={{ borderColor: from }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-48 top-1/2 size-72 rounded-full border-[16px] opacity-60 blur-xl"
        style={{ borderColor: to }}
      />
    </>
  )
}

export { BankAccountCard, bankAccountCardVariants }
