// src/features/bookings/AssignTechnicianDialog.tsx
// Assign or reassign a technician using the dispatch candidate ranking. Lists ranked
// candidates (eligibility, workload, distance, score) and assigns the chosen one. RBAC: the
// trigger is gated by AssignTechnician; this dialog assumes that check already passed.

import { useState } from 'react';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItemButton,
  ListItemText, Radio, Stack, TextField, Typography,
} from '@mui/material';
import { LoadingScreen } from '@/components/feedback';
import { useCandidates, useBookingMutations } from './hooks';

interface Props {
  bookingId: string;
  open: boolean;
  mode: 'assign' | 'reassign';
  onClose: () => void;
}

export function AssignTechnicianDialog({ bookingId, open, mode, onClose }: Props) {
  const { data: candidates, isLoading, error } = useCandidates(bookingId, open);
  const { assign, reassign } = useBookingMutations(bookingId);
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const busy = assign.isPending || reassign.isPending;

  const handleConfirm = async () => {
    if (!selected) return;
    if (mode === 'assign') await assign.mutateAsync(selected);
    else await reassign.mutateAsync({ technicianId: selected, reason: reason || undefined });
    onClose();
    setSelected(null);
    setReason('');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{mode === 'assign' ? 'Assign technician' : 'Reassign technician'}</DialogTitle>
      <DialogContent dividers>
        {isLoading && <LoadingScreen label="Ranking candidates…" />}
        {error && <Alert severity="error">Couldn’t load candidates.</Alert>}
        {!isLoading && candidates && candidates.length === 0 && (
          <Typography color="text.secondary">No eligible technicians found for this booking.</Typography>
        )}
        {candidates && candidates.length > 0 && (
          <List>
            {candidates.map((c) => {
              const matchLabel = c.serves_area && c.has_skill
                ? 'Best match'
                : c.serves_area
                ? 'Area match'
                : c.has_skill
                ? 'Skill match'
                : 'Can assign';
              return (
                <ListItemButton key={c.technician_id} selected={selected === c.technician_id} onClick={() => setSelected(c.technician_id)}>
                  <Radio checked={selected === c.technician_id} tabIndex={-1} />
                  <ListItemText
                    primary={c.full_name}
                    secondary={[
                      matchLabel,
                      c.active_jobs != null ? `${c.active_jobs} active jobs` : null,
                      c.distance_km != null ? `${c.distance_km.toFixed(1)} km` : null,
                      c.score != null ? `score ${c.score.toFixed(0)}` : null,
                    ].filter(Boolean).join('  ·  ')}
                  />
                </ListItemButton>
              );
            })}
          </List>
        )}
        {mode === 'reassign' && (
          <Stack sx={{ mt: 2 }}>
            <TextField label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} multiline minRows={2} />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!selected || busy} onClick={handleConfirm}>
          {busy ? 'Saving…' : mode === 'assign' ? 'Assign' : 'Reassign'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
