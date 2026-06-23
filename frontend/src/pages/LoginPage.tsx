// src/pages/LoginPage.tsx
// Staff login (email + password) using the form framework. On success, returns the user to
// the page they were heading to (location.state.from) or the dashboard. Errors from the
// api client (ApiError) are surfaced inline.

import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Divider, Link, Stack, Typography } from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Form, RHFTextField, useFormSubmitting } from '@/components/form';
import { useAuth } from '@/hooks/useAuth';
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
      const user = await login(values.email, values.password);
      let dest = from;
      if (user.role === 'TECHNICIAN') dest = paths.technicianDashboard;
      else if (user.role === 'CUSTOMER') dest = paths.customerDashboard;
      navigate(dest, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in. Try again.');
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

      <Divider sx={{ my: 2.5 }}>
        <Typography variant="caption" color="text.disabled">New to {env.appName}?</Typography>
      </Divider>

      <Button
        component={RouterLink}
        to={paths.register}
        variant="outlined"
        fullWidth
        size="large"
        startIcon={<PersonAddIcon />}
        sx={{ fontWeight: 600 }}
      >
        Create a customer account
      </Button>

      <Typography variant="caption" color="text.disabled" display="block" textAlign="center" sx={{ mt: 1.5 }}>
        Admin and technician accounts are provisioned internally.{' '}
        <Link href="mailto:support@dnrpestcontrol.com" underline="hover">Contact support</Link>
      </Typography>
    </Box>
  );
}
