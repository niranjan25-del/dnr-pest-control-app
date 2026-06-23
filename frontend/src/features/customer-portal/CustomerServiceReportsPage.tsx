import { useState } from 'react';
import {
  Alert, Box, Card, CardActionArea, CardContent, Chip, CircularProgress,
  Dialog, DialogContent, DialogTitle, Divider, IconButton, Stack, Typography,
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import ScienceIcon from '@mui/icons-material/Science';
import { useMyServiceReports } from './hooks';
import type { CustomerServiceReport } from './types';

const BRAND = '#1565C0';

const STATUS_META: Record<string, { label: string; color: string }> = {
  DRAFT:     { label: 'Draft',     color: '#9E9E9E' },
  SUBMITTED: { label: 'Submitted', color: '#FF9800' },
  APPROVED:  { label: 'Approved',  color: '#4CAF50' },
  REJECTED:  { label: 'Rejected',  color: '#F44336' },
};

function ReportDetailModal({ report, onClose }: { report: CustomerServiceReport; onClose: () => void }) {
  const meta = STATUS_META[report.status] ?? { label: report.status, color: '#9E9E9E' };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AssignmentIcon sx={{ color: BRAND }} />
          <Box>
            <Typography fontWeight={700}>Service Report</Typography>
            {report.service_name && (
              <Typography variant="caption" color="text.secondary">{report.service_name}</Typography>
            )}
          </Box>
        </Stack>
        <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Chip
            label={meta.label}
            size="small"
            sx={{ bgcolor: `${meta.color}18`, color: meta.color, fontWeight: 700 }}
          />
          {report.submitted_at && (
            <Typography variant="caption" color="text.secondary">
              Submitted {new Date(report.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Typography>
          )}
        </Stack>

        {report.summary && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>Summary</Typography>
            <Typography variant="body2" color="text.secondary">{report.summary}</Typography>
          </Box>
        )}

        {report.recommendations && (
          <Box sx={{ mb: 2, p: 1.5, bgcolor: '#E3F2FD', borderRadius: 2 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5, color: BRAND }}>
              Technician Recommendations
            </Typography>
            <Typography variant="body2">{report.recommendations}</Typography>
          </Box>
        )}

        {report.items && report.items.length > 0 && (
          <>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Treatment Details</Typography>
            <Stack spacing={1.5}>
              {report.items.map((item) => (
                <Card key={item.id} variant="outlined" sx={{ bgcolor: 'action.hover' }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} display="block">
                      {item.label}
                    </Typography>
                    {item.value && <Typography variant="body2">{item.value}</Typography>}
                    {item.chemical_name && (
                      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                        <ScienceIcon sx={{ fontSize: 14, color: '#9C27B0' }} />
                        <Typography variant="caption" sx={{ color: '#9C27B0' }}>
                          {item.chemical_name}{item.quantity ? ` — ${item.quantity}` : ''}
                        </Typography>
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </>
        )}

        {report.status === 'APPROVED' && (
          <Stack direction="row" alignItems="center" spacing={1}
            sx={{ mt: 2, p: 1.5, bgcolor: '#4CAF5010', borderRadius: 2 }}>
            <CheckCircleIcon sx={{ color: '#4CAF50', fontSize: 20 }} />
            <Typography variant="body2" fontWeight={600} sx={{ color: '#4CAF50' }}>
              Report approved by our quality team
            </Typography>
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CustomerServiceReportsPage() {
  const { data: reports = [], isLoading, error } = useMyServiceReports();
  const [selected, setSelected] = useState<CustomerServiceReport | null>(null);

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 3 }}>Service Reports</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Detailed reports filed by our technicians after each service visit.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>Could not load service reports.</Alert>}

      {isLoading ? (
        <Box textAlign="center" py={6}><CircularProgress /></Box>
      ) : reports.length === 0 ? (
        <Card variant="outlined" sx={{ p: 5, textAlign: 'center', bgcolor: 'action.hover' }}>
          <AssignmentIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">No service reports yet. Reports appear here after service completion.</Typography>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {reports.map((r) => {
            const meta = STATUS_META[r.status] ?? { label: r.status, color: '#9E9E9E' };
            return (
              <Card key={r.id} variant="outlined"
                sx={{ '&:hover': { borderColor: BRAND }, transition: 'border-color 0.15s' }}>
                <CardActionArea onClick={() => setSelected(r)} sx={{ p: 2 }}>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <AssignmentIcon sx={{ color: BRAND, mt: 0.2 }} />
                      <Box>
                        <Typography fontWeight={700} variant="body2">
                          {r.service_name ?? 'Service Report'}
                        </Typography>
                        {r.summary && (
                          <Typography variant="caption" color="text.secondary"
                            sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {r.summary}
                          </Typography>
                        )}
                        {r.submitted_at && (
                          <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.5 }}>
                            {new Date(r.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </Typography>
                        )}
                      </Box>
                    </Stack>
                    <Chip label={meta.label} size="small"
                      sx={{ bgcolor: `${meta.color}18`, color: meta.color, fontWeight: 700, fontSize: 10, height: 20, flexShrink: 0 }} />
                  </Stack>
                </CardActionArea>
              </Card>
            );
          })}
        </Stack>
      )}

      {selected && <ReportDetailModal report={selected} onClose={() => setSelected(null)} />}
    </Box>
  );
}
