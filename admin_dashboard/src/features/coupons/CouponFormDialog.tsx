// src/features/coupons/CouponFormDialog.tsx
// Create / edit a coupon (RHF + MUI Dialog). Percentage vs fixed discount, optional
// redemption cap and validity window.

import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  MenuItem, Stack, Switch, TextField,
} from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { ApiError } from '@/types';
import { useToast } from '@/providers/ToastProvider';
import { useSaveCoupon } from './hooks';
import type { CouponFormValues, CouponRow } from './types';

interface Props { open: boolean; onClose: () => void; existing?: CouponRow | null }

const isoDate = (s?: string | null) => (s ? s.slice(0, 10) : '');

export function CouponFormDialog({ open, onClose, existing }: Props) {
  const toast = useToast();
  const save = useSaveCoupon();
  const isEdit = Boolean(existing);

  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<CouponFormValues>({
    defaultValues: { code: '', description: '', discount_type: 'PERCENTAGE', discount_value: 10, max_redemptions: undefined, valid_from: '', valid_until: '', is_active: true },
  });
  const type = watch('discount_type');

  useEffect(() => {
    if (open) {
      reset({
        code: existing?.code ?? '',
        description: existing?.description ?? '',
        discount_type: existing?.discount_type ?? 'PERCENTAGE',
        discount_value: existing?.discount_value ?? 10,
        max_redemptions: existing?.max_redemptions ?? undefined,
        valid_from: isoDate(existing?.valid_from),
        valid_until: isoDate(existing?.valid_until),
        is_active: existing?.is_active ?? true,
      });
    }
  }, [open, existing, reset]);

  const onSubmit = (v: CouponFormValues) => {
    const body = {
      ...v,
      code: v.code.trim().toUpperCase(),
      max_redemptions: v.max_redemptions ? Number(v.max_redemptions) : undefined,
      valid_from: v.valid_from || undefined,
      valid_until: v.valid_until || undefined,
    };
    save.mutate({ id: existing?.id, body }, {
      onSuccess: () => { toast.success(isEdit ? 'Coupon updated' : 'Coupon created'); onClose(); },
      onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save coupon'),
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isEdit ? 'Edit coupon' : 'New coupon'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Controller name="code" control={control} rules={{ required: 'Code is required' }}
            render={({ field }) => <TextField {...field} label="Code" error={!!errors.code} helperText={errors.code?.message} disabled={isEdit} fullWidth />} />
          <Controller name="description" control={control}
            render={({ field }) => <TextField {...field} label="Description" fullWidth />} />
          <Stack direction="row" spacing={2}>
            <Controller name="discount_type" control={control}
              render={({ field }) => (
                <TextField {...field} select label="Type" sx={{ minWidth: 160 }}>
                  <MenuItem value="PERCENTAGE">Percentage</MenuItem>
                  <MenuItem value="FIXED">Fixed (₹)</MenuItem>
                </TextField>
              )} />
            <Controller name="discount_value" control={control} rules={{ required: 'Required', min: { value: 0, message: '≥ 0' } }}
              render={({ field }) => <TextField {...field} type="number" label={type === 'PERCENTAGE' ? 'Percent off' : 'Amount off (₹)'} error={!!errors.discount_value} helperText={errors.discount_value?.message} fullWidth />} />
          </Stack>
          <Controller name="max_redemptions" control={control}
            render={({ field }) => <TextField {...field} type="number" label="Max redemptions (blank = unlimited)" fullWidth />} />
          <Stack direction="row" spacing={2}>
            <Controller name="valid_from" control={control}
              render={({ field }) => <TextField {...field} type="date" label="Valid from" InputLabelProps={{ shrink: true }} fullWidth />} />
            <Controller name="valid_until" control={control}
              render={({ field }) => <TextField {...field} type="date" label="Valid until" InputLabelProps={{ shrink: true }} fullWidth />} />
          </Stack>
          <Controller name="is_active" control={control}
            render={({ field }) => <FormControlLabel control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />} label="Active" />} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit(onSubmit)} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  );
}
