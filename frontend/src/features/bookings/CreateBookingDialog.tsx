// src/features/bookings/CreateBookingDialog.tsx
//
// Multi-step wizard for admins to manually create a booking on behalf of a customer.
// Steps: Customer → Service → Address → Schedule
// On submit: optionally creates an address first, then creates the booking.

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, CardActionArea, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel,
  Radio, RadioGroup, Stack, Step, StepLabel, Stepper, TextField, Typography,
} from '@mui/material';
import { CheckCircle as CheckIcon, PersonSearch as SearchIcon } from '@mui/icons-material';
import { apiClient } from '@/services/apiClient';
import { formatMoney } from '@/utils/format';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminCustomer {
  id: string;
  customer_profile_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
}

interface ServiceItem {
  id: string;
  name: string;
  basePrice: number | string;
  currency: string;
  estimatedDurationMin: number;
  description?: string | null;
  isActive: boolean;
}

interface AddressItem {
  id: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  label?: string | null;
  isDefault: boolean;
}

interface NewAddrForm {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = ['Customer', 'Service', 'Address', 'Schedule'];
const EMPTY_ADDR: NewAddrForm = { line1: '', line2: '', city: '', state: '', postalCode: '' };

function addrOneLine(a: AddressItem | undefined): string {
  if (!a) return '';
  return [a.line1, a.city, a.state, a.postalCode].filter(Boolean).join(', ');
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CreateBookingDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();

  const [step, setStep]                       = useState(0);
  const [search, setSearch]                   = useState('');
  const [customer, setCustomer]               = useState<AdminCustomer | null>(null);
  const [service, setService]                 = useState<ServiceItem | null>(null);
  const [addrChoice, setAddrChoice]           = useState('');   // address UUID or 'new'
  const [newAddr, setNewAddr]                 = useState<NewAddrForm>(EMPTY_ADDR);
  const [scheduledStart, setScheduledStart]   = useState('');
  const [notes, setNotes]                     = useState('');
  const [submitError, setSubmitError]         = useState('');

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: customerResults = [], isFetching: searchingCustomers } = useQuery({
    queryKey: ['admin-customers-search', search],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: AdminCustomer[] }>('/admin/customers', {
        params: { search: search.trim(), limit: 8 },
      });
      return data.data ?? [];
    },
    enabled: search.trim().length > 1,
    staleTime: 15_000,
  });

  const { data: services = [], isLoading: loadingServices } = useQuery({
    queryKey: ['services-list-booking'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data?: ServiceItem[] } | ServiceItem[]>('/services', {
        params: { limit: 100 },
      });
      return (data as { data?: ServiceItem[] }).data ?? (data as ServiceItem[]) ?? [];
    },
    enabled: step === 1,
  });

  const { data: addresses = [], isLoading: loadingAddresses } = useQuery({
    queryKey: ['admin-customer-addresses', customer?.id],
    queryFn: async () => {
      const { data } = await apiClient.get<AddressItem[]>(
        `/admin/customers/${customer!.id}/addresses`,
      );
      return Array.isArray(data) ? data : [];
    },
    enabled: step === 2 && customer !== null,
  });

  // Auto-select address when entering step 2
  useEffect(() => {
    if (step === 2 && !loadingAddresses && addrChoice === '') {
      if (addresses.length === 1) setAddrChoice(addresses[0].id);
      else if (addresses.length === 0) setAddrChoice('new');
    }
  }, [step, addresses, loadingAddresses, addrChoice]);

  // Reset address choice when customer changes
  useEffect(() => {
    setAddrChoice('');
    setNewAddr(EMPTY_ADDR);
  }, [customer?.id]);

  // ── Create mutation ──────────────────────────────────────────────────────────

  const createBooking = useMutation({
    mutationFn: async () => {
      let finalAddressId = addrChoice;

      if (addrChoice === 'new') {
        const { data } = await apiClient.post<AddressItem>(
          `/admin/customers/${customer!.id}/addresses`,
          {
            line1: newAddr.line1.trim(),
            ...(newAddr.line2.trim() ? { line2: newAddr.line2.trim() } : {}),
            city: newAddr.city.trim(),
            state: newAddr.state.trim(),
            postalCode: newAddr.postalCode.trim(),
          },
        );
        finalAddressId = data.id;
      }

      await apiClient.post('/bookings', {
        customerId: customer!.customer_profile_id,
        serviceId: service!.id,
        addressId: finalAddressId,
        scheduledStart: new Date(scheduledStart).toISOString(),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      doClose();
    },
    onError: (e: unknown) => {
      // apiClient interceptor converts all HTTP errors to ApiError (extends Error)
      setSubmitError((e as Error).message || 'Failed to create booking. Please try again.');
    },
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const doClose = () => {
    if (createBooking.isPending) return;
    setStep(0);
    setSearch('');
    setCustomer(null);
    setService(null);
    setAddrChoice('');
    setNewAddr(EMPTY_ADDR);
    setScheduledStart('');
    setNotes('');
    setSubmitError('');
    onClose();
  };

  const canNext = (): boolean => {
    if (step === 0) return customer !== null && customer.customer_profile_id !== null;
    if (step === 1) return service !== null;
    if (step === 2) {
      if (addrChoice === 'new') {
        const { line1, city, state, postalCode } = newAddr;
        return !!(line1.trim() && city.trim() && state.trim() && postalCode.trim());
      }
      return addrChoice !== '';
    }
    if (step === 3) return scheduledStart !== '';
    return false;
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      setSubmitError('');
      createBooking.mutate();
    }
  };

  const handleBack = () => {
    if (step === 0) doClose();
    else setStep((s) => s - 1);
  };

  const activeServices = services.filter((s) => s.isActive);
  const selectedAddr   = addresses.find((a) => a.id === addrChoice);

  // minimum datetime for the scheduler (now rounded to next minute)
  // datetime-local input uses LOCAL time — must not use toISOString() (that's UTC)
  const minDatetimeStr = (() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })();

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onClose={doClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>New Manual Booking</DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* ── Step 0: Customer ─────────────────────────────────────────────── */}
        {step === 0 && (
          <Box>
            {customer && (
              <Card variant="outlined"
                sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderColor: 'primary.main' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography fontWeight={700}>{customer.full_name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {customer.email}{customer.phone ? ` · ${customer.phone}` : ''}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CheckIcon color="primary" fontSize="small" />
                    <Button size="small" onClick={() => { setCustomer(null); setSearch(''); }}>
                      Change
                    </Button>
                  </Stack>
                </Stack>
              </Card>
            )}

            <TextField
              label="Search by name, email or phone"
              fullWidth
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                endAdornment: searchingCustomers
                  ? <CircularProgress size={18} sx={{ mr: 1 }} />
                  : <SearchIcon color="disabled" sx={{ mr: 1 }} />,
              }}
            />

            {search.trim().length > 1 && !searchingCustomers && customerResults.length === 0 && (
              <Typography variant="body2" color="text.secondary" mt={1.5} textAlign="center">
                No customers found for "{search}"
              </Typography>
            )}

            {customerResults.length > 0 && (
              <Box mt={1} sx={{ maxHeight: 260, overflowY: 'auto' }}>
                {customerResults.map((c) => (
                  <Card key={c.id} variant="outlined" sx={{ mb: 0.5 }}>
                    <CardActionArea
                      sx={{ p: 1.5 }}
                      onClick={() => { setCustomer(c); setSearch(''); }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography fontWeight={600}>{c.full_name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {c.email}{c.phone ? ` · ${c.phone}` : ''}
                          </Typography>
                        </Box>
                        {customer?.id === c.id && (
                          <CheckIcon color="primary" fontSize="small" />
                        )}
                      </Stack>
                    </CardActionArea>
                  </Card>
                ))}
              </Box>
            )}

            {!search.trim() && !customer && (
              <Typography variant="body2" color="text.secondary" mt={2} textAlign="center">
                Type at least 2 characters to search for a customer
              </Typography>
            )}
          </Box>
        )}

        {/* ── Step 1: Service ──────────────────────────────────────────────── */}
        {step === 1 && (
          <Box>
            {loadingServices ? (
              <Box textAlign="center" py={5}>
                <CircularProgress />
              </Box>
            ) : activeServices.length === 0 ? (
              <Alert severity="warning">No active services found. Create a service first.</Alert>
            ) : (
              <Box sx={{ maxHeight: 380, overflowY: 'auto' }}>
                {activeServices.map((s) => {
                  const selected = service?.id === s.id;
                  return (
                    <Card key={s.id} variant="outlined" sx={{ mb: 1,
                      border: selected ? '2px solid' : undefined,
                      borderColor: selected ? 'primary.main' : undefined,
                    }}>
                      <CardActionArea sx={{ p: 1.5 }} onClick={() => setService(s)}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                          <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
                            <Typography fontWeight={600}>{s.name}</Typography>
                            {s.description && (
                              <Typography variant="caption" color="text.secondary" noWrap>
                                {s.description}
                              </Typography>
                            )}
                          </Box>
                          <Stack alignItems="flex-end" spacing={0.5} flexShrink={0}>
                            <Typography fontWeight={700} color="primary.main">
                              {formatMoney(s.basePrice, s.currency)}
                            </Typography>
                            <Chip size="small" label={`${s.estimatedDurationMin} min`} />
                          </Stack>
                        </Stack>
                        {selected && (
                          <Stack direction="row" alignItems="center" spacing={0.5} mt={0.5}>
                            <CheckIcon fontSize="small" color="primary" />
                            <Typography variant="caption" color="primary.main" fontWeight={600}>
                              Selected
                            </Typography>
                          </Stack>
                        )}
                      </CardActionArea>
                    </Card>
                  );
                })}
              </Box>
            )}
          </Box>
        )}

        {/* ── Step 2: Address ──────────────────────────────────────────────── */}
        {step === 2 && (
          <Box>
            {loadingAddresses ? (
              <Box textAlign="center" py={5}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {addresses.length > 0 && (
                  <>
                    <Typography variant="subtitle2" color="text.secondary" mb={0.5}>
                      Saved addresses for {customer?.full_name}
                    </Typography>
                    <RadioGroup
                      value={addrChoice}
                      onChange={(e) => setAddrChoice(e.target.value)}
                    >
                      {addresses.map((a) => (
                        <FormControlLabel
                          key={a.id}
                          value={a.id}
                          control={<Radio size="small" />}
                          label={
                            <Box py={0.5}>
                              <Stack direction="row" alignItems="center" spacing={0.5} flexWrap="wrap">
                                <Typography variant="body2" fontWeight={500}>
                                  {addrOneLine(a)}
                                </Typography>
                                {a.label && (
                                  <Chip size="small" label={a.label} variant="outlined" />
                                )}
                                {a.isDefault && (
                                  <Chip size="small" label="Default" color="primary" />
                                )}
                              </Stack>
                            </Box>
                          }
                        />
                      ))}

                      <Divider sx={{ my: 1 }} />

                      <FormControlLabel
                        value="new"
                        control={<Radio size="small" />}
                        label={<Typography variant="body2" fontWeight={500}>Enter a new address</Typography>}
                      />
                    </RadioGroup>
                  </>
                )}

                {addresses.length === 0 && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    This customer has no saved addresses. Enter one below.
                  </Alert>
                )}

                {(addrChoice === 'new' || addresses.length === 0) && (
                  <Stack spacing={1.5} mt={addresses.length > 0 ? 1 : 0}>
                    <TextField
                      label="Address line 1" size="small" fullWidth required
                      value={newAddr.line1}
                      onChange={(e) => setNewAddr((p) => ({ ...p, line1: e.target.value }))}
                    />
                    <TextField
                      label="Address line 2 (optional)" size="small" fullWidth
                      value={newAddr.line2}
                      onChange={(e) => setNewAddr((p) => ({ ...p, line2: e.target.value }))}
                    />
                    <Stack direction="row" spacing={1}>
                      <TextField
                        label="City" size="small" fullWidth required
                        value={newAddr.city}
                        onChange={(e) => setNewAddr((p) => ({ ...p, city: e.target.value }))}
                      />
                      <TextField
                        label="State" size="small" fullWidth required
                        value={newAddr.state}
                        onChange={(e) => setNewAddr((p) => ({ ...p, state: e.target.value }))}
                      />
                    </Stack>
                    <TextField
                      label="Postal code" size="small" required sx={{ maxWidth: 180 }}
                      value={newAddr.postalCode}
                      onChange={(e) => setNewAddr((p) => ({ ...p, postalCode: e.target.value }))}
                    />
                  </Stack>
                )}
              </>
            )}
          </Box>
        )}

        {/* ── Step 3: Schedule ─────────────────────────────────────────────── */}
        {step === 3 && (
          <Stack spacing={2}>
            {/* Booking summary */}
            <Card variant="outlined" sx={{ p: 1.5, bgcolor: 'grey.50' }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                Booking summary
              </Typography>
              <Typography variant="body2"><b>Customer:</b> {customer?.full_name}</Typography>
              <Typography variant="body2"><b>Service:</b> {service?.name} · {formatMoney(service?.basePrice, service?.currency)}</Typography>
              <Typography variant="body2">
                <b>Address:</b>{' '}
                {addrChoice !== 'new'
                  ? addrOneLine(selectedAddr)
                  : `${newAddr.line1}, ${newAddr.city} - ${newAddr.postalCode}`}
              </Typography>
            </Card>

            <TextField
              label="Scheduled date & time"
              type="datetime-local"
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: minDatetimeStr }}
              value={scheduledStart}
              onChange={(e) => setScheduledStart(e.target.value)}
            />

            <TextField
              label="Notes (optional)"
              placeholder="Any special instructions from the customer…"
              multiline
              rows={3}
              fullWidth
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            {submitError && <Alert severity="error">{submitError}</Alert>}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleBack} disabled={createBooking.isPending}>
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        <Button
          variant="contained"
          onClick={handleNext}
          disabled={!canNext() || createBooking.isPending}
          startIcon={createBooking.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {step === STEPS.length - 1
            ? createBooking.isPending ? 'Creating…' : 'Create Booking'
            : 'Next'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
