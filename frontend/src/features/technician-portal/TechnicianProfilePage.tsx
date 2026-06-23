import { useNavigate } from 'react-router-dom';
import {
  Alert, Avatar, Box, Button, Card, CircularProgress, Divider,
  Stack, Switch, Typography,
} from '@mui/material';
import {
  Email as EmailIcon, Phone as PhoneIcon, Badge as BadgeIcon,
  Build as SkillsIcon, Logout as LogoutIcon, FiberManualRecord as DotIcon,
} from '@mui/icons-material';
import { paths } from '@/routes/paths';
import { useAuth } from '@/hooks/useAuth';
import { useTechProfile, useSetAvailability } from './hooks';
import { useState } from 'react';

const BRAND = '#1E8E5A';

function initials(name?: string) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <Stack direction="row" alignItems="flex-start" spacing={2} py={1.5} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ color: BRAND, mt: 0.2 }}>{icon}</Box>
      <Box>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="body2" fontWeight={500}>{value}</Typography>
      </Box>
    </Stack>
  );
}

export function TechnicianProfilePage() {
  const { data: profile, isLoading, error } = useTechProfile();
  const setAvail = useSetAvailability();
  const [optimisticAvail, setOptimisticAvail] = useState<boolean | null>(null);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const available = optimisticAvail ?? profile?.is_available ?? false;

  const handleToggle = () => {
    const next = !available;
    setOptimisticAvail(next);
    setAvail.mutate(next, { onSettled: () => setOptimisticAvail(null) });
  };

  const handleLogout = async () => {
    await logout();
    navigate(paths.login, { replace: true });
  };

  if (isLoading) return <Box textAlign="center" py={6}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">Could not load profile. Please try again.</Alert>;

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} mb={3}>My Profile</Typography>

      {/* Avatar card */}
      <Card sx={{ mb: 2.5, background: `linear-gradient(135deg, ${BRAND} 0%, #145e3a 100%)`, color: '#fff', overflow: 'hidden' }}>
        <Box sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={2.5}>
            <Avatar sx={{ width: 64, height: 64, bgcolor: 'rgba(255,255,255,0.2)', fontSize: 22, fontWeight: 800 }}>
              {profile?.full_name ? initials(profile.full_name) : '?'}
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={800}>{profile?.full_name ?? 'Technician'}</Typography>
              {profile?.email && <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{profile.email}</Typography>}
              <Stack direction="row" alignItems="center" spacing={0.5} mt={0.5}>
                <DotIcon sx={{ fontSize: 10, color: available ? '#69f0ae' : 'rgba(255,255,255,0.4)' }} />
                <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                  {available ? 'Available for jobs' : 'Off duty'}
                </Typography>
              </Stack>
            </Box>
          </Stack>
        </Box>
      </Card>

      {/* Availability toggle */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
          <Box>
            <Typography fontWeight={600}>Availability</Typography>
            <Typography variant="caption" color="text.secondary">
              {available ? 'You are available to receive new jobs' : 'You are currently off duty'}
            </Typography>
          </Box>
          <Switch
            checked={available}
            onChange={handleToggle}
            disabled={setAvail.isPending}
            sx={{ '& .MuiSwitch-thumb': { bgcolor: available ? BRAND : undefined }, '& .Mui-checked+.MuiSwitch-track': { bgcolor: `${BRAND}80 !important` } }}
          />
        </Stack>
      </Card>

      {/* Contact info */}
      <Card variant="outlined" sx={{ mb: 2, px: 2 }}>
        <Typography variant="overline" color="text.disabled" sx={{ display: 'block', pt: 1.5, pb: 0.5, fontSize: 10 }}>Contact Information</Typography>
        <InfoRow icon={<EmailIcon fontSize="small" />}  label="Email"        value={profile?.email} />
        <InfoRow icon={<PhoneIcon fontSize="small" />}  label="Phone"        value={profile?.phone} />
        <InfoRow icon={<BadgeIcon fontSize="small" />}  label="License no."  value={profile?.license_number} />
        <Box sx={{ height: 8 }} />
      </Card>

      {/* Skills */}
      {profile?.skills && profile.skills.length > 0 && (
        <Card variant="outlined" sx={{ mb: 2, px: 2 }}>
          <Typography variant="overline" color="text.disabled" sx={{ display: 'block', pt: 1.5, pb: 0.5, fontSize: 10 }}>Skills & Certifications</Typography>
          <Stack direction="row" flexWrap="wrap" gap={1} pb={2}>
            {profile.skills.map((s) => (
              <Box key={s} sx={{ px: 1.5, py: 0.5, borderRadius: 10, bgcolor: `${BRAND}14`, border: `1px solid ${BRAND}40` }}>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <SkillsIcon sx={{ fontSize: 12, color: BRAND }} />
                  <Typography variant="caption" sx={{ color: BRAND, fontWeight: 600 }}>{s}</Typography>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Card>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Logout */}
      <Button
        variant="outlined"
        color="error"
        fullWidth
        startIcon={<LogoutIcon />}
        onClick={handleLogout}
        sx={{ py: 1.5 }}
      >
        Sign out
      </Button>
    </Box>
  );
}
