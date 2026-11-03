import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mentorlink_bd/core/providers.dart';
import 'package:mentorlink_bd/features/welcome.dart';

// Widget tests for the welcome screen. They need no Firebase: GoRouter gets stub
// sign-in / sign-up pages so we can check that both buttons still navigate.
Widget _app({String lang = 'en', bool reduceMotion = false}) {
  final router = GoRouter(
    routes: [
      GoRoute(path: '/', builder: (_, __) => const WelcomeScreen()),
      GoRoute(
        path: '/sign-up',
        builder: (_, __) => const Scaffold(body: Text('SIGN-UP PAGE')),
      ),
      GoRoute(
        path: '/sign-in',
        builder: (_, __) => const Scaffold(body: Text('SIGN-IN PAGE')),
      ),
    ],
  );
  return ProviderScope(
    overrides: [localeProvider.overrideWith((_) => lang)],
    child: Consumer(
      builder: (context, ref, _) => MaterialApp.router(
        locale: Locale(ref.watch(localeProvider)),
        supportedLocales: const [Locale('en'), Locale('bn')],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        routerConfig: router,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context)
              .copyWith(disableAnimations: reduceMotion),
          child: child!,
        ),
      ),
    ),
  );
}

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  void phone(WidgetTester t, {double w = 390, double h = 844}) {
    t.view.physicalSize = Size(w, h);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.resetPhysicalSize);
    addTearDown(t.view.resetDevicePixelRatio);
  }

  testWidgets('English: headline, journey labels and both actions are shown', (
    t,
  ) async {
    phone(t);
    await t.pumpWidget(_app());
    await t.pump(const Duration(seconds: 4)); // let the intro finish
    expect(find.textContaining('deserves', findRichText: true), findsOneWidget);
    for (final s in [
      'Discover',
      'Learn',
      'Connect',
      'Prove',
      'Get started',
      'I already have an account',
    ]) {
      expect(find.text(s), findsOneWidget, reason: s);
    }
  });

  testWidgets('Get started → /sign-up, I already have an account → /sign-in', (
    t,
  ) async {
    phone(t);
    await t.pumpWidget(_app());
    await t.pump(const Duration(seconds: 4));
    await t.tap(find.text('Get started'));
    await t.pumpAndSettle();
    expect(find.text('SIGN-UP PAGE'), findsOneWidget);

    await t.pumpWidget(_app());
    await t.pump(const Duration(seconds: 4));
    await t.tap(find.text('I already have an account'));
    await t.pumpAndSettle();
    expect(find.text('SIGN-IN PAGE'), findsOneWidget);
  });

  testWidgets('Language switch changes the copy to Bangla', (t) async {
    phone(t);
    await t.pumpWidget(_app());
    await t.pump(const Duration(seconds: 4));
    await t.tap(find.text('বাংলা'));
    await t.pump(const Duration(milliseconds: 400));
    expect(find.text('শুরু করুন'), findsOneWidget);
    expect(find.text('আবিষ্কার করুন'), findsOneWidget);
    expect(find.textContaining('প্রমাণ', findRichText: true), findsWidgets);
  });

  testWidgets(
    'Reduced motion: finished journey is visible immediately, nothing keeps animating',
    (t) async {
      phone(t);
      await t.pumpWidget(_app(reduceMotion: true));
      await t.pump(); // no extra time
      expect(find.text('Prove'), findsOneWidget);
      expect(t.binding.hasScheduledFrame, isFalse);
    },
  );

  testWidgets('Tapping the journey skips the intro', (t) async {
    phone(t);
    await t.pumpWidget(_app());
    await t.pump(const Duration(milliseconds: 300));
    await t.tap(find.text('Skip'));
    await t.pump();
    await t.pump(const Duration(milliseconds: 250));
    expect(t.binding.hasScheduledFrame, isFalse);
  });

  testWidgets(
    'Small screen and large text: fits without overflow (EN + BN)',
    (t) async {
      for (final lang in ['en', 'bn']) {
        phone(t, w: 320, h: 568);
        await t.pumpWidget(_app(lang: lang));
        await t.pump(const Duration(seconds: 4));
        expect(t.takeException(), isNull, reason: lang);
      }
    },
  );
}