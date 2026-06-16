// src/components/form/index.tsx
// Form framework: React Hook Form + zod. `Form` wires a zod schema to RHF and exposes a
// typed submit; `RHFTextField` binds an MUI TextField to a field with error display. This
// keeps every form consistent (validation, error surfacing, disabled-while-submitting).

import { type ReactNode } from 'react';
import { FormProvider, useForm, useFormContext, type DefaultValues, type SubmitHandler, type FieldValues, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodType } from 'zod';
import { TextField, type TextFieldProps } from '@mui/material';

interface FormProps<T extends FieldValues> {
  schema: ZodType<T>;
  defaultValues: DefaultValues<T>;
  onSubmit: SubmitHandler<T>;
  children: ReactNode;
}

export function Form<T extends FieldValues>({ schema, defaultValues, onSubmit, children }: FormProps<T>) {
  const methods = useForm<T>({ resolver: zodResolver(schema), defaultValues, mode: 'onTouched' });
  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} noValidate>
        {children}
      </form>
    </FormProvider>
  );
}

interface RHFTextFieldProps<T extends FieldValues> extends Omit<TextFieldProps, 'name' | 'error'> {
  name: Path<T>;
}

export function RHFTextField<T extends FieldValues>({ name, ...props }: RHFTextFieldProps<T>) {
  const { register, formState: { errors } } = useFormContext<T>();
  const error = errors[name];
  return (
    <TextField
      {...register(name)}
      error={Boolean(error)}
      helperText={(error?.message as string) ?? props.helperText}
      {...props}
    />
  );
}

/** Read submitting state inside a <Form> (for disabling the submit button). */
export function useFormSubmitting(): boolean {
  return useFormContext().formState.isSubmitting;
}
