import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/providers.dart';
import 'core/theme.dart';
import 'l10n/app_localizations.dart';
import 'firebase_options.dart';
import 'router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  const emu = String.fromEnvironment('AUTH_EMULATOR'); // e.g. 10.0.2.2
  if (emu.isNotEmpty) await FirebaseAuth.instance.useAuthEmulator(emu, 9099);
  runApp(const ProviderScope(child: MentorLinkApp()));
}

class MentorLinkApp extends ConsumerWidget {
  const MentorLinkApp({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'MentorLink BD',
      theme: buildTheme(),
      locale: Locale(ref.watch(localeProvider)),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [AppLocalizations.delegate, GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
      routerConfig: ref.watch(routerProvider),
      // On web/desktop, show the app in a phone-sized column like the prototype.
      builder: (context, child) => ColoredBox(
        color: const Color(0xFFDDE5DF),
        child: Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 430), child: ClipRect(child: child ?? const SizedBox()))),
      ),
    );
  }
}
