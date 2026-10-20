import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

// Design tokens from the MentorLink BD prototype.
class Brand {
  static const forest = Color(0xFF0A4A39);
  static const delta = Color(0xFF0F6B52);
  static const saffron = Color(0xFFF0A21C);
  static const paper = Color(0xFFF5F7F3);
  static const ink = Color(0xFF15221D);
  static const muted = Color(0xFF55625C);
  static const lightGreen = Color(0xFFE3F1EB);
  static const lightSaffron = Color(0xFFFFF0CC);
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
    filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(minimumSize: const Size(44, 48), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)))),
    inputDecorationTheme: InputDecorationTheme(filled: true, fillColor: Colors.white, border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none)),
    appBarTheme: const AppBarTheme(backgroundColor: Brand.paper, foregroundColor: Brand.forest, elevation: 0),
  );
}
