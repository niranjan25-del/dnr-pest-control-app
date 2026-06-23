import { useState, useEffect } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogContent, DialogTitle, Divider, IconButton, Stack, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import PaymentIcon from '@mui/icons-material/Payment';
import ReceiptIcon from '@mui/icons-material/Receipt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { formatMoney } from '@/utils/format';
import { useMyInvoices, useCreateCashfreeOrder, useConfirmCashfreePayment } from './hooks';
import { customerPortalApi } from './api';
import type { CashfreeOrderResult, CustomerInvoice } from './types';

const BRAND = '#1565C0';

const STATUS_COLOR: Record<string, string> = {
  DRAFT:          '#9E9E9E',
  ISSUED:         '#FF9800',
  PARTIALLY_PAID: '#2196F3',
  PAID:           '#4CAF50',
  OVERDUE:        '#F44336',
  VOID:           '#9E9E9E',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT:          'Draft',
  ISSUED:         'Unpaid',
  PARTIALLY_PAID: 'Partially Paid',
  PAID:           'Paid',
  OVERDUE:        'Overdue',
  VOID:           'Void',
};

// ── Cashfree SDK loader ───────────────────────────────────────────────────────

function loadCashfreeScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ('Cashfree' in window) { resolve(true); return; }
    const s = document.createElement('script');
    s.src     = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

declare global {
  interface Window {
    Cashfree: (config: { mode: string }) => {
      checkout: (opts: { paymentSessionId: string; redirectTarget: string }) => Promise<{
        error?: { message: string; code?: string } | null;
        redirect?: boolean;
        paymentDetails?: { paymentMessage: string } | null;
      }>;
    };
  }
}

// ── Pay button ────────────────────────────────────────────────────────────────

function PayButton({ invoice, onPaid }: { invoice: CustomerInvoice; onPaid: () => void }) {
  const createOrder = useCreateCashfreeOrder();
  const confirm     = useConfirmCashfreePayment();
  const [err, setErr] = useState('');

  const handlePay = async () => {
    setErr('');
    try {
      const loaded = await loadCashfreeScript();
      if (!loaded) { setErr('Could not load payment gateway. Check your internet connection.'); return; }

      const order: CashfreeOrderResult = await createOrder.mutateAsync(invoice.booking_id!);
      const mode     = import.meta.env.VITE_CASHFREE_MODE ?? 'sandbox';
      const cashfree = window.Cashfree({ mode });

      const result = await cashfree.checkout({
        paymentSessionId: order.payment_session_id,
        redirectTarget: '_modal',
      });

      if (result.paymentDetails) {
        const payment = await confirm.mutateAsync(order.order_id);
        if (payment.status === 'SUCCEEDED') {
          onPaid();
        } else {
          setErr('Payment processing. Your invoice will update shortly.');
        }
      } else if (result.error) {
        setErr(result.error.message ?? 'Payment failed or was cancelled.');
      }
    } catch (e: unknown) {
      setErr((e as { message?: string })?.message ?? 'Payment failed. Please try again.');
    }
  };

  const busy = createOrder.isPending || confirm.isPending;

  return (
    <Box>
      {err && <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert>}
      <Button
        variant="contained"
        size="small"
        startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <PaymentIcon />}
        onClick={handlePay}
        disabled={busy || !invoice.booking_id}
        sx={{ bgcolor: BRAND }}
      >
        {busy ? 'Processing…' : 'Pay Now'}
      </Button>
    </Box>
  );
}

// ── Invoice detail modal ──────────────────────────────────────────────────────

function DownloadPdfButton({ invoiceId }: { invoiceId: string }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleDownload = async () => {
    setLoading(true);
    setErr('');
    try {
      await customerPortalApi.downloadInvoicePdf(invoiceId);
    } catch {
      setErr('Could not download PDF. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ mt: 1.5 }}>
      {err && <Alert severity="error" sx={{ mb: 1 }}>{err}</Alert>}
      <Button
        fullWidth
        variant="outlined"
        size="small"
        startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon />}
        onClick={handleDownload}
        disabled={loading}
      >
        {loading ? 'Preparing PDF…' : 'Download PDF'}
      </Button>
    </Box>
  );
}

function InvoiceModal({ invoice, onClose, onPaid }: {
  invoice: CustomerInvoice;
  onClose: () => void;
  onPaid: () => void;
}) {
  const color    = STATUS_COLOR[invoice.status] ?? '#9E9E9E';
  const label    = STATUS_LABEL[invoice.status] ?? invoice.status;
  const subtotal = Number(invoice.subtotal_amount ?? 0);
  const tax      = Number(invoice.tax_amount ?? 0);
  const discount = Number(invoice.discount_amount ?? 0);
  const total    = Number(invoice.total_amount);
  const isPaid   = invoice.status === 'PAID';

  const handlePaid = () => { onPaid(); onClose(); };

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <ReceiptIcon sx={{ color: BRAND }} />
          <Typography fontWeight={700}>{invoice.invoice_number ?? 'Invoice'}</Typography>
        </Stack>
        <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Chip label={label} size="small" sx={{ bgcolor: `${color}18`, color, fontWeight: 700 }} />
          {invoice.due_date && !isPaid && (
            <Typography variant="caption" color="text.secondary">
              Due {new Date(invoice.due_date).toLocaleDateString('en-IN')}
            </Typography>
          )}
        </Stack>

        <Divider sx={{ mb: 2 }} />

        {[
          subtotal && { label: 'Subtotal',   value: subtotal  },
          discount && { label: 'Discount',   value: -discount },
          tax      && { label: 'GST (18%)',  value: tax       },
        ].filter(Boolean).map((row) => (
          <Stack key={(row as { label: string }).label} direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography variant="body2" color="text.secondary">{(row as { label: string }).label}</Typography>
            <Typography variant="body2">{formatMoney((row as { value: number }).value, invoice.currency)}</Typography>
          </Stack>
        ))}

        <Divider sx={{ my: 1 }} />
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 2.5 }}>
          <Typography fontWeight={700}>Total</Typography>
          <Typography fontWeight={800} sx={{ color: BRAND }}>{formatMoney(total, invoice.currency)}</Typography>
        </Stack>

        {isPaid ? (
          <Stack direction="row" alignItems="center" spacing={1}
            sx={{ p: 1.5, bgcolor: '#4CAF5010', borderRadius: 2 }}>
            <CheckCircleIcon sx={{ color: '#4CAF50' }} />
            <Typography variant="body2" fontWeight={600} sx={{ color: '#4CAF50' }}>Payment received</Typography>
          </Stack>
        ) : invoice.booking_id ? (
          <PayButton invoice={invoice} onPaid={handlePaid} />
        ) : (
          <Alert severity="info" sx={{ mt: 1 }}>Contact support to pay this invoice.</Alert>
        )}

        <DownloadPdfButton invoiceId={invoice.id} />
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function CustomerInvoicesPage() {
  const [page, setPage]         = useState(1);
  const [selected, setSelected] = useState<CustomerInvoice | null>(null);
  const { data, isLoading, refetch } = useMyInvoices({ page, limit: 20 });
  const invoices = data?.data ?? [];

  useEffect(() => { window.scrollTo(0, 0); }, [page]);

  const handlePaid = () => { refetch(); setSelected(null); };

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 3 }}>My Invoices</Typography>

      {isLoading ? (
        <Box textAlign="center" py={6}><CircularProgress /></Box>
      ) : invoices.length === 0 ? (
        <Card variant="outlined" sx={{ p: 5, textAlign: 'center', bgcolor: 'action.hover' }}>
          <ReceiptIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">No invoices yet. Your invoices appear here after booking.</Typography>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {invoices.map((inv) => {
            const color  = STATUS_COLOR[inv.status] ?? '#9E9E9E';
            const label  = STATUS_LABEL[inv.status] ?? inv.status;
            const isPaid = inv.status === 'PAID';
            return (
              <Card
                key={inv.id} variant="outlined"
                sx={{ '&:hover': { borderColor: BRAND }, cursor: 'pointer', transition: 'border-color 0.15s' }}
                onClick={() => setSelected(inv)}
              >
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1.5}>
                      <ReceiptIcon sx={{ color: isPaid ? '#4CAF50' : BRAND, fontSize: 22 }} />
                      <Box>
                        <Typography fontWeight={700} variant="body2">{inv.invoice_number ?? inv.id.slice(0, 8)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {inv.created_at
                            ? new Date(inv.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                            : ''}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack alignItems="flex-end" spacing={0.5}>
                      <Typography fontWeight={800} sx={{ color: isPaid ? '#4CAF50' : BRAND }}>
                        {formatMoney(inv.total_amount, inv.currency)}
                      </Typography>
                      <Chip
                        label={label} size="small"
                        sx={{ bgcolor: `${color}18`, color, fontWeight: 700, fontSize: 10, height: 18 }}
                      />
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      {data && data.meta.total > 20 && (
        <Stack direction="row" justifyContent="center" spacing={1} sx={{ mt: 3 }}>
          <Button size="small" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <Typography sx={{ alignSelf: 'center', fontSize: 13 }}>Page {page}</Typography>
          <Button size="small" disabled={invoices.length < 20} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </Stack>
      )}

      {selected && (
        <InvoiceModal invoice={selected} onClose={() => setSelected(null)} onPaid={handlePaid} />
      )}
    </Box>
  );
}
