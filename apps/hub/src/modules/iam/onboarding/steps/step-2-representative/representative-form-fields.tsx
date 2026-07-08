'use client';

import { Label, Input, cn } from '@core/ui';
import { type JSX } from 'react';
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import { Controller } from 'react-hook-form';

import { PhoneCompositeInput } from './phone-composite-input';
import type { RepresentativeFields } from './representative-schema';

// ─── Props ────────────────────────────────────────────────────────────────────

interface RepresentativeFormFieldsProps {
  register: UseFormRegister<RepresentativeFields>;
  control: Control<RepresentativeFields>;
  errors: FieldErrors<RepresentativeFields>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RepresentativeFormFields({
  register,
  control,
  errors,
}: RepresentativeFormFieldsProps): JSX.Element {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-describedby={errors.email !== undefined ? 'email-error' : undefined}
          aria-invalid={errors.email !== undefined}
          className={cn(errors.email !== undefined && 'ring-destructive/40 ring-2')}
          placeholder="representante@empresa.com"
          {...register('email')}
        />
        {errors.email !== undefined && (
          <p id="email-error" className="text-destructive text-xs">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="fullName">Nombre completo</Label>
        <Input
          id="fullName"
          type="text"
          autoComplete="name"
          aria-describedby={errors.fullName !== undefined ? 'fullName-error' : undefined}
          aria-invalid={errors.fullName !== undefined}
          className={cn(errors.fullName !== undefined && 'ring-destructive/40 ring-2')}
          placeholder="Ana Pereira"
          {...register('fullName')}
        />
        {errors.fullName !== undefined && (
          <p id="fullName-error" className="text-destructive text-xs">
            {errors.fullName.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Teléfono</Label>
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <PhoneCompositeInput
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={errors.phone !== undefined}
              {...(errors.phone !== undefined ? { errorId: 'phone-error' } : {})}
            />
          )}
        />
        {errors.phone !== undefined && (
          <p id="phone-error" className="text-destructive text-xs">
            {errors.phone.message}
          </p>
        )}
      </div>
    </>
  );
}
