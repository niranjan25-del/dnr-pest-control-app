// lib/features/technician/jobs/job_workflow/job_workflow_screen.dart
//
// Job workflow as a visual Stepper: accept → en route → arrived → in progress →
// report capture (photos/chemicals/notes/signature) → submit → complete.

import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../../../core/extensions/context_extensions.dart';
import '../../shared/application/technician_providers.dart';
import '../../shared/models/technician_models.dart';
import 'job_workflow_controller.dart';
import 'report_builder_controller.dart';
import 'signature_pad.dart';

// ── progress step definition ─────────────────────────────────────────────────

enum _Step { accept, enRoute, arrived, inProgress, report, complete }

_Step _currentStep(Job j) {
  if (j.needsAcceptance) return _Step.accept;
  return switch (j.status) {
    JobStatus.confirmed   => _Step.enRoute,
    JobStatus.enRoute     => _Step.arrived,
    JobStatus.arrived     => _Step.inProgress,
    JobStatus.inProgress  => _Step.report,
    JobStatus.completed   => _Step.complete,
    _                     => _Step.accept,
  };
}

Color _stepColor(BuildContext ctx, _Step s) => switch (s) {
  _Step.accept      => Theme.of(ctx).colorScheme.primary,
  _Step.enRoute     => Colors.blue,
  _Step.arrived     => Colors.orange,
  _Step.inProgress  => Colors.deepPurple,
  _Step.report      => Colors.teal,
  _Step.complete    => Colors.green,
};

// ── main screen ──────────────────────────────────────────────────────────────

class JobWorkflowScreen extends ConsumerStatefulWidget {
  final String bookingId;
  const JobWorkflowScreen({super.key, required this.bookingId});

  @override
  ConsumerState<JobWorkflowScreen> createState() => _JobWorkflowScreenState();
}

class _JobWorkflowScreenState extends ConsumerState<JobWorkflowScreen> {
  final _sig        = SignaturePadController();
  final _signerName = TextEditingController();

  @override
  void dispose() {
    _signerName.dispose();
    super.dispose();
  }

  JobWorkflowController get _wf     => ref.read(jobWorkflowControllerProvider.notifier);
  ReportBuilderController get _rpt  => ref.read(reportBuilderControllerProvider.notifier);

  Future<void> _pickPhotos({required bool before}) async {
    final picked = await ImagePicker().pickMultiImage(imageQuality: 75);
    if (picked.isEmpty) return;
    final files = picked.map((x) => File(x.path)).toList();
    _rpt.update((d) => before
        ? d.copyWith(beforePhotos: [...d.beforePhotos, ...files])
        : d.copyWith(afterPhotos: [...d.afterPhotos, ...files]));
  }

  @override
  Widget build(BuildContext context) {
    final job = ref.watch(jobByIdProvider(widget.bookingId));
    ref.listen(jobWorkflowControllerProvider, (_, n) {
      if (n.isFailure) context.showSnack(n.failure?.message ?? 'Action failed');
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Job workflow', style: TextStyle(fontWeight: FontWeight.w700)),
        centerTitle: false,
        elevation: 0,
      ),
      body: job.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error:   (e, _) => Center(child: Text('Could not load job: $e')),
        data:    (j)   => _buildBody(j),
      ),
    );
  }

  Widget _buildBody(Job j) {
    final step    = _currentStep(j);
    final wfState = ref.watch(jobWorkflowControllerProvider);
    final rpt     = ref.watch(reportBuilderControllerProvider);
    final busy    = wfState.isSubmitting || rpt.submission.isSubmitting;
    final cs      = Theme.of(context).colorScheme;
    final stepIdx = _Step.values.indexOf(step);

    return Column(
      children: [
        // ── Progress bar ──
        _ProgressHeader(step: step, stepIdx: stepIdx),

        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
            children: [
              // ── Job summary header ──
              _JobSummaryCard(j),
              const SizedBox(height: 16),

              // ── Step 1: Accept / Decline ──
              if (j.needsAcceptance)
                _WorkflowSection(
                  step: _Step.accept, current: step,
                  title: 'Accept this job',
                  icon: Icons.assignment_turned_in_outlined,
                  child: _AcceptDeclineStep(j: j, busy: busy, wf: _wf),
                ),

              // ── Step 2: En route ──
              if (!j.needsAcceptance && step.index <= _Step.enRoute.index + 1)
                _WorkflowSection(
                  step: _Step.enRoute, current: step,
                  title: "I'm on my way",
                  icon: Icons.directions_car_outlined,
                  child: _TransitionButton(
                    label: "I'm on my way",
                    busy: busy,
                    enabled: step == _Step.enRoute,
                    onTap: () => _wf.transition(bookingId: j.id, to: JobStatus.enRoute),
                  ),
                ),

              // ── Step 3: Arrived ──
              if (step.index >= _Step.enRoute.index)
                _WorkflowSection(
                  step: _Step.arrived, current: step,
                  title: 'Mark arrived',
                  icon: Icons.location_on_outlined,
                  child: _TransitionButton(
                    label: 'I have arrived',
                    busy: busy,
                    enabled: step == _Step.arrived,
                    onTap: () => _wf.transition(bookingId: j.id, to: JobStatus.arrived),
                  ),
                ),

              // ── Step 4: Start service ──
              if (step.index >= _Step.arrived.index)
                _WorkflowSection(
                  step: _Step.inProgress, current: step,
                  title: 'Start service',
                  icon: Icons.pest_control_outlined,
                  child: _TransitionButton(
                    label: 'Start service now',
                    busy: busy,
                    enabled: step == _Step.inProgress,
                    onTap: () => _wf.transition(bookingId: j.id, to: JobStatus.inProgress),
                  ),
                ),

              // ── Step 5: Report ──
              if (step == _Step.report || step == _Step.complete)
                _WorkflowSection(
                  step: _Step.report, current: step,
                  title: 'Capture service report',
                  icon: Icons.description_outlined,
                  child: _ReportStep(
                    rpt: rpt,
                    sig: _sig,
                    signerName: _signerName,
                    pickPhotos: _pickPhotos,
                    busy: busy,
                    onSubmit: () async {
                      final png = await _sig.exportPng();
                      if (png != null) _rpt.update((d) => d.copyWith(signatureBytes: Uint8List.fromList(png)));
                      final ok = await _rpt.submit(j.id);
                      if (ok && mounted) context.showSnack('Report submitted!');
                    },
                    onComplete: () async {
                      final ok = await _wf.transition(bookingId: j.id, to: JobStatus.completed);
                      if (ok && mounted) context.go('/technician');
                    },
                  ),
                ),

              if (step == _Step.complete)
                _CompleteBanner(),
            ],
          ),
        ),
      ],
    );
  }
}

// ── progress header ──────────────────────────────────────────────────────────

class _ProgressHeader extends StatelessWidget {
  final _Step step;
  final int stepIdx;
  const _ProgressHeader({required this.step, required this.stepIdx});

  @override
  Widget build(BuildContext context) {
    final cs      = Theme.of(context).colorScheme;
    final color   = _stepColor(context, step);
    final total   = _Step.values.length;
    final pct     = (stepIdx + 1) / total;
    final labels  = ['Accept', 'En Route', 'Arrived', 'In Progress', 'Report', 'Done'];

    return Container(
      color: cs.surfaceContainerLow,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text('Step ${stepIdx + 1} of $total', style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant)),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(20)),
            child: Text(labels[stepIdx], style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
          ),
        ]),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: pct, minHeight: 6,
            backgroundColor: cs.outlineVariant,
            valueColor: AlwaysStoppedAnimation(color),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: List.generate(total, (i) {
            final done    = i < stepIdx;
            final current = i == stepIdx;
            final stepClr = current ? color : done ? Colors.green : cs.outlineVariant;
            return Expanded(
              child: Row(children: [
                Container(
                  width: 8, height: 8,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: stepClr),
                ),
                if (i < total - 1) Expanded(child: Container(height: 2, color: done ? Colors.green : cs.outlineVariant)),
              ]),
            );
          }),
        ),
      ]),
    );
  }
}

// ── workflow section wrapper ─────────────────────────────────────────────────

class _WorkflowSection extends StatelessWidget {
  final _Step step;
  final _Step current;
  final String title;
  final IconData icon;
  final Widget child;
  const _WorkflowSection({required this.step, required this.current, required this.title, required this.icon, required this.child});

  @override
  Widget build(BuildContext context) {
    final cs      = Theme.of(context).colorScheme;
    final isCurrent = step == current;
    final isDone    = step.index < current.index;
    final color     = isDone ? Colors.green : isCurrent ? _stepColor(context, step) : cs.outlineVariant;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isCurrent ? color.withOpacity(0.04) : cs.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isCurrent ? color.withOpacity(0.4) : cs.outlineVariant, width: isCurrent ? 1.5 : 1),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(color: color.withOpacity(0.12), shape: BoxShape.circle),
              child: isDone
                  ? Icon(Icons.check, color: Colors.green, size: 18)
                  : Icon(icon, color: color, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(child: Text(title, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: isDone ? cs.onSurfaceVariant : cs.onSurface))),
            if (isDone)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: Colors.green.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                child: const Text('Done', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.green)),
              ),
          ]),
          if (isCurrent) ...[const SizedBox(height: 16), child],
        ]),
      ),
    );
  }
}

// ── step children ────────────────────────────────────────────────────────────

class _AcceptDeclineStep extends ConsumerWidget {
  final Job j;
  final bool busy;
  final JobWorkflowController wf;
  const _AcceptDeclineStep({required this.j, required this.busy, required this.wf});

  @override
  Widget build(BuildContext context, WidgetRef ref) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Theme.of(context).colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(12)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _MiniDetail(Icons.pest_control_outlined, j.serviceName ?? 'Service'),
        _MiniDetail(Icons.person_outline, j.customerName ?? '—'),
        _MiniDetail(Icons.location_on_outlined, j.addressLine ?? '—'),
        if (j.windowStart != null) _MiniDetail(Icons.schedule, DateFormat('EEE d MMM · HH:mm').format(j.windowStart!)),
      ]),
    ),
    const SizedBox(height: 16),
    Row(children: [
      Expanded(child: OutlinedButton.icon(
        onPressed: busy ? null : () => wf.decline(j.id),
        icon: const Icon(Icons.close), label: const Text('Decline'),
        style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48), foregroundColor: Colors.red),
      )),
      const SizedBox(width: 12),
      Expanded(child: FilledButton.icon(
        onPressed: busy ? null : () => wf.accept(j.id),
        icon: const Icon(Icons.check), label: const Text('Accept job'),
        style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
      )),
    ]),
  ]);
}

class _MiniDetail extends StatelessWidget {
  final IconData icon;
  final String text;
  const _MiniDetail(this.icon, this.text);
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Row(children: [
      Icon(icon, size: 15, color: Theme.of(context).colorScheme.onSurfaceVariant),
      const SizedBox(width: 8),
      Expanded(child: Text(text, style: const TextStyle(fontSize: 13))),
    ]),
  );
}

class _TransitionButton extends StatelessWidget {
  final String label;
  final bool busy;
  final bool enabled;
  final VoidCallback onTap;
  const _TransitionButton({required this.label, required this.busy, required this.enabled, required this.onTap});

  @override
  Widget build(BuildContext context) => FilledButton(
    onPressed: enabled && !busy ? onTap : null,
    style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
    child: busy ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Text(label),
  );
}

// ── report step ──────────────────────────────────────────────────────────────

class _ReportStep extends StatelessWidget {
  final ReportBuilderState rpt;
  final SignaturePadController sig;
  final TextEditingController signerName;
  final Future<void> Function({required bool before}) pickPhotos;
  final bool busy;
  final VoidCallback onSubmit;
  final VoidCallback onComplete;
  const _ReportStep({required this.rpt, required this.sig, required this.signerName, required this.pickPhotos, required this.busy, required this.onSubmit, required this.onComplete});

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    _ReportSubSection(title: 'Before photos', children: [_PhotoGrid(rpt.draft.beforePhotos, () => pickPhotos(before: true))]),
    const SizedBox(height: 16),
    _ReportSubSection(title: 'Treatment notes', children: [
      TextField(
        maxLines: 3,
        decoration: const InputDecoration(hintText: 'Describe treatment and observations…', border: OutlineInputBorder()),
      ),
    ]),
    const SizedBox(height: 16),
    _ReportSubSection(title: 'After photos', children: [_PhotoGrid(rpt.draft.afterPhotos, () => pickPhotos(before: false))]),
    const SizedBox(height: 16),
    _ReportSubSection(title: 'Customer signature', children: [
      TextField(controller: signerName, decoration: const InputDecoration(labelText: 'Signer name', border: OutlineInputBorder())),
      const SizedBox(height: 10),
      SignaturePad(controller: sig),
      Align(alignment: Alignment.centerRight, child: TextButton.icon(onPressed: sig.clear, icon: const Icon(Icons.clear, size: 16), label: const Text('Clear'))),
    ]),
    const SizedBox(height: 16),
    FilledButton.icon(
      onPressed: busy ? null : onSubmit,
      icon: const Icon(Icons.upload_outlined),
      label: const Text('Submit report'),
      style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48), backgroundColor: Colors.teal),
    ),
    const SizedBox(height: 10),
    FilledButton.icon(
      onPressed: busy ? null : onComplete,
      icon: const Icon(Icons.task_alt),
      label: const Text('Mark job complete'),
      style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52), backgroundColor: Colors.green),
    ),
  ]);
}

class _ReportSubSection extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _ReportSubSection({required this.title, required this.children});
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(title, style: Theme.of(context).textTheme.labelLarge?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant)),
    const SizedBox(height: 8),
    ...children,
  ]);
}

class _PhotoGrid extends StatelessWidget {
  final List<File> photos;
  final VoidCallback onAdd;
  const _PhotoGrid(this.photos, this.onAdd);
  @override
  Widget build(BuildContext context) => Wrap(spacing: 8, runSpacing: 8, children: [
    ...photos.map((f) => ClipRRect(borderRadius: BorderRadius.circular(10), child: Image.file(f, width: 80, height: 80, fit: BoxFit.cover))),
    InkWell(
      onTap: onAdd,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        width: 80, height: 80,
        decoration: BoxDecoration(border: Border.all(color: Theme.of(context).colorScheme.outline, width: 1.5), borderRadius: BorderRadius.circular(10), color: Theme.of(context).colorScheme.surfaceContainerHighest),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(Icons.add_a_photo_outlined, color: Theme.of(context).colorScheme.primary),
          const SizedBox(height: 4),
          Text('Add', style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.primary)),
        ]),
      ),
    ),
  ]);
}

// ── job summary card ─────────────────────────────────────────────────────────

class _JobSummaryCard extends StatelessWidget {
  final Job j;
  const _JobSummaryCard(this.j);
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: cs.primaryContainer, borderRadius: BorderRadius.circular(14)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(j.serviceName ?? 'Service', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: cs.onPrimaryContainer)),
        const SizedBox(height: 6),
        if (j.customerName != null) _SummaryRow(Icons.person_outline, j.customerName!, cs.onPrimaryContainer),
        if (j.addressLine != null) _SummaryRow(Icons.location_on_outlined, j.addressLine!, cs.onPrimaryContainer),
        if (j.windowStart != null) _SummaryRow(Icons.schedule, DateFormat('EEE d MMM · HH:mm').format(j.windowStart!), cs.onPrimaryContainer),
      ]),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final IconData icon;
  final String text;
  final Color color;
  const _SummaryRow(this.icon, this.text, this.color);
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 4),
    child: Row(children: [
      Icon(icon, size: 14, color: color.withOpacity(0.75)),
      const SizedBox(width: 8),
      Expanded(child: Text(text, style: TextStyle(fontSize: 13, color: color.withOpacity(0.85)))),
    ]),
  );
}

class _CompleteBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(top: 8),
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(color: Colors.green.withOpacity(0.1), borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.green.withOpacity(0.3))),
    child: Row(children: [
      const Icon(Icons.celebration_outlined, color: Colors.green, size: 32),
      const SizedBox(width: 14),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Job completed!', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Colors.green)),
        Text('Great work. This job is now marked complete.', style: TextStyle(color: Colors.green.shade700, fontSize: 13)),
      ])),
    ]),
  );
}