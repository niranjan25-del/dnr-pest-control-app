import {
  Alert, Box, Card, CardContent, Chip, CircularProgress, LinearProgress, Stack, Typography,
} from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ShieldIcon from '@mui/icons-material/Shield';
import { useMyWarranties } from './hooks';
import type { CustomerWarranty } from './types';

const BRAND = '#1565C0';

function WarrantyCard({ w }: { w: CustomerWarranty }) {
  const pct = Math.round((w.days_remaining / w.warranty_days) * 100);
  const barColor = pct > 50 ? '#4CAF50' : pct > 20 ? '#FF9800' : '#F44336';
  const expired  = !w.is_active || w.days_remaining === 0;
  const expiryDate = new Date(w.expires_at).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <Card variant="outlined" sx={{ borderColor: expired ? 'divider' : `${barColor}60`, mb: 1.5 }}>
      <CardContent>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start">
            <ShieldIcon sx={{ color: expired ? 'text.disabled' : barColor, fontSize: 28, mt: 0.2 }} />
            <Box>
              <Typography fontWeight={700}>{w.service_name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {w.warranty_days}-day service guarantee
              </Typography>
            </Box>
          </Stack>
          {expired ? (
            <Chip label="Expired" size="small" sx={{ bgcolor: '#9E9E9E18', color: '#9E9E9E', fontWeight: 700 }} />
          ) : (
            <Chip
              icon={<VerifiedIcon sx={{ fontSize: '14px !important', color: `${barColor} !important` }} />}
              label="Active"
              size="small"
              sx={{ bgcolor: `${barColor}18`, color: barColor, fontWeight: 700 }}
            />
          )}
        </Stack>

        {!expired && (
          <Box sx={{ mb: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Coverage remaining</Typography>
              <Typography variant="caption" fontWeight={700} sx={{ color: barColor }}>
                {w.days_remaining} day{w.days_remaining !== 1 ? 's' : ''} left
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{
                height: 8, borderRadius: 4,
                bgcolor: `${barColor}20`,
                '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: 4 },
              }}
            />
          </Box>
        )}

        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            {expired ? 'Expired on' : 'Expires on'}
          </Typography>
          <Typography variant="caption" fontWeight={600}>{expiryDate}</Typography>
        </Stack>

        {!expired && w.days_remaining <= 7 && (
          <Alert
            severity="warning"
            icon={<ErrorOutlineIcon fontSize="inherit" />}
            sx={{ mt: 1.5, py: 0.5 }}
          >
            Warranty expires soon! Contact us if you experience any pest issues.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export function CustomerWarrantiesPage() {
  const { data: warranties = [], isLoading, error } = useMyWarranties();

  const active  = warranties.filter((w) => w.is_active && w.days_remaining > 0);
  const expired = warranties.filter((w) => !w.is_active || w.days_remaining === 0);

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 1 }}>Service Warranties</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        After each service, you're covered by our satisfaction guarantee. If pests return within the warranty period, we'll re-treat at no extra cost.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>Could not load warranties.</Alert>}

      {isLoading ? (
        <Box textAlign="center" py={6}><CircularProgress /></Box>
      ) : warranties.length === 0 ? (
        <Card variant="outlined" sx={{ p: 5, textAlign: 'center', bgcolor: 'action.hover' }}>
          <ShieldIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">
            No warranties yet. Warranties are issued after each completed service.
          </Typography>
        </Card>
      ) : (
        <>
          {active.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                <VerifiedIcon sx={{ color: '#4CAF50', fontSize: 18 }} />
                <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#4CAF50' }}>
                  Active Warranties ({active.length})
                </Typography>
              </Stack>
              {active.map((w) => <WarrantyCard key={w.id} w={w} />)}
            </Box>
          )}

          {expired.length > 0 && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" fontWeight={700} sx={{ mb: 1.5 }}>
                Expired ({expired.length})
              </Typography>
              {expired.map((w) => <WarrantyCard key={w.id} w={w} />)}
            </Box>
          )}
        </>
      )}

      <Card sx={{ mt: 3, p: 2, bgcolor: `${BRAND}08`, border: `1px solid ${BRAND}30` }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <ShieldIcon sx={{ color: BRAND, mt: 0.2 }} />
          <Box>
            <Typography variant="body2" fontWeight={700} sx={{ color: BRAND }}>
              Our Warranty Promise
            </Typography>
            <Typography variant="caption" color="text.secondary">
              If you notice pest activity within your warranty period, call us or raise a warranty claim. We'll send a technician for a free re-treatment, no questions asked.
            </Typography>
          </Box>
        </Stack>
      </Card>
    </Box>
  );
}
