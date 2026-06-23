// lib/features/auth/presentation/screens/profile_setup_screen.dart
//
// Step 2 of sign-up: collect phone + customer type, then call the backend to provision
// the User/profile and mint app JWTs. On success the session is committed and the router
// redirects to the customer home.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/extensions/context_extensions.dart';
import '../../application/auth_validators.dart';
import '../../application/profile_setup_controller.dart';
import '../../application/submission_state.dart';
import '../../domain/repositories/auth_repository.dart';
import '../widgets/auth_widgets.dart';

class ProfileSetupScreen extends ConsumerStatefulWidget {
  const ProfileSetupScreen({super.key});
  @override
  ConsumerState<ProfileSetupScreen> createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends ConsumerState<ProfileSetupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  CustomerType _type = CustomerType.residential;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState?.validate() ?? false) {
      ref
          .read(profileSetupControllerProvider.notifier)
          .submit(fullName: _name.text, phone: _phone.text, customerType: _type);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(profileSetupControllerProvider);
    ref.listen(profileSetupControllerProvider, (_, next) {
      if (next.isFailure) showAuthError(context, next.failure);
      // On success the router redirects automatically (session committed).
    });

    return Scaffold(
      appBar: AppBar(title: const Text('Complete your profile')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const AuthHeader(title: 'A few more details', subtitle: 'So we can service the right place.'),
                const SizedBox(height: 28),
                AuthTextField(controller: _name, label: 'Full name', validator: AuthValidators.fullName, action: TextInputAction.next),
                const SizedBox(height: 16),
                AuthTextField(
                  controller: _phone,
                  label: 'Phone',
                  keyboardType: TextInputType.phone,
                  validator: AuthValidators.phone,
                  action: TextInputAction.done,
                ),
                const SizedBox(height: 24),
                Text('Account type', style: context.text.labelLarge),
                const SizedBox(height: 8),
                SegmentedButton<CustomerType>(
                  segments: const [
                    ButtonSegment(value: CustomerType.residential, label: Text('Residential'), icon: Icon(Icons.home_outlined)),
                    ButtonSegment(value: CustomerType.commercial, label: Text('Commercial'), icon: Icon(Icons.business_outlined)),
                  ],
                  selected: {_type},
                  onSelectionChanged: (s) => setState(() => _type = s.first),
                ),
                const SizedBox(height: 32),
                LoadingButton(label: 'Finish', loading: state.isSubmitting, onPressed: _submit),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
