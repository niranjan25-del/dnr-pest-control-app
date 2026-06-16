// src/pages/LoginPage.tsx
// Staff login (email + password) using the form framework. On success, returns the user to
// the page they were heading to (location.state.from) or the dashboard. Errors from the
// api client (ApiError) are surfaced inline.

import { useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Form, RHFTextField, useFormSubmitting } from '@/components/form';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/types';
import { paths } from '@/routes/paths';
import { env } from '@/utils/env';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
type LoginForm = z.infer<typeof schema>;

function SubmitButton() {
  const submitting = useFormSubmitting();
  return (
    <Button type="submit" variant="contained" size="large" fullWidth disabled={submitting}>
      {submitting ? 'Signing in…' : 'Sign in'}
    </Button>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? paths.dashboard;

  const onSubmit = async (values: LoginForm) => {
    setError(null);
    try {
      await login(values.email, values.password);
      navigate(from, { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Unable to sign in. Try again.');
    }
  };

  return (
    <Box>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: 'primary.main', mb: 1 }} />
        <Typography variant="h2">Sign in</Typography>
        <Typography color="text.secondary" variant="body2">{env.appName}</Typography>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Form schema={schema} defaultValues={{ email: '', password: '' }} onSubmit={onSubmit}>
        <Stack spacing={2}>
          <RHFTextField<LoginForm> name="email" label="Email" type="email" autoComplete="email" autoFocus />
          <RHFTextField<LoginForm> name="password" label="Password" type="password" autoComplete="current-password" />
          <SubmitButton />
        </Stack>
      </Form>
    </Box>
  );
}
