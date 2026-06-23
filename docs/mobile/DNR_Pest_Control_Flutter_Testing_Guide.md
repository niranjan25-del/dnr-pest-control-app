# DNR Pest Control — Flutter Testing Strategy & Automated Test Plan (Step 45)

Production-grade automated testing for the Flutter app: `flutter_test` (unit + widget), `integration_test` (on-device flows), `mocktail` (no-codegen mocks), Riverpod overrides for dependency injection. Covers the critical journeys with an 80% coverage goal. Mobile only — no Flutter security testing (per instruction).

> **Faithful to the real app:** tests reference the actual code — clean per-feature layers (`application/data/domain/presentation`), `Result<T>` (`Success`/`FailureResult`/`.when`), `AuthValidators`, `LoginController extends StateNotifier<SubmissionState>`, `authRepositoryProvider`, `authControllerProvider` (`AuthState`/`AuthStatus`/`AppRole`), `routerProvider`, and route constants (`AppRoutes.signIn`, `customerHome`). Login/Register screens use two/four `TextFormField`s + a `LoadingButton`.

> **Honest caveats:** these run in the app repo, not this workspace. Reconcile on first run: (1) the `AuthRepositoryImpl` constructor's third arg (secure storage) — inject a real mock where the sample shows `throwOnMissing()`; (2) datasource method names used in `auth_repository_impl_test` (`signInWithEmail`, `exchangeFirebaseToken`) — match to the real datasources; (3) `routerProvider` also reads `preferencesServiceProvider` + `analyticsProvider`, so override them with fakes if they touch platform channels; (4) the `booking_flow` integration test is a **skipped scaffold** — add `Key`s to the customer booking widgets and unskip; (5) push routing + offline use illustrative contracts — point them at the real handler/connectivity providers.

---

## Testing Architecture
A mobile test pyramid:

- **Unit (most):** pure logic in isolation — validators, `Result`, repositories (datasources mocked), controllers/notifiers (repository mocked via Riverpod override), offline/cache logic, push-route mapping. Fast, deterministic, where coverage is won.
- **Widget (some):** a single screen under `ProviderScope` + `MaterialApp`, dependencies overridden. Asserts rendering, form validation, loading/error states, and that user actions call the right controller — without a backend.
- **Integration (few):** the full app driven through the real `GoRouter` + screens with only the network boundary mocked. Reserved for the journeys that *are* the product (auth, booking).

Riverpod is the DI seam: every test swaps real providers for mocks via `overrides`, so nothing hits Dio/Firebase. `mocktail` needs no codegen.

## Test Folder Structure
```
test/
├── helpers/harness.dart          # createContainer() + pumpApp()/pumpRouterApp()
├── mocks/mocks.dart              # mocktail mocks (repo, datasources, Dio, GoRouter, FCM) + fallbacks
├── fixtures/fixtures.dart        # entity builders + snake_case JSON samples
├── unit/
│   ├── auth_validators_test.dart      # validators / form rules
│   ├── result_test.dart               # Result<T> pattern-matching
│   ├── auth_repository_impl_test.dart # repository + API mocks + error mapping
│   ├── login_controller_test.dart     # Riverpod state management
│   ├── offline_mode_test.dart         # connectivity → cache fallback
│   └── push_notification_test.dart    # FCM data → deep link
└── widget/
    ├── login_screen_test.dart         # render + validation + loading
    ├── register_screen_test.dart      # confirm-password validation
    └── navigation_test.dart           # router redirect guards
integration_test/
├── auth_flow_test.dart                # login → redirect (hermetic, repo mocked)
└── booking_flow_test.dart             # customer booking scaffold (skipped until finders wired)
```

## Unit Tests — coverage map
| Area | What's tested |
|---|---|
| **Validators** | email/password/confirm/fullName/phone/required — happy + boundary + invalid. *(provided)* |
| **Utilities** | `Result<T>` matching + accessors; add formatters (INR money, date windows). *(provided: result)* |
| **Repositories** | success → `Success(session)` + token persisted; backend/auth error → `FailureResult(Failure)` (never throws). *(provided: auth)* |
| **Providers / state** | `LoginController` idle→submitting→success/failure; extend to register/booking/payment controllers. *(provided: login)* |
| **Offline** | offline + cache → cached data; offline + empty cache → `NetworkFailure`. *(provided)* |
| **Push** | `RemoteMessage.data.type` → correct deep link. *(provided)* |

## Widget Tests — coverage map
Provided: **Login** (validation blocks submit; valid input calls repo + shows spinner) and **Register** (password-mismatch blocks submit) and **Navigation** (redirect guards). Same pattern extends to the other required screens — pump the screen with mocked providers and assert render + interaction:
- **Dashboard:** renders KPIs/sections; tapping a CTA navigates.
- **Booking flow:** service select → slot → confirm calls the booking controller.
- **Payment:** card entry state; pay button disabled while submitting; error surfaces.
- **Chat:** message list renders; send calls the controller; socket events update the list.
- **Notifications:** list renders; tap routes to the target.
- **Profile:** edit form validates and saves.

## Integration / Navigation / State / Form
- **Integration:** `auth_flow_test` drives the real router through login (provided); `booking_flow_test` is a ready scaffold.
- **Navigation:** `navigation_test` asserts the router's resolved location for unauth vs authenticated-customer. *(provided)*
- **State management:** `login_controller_test` listens to the provider and asserts the emitted state sequence. *(provided)*
- **Form validation:** covered by the validator unit test + the login/register widget tests.

## Mocking Strategy
- **API:** mock `AuthRemoteDatasource`/`Dio` (or the repository directly) — never real HTTP. JSON fixtures mirror the snake_case envelope so parsing is exercised.
- **Repository:** override `authRepositoryProvider` (and feature repo providers) with mocktail mocks; this is the main seam for controller + widget tests.
- **Firebase:** mock `FirebaseAuthDatasource` and `FirebaseMessaging` — no real Firebase init in unit/widget tests; on-device integration runs initialize it for real.

## Test Data Strategy
`Fixtures` builds entities with overridable args + canonical JSON maps; keep all sample data there so specs stay short. Construct only what a test asserts on. No shared mutable globals between tests (each gets fresh mocks in `setUp`).

## Coverage Goals
Target **≥80%** lines overall, higher on logic-dense files (validators, `Result`, repositories, controllers, push/offline mapping). UI-only widgets and generated files (`*.g.dart`, `*.freezed.dart`) are excluded from the meaningful denominator. Generate `coverage/lcov.info`, strip generated files, and gate in CI.

---

## Test Commands
```bash
flutter test                                   # all unit + widget tests
flutter test test/unit                         # just unit
flutter test test/widget/login_screen_test.dart  # one file
flutter test --name "validation"               # by test name
flutter test integration_test                  # integration (emulator/device or flutter drive)
```

## Coverage Commands
```bash
flutter test --coverage                        # writes coverage/lcov.info
# strip generated + entrypoints, then view:
dart run remove_from_coverage -f coverage/lcov.info -r '\.g\.dart$' -r '\.freezed\.dart$'
genhtml coverage/lcov.info -o coverage/html && open coverage/html/index.html
```

## Recommendations
1. **Add `Key`s to interactive widgets** (fields, primary buttons, list items) so widget/integration finders are stable — then unskip `booking_flow_test`.
2. **Extend controllers first:** replicate `login_controller_test` for register/booking/payment/chat notifiers — that's where business state lives.
3. **Golden tests** for the design-system components (buttons, cards, status chips) in light/dark to catch visual regressions.
4. **CI:** run `flutter analyze` + `flutter test --coverage` on PRs; enforce the 80% gate after stripping generated files; cache pub + the SDK.
5. **Determinism:** mock time where windows matter (booking lead time), use `network_image_mock` for avatars, and keep integration tests to true journeys (auth, booking, payment, chat) — breadth goes in widget tests.
6. **Contract safety:** keep `Fixtures` JSON in lockstep with the backend envelope so parser drift fails a test, not production.

---

**Stopping after Flutter Testing, per instruction** (no security testing). Open elsewhere in the project: Admin Dashboard Wave 2 (Services/Pricing/Subscriptions/Coupons/Notifications) and the Flutter Mobile App Integration (Step 40) finish (`bootstrap.dart`/`main.dart`/`app.dart` + guide).
