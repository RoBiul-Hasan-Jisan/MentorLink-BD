import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'theme.dart';

// ---------- text helpers ----------
String tr(BuildContext c, String en, String bn) => Localizations.localeOf(c).languageCode == 'bn' ? bn : en;
String nm(BuildContext c, Map m, String en, String bn) => Localizations.localeOf(c).languageCode == 'bn' ? ((m[bn] ?? m[en] ?? '') as String) : ((m[en] ?? '') as String);
TextStyle display(double size, {Color color = Brand.forest, FontWeight w = FontWeight.w800}) =>
    GoogleFonts.bricolageGrotesque(fontSize: size, fontWeight: w, color: color, height: 1.1);
TextStyle body(double size, {Color color = Brand.ink, FontWeight w = FontWeight.w500}) =>
    GoogleFonts.hindSiliguri(fontSize: size, fontWeight: w, color: color, height: 1.3);

// ---------- green header with diamond pattern ----------
class _DiamondPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = Colors.white.withValues(alpha: 0.06);
    const step = 64.0;
    for (double y = 10; y < size.height; y += step) {
      for (double x = 10; x < size.width; x += step) {
        final path = Path()
          ..moveTo(x, y - 12)..lineTo(x + 12, y)..lineTo(x, y + 12)..lineTo(x - 12, y)..close();
        canvas.drawPath(path, p);
      }
    }
  }
  @override
  bool shouldRepaint(_) => false;
}

/// Flat forest-green panel with the diamond pattern (used beside the sign-in form on wide screens).
class DiamondPanel extends StatelessWidget {
  const DiamondPanel({super.key, required this.child, this.padding = const EdgeInsets.all(40)});
  final Widget child; final EdgeInsets padding;
  @override
  Widget build(BuildContext context) => Container(
        color: Brand.forest,
        child: Stack(children: [
          Positioned.fill(child: CustomPaint(painter: _DiamondPainter())),
          Padding(padding: padding, child: child),
        ]),
      );
}

class GreenHeader extends StatelessWidget {
  const GreenHeader({super.key, required this.child, this.bottomPad = 40, this.radius = 40});
  final Widget child; final double bottomPad, radius;
  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(radius)),
        child: Container(
          decoration: const BoxDecoration(gradient: RadialGradient(center: Alignment(0.6, -0.2), radius: 1.3, colors: [Brand.delta, Brand.forest])),
          child: Stack(children: [
            Positioned.fill(child: CustomPaint(painter: _DiamondPainter())),
            Padding(padding: EdgeInsets.fromLTRB(20, MediaQuery.of(context).padding.top + 16, 20, bottomPad), child: child),
          ]),
        ),
      );
}

// ---------- cards, pills ----------
class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.color = Colors.white, this.border, this.padding = const EdgeInsets.all(18), this.onTap, this.margin = const EdgeInsets.only(bottom: 12)});
  final Widget child; final Color color; final Color? border; final EdgeInsets padding, margin; final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Padding(
        padding: margin,
        child: Material(
          color: color,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24), side: BorderSide(color: border ?? const Color(0xFFE2E8E3), width: border == null ? 1 : 2)),
          child: InkWell(borderRadius: BorderRadius.circular(24), onTap: onTap, child: Padding(padding: padding, child: child)),
        ),
      );
}

enum Tone { green, saffron, blue, red, grey }
class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, this.tone = Tone.green});
  final String text; final Tone tone;
  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (tone) {
      Tone.green => (Brand.lightGreen, Brand.forest),
      Tone.saffron => (Brand.lightSaffron, const Color(0xFF7A4A00)),
      Tone.blue => (const Color(0xFFE6EEFB), const Color(0xFF1F4A8F)),
      Tone.red => (const Color(0xFFFBEDEA), const Color(0xFF9B2C1F)),
      Tone.grey => (const Color(0xFFE9EEEA), Brand.muted),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
      child: Text(text, style: body(13, color: fg, w: FontWeight.w700)),
    );
  }
}

class Avatar extends StatelessWidget {
  const Avatar(this.name, {super.key, this.size = 56, this.bg = Brand.forest, this.fg = Colors.white});
  final String name; final double size; final Color bg, fg;
  @override
  Widget build(BuildContext context) {
    final parts = name.trim().split(RegExp(r'\s+'));
    final ini = parts.isEmpty || parts.first.isEmpty ? '?' : (parts.first[0] + (parts.length > 1 ? parts[1][0] : parts.first.length > 1 ? parts.first[1] : '')).toUpperCase();
    return Container(width: size, height: size, alignment: Alignment.center, decoration: BoxDecoration(color: bg, shape: BoxShape.circle), child: Text(ini, style: display(size * 0.34, color: fg)));
  }
}

class ProgressBar extends StatelessWidget {
  const ProgressBar(this.value, {super.key, this.color = Brand.delta, this.height = 10});
  final double value; final Color color; final double height;
  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: LinearProgressIndicator(value: value.clamp(0, 1).toDouble(), minHeight: height, color: color, backgroundColor: const Color(0xFFE3E9E5)),
      );
}

// ---------- ring ----------
class Ring extends StatelessWidget {
  const Ring({super.key, required this.value, this.size = 110, this.stroke = 12, this.label, this.dark = true, this.labelStyle});
  final double value; final double size, stroke; final String? label; final bool dark; final TextStyle? labelStyle;
  @override
  Widget build(BuildContext context) => SizedBox(
        width: size, height: size,
        child: CustomPaint(
          painter: _RingPainter(value.clamp(0, 1).toDouble(), stroke, dark),
          child: Center(child: Text(label ?? '${(value * 100).round()}%', style: labelStyle ?? display(size * 0.26, color: dark ? Colors.white : Brand.ink))),
        ),
      );
}
class _RingPainter extends CustomPainter {
  _RingPainter(this.v, this.stroke, this.dark);
  final double v, stroke; final bool dark;
  @override
  void paint(Canvas c, Size s) {
    final r = Rect.fromLTWH(stroke / 2, stroke / 2, s.width - stroke, s.height - stroke);
    final track = Paint()..style = PaintingStyle.stroke..strokeWidth = stroke..color = dark ? Colors.white.withValues(alpha: 0.12) : Brand.lightSaffron;
    final arc = Paint()..style = PaintingStyle.stroke..strokeWidth = stroke..strokeCap = StrokeCap.round..color = Brand.saffron;
    c.drawArc(r, 0, math.pi * 2, false, track);
    c.drawArc(r, -math.pi / 2, math.pi * 2 * v, false, arc);
  }
  @override
  bool shouldRepaint(_RingPainter o) => o.v != v;
}

// ---------- stepper (Skills / Mentor / Interview / Job) ----------
class JourneyStepper extends StatelessWidget {
  const JourneyStepper({super.key, required this.labels, required this.current});
  final List<String> labels; final int current; // steps before `current` are done
  @override
  Widget build(BuildContext context) => Row(children: [
        for (int i = 0; i < labels.length; i++) ...[
          Expanded(child: Column(children: [
            Row(children: [
              Expanded(child: Container(height: 3, color: i == 0 ? Colors.transparent : (i <= current ? Brand.saffron : Colors.white24))),
              Container(
                width: 30, height: 30, alignment: Alignment.center,
                decoration: BoxDecoration(shape: BoxShape.circle, color: i < current ? Brand.saffron : (i == current ? Brand.saffron : Colors.transparent), border: Border.all(color: i <= current ? Brand.saffron : Colors.white30, width: 3)),
                child: i < current ? const Icon(Icons.check, size: 16, color: Brand.ink) : (i == current ? Container(width: 10, height: 10, decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle)) : null),
              ),
              Expanded(child: Container(height: 3, color: i == labels.length - 1 ? Colors.transparent : (i < current ? Brand.saffron : Colors.white24))),
            ]),
            const SizedBox(height: 6),
            Text(labels[i], style: body(13, color: Colors.white, w: FontWeight.w700)),
          ])),
        ],
      ]);
}

// ---------- segmented factor bar ----------
class FactorBar extends StatelessWidget {
  const FactorBar(this.parts, {super.key});
  final List<(String, int)> parts; // label, points
  static const colors = [Color(0xFF0A4A39), Color(0xFF0F6B52), Color(0xFF2E9C7E), Color(0xFFF0A21C), Color(0xFFF5C25C), Color(0xFFFADC9A)];
  @override
  Widget build(BuildContext context) {
    final total = parts.fold<int>(0, (a, b) => a + (b.$2 <= 0 ? 1 : b.$2));
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      ClipRRect(borderRadius: BorderRadius.circular(20), child: Row(children: [
        for (int i = 0; i < parts.length; i++) Expanded(flex: (parts[i].$2 <= 0 ? 1 : parts[i].$2) * 100 ~/ total + 1, child: Container(height: 10, margin: const EdgeInsets.only(right: 2), color: colors[i % colors.length])),
      ])),
      const SizedBox(height: 8),
      Wrap(spacing: 14, runSpacing: 2, children: [for (final p in parts) Text('${p.$1} ${p.$2}', style: body(13, color: Brand.muted))]),
    ]);
  }
}

// ---------- radar chart ----------
class Radar extends StatelessWidget {
  const Radar({super.key, required this.labels, required this.need, required this.have, this.size = 300});
  final List<String> labels; final List<double> need, have; final double size; // values 0..1
  @override
  Widget build(BuildContext context) => SizedBox(width: size, height: size, child: CustomPaint(painter: _RadarPainter(labels, need, have)));
}
class _RadarPainter extends CustomPainter {
  _RadarPainter(this.labels, this.need, this.have);
  final List<String> labels; final List<double> need, have;
  @override
  void paint(Canvas c, Size s) {
    final n = labels.length; if (n < 3) return;
    final center = Offset(s.width / 2, s.height / 2);
    final R = s.width / 2 - 52;
    Offset pt(int i, double f) { final a = -math.pi / 2 + 2 * math.pi * i / n; return center + Offset(math.cos(a), math.sin(a)) * (R * f); }
    final grid = Paint()..style = PaintingStyle.stroke..color = Colors.white24..strokeWidth = 1;
    for (final f in [0.33, 0.66, 1.0]) { final p = Path()..moveTo(pt(0, f).dx, pt(0, f).dy); for (int i = 1; i < n; i++) { p.lineTo(pt(i, f).dx, pt(i, f).dy); } p.close(); c.drawPath(p, grid); }
    // required outline (dashed)
    final req = Path()..moveTo(pt(0, 1).dx, pt(0, 1).dy);
    for (int i = 1; i < n; i++) { req.lineTo(pt(i, need[i]).dx, pt(i, need[i]).dy); }
    req.close();
    final dash = Paint()..style = PaintingStyle.stroke..color = Colors.white54..strokeWidth = 2;
    for (final m in req.computeMetrics()) { double d = 0; while (d < m.length) { c.drawPath(m.extractPath(d, d + 6), dash); d += 12; } }
    final me = Path()..moveTo(pt(0, have[0]).dx, pt(0, have[0]).dy);
    for (int i = 1; i < n; i++) { me.lineTo(pt(i, have[i]).dx, pt(i, have[i]).dy); }
    me.close();
    c.drawPath(me, Paint()..color = Brand.saffron.withValues(alpha: 0.35));
    c.drawPath(me, Paint()..style = PaintingStyle.stroke..color = Brand.saffron..strokeWidth = 4..strokeJoin = StrokeJoin.round);
    for (int i = 0; i < n; i++) {
      c.drawCircle(pt(i, have[i]), 6, Paint()..color = have[i] >= need[i] ? Colors.white : Brand.saffron);
      final tp = TextPainter(text: TextSpan(text: labels[i], style: display(15, color: have[i] >= need[i] ? Colors.white : Brand.saffron, w: FontWeight.w700)), textDirection: TextDirection.ltr)..layout();
      final lp = pt(i, 1.0); final a = -math.pi / 2 + 2 * math.pi * i / n;
      c.save(); tp.paint(c, lp + Offset(math.cos(a) * 14 - tp.width / 2 + math.cos(a) * tp.width / 2, math.sin(a) * 14 - tp.height / 2)); c.restore();
    }
  }
  @override
  bool shouldRepaint(_) => true;
}

// ---------- bottom nav ----------
class PillNav extends StatelessWidget {
  const PillNav({super.key, required this.items, required this.index, required this.onTap});
  final List<(IconData, String)> items; final int index; final ValueChanged<int> onTap;
  @override
  Widget build(BuildContext context) => Container(
        decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Color(0xFFE2E8E3)))),
        child: SafeArea(top: false, child: Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Row(children: [
          for (int i = 0; i < items.length; i++) Expanded(child: InkWell(
            onTap: () => onTap(i),
            child: SizedBox(height: 60, child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Container(width: 64, height: 32, alignment: Alignment.center, decoration: BoxDecoration(color: i == index ? Brand.lightGreen : Colors.transparent, borderRadius: BorderRadius.circular(20)), child: Icon(items[i].$1, size: 22, color: i == index ? Brand.forest : Brand.muted)),
              const SizedBox(height: 2),
              Text(items[i].$2, style: display(12, color: i == index ? Brand.forest : Brand.muted, w: i == index ? FontWeight.w800 : FontWeight.w500)),
            ])),
          )),
        ]))),
      );
}

class BackCircle extends StatelessWidget {
  const BackCircle({super.key, required this.onTap, this.dark = false});
  final VoidCallback onTap; final bool dark;
  @override
  Widget build(BuildContext context) => InkWell(borderRadius: BorderRadius.circular(30), onTap: onTap, child: Container(width: 44, height: 44, decoration: BoxDecoration(shape: BoxShape.circle, color: dark ? Colors.white12 : Colors.white, border: dark ? null : Border.all(color: const Color(0xFFE2E8E3))), child: Icon(Icons.arrow_back_ios_new, size: 18, color: dark ? Colors.white : Brand.ink)));
}

class BigButton extends StatelessWidget {
  const BigButton(this.text, {super.key, required this.onPressed, this.outlined = false});
  final String text; final VoidCallback? onPressed; final bool outlined;
  @override
  Widget build(BuildContext context) => SizedBox(
        width: double.infinity, height: 56,
        child: outlined
            ? OutlinedButton(onPressed: onPressed, style: OutlinedButton.styleFrom(shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)), side: const BorderSide(color: Color(0xFFB9C9C0)), foregroundColor: Brand.delta), child: Text(text, style: display(17, color: Brand.delta, w: FontWeight.w700)))
            : FilledButton(onPressed: onPressed, style: FilledButton.styleFrom(backgroundColor: Brand.delta, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18))), child: Text(text, style: display(17, color: Colors.white, w: FontWeight.w700))),
      );
}
