'use client';

import { type JSX } from 'react';
import { Controller, type UseFormRegister, type FieldErrors, type Control } from 'react-hook-form';
import { Input, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, cn } from '@core/ui';

import { StepFormField } from '../shared/step-form-field';

import type { CompanyFields } from './company-schema';
import { DEPARTAMENTOS, TIPOS_EMPRESA } from './paraguay-data';

// ─── Props ────────────────────────────────────────────────────────────────────

interface CompanyFormFieldsProps {
  register: UseFormRegister<CompanyFields>;
  control: Control<CompanyFields>;
  errors: FieldErrors<CompanyFields>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CompanyFormFields({
  register,
  control,
  errors,
}: CompanyFormFieldsProps): JSX.Element {
  return (
    <>
      {/* Full width fields */}
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <StepFormField id="razonSocial" label="Razón social" error={errors.razonSocial?.message}>
          <Input
            id="razonSocial"
            type="text"
            placeholder="Empresa ACME S.A."
            aria-invalid={errors.razonSocial !== undefined}
            aria-describedby={errors.razonSocial !== undefined ? 'razonSocial-error' : undefined}
            className={cn(errors.razonSocial !== undefined && 'ring-destructive/40 ring-2')}
            {...register('razonSocial')}
          />
        </StepFormField>
      </div>

      <StepFormField id="ruc" label="RUC" error={errors.ruc?.message}>
        <Input
          id="ruc"
          type="text"
          placeholder="80012345-1"
          aria-invalid={errors.ruc !== undefined}
          aria-describedby={errors.ruc !== undefined ? 'ruc-error' : undefined}
          className={cn(errors.ruc !== undefined && 'ring-destructive/40 ring-2')}
          {...register('ruc')}
        />
      </StepFormField>

      <StepFormField id="tipoEmpresa" label="Tipo de empresa" error={errors.tipoEmpresa?.message}>
        <Controller
          control={control}
          name="tipoEmpresa"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                id="tipoEmpresa"
                aria-label="Tipo de empresa"
                aria-invalid={errors.tipoEmpresa !== undefined}
                className={cn(errors.tipoEmpresa !== undefined && 'ring-destructive/40 ring-2')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_EMPRESA.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {tipo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </StepFormField>

      <div className="flex flex-col gap-1.5 md:col-span-2">
        <StepFormField
          id="direccionFiscal"
          label="Dirección fiscal"
          error={errors.direccionFiscal?.message}
        >
          <Input
            id="direccionFiscal"
            type="text"
            placeholder="Av. Mariscal López 2000"
            aria-invalid={errors.direccionFiscal !== undefined}
            aria-describedby={
              errors.direccionFiscal !== undefined ? 'direccionFiscal-error' : undefined
            }
            className={cn(errors.direccionFiscal !== undefined && 'ring-destructive/40 ring-2')}
            {...register('direccionFiscal')}
          />
        </StepFormField>
      </div>

      <StepFormField id="ciudad" label="Ciudad" error={errors.ciudad?.message}>
        <Input
          id="ciudad"
          type="text"
          placeholder="Asunción"
          aria-invalid={errors.ciudad !== undefined}
          aria-describedby={errors.ciudad !== undefined ? 'ciudad-error' : undefined}
          className={cn(errors.ciudad !== undefined && 'ring-destructive/40 ring-2')}
          {...register('ciudad')}
        />
      </StepFormField>

      <StepFormField id="departamento" label="Departamento" error={errors.departamento?.message}>
        <Controller
          control={control}
          name="departamento"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                id="departamento"
                aria-label="Departamento"
                aria-invalid={errors.departamento !== undefined}
                className={cn(errors.departamento !== undefined && 'ring-destructive/40 ring-2')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEPARTAMENTOS.map((dep) => (
                  <SelectItem key={dep} value={dep}>
                    {dep}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </StepFormField>

      <StepFormField id="telefono" label="Teléfono" error={errors.telefono?.message}>
        <Input
          id="telefono"
          type="tel"
          placeholder="+595 21 123456"
          aria-invalid={errors.telefono !== undefined}
          aria-describedby={errors.telefono !== undefined ? 'telefono-error' : undefined}
          className={cn(errors.telefono !== undefined && 'ring-destructive/40 ring-2')}
          {...register('telefono')}
        />
      </StepFormField>

      <StepFormField
        id="personaContacto"
        label="Persona de contacto"
        error={errors.personaContacto?.message}
      >
        <Input
          id="personaContacto"
          type="text"
          placeholder="Ana Pereira"
          aria-invalid={errors.personaContacto !== undefined}
          aria-describedby={
            errors.personaContacto !== undefined ? 'personaContacto-error' : undefined
          }
          className={cn(errors.personaContacto !== undefined && 'ring-destructive/40 ring-2')}
          {...register('personaContacto')}
        />
      </StepFormField>

      <StepFormField id="cargoContacto" label="Cargo" error={errors.cargoContacto?.message}>
        <Input
          id="cargoContacto"
          type="text"
          placeholder="Gerente General"
          aria-invalid={errors.cargoContacto !== undefined}
          aria-describedby={errors.cargoContacto !== undefined ? 'cargoContacto-error' : undefined}
          className={cn(errors.cargoContacto !== undefined && 'ring-destructive/40 ring-2')}
          {...register('cargoContacto')}
        />
      </StepFormField>

      <div className="flex flex-col gap-1.5 md:col-span-2">
        <StepFormField id="sitioWeb" label="Sitio web (opcional)" error={errors.sitioWeb?.message}>
          <Input
            id="sitioWeb"
            type="url"
            placeholder="https://www.empresa.com"
            aria-invalid={errors.sitioWeb !== undefined}
            aria-describedby={errors.sitioWeb !== undefined ? 'sitioWeb-error' : undefined}
            className={cn(errors.sitioWeb !== undefined && 'ring-destructive/40 ring-2')}
            {...register('sitioWeb')}
          />
        </StepFormField>
      </div>
    </>
  );
}
