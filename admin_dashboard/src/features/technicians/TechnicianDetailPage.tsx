// src/features/technicians/TechnicianDetailPage.tsx
// Technician detail: identity + availability, license/certifications, service-area
// assignment (editable, gated by ManageTechnicians), skills, and a performance summary
// (shown only if the API provides it; richer analytics live in the Analytics module).

import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Autocomplete, Box, Button, Card, CardContent, Chip, Stack, TextField, Typography,
} from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { PageHeader, StatusChip, Can, useConfirm } from '@/components/common';
import { LoadingScreen, ErrorState } from '@/components/feedback';
import { Permission } from '@/features/auth/permissions';
import { formatDateTime } from '@/utils/format';
import { paths } from '@/routes/paths';
import Grid from '@mui/material/Grid2';
import { useTechnicianProfile, useServiceAreas, useUpdateTechnician, useSetTechnicianStatus } from './hooks';
import type { ServiceArea } from './types';

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2">{value || '—'}</Typography>
    </Box>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Grid size={{ xs: 6, sm: 4 }}>
      <Card><CardContent>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="h3">{value}</Typography>
      </CardContent></Card>
    </Grid>
  );
}

export function TechnicianDetailPage() {
  const { id = '' } = useParams();
  const confirm = useConfirm();
  const { data: tech, isLoading, error, refetch } = useTechnicianProfile(id);
  const { data: allAreas } = useServiceAreas();
  const update = useUpdateTechnician(id);
  const setStatus = useSetTechnicianStatus();

  const [editingAreas, setEditingAreas] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState<ServiceArea[]>([]);

  const assignedAreas = useMemo(() => tech?.service_areas ?? [], [tech]);

  if (isLoading) return <LoadingScreen />;
  if (error || !tech) return <ErrorState error={error} onRetry={refetch} />;

  const userId = tech.user_id ?? tech.id;
  const isActive = (tech.status ?? 'ACTIVE') === 'ACTIVE';

  const toggleStatus = async () => {
    const next = isActive ? 'SUSPENDED' : 'ACTIVE';
    const ok = await confirm({
      title: isActive ? 'Suspend technician?' : 'Reactivate technician?',
      message: isActive ? 'Suspending blocks sign-in and removes them from dispatch.' : 'Reactivating restores access.',
      confirmText: isActive ? 'Suspend' : 'Reactivate',
      destructive: isActive,
    });
    if (ok) await setStatus.mutateAsync({ userId, status: next });
  };

  const startEditAreas = () => {
    setSelectedAreas(assignedAreas);
    setEditingAreas(true);
  };
  const saveAreas = async () => {
    await update.mutateAsync({ service_area_ids: selectedAreas.map((a) => a.id) });
    setEditingAreas(false);
  };

  const showPerformance = tech.rating != null || tech.completed_jobs != null || tech.on_time_rate != null;

  return (
    <>
      <PageHeader
        title={tech.full_name ?? 'Technician'}
        crumbs={[{ label: 'Technicians', to: paths.technicians }, { label: 'Detail' }]}
        actions={
          <Can permission={Permission.SuspendUsers}>
            <Button variant="outlined" color={isActive ? 'error' : 'success'} startIcon={isActive ? <BlockIcon /> : <CheckCircleIcon />} onClick={toggleStatus} disabled={setStatus.isPending}>
              {isActive ? 'Suspend' : 'Reactivate'}
            </Button>
          </Can>
        }
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h4">Profile</Typography>
                <Stack direction="row" spacing={1}>
                  <Chip size="small" variant="outlined" color={tech.is_available ? 'success' : 'default'} label={tech.is_available ? 'Available' : 'Off'} />
                  <StatusChip status={tech.status ?? 'ACTIVE'} />
                </Stack>
              </Stack>
              <Field label="Email" value={tech.email} />
              <Field label="Phone" value={tech.phone} />
              <Field label="License" value={[tech.license_number, tech.license_expiry ? `exp ${formatDateTime(tech.license_expiry, 'dd MMM yyyy')}` : null].filter(Boolean).join(' · ')} />
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h4" gutterBottom>Skills & certifications</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                {(tech.skills ?? []).length === 0 ? <Typography variant="body2" color="text.secondary">No skills listed</Typography>
                  : tech.skills!.map((s) => <Chip key={s} label={s} size="small" />)}
              </Stack>
              {(tech.certifications ?? []).map((c) => (
                <Field key={c.name} label={c.name} value={[c.number, c.expiry ? `exp ${formatDateTime(c.expiry, 'dd MMM yyyy')}` : null].filter(Boolean).join(' · ')} />
              ))}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h4">Service areas</Typography>
                <Can permission={Permission.ManageTechnicians}>
                  {!editingAreas
                    ? <Button size="small" onClick={startEditAreas}>Edit</Button>
                    : <Button size="small" variant="contained" onClick={saveAreas} disabled={update.isPending}>Save</Button>}
                </Can>
              </Stack>
              {!editingAreas ? (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {assignedAreas.length === 0 ? <Typography variant="body2" color="text.secondary">No areas assigned</Typography>
                    : assignedAreas.map((a) => <Chip key={a.id} label={a.name} size="small" />)}
                </Stack>
              ) : (
                <Autocomplete
                  multiple
                  options={allAreas ?? []}
                  getOptionLabel={(o) => o.name}
                  isOptionEqualToValue={(o, v) => o.id === v.id}
                  value={selectedAreas}
                  onChange={(_, v) => setSelectedAreas(v)}
                  renderInput={(params) => <TextField {...params} label="Assigned areas" placeholder="Add area" />}
                />
              )}
            </CardContent>
          </Card>

          {showPerformance && (
            <Card>
              <CardContent>
                <Typography variant="h4" gutterBottom>Performance</Typography>
                <Grid container spacing={1.5}>
                  {tech.rating != null && <Metric label="Rating" value={tech.rating.toFixed(1)} />}
                  {tech.completed_jobs != null && <Metric label="Completed" value={String(tech.completed_jobs)} />}
                  {tech.on_time_rate != null && <Metric label="On-time" value={`${Math.round(tech.on_time_rate * 100)}%`} />}
                </Grid>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Detailed analytics available in the Analytics module.
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </>
  );
}
