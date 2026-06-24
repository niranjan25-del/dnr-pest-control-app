import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardActionArea, CardContent, Chip, CircularProgress,
  Divider, IconButton, InputAdornment, Link, MenuItem, Stack,
  Step, StepLabel, Stepper, TextField, Tooltip, Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ClearIcon from '@mui/icons-material/Clear';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import HomeIcon from '@mui/icons-material/Home';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ScheduleIcon from '@mui/icons-material/Schedule';
import { formatMoney } from '@/utils/format';
import { paths } from '@/routes/paths';
import {
  useAvailableServices, useAvailablePackages,
  useMyAddresses, useCreateBooking,
  useValidateCoupon, useRedeemCoupon,
  useCheckCoverage,
} from './hooks';
import type { CouponPreview, CustomerAddress, PackageOption, ServiceOption } from './types';

const BRAND = '#1565C0';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(min?: number | null) {
  if (!min) return '';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function getPrice(item: ServiceOption | PackageOption): number {
  if ('base_price' in item && item.base_price != null) return Number(item.base_price);
  if ('basePrice' in item && item.basePrice != null) return Number(item.basePrice);
  if ('price' in item) return Number(item.price);
  return 0;
}

function getDuration(item: ServiceOption): number | null {
  return item.duration_minutes ?? item.estimatedDurationMin ?? null;
}

function isValidUrl(str: string) {
  try { return Boolean(new URL(str)); } catch { return false; }
}

// ── Step 1: Select Service or Package ────────────────────────────────────────

type SelectionType = 'service' | 'package';
interface Selection {
  type: SelectionType;
  item: ServiceOption | PackageOption;
}

function Step1Service({
  selected, onSelect,
}: {
  selected: Selection | null;
  onSelect: (s: Selection) => void;
}) {
  const { data: services = [], isLoading: loadSvc } = useAvailableServices();
  const { data: packages = [], isLoading: loadPkg } = useAvailablePackages();
  const [tab, setTab] = useState<'service' | 'package'>('service');

  const loading = loadSvc || loadPkg;
  if (loading) return <Box textAlign="center" py={4}><CircularProgress /></Box>;

  const items = tab === 'service' ? services : packages;

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
        Choose what you'd like to book
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 2.5 }}>
        <Chip
          label={`Services (${services.length})`}
          onClick={() => setTab('service')}
          color={tab === 'service' ? 'primary' : 'default'}
          variant={tab === 'service' ? 'filled' : 'outlined'}
        />
        {packages.length > 0 && (
          <Chip
            label={`Packages (${packages.length})`}
            onClick={() => setTab('package')}
            color={tab === 'package' ? 'primary' : 'default'}
            variant={tab === 'package' ? 'filled' : 'outlined'}
          />
        )}
      </Stack>

      {items.length === 0 && (
        <Alert severity="info">No {tab}s available at the moment. Please contact us.</Alert>
      )}

      <Stack spacing={1.5}>
        {items.map((item) => {
          const price = getPrice(item);
          const duration = tab === 'service' ? getDuration(item as ServiceOption) : null;
          const isSelected = selected?.item.id === item.id;

          return (
            <Card
              key={item.id}
              variant="outlined"
              sx={{ borderColor: isSelected ? BRAND : 'divider', borderWidth: isSelected ? 2 : 1, transition: 'all 0.15s' }}
            >
              <CardActionArea onClick={() => onSelect({ type: tab, item })} sx={{ p: 2 }}>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                  <Stack direction="row" spacing={1.5} alignItems="flex-start" flex={1}>
                    <Box sx={{ mt: 0.25 }}>
                      {isSelected
                        ? <CheckCircleIcon sx={{ color: BRAND, fontSize: 22 }} />
                        : <RadioButtonUncheckedIcon sx={{ color: 'text.disabled', fontSize: 22 }} />}
                    </Box>
                    <Box flex={1}>
                      <Typography fontWeight={700}>{item.name}</Typography>
                      {item.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{item.description}</Typography>
                      )}
                      {duration && (
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.75 }}>
                          <ScheduleIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                          <Typography variant="caption" color="text.secondary">{fmtDuration(duration)}</Typography>
                        </Stack>
                      )}
                    </Box>
                  </Stack>
                  <Box textAlign="right" ml={2}>
                    <Typography fontWeight={800} sx={{ color: BRAND }}>{formatMoney(price, 'INR')}</Typography>
                    {tab === 'package' && (
                      <Chip size="small" label="Package" color="secondary" variant="outlined" sx={{ mt: 0.5, fontSize: 10, height: 18 }} />
                    )}
                  </Box>
                </Stack>
              </CardActionArea>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
}

// ── Step 2: Select Address + Location ────────────────────────────────────────

function LocationSection({
  locationLink, onLocationLink,
}: {
  locationLink: string;
  onLocationLink: (v: string) => void;
}) {
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Location access is not supported by your browser. Please paste a Google Maps link.');
      return;
    }
    setGeoLoading(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        onLocationLink(`https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`);
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(
          err.code === 1
            ? 'Location permission denied. Please paste a Google Maps link instead.'
            : 'Could not detect your location. Please paste a Google Maps link instead.',
        );
        setGeoLoading(false);
      },
      { timeout: 10_000 },
    );
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) onLocationLink(text.trim());
    } catch {
      // clipboard permission denied — user types manually
    }
  };

  const valid = locationLink && isValidUrl(locationLink);

  return (
    <Box sx={{ mt: 2.5 }}>
      <Divider sx={{ mb: 2 }} />

      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <MyLocationIcon sx={{ fontSize: 18, color: BRAND }} />
        <Typography variant="subtitle2" fontWeight={700}>
          Share your exact location
          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            (optional — helps the technician find you faster)
          </Typography>
        </Typography>
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Paste a Google Maps link or tap the button below to share your current location.
      </Typography>

      {/* Auto-detect button */}
      <Button
        variant="outlined"
        size="small"
        startIcon={geoLoading ? <CircularProgress size={14} /> : <MyLocationIcon />}
        onClick={handleUseMyLocation}
        disabled={geoLoading}
        sx={{ mb: 1.5, borderColor: BRAND, color: BRAND }}
      >
        {geoLoading ? 'Detecting location…' : 'Use my current location'}
      </Button>

      {geoError && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>{geoError}</Alert>
      )}

      {/* Manual paste field */}
      <TextField
        fullWidth
        size="small"
        label="Google Maps link"
        placeholder="https://maps.app.goo.gl/... or https://maps.google.com/..."
        value={locationLink}
        onChange={(e) => onLocationLink(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <MyLocationIcon fontSize="small" sx={{ color: 'text.disabled' }} />
            </InputAdornment>
          ),
          endAdornment: locationLink ? (
            <InputAdornment position="end">
              <Tooltip title="Clear">
                <IconButton size="small" onClick={() => onLocationLink('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </InputAdornment>
          ) : (
            <InputAdornment position="end">
              <Tooltip title="Paste from clipboard">
                <IconButton size="small" onClick={handlePaste}>
                  <ContentPasteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </InputAdornment>
          ),
        }}
      />

      {/* Link preview */}
      {valid && (
        <Card
          variant="outlined"
          sx={{ mt: 1.5, borderColor: '#4CAF5040', bgcolor: '#4CAF5008', p: 1.5, borderRadius: 2 }}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <CheckCircleIcon sx={{ color: '#4CAF50', fontSize: 18, flexShrink: 0 }} />
            <Box flex={1} minWidth={0}>
              <Typography variant="caption" color="text.secondary" display="block">Location link saved</Typography>
              <Typography
                variant="body2"
                fontWeight={600}
                noWrap
                sx={{ color: BRAND, fontSize: 12, maxWidth: '100%' }}
              >
                {locationLink}
              </Typography>
            </Box>
            <Link href={locationLink} target="_blank" rel="noopener noreferrer" sx={{ flexShrink: 0 }}>
              <Tooltip title="Open in Google Maps">
                <IconButton size="small" sx={{ color: BRAND }}>
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Link>
          </Stack>
        </Card>
      )}

      {/* How to share guide */}
      {!locationLink && (
        <Box sx={{ mt: 1.5, p: 1.5, bgcolor: 'action.hover', borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ mb: 0.5 }}>
            How to get a Google Maps link:
          </Typography>
          {[
            'Open Google Maps on your phone',
            'Hold your finger on your exact location (blue dot)',
            'Tap "Share" → copy the link',
            'Paste it here',
          ].map((step, i) => (
            <Typography key={i} variant="caption" color="text.secondary" display="block">
              {i + 1}. {step}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}

function Step2Address({
  selected, onSelect, locationLink, onLocationLink, onCoverageChange,
}: {
  selected: CustomerAddress | null;
  onSelect: (a: CustomerAddress) => void;
  locationLink: string;
  onLocationLink: (v: string) => void;
  onCoverageChange: (covered: boolean | null) => void;
}) {
  const { data: addresses = [], isLoading } = useMyAddresses();
  const selectedPostalCode = selected ? (selected.postalCode ?? selected.postal_code ?? '') : '';
  const { data: coverage, isLoading: coverageLoading } = useCheckCoverage(selectedPostalCode);

  useEffect(() => {
    if (!selectedPostalCode) { onCoverageChange(null); return; }
    if (coverage) onCoverageChange(coverage.covered);
  }, [coverage, selectedPostalCode, onCoverageChange]);

  if (isLoading) return <Box textAlign="center" py={4}><CircularProgress /></Box>;

  if (addresses.length === 0) {
    return (
      <Alert severity="warning">
        You have no saved addresses. Please go to <b>My Profile → Addresses</b> and add an address first.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
        Choose the service address
      </Typography>

      <Stack spacing={1.5}>
        {addresses.map((addr) => {
          const isDefault = addr.isDefault ?? addr.is_default ?? false;
          const postalCode = addr.postalCode ?? addr.postal_code ?? '';
          const isSelected = selected?.id === addr.id;

          return (
            <Card
              key={addr.id}
              variant="outlined"
              sx={{ borderColor: isSelected ? BRAND : 'divider', borderWidth: isSelected ? 2 : 1, transition: 'all 0.15s' }}
            >
              <CardActionArea onClick={() => onSelect(addr)} sx={{ p: 2 }}>
                <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                  <Box sx={{ mt: 0.25 }}>
                    {isSelected
                      ? <CheckCircleIcon sx={{ color: BRAND, fontSize: 22 }} />
                      : <RadioButtonUncheckedIcon sx={{ color: 'text.disabled', fontSize: 22 }} />}
                  </Box>
                  <Box flex={1}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                      <HomeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      {addr.label && <Typography variant="body2" fontWeight={700}>{addr.label}</Typography>}
                      {isDefault && <Chip label="Default" size="small" color="primary" sx={{ height: 18, fontSize: 10 }} />}
                    </Stack>
                    <Typography variant="body2">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</Typography>
                    <Typography variant="body2" color="text.secondary">{addr.city}, {addr.state} {postalCode}</Typography>
                  </Box>
                </Stack>
              </CardActionArea>
            </Card>
          );
        })}
      </Stack>

      {/* Coverage status */}
      {selected && (
        <Box sx={{ mt: 1.5 }}>
          {coverageLoading ? (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 1 }}>
              <CircularProgress size={14} />
              <Typography variant="caption" color="text.secondary">Checking if we service this area…</Typography>
            </Stack>
          ) : coverage?.covered === true ? (
            <Alert severity="success" sx={{ py: 0.5 }}>
              We service this area — you're good to go!
            </Alert>
          ) : coverage?.covered === false ? (
            <Alert severity="error" sx={{ py: 0.5 }}>
              Sorry, we don't currently service postal code <b>{selectedPostalCode}</b>. Please try a different address or contact us.
            </Alert>
          ) : null}
        </Box>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
        Need to add a new address? Go to My Profile → Addresses and add it, then come back here.
      </Typography>

      {/* Location link section */}
      <LocationSection locationLink={locationLink} onLocationLink={onLocationLink} />
    </Box>
  );
}

// ── Step 3: Date & Time ───────────────────────────────────────────────────────

const TIME_SLOTS = [
  { label: 'Morning (9:00 AM)', value: '09:00' },
  { label: 'Mid morning (10:30 AM)', value: '10:30' },
  { label: 'Afternoon (12:00 PM)', value: '12:00' },
  { label: 'Early afternoon (2:00 PM)', value: '14:00' },
  { label: 'Late afternoon (4:00 PM)', value: '16:00' },
  { label: 'Evening (6:00 PM)', value: '18:00' },
  { label: 'Evening (7:00 PM)', value: '19:00' },
  { label: 'Evening (8:00 PM)', value: '20:00' },
];

type Priority = 'NORMAL' | 'HIGH';

const PRIORITY_OPTIONS: { value: Priority; label: string; desc: string; color: string }[] = [
  { value: 'NORMAL', label: 'Standard', desc: 'Schedule within 1–3 days',    color: '#4CAF50' },
  { value: 'HIGH',   label: 'Priority', desc: 'Assigned within 3 hours · +5%', color: '#FF9800' },
];

function Step3DateTime({
  date, time, notes, priority,
  onDate, onTime, onNotes, onPriority,
}: {
  date: string; time: string; notes: string; priority: Priority;
  onDate: (v: string) => void;
  onTime: (v: string) => void;
  onNotes: (v: string) => void;
  onPriority: (v: Priority) => void;
}) {
  const todayStr = new Date().toISOString().split('T')[0];

  const getAvailableSlots = (selectedDate: string) => {
    if (selectedDate !== todayStr) return TIME_SLOTS;
    const cutoff = Date.now() + 5 * 60 * 60 * 1000; // 5 hours from now
    return TIME_SLOTS.filter((s) => {
      const [h, m] = s.value.split(':').map(Number);
      const slotTime = new Date();
      slotTime.setHours(h, m, 0, 0);
      return slotTime.getTime() >= cutoff;
    });
  };

  const availableSlots = getAvailableSlots(date);
  const isToday = date === todayStr;

  const handleDateChange = (v: string) => {
    onDate(v);
    const slots = getAvailableSlots(v);
    if (slots.length > 0 && !slots.find((s) => s.value === time)) {
      onTime(slots[0].value);
    }
  };

  return (
    <Stack spacing={2.5}>
      <Typography variant="subtitle2" color="text.secondary">
        Choose your preferred date and time
      </Typography>

      {/* Priority selector */}
      <Box>
        <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Urgency level</Typography>
        <Stack direction="row" spacing={1}>
          {PRIORITY_OPTIONS.map((opt) => {
            const sel = priority === opt.value;
            return (
              <Card
                key={opt.value}
                variant="outlined"
                onClick={() => onPriority(opt.value)}
                sx={{
                  flex: 1, cursor: 'pointer', transition: 'all 0.15s',
                  borderColor: sel ? opt.color : 'divider',
                  borderWidth: sel ? 2 : 1,
                  bgcolor: sel ? `${opt.color}08` : 'transparent',
                }}
              >
                <CardContent sx={{ p: '10px !important', textAlign: 'center' }}>
                  <Typography variant="caption" fontWeight={700} sx={{ color: sel ? opt.color : 'text.secondary', display: 'block' }}>
                    {opt.label}
                  </Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10, lineHeight: 1.2 }}>
                    {opt.desc}
                  </Typography>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      </Box>

      <TextField
        label="Preferred date"
        type="date"
        fullWidth
        required
        value={date}
        onChange={(e) => handleDateChange(e.target.value)}
        InputLabelProps={{ shrink: true }}
        inputProps={{ min: todayStr }}
        helperText="Same-day bookings are available — slots must be at least 5 hours from now"
      />

      <TextField
        select
        label="Preferred time slot"
        fullWidth
        required
        value={time}
        onChange={(e) => onTime(e.target.value)}
        helperText={isToday && availableSlots.length === 0
          ? 'No slots available today — please select a future date'
          : 'Our team will confirm the exact time'}
        error={isToday && availableSlots.length === 0}
      >
        {availableSlots.map((s) => (
          <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
        ))}
      </TextField>

      <TextField
        label="Special instructions (optional)"
        multiline
        rows={3}
        fullWidth
        value={notes}
        onChange={(e) => onNotes(e.target.value)}
        placeholder="Any access instructions, special requirements, pet information…"
        inputProps={{ maxLength: 1000 }}
        helperText={`${notes.length}/1000`}
      />
    </Stack>
  );
}

// ── Step 4: Review & Confirm ──────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>{label}</Typography>
      <Box textAlign="right" sx={{ flex: 1, ml: 2 }}>
        {typeof value === 'string'
          ? <Typography variant="body2" fontWeight={600}>{value}</Typography>
          : value}
      </Box>
    </Stack>
  );
}

function ReviewLocationRow({ locationLink }: { locationLink: string }) {
  const valid = isValidUrl(locationLink);
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>Location pin</Typography>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flex: 1, ml: 2, justifyContent: 'flex-end' }}>
        {valid ? (
          <>
            <CheckCircleIcon sx={{ fontSize: 14, color: '#4CAF50' }} />
            <Link
              href={locationLink}
              target="_blank"
              rel="noopener noreferrer"
              variant="body2"
              fontWeight={600}
              sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
            >
              Open in Google Maps
            </Link>
            <OpenInNewIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
          </>
        ) : (
          <Typography variant="body2" fontWeight={600}>{locationLink}</Typography>
        )}
      </Stack>
    </Stack>
  );
}

function Step4Confirm({
  selection, address, date, time, notes, locationLink, priority, onCouponApplied,
}: {
  selection: Selection;
  address: CustomerAddress;
  date: string;
  time: string;
  notes: string;
  locationLink: string;
  priority: Priority;
  onCouponApplied: (coupon: { code: string; discountAmount: number } | null) => void;
}) {
  const basePrice = getPrice(selection.item);
  const displayPrice = priority === 'HIGH' ? Math.round(basePrice * 1.05 * 100) / 100 : basePrice;
  const postalCode = address.postalCode ?? address.postal_code ?? '';

  const [couponInput,   setCouponInput]   = useState('');
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(null);
  const [couponError,   setCouponError]   = useState('');
  const validateCoupon = useValidateCoupon();

  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponError('');
    try {
      const result = await validateCoupon.mutateAsync({ code, amount: displayPrice });
      if (result.valid) {
        setCouponPreview(result);
        onCouponApplied({ code, discountAmount: result.discount_amount });
      } else {
        setCouponPreview(null);
        setCouponError(result.reason ?? 'Invalid or expired coupon code.');
        onCouponApplied(null);
      }
    } catch {
      setCouponError('Could not validate coupon. Please try again.');
    }
  };

  const handleRemoveCoupon = () => {
    setCouponInput('');
    setCouponPreview(null);
    setCouponError('');
    onCouponApplied(null);
  };

  const formattedDate = new Date(`${date}T${time}`).toLocaleString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  const priceLabel = priority === 'HIGH'
    ? `${formatMoney(displayPrice, 'INR')} (${formatMoney(basePrice, 'INR')} + 5% priority)`
    : formatMoney(displayPrice, 'INR');

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
        Review your booking details
      </Typography>

      <Card variant="outlined" sx={{ borderColor: `${BRAND}30`, bgcolor: `${BRAND}04` }}>
        <CardContent>
          <ReviewRow
            label={selection.type === 'package' ? 'Package' : 'Service'}
            value={selection.item.name}
          />
          <ReviewRow
            label="Address"
            value={`${address.line1}${address.line2 ? ', ' + address.line2 : ''}, ${address.city}, ${address.state} ${postalCode}`}
          />
          {locationLink && <ReviewLocationRow locationLink={locationLink} />}
          <ReviewRow label="Scheduled" value={formattedDate} />
          {couponPreview ? (
            <>
              <ReviewRow label={priority === 'HIGH' ? 'Price (+ priority)' : 'Base price'} value={priceLabel} />
              <ReviewRow
                label="Coupon discount"
                value={
                  <Typography variant="body2" fontWeight={700} sx={{ color: '#2E7D32' }}>
                    -{formatMoney(couponPreview.discount_amount, 'INR')}
                  </Typography>
                }
              />
              <ReviewRow
                label="You pay"
                value={
                  <Typography variant="body2" fontWeight={800} sx={{ color: BRAND }}>
                    {formatMoney(couponPreview.final_amount, 'INR')}
                  </Typography>
                }
              />
            </>
          ) : (
            <>
              <ReviewRow label="Estimated price" value={priceLabel} />
              {priority === 'HIGH' && <ReviewRow label="Urgency" value="⚡ High Priority" />}
            </>
          )}
          {notes && <ReviewRow label="Notes" value={notes} />}
        </CardContent>
      </Card>

      {/* Coupon code input */}
      <Card variant="outlined" sx={{ mt: 2, borderStyle: 'dashed' }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1.25 }}>
            <LocalOfferIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 0.5 }}>
              COUPON CODE
            </Typography>
          </Stack>
          {couponPreview ? (
            <Chip
              icon={<LocalOfferIcon sx={{ fontSize: '0.9rem !important' }} />}
              label={`${couponPreview.code} · -${formatMoney(couponPreview.discount_amount, 'INR')}`}
              color="success"
              variant="outlined"
              onDelete={handleRemoveCoupon}
              sx={{ fontWeight: 700, fontFamily: 'monospace' }}
            />
          ) : (
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <TextField
                size="small"
                placeholder="E.g. SAVE20"
                value={couponInput}
                onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleApplyCoupon(); } }}
                error={Boolean(couponError)}
                helperText={couponError || ' '}
                sx={{ flex: 1 }}
                inputProps={{ style: { textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: 1 } }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={() => void handleApplyCoupon()}
                disabled={!couponInput.trim() || validateCoupon.isPending}
                sx={{ whiteSpace: 'nowrap', mt: 0.25 }}
              >
                {validateCoupon.isPending ? <CircularProgress size={16} /> : 'Apply'}
              </Button>
            </Stack>
          )}
        </CardContent>
      </Card>

      {locationLink && (
        <Alert severity="success" icon={<MyLocationIcon fontSize="inherit" />} sx={{ mt: 2 }}>
          Your location pin is attached. The technician will use it to find your exact spot.
        </Alert>
      )}

      <Alert severity="info" sx={{ mt: locationLink ? 1 : 2 }}>
        Your booking will be in <b>Pending</b> status until our team confirms it.
      </Alert>
    </Box>
  );
}

// ── Build combined notes ──────────────────────────────────────────────────────

function buildNotes(locationLink: string, notes: string): string | undefined {
  const parts: string[] = [];
  if (locationLink.trim()) parts.push(`📍 Location: ${locationLink.trim()}`);
  if (notes.trim()) parts.push(notes.trim());
  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const STEPS = ['Choose service', 'Service address', 'Date & time', 'Confirm'];

export function BookServicePage() {
  const navigate = useNavigate();
  const createBooking = useCreateBooking();
  const redeemCoupon  = useRedeemCoupon();

  const [activeStep, setActiveStep] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [address, setAddress] = useState<CustomerAddress | null>(null);
  const [coverageOk, setCoverageOk] = useState<boolean | null>(null);
  const [locationLink, setLocationLink] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleAddressSelect = (addr: CustomerAddress) => {
    setAddress(addr);
    setCoverageOk(null); // reset until coverage check resolves for new address
  };

  const canNext = () => {
    if (activeStep === 0) return Boolean(selection);
    if (activeStep === 1) return Boolean(address) && coverageOk === true;
    if (activeStep === 2) return Boolean(date && time);
    return true;
  };

  const handleNext = () => setActiveStep((s) => s + 1);
  const handleBack = () => setActiveStep((s) => s - 1);

  const handleConfirm = async () => {
    if (!selection || !address || !date || !time) return;
    setSubmitError('');

    const scheduledStart = new Date(`${date}T${time}:00`).toISOString();
    const combinedNotes = buildNotes(locationLink, notes);

    try {
      const newBooking = await createBooking.mutateAsync({
        ...(selection.type === 'service' ? { serviceId: selection.item.id } : { packageId: selection.item.id }),
        addressId: address.id,
        scheduledStart,
        ...(combinedNotes ? { notes: combinedNotes } : {}),
        ...(priority !== 'NORMAL' ? { priority } : {}),
      });
      if (appliedCoupon) {
        try {
          await redeemCoupon.mutateAsync({ code: appliedCoupon.code, bookingId: newBooking.id });
        } catch { /* booking still succeeded — coupon error is non-fatal */ }
      }
      setSuccess(true);
    } catch (e: unknown) {
      const msg = (e as { message?: string; response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (e as Error).message
        ?? 'Failed to create booking. Please try again.';
      setSubmitError(Array.isArray(msg) ? msg.join('. ') : String(msg));
    }
  };

  if (success) {
    return (
      <Box sx={{ maxWidth: 480, mx: 'auto', textAlign: 'center', pt: 6 }}>
        <CheckCircleIcon sx={{ fontSize: 72, color: '#4CAF50', mb: 2 }} />
        <Typography variant="h5" fontWeight={800} sx={{ mb: 1 }}>Booking Submitted!</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Your booking is pending confirmation. Our team will review and confirm shortly.
        </Typography>
        <Stack direction="row" spacing={1.5} justifyContent="center">
          <Button variant="outlined" onClick={() => navigate(paths.customerBookings)}>
            View My Bookings
          </Button>
          <Button variant="contained" sx={{ bgcolor: BRAND }} onClick={() => navigate(paths.customerDashboard)}>
            Go to Dashboard
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto' }}>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 3 }}>Book a Service</Typography>

      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ pt: 2.5 }}>
          {activeStep === 0 && (
            <Step1Service selected={selection} onSelect={setSelection} />
          )}
          {activeStep === 1 && (
            <Step2Address
              selected={address}
              onSelect={handleAddressSelect}
              locationLink={locationLink}
              onLocationLink={setLocationLink}
              onCoverageChange={setCoverageOk}
            />
          )}
          {activeStep === 2 && (
            <Step3DateTime
              date={date} time={time} notes={notes} priority={priority}
              onDate={setDate} onTime={setTime} onNotes={setNotes} onPriority={setPriority}
            />
          )}
          {activeStep === 3 && selection && address && (
            <Step4Confirm
              selection={selection} address={address}
              date={date} time={time} notes={notes}
              locationLink={locationLink} priority={priority}
              onCouponApplied={setAppliedCoupon}
            />
          )}
        </CardContent>
      </Card>

      {submitError && (
        <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>
      )}

      <Divider sx={{ mb: 2 }} />

      <Stack direction="row" justifyContent="space-between">
        <Button
          variant="outlined"
          onClick={activeStep === 0 ? () => navigate(-1) : handleBack}
          disabled={createBooking.isPending}
        >
          {activeStep === 0 ? 'Cancel' : 'Back'}
        </Button>

        {activeStep < STEPS.length - 1 ? (
          <Button
            variant="contained"
            sx={{ bgcolor: BRAND }}
            onClick={handleNext}
            disabled={!canNext()}
          >
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            sx={{ bgcolor: '#1E8E5A' }}
            onClick={handleConfirm}
            disabled={createBooking.isPending || redeemCoupon.isPending || !canNext()}
            startIcon={(createBooking.isPending || redeemCoupon.isPending) ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {createBooking.isPending ? 'Confirming…' : redeemCoupon.isPending ? 'Applying coupon…' : 'Confirm Booking'}
          </Button>
        )}
      </Stack>
    </Box>
  );
}
