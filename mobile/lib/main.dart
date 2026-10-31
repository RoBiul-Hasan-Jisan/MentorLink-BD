import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'core/providers.dart';
import 'core/theme.dart';
import 'l10n/app_localizations.dart';
import 'firebase_options.dart';
import 'router.dart';

const kLangPref = 'app_language';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  const emu = String.fromEnvironment('AUTH_EMULATOR'); // e.g. 10.0.2.2
  if (emu.isNotEmpty) await FirebaseAuth.instance.useAuthEmulator(emu, 9099);
  final prefs = await SharedPreferences.getInstance();
  final saved = prefs.getString(kLangPref);
  runApp(ProviderScope(
    overrides: [if (saved == 'en' || saved == 'bn') localeProvider.overrideWith((_) => saved!)],
    child: const MentorLinkApp(),
  ));
}

class MentorLinkApp extends ConsumerWidget {
  const MentorLinkApp({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Save the language whenever the user changes it. Nothing else in the app changes it.
    ref.listen<String>(localeProvider, (_, next) async {
      try { (await SharedPreferences.getInstance()).setString(kLangPref, next); } catch (_) {}
    });
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
