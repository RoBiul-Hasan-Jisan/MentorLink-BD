import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'dart:ui' show PointerDeviceKind;
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
const kPalettePref = 'app_palette';

// Soft bouncing scroll everywhere; mouse/trackpad can drag too (web). Always scrollable so pull-to-refresh works on short lists.
class _AppScroll extends MaterialScrollBehavior {
  const _AppScroll();
  @override
  Set<PointerDeviceKind> get dragDevices => {PointerDeviceKind.touch, PointerDeviceKind.mouse, PointerDeviceKind.stylus, PointerDeviceKind.trackpad};
  @override
  ScrollPhysics getScrollPhysics(BuildContext context) => const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics());
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  const emu = String.fromEnvironment('AUTH_EMULATOR'); // e.g. 10.0.2.2
  if (emu.isNotEmpty) await FirebaseAuth.instance.useAuthEmulator(emu, 9099);
  final prefs = await SharedPreferences.getInstance();
  final saved = prefs.getString(kLangPref);
  final pal = prefs.getString(kPalettePref) == 'green' ? 'green' : 'lilac';
  Brand.lilac = pal == 'lilac';
  runApp(ProviderScope(
    overrides: [
      if (saved == 'en' || saved == 'bn') localeProvider.overrideWith((_) => saved!),
      paletteProvider.overrideWith((_) => pal),
    ],
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
    ref.listen<String>(paletteProvider, (_, next) async {
      try { (await SharedPreferences.getInstance()).setString(kPalettePref, next); } catch (_) {}
    });
    final palette = ref.watch(paletteProvider);
    Brand.lilac = palette == 'lilac'; // set before anything below reads Brand.*
    // The key rebuilds the whole tree once when the palette changes, so every screen picks up the new colours.
    return KeyedSubtree(key: ValueKey(palette), child: MaterialApp.router(
      title: 'MentorLink BD',
      theme: buildTheme(),
      scrollBehavior: const _AppScroll(),
      locale: Locale(ref.watch(localeProvider)),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [AppLocalizations.delegate, GlobalMaterialLocalizations.delegate, GlobalWidgetsLocalizations.delegate, GlobalCupertinoLocalizations.delegate],
      routerConfig: ref.watch(routerProvider),
      // On web/desktop, show the app in a phone-sized column like the prototype.
      builder: (context, child) => ColoredBox(
        color: Brand.backdrop,
        child: Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 430), child: ClipRect(child: child ?? const SizedBox()))),
      ),
    ));
  }
}
