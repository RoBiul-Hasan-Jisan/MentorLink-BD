import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// Two palettes, same token names, switchable at runtime (Profile > Colour theme).
//   'lilac' = Chrome Black + Digital Lilac   'green' = Green + Saffron (previous look)
// Colours are getters (not const), so widgets must not be `const` when they use Brand.* colours.
class Brand {
  static bool lilac = true; // set from main.dart / paletteProvider
  static const ink = Color(0xFF15151B);

  static Color get forest => lilac ? const Color(0xFF15151B) : const Color(0xFF0A4A39);       // headers, headings
  static Color get delta => lilac ? const Color(0xFF8A63F2) : const Color(0xFF0F6B52);        // charts, progress, selected
  static Color get saffron => lilac ? const Color(0xFFB79CFF) : const Color(0xFFF0A21C);      // rings, arcs, badges on dark
  static Color get paper => lilac ? const Color(0xFFF7F5FB) : const Color(0xFFF5F7F3);        // page background
  static Color get muted => lilac ? const Color(0xFF5F5D6E) : const Color(0xFF55625C);
  static Color get lightGreen => lilac ? const Color(0xFFEDE6FF) : const Color(0xFFE3F1EB);   // chips, soft cards, nav pill
  static Color get lightSaffron => lilac ? const Color(0xFFF1EBFF) : const Color(0xFFFFF0CC); // alert and card tints
  static Color get deep => lilac ? const Color(0xFF5B34C9) : const Color(0xFF7A4A00);         // small accent text
  static Color get button => lilac ? const Color(0xFF15151B) : const Color(0xFF0F6B52);       // primary buttons
  static Color get glow => lilac ? const Color(0xFF3B2C73) : const Color(0xFF0F6B52);         // header gradient highlight
  static Color get line => lilac ? const Color(0xFFE6E2F0) : const Color(0xFFE2E8E3);         // card borders, dividers
  static Color get track => lilac ? const Color(0xFFE9E5F3) : const Color(0xFFE3E9E5);        // empty part of progress bars
  static Color get field => lilac ? const Color(0xFFCFC8E0) : const Color(0xFFC9D3CC);        // input borders
  static Color get backdrop => lilac ? const Color(0xFFE9E5F3) : const Color(0xFFDDE5DF);     // area around the phone column on web
}

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: Brand.delta, primary: Brand.delta, secondary: Brand.saffron, surface: Colors.white);
  final text = GoogleFonts.hindSiliguriTextTheme().apply(bodyColor: Brand.ink, displayColor: Brand.ink);
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: Brand.paper,
    textTheme: text.copyWith(
      headlineMedium: GoogleFonts.bricolageGrotesque(fontSize: 26, fontWeight: FontWeight.w800, color: Brand.forest),
      titleLarge: GoogleFonts.bricolageGrotesque(fontSize: 20, fontWeight: FontWeight.w700, color: Brand.forest),
    ),
    cardTheme: CardThemeData(color: Colors.white, elevation: 0, margin: const EdgeInsets.symmetric(vertical: 6), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20))),
    filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(backgroundColor: Brand.button, minimumSize: const Size(44, 48), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)))),
    inputDecorationTheme: InputDecorationTheme(
      filled: true, fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Brand.field)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Brand.field)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Brand.delta, width: 2)),
      hintStyle: TextStyle(color: Brand.muted, fontSize: 14),
      helperStyle: TextStyle(color: Brand.muted, fontSize: 13),
      helperMaxLines: 3,
    ),
    appBarTheme: AppBarTheme(backgroundColor: Brand.paper, foregroundColor: Brand.forest, elevation: 0, scrolledUnderElevation: 0),
    // Smoother feel: slide + swipe-back screens, soft ripples, rounded floating messages and sheets.
    pageTransitionsTheme: const PageTransitionsTheme(builders: {
      TargetPlatform.android: CupertinoPageTransitionsBuilder(),
      TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
      TargetPlatform.windows: ZoomPageTransitionsBuilder(),
      TargetPlatform.linux: ZoomPageTransitionsBuilder(),
      TargetPlatform.fuchsia: ZoomPageTransitionsBuilder(),
    }),
    splashFactory: InkRipple.splashFactory,
    highlightColor: Colors.transparent,
    progressIndicatorTheme: ProgressIndicatorThemeData(color: Brand.delta),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating, backgroundColor: Brand.forest, elevation: 0,
      contentTextStyle: GoogleFonts.hindSiliguri(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      insetPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
    ),
    dialogTheme: DialogThemeData(backgroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24))),
    bottomSheetTheme: const BottomSheetThemeData(backgroundColor: Colors.white, showDragHandle: true, shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28)))),
    chipTheme: ChipThemeData(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)), side: BorderSide(color: Brand.line)),
  );
}
