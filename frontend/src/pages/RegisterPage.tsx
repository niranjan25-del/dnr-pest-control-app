import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, CircularProgress, Divider, InputAdornment,
  Link, Stack, TextField, Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIcon from '@mui/icons-material/Phone';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/useAuth';
import { paths } from '@/routes/paths';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

const schema = z
  .object({
    fullName: z.string().min(2, 'Full name is required').max(120),
    email: z.string().email('Enter a valid email address'),
    phone: z
      .string()
      .optional()
      .refine(
        (v) => !v || /^\+?[1-9]\d{7,14}$/.test(v),
        'Enter a valid phone number (e.g. +919876543210)',
      ),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72)
      .regex(PASSWORD_RULE, 'Password must include both letters and numbers'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterForm = z.infer<typeof schema>;

const BRAND = '#1565C0';

export function RegisterPage() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: RegisterForm) => {
    setServerError(null);
    try {
      await registerUser({
        fullName: values.fullName,
        email: values.email,
        password: values.password,
        phone: values.phone || undefined,
      });
      navigate(paths.customerDashboard, { replace: true });
    } catch (e: unknown) {
      const raw = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (e as Error)?.message
        ?? 'Registration failed. Please try again.';
      setServerError(Array.isArray(raw) ? raw.join('. ') : String(raw));
    }
  };

  return (
    <Box>
      {/* Header */}
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Box
          sx={{
            width: 36, height: 36, borderRadius: 1.5,
            background: `linear-gradient(135deg, ${BRAND}, #0D47A1)`,
            mb: 1,
          }}
        />
        <Typography variant="h5" fontWeight={800}>Create your account</Typography>
        <Typography color="text.secondary" variant="body2">
          Book pest control services and track your appointments
        </Typography>
      </Stack>

      {serverError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setServerError(null)}>
          {serverError}
        </Alert>
      )}

      <Stack component="form" spacing={2} onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Full name */}
        <TextField
          label="Full name"
          fullWidth
          autoFocus
          autoComplete="name"
          error={Boolean(errors.fullName)}
          helperText={errors.fullName?.message}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PersonIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
          {...register('fullName')}
        />

        {/* Email */}
        <TextField
          label="Email address"
          type="email"
          fullWidth
          autoComplete="email"
          error={Boolean(errors.email)}
          helperText={errors.email?.message}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <EmailIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
          {...register('email')}
        />

        {/* Phone (optional) */}
        <TextField
          label="Phone number (optional)"
          type="tel"
          fullWidth
          autoComplete="tel"
          placeholder="+919876543210"
          error={Boolean(errors.phone)}
          helperText={errors.phone?.message ?? 'Used to confirm your booking appointments'}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PhoneIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
          {...register('phone')}
        />

        {/* Password */}
        <TextField
          label="Password"
          type="password"
          fullWidth
          autoComplete="new-password"
          error={Boolean(errors.password)}
          helperText={errors.password?.message ?? 'At least 8 characters with letters and numbers'}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
          {...register('password')}
        />

        {/* Confirm password */}
        <TextField
          label="Confirm password"
          type="password"
          fullWidth
          autoComplete="new-password"
          error={Boolean(errors.confirmPassword)}
          helperText={errors.confirmPassword?.message}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
          {...register('confirmPassword')}
        />

        {/* Perks list */}
        <Box sx={{ bgcolor: `${BRAND}08`, borderRadius: 2, p: 1.5 }}>
          {[
            'Book services in minutes',
            'Track your technician in real time',
            'View invoices and service history',
          ].map((t) => (
            <Stack key={t} direction="row" spacing={1} alignItems="center" sx={{ py: 0.4 }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 16, color: BRAND }} />
              <Typography variant="body2" color="text.secondary">{t}</Typography>
            </Stack>
          ))}
        </Box>

        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={isSubmitting}
          sx={{ bgcolor: BRAND, '&:hover': { bgcolor: '#0D47A1' }, fontWeight: 700 }}
          startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </Stack>

      <Divider sx={{ my: 2.5 }} />

      <Typography variant="body2" color="text.secondary" textAlign="center">
        Already have an account?{' '}
        <Link component={RouterLink} to={paths.login} fontWeight={600}>
          Sign in
        </Link>
      </Typography>
    </Box>
  );
}
