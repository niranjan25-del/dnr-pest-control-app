// src/features/services/ServiceFormDialog.tsx
// Create / edit a service. Self-contained MUI Dialog + react-hook-form (no external schema
// dependency). Toasts on success/error; invalidation handled by the save hook.

import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  MenuItem, Stack, Switch, TextField,
} from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { ApiError } from '@/types';
import { useToast } from '@/providers/ToastProvider';
import { usePestCategories, useSaveService } from './hooks';
import type { ServiceFormValues, ServiceRow } from './types';

interface Props {
  open: boolean;
  onClose: () => void;
  existing?: ServiceRow | null;
}

export function ServiceFormDialog({ open, onClose, existing }: Props) {
  const toast = useToast();
  const save = useSaveService();
  const { data: pestCategories } = usePestCategories();
  const isEdit = Boolean(existing);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<ServiceFormValues>({
    defaultValues: { name: '', description: '', base_price: 0, duration_minutes: 60, pest_category_id: '', is_active: true },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: existing?.name ?? '',
        description: existing?.description ?? '',
        base_price: existing?.base_price ?? 0,
        duration_minutes: existing?.duration_minutes ?? 60,
        pest_category_id: existing?.pest_category_id ?? '',
        is_active: existing?.is_active ?? true,
      });
    }
  }, [open, existing, reset]);

  const onSubmit = (values: ServiceFormValues) => {
    const body = { ...values, pest_category_id: values.pest_category_id || undefined };
    save.mutate(
      { id: existing?.id, body },
      {
        onSuccess: () => { toast.success(isEdit ? 'Service updated' : 'Service created'); onClose(); },
        onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save service'),
      },
    );
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isEdit ? 'Edit service' : 'New service'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Controller
            name="name" control={control} rules={{ required: 'Name is required' }}
            render={({ field }) => <TextField {...field} label="Name" error={!!errors.name} helperText={errors.name?.message} fullWidth />}
          />
          <Controller
            name="description" control={control}
            render={({ field }) => <TextField {...field} label="Description" multiline minRows={2} fullWidth />}
          />
          <Stack direction="row" spacing={2}>
            <Controller
              name="base_price" control={control} rules={{ required: 'Required', min: { value: 0, message: '≥ 0' } }}
              render={({ field }) => <TextField {...field} type="number" label="Base price (₹)" error={!!errors.base_price} helperText={errors.base_price?.message} fullWidth />}
            />
            <Controller
              name="duration_minutes" control={control}
              render={({ field }) => <TextField {...field} type="number" label="Duration (min)" fullWidth />}
            />
          </Stack>
          <Controller
            name="pest_category_id" control={control}
            render={({ field }) => (
              <TextField {...field} select label="Pest category" fullWidth>
                <MenuItem value="">Unassigned</MenuItem>
                {(pestCategories ?? []).map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
              </TextField>
            )}
          />
          <Controller
            name="is_active" control={control}
            render={({ field }) => <FormControlLabel control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />} label="Active" />}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit(onSubmit)} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
