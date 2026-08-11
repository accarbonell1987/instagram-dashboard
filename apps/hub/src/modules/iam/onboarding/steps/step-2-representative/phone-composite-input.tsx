'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  cn,
} from '@core/ui';
import { type JSX, useState } from 'react';
import * as React from 'react';

import { LATAM_DIAL_CODES, PHONE_FORMATS, type DialCode, splitPhone } from './latam-dial-codes';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PhoneCompositeInputProps {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  error?: boolean;
  errorId?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PhoneCompositeInput({
  value,
  onChange,
  onBlur,
  error,
  errorId,
}: PhoneCompositeInputProps): JSX.Element {
  const [dialCode, setDialCode] = useState<DialCode>(() => splitPhone(value).dialCode);
  const [localNumber, setLocalNumber] = useState<string>(() =>
    splitPhone(value).localNumber.replace(/\D/g, '')
  );

  // The initialisers above only run on the first render, but `value` often
  // arrives later — the profile fetches it from /auth/me and the wizard loads
  // it from a saved draft. Without this the field stays empty even though the
  // form holds the number. Re-splitting on our own echo is a no-op, since
  // setting state to an identical value bails out.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    const split = splitPhone(value);
    setLastValue(value);
    setDialCode(split.dialCode);
    setLocalNumber(split.localNumber.replace(/\D/g, ''));
  }

  function assemble(newDialCode: DialCode, newLocalNumber: string): void {
    onChange(newDialCode + newLocalNumber.replace(/\D/g, ''));
  }

  const fmt = PHONE_FORMATS[dialCode];

  // Starting slot index for each group
  const groupOffsets = fmt.groups.reduce<number[]>((acc, _, i) => {
    acc.push(i === 0 ? 0 : (acc[i - 1] ?? 0) + (fmt.groups[i - 1] ?? 0));
    return acc;
  }, []);

  return (
    // min-w-0 is what keeps this inside its card. The number is drawn as one
    // box per digit, so its intrinsic width is fixed and large; a flex child
    // will not shrink below that without min-w-0, and the row spilled out of
    // the container instead of wrapping.
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
      {/* ── Country code ── */}
      <Select
        value={dialCode}
        onValueChange={(dc) => {
          const newDc = dc as DialCode;
          const newFmt = PHONE_FORMATS[newDc];
          const trimmed = localNumber.slice(0, newFmt.digits);
          setDialCode(newDc);
          setLocalNumber(trimmed);
          assemble(newDc, trimmed);
        }}
      >
        <SelectTrigger
          className={cn(
            'bg-background! w-30 shrink-0',
            error === true && 'ring-destructive/40 ring-2'
          )}
          aria-label="Código de país"
          aria-invalid={error}
          aria-describedby={errorId}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LATAM_DIAL_CODES.map(({ code, label }) => (
            <SelectItem key={code} value={code}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {/* ── Local number ── */}
      <InputOTP
        id="phone"
        maxLength={fmt.digits}
        value={localNumber}
        onChange={(val) => {
          setLocalNumber(val);
          assemble(dialCode, val);
        }}
        onBlur={onBlur}
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label="Número local"
        aria-invalid={error}
        aria-describedby={errorId}
        containerClassName={cn(
          // flex-wrap lets the digit groups drop to a second line on a narrow
          // card rather than pushing the row past its container.
          'min-w-0 flex-1 flex-wrap',
          error === true && 'ring-destructive/40 rounded-md ring-2'
        )}
      >
        {fmt.groups.map((groupSize, groupIndex) => (
          <React.Fragment key={groupIndex}>
            {/* {groupIndex > 0 && <InputOTPSeparator />} */}
            <InputOTPGroup>
              {Array.from({ length: groupSize }, (_, slotIndex) => (
                <InputOTPSlot key={slotIndex} index={(groupOffsets[groupIndex] ?? 0) + slotIndex} />
              ))}
            </InputOTPGroup>
          </React.Fragment>
        ))}
      </InputOTP>
    </div>
  );
}
