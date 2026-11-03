import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../core/ui.dart';

// Small chart widgets with no extra package. A null value means "hidden" (the server hides groups that are too small).
class BarDatum {
  const BarDatum(this.label, this.value, {this.color});
  final String label;
  final double? value;
  final Color? color;
}

class BarChartBox extends StatelessWidget {
  const BarChartBox({super.key, required this.data, this.height = 120, this.maxValue});
  final List<BarDatum> data;
  final double height;
  final double? maxValue;

  @override
  Widget build(BuildContext context) {
    double top = 0;
    for (final d in data) { if ((d.value ?? 0) > top) top = d.value!; }
    final mx = math.max(1.0, maxValue ?? top);
    return SizedBox(
      height: height + 68, // room for a two-line label such as "Machine Learning"
      child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
        for (final d in data)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 5),
              child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                Text(d.value == null ? '–' : d.value!.round().toString(), style: body(13, w: FontWeight.w700)),
                const SizedBox(height: 4),
                Container(
                  height: d.value == null ? 4.0 : (height * (d.value! / mx)).clamp(4.0, height).toDouble(),
                  decoration: BoxDecoration(color: d.value == null ? const Color(0xFFD7DFDA) : (d.color ?? Brand.delta), borderRadius: BorderRadius.circular(8)),
                ),
                const SizedBox(height: 6),
                Text(d.label, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: body(11, color: Brand.muted)),
              ]),
            ),
          ),
      ]),
    );
  }
}

class DonutSlice {
  const DonutSlice(this.label, this.value, this.color);
  final String label;
  final double value;
  final Color color;
}

class DonutChartBox extends StatelessWidget {
  const DonutChartBox({super.key, required this.slices, this.size = 120, this.center});
  final List<DonutSlice> slices;
  final double size;
  final String? center;

  @override
  Widget build(BuildContext context) => Row(children: [
        SizedBox(
          width: size,
          height: size,
          child: Stack(alignment: Alignment.center, children: [
            CustomPaint(size: Size.square(size), painter: _DonutPainter(slices)),
            if (center != null) Text(center!, style: display(22, color: Brand.ink)),
          ]),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            for (final s in slices)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(children: [
                  Container(width: 12, height: 12, decoration: BoxDecoration(color: s.color, borderRadius: BorderRadius.circular(4))),
                  const SizedBox(width: 8),
                  Expanded(child: Text(s.label, style: body(14))),
                  Text(s.value.round().toString(), style: body(14, w: FontWeight.w700)),
                ]),
              ),
          ]),
        ),
      ]);
}

class _DonutPainter extends CustomPainter {
  _DonutPainter(this.slices);
  final List<DonutSlice> slices;
  @override
  void paint(Canvas canvas, Size size) {
    final total = slices.fold<double>(0, (a, s) => a + s.value);
    final stroke = size.width * 0.17;
    final rect = Rect.fromLTWH(stroke / 2, stroke / 2, size.width - stroke, size.height - stroke);
    final base = Paint()..style = PaintingStyle.stroke..strokeWidth = stroke..color = const Color(0xFFE9EEEA);
    canvas.drawArc(rect, 0, math.pi * 2, false, base);
    if (total <= 0) return;
    var start = -math.pi / 2;
    for (final s in slices) {
      if (s.value <= 0) continue;
      final sweep = math.pi * 2 * (s.value / total);
      canvas.drawArc(rect, start, math.max(0.02, sweep - 0.03), false, Paint()..style = PaintingStyle.stroke..strokeWidth = stroke..strokeCap = StrokeCap.butt..color = s.color);
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant _DonutPainter old) => old.slices != slices;
}

class SparklineBox extends StatelessWidget {
  const SparklineBox({super.key, required this.values, this.height = 56, this.color = Brand.delta});
  final List<double> values;
  final double height;
  final Color color;
  @override
  Widget build(BuildContext context) => SizedBox(height: height, width: double.infinity, child: CustomPaint(painter: _SparkPainter(values, color)));
}

class _SparkPainter extends CustomPainter {
  _SparkPainter(this.v, this.color);
  final List<double> v;
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    if (v.length < 2) return;
    final lo = v.reduce(math.min), hi = v.reduce(math.max);
    final span = math.max(1e-6, hi - lo);
    Offset at(int i) => Offset(size.width * i / (v.length - 1), size.height - 6 - (size.height - 12) * ((v[i] - lo) / span));
    final path = Path()..moveTo(at(0).dx, at(0).dy);
    for (var i = 1; i < v.length; i++) { path.lineTo(at(i).dx, at(i).dy); }
    canvas.drawPath(path, Paint()..style = PaintingStyle.stroke..strokeWidth = 3..strokeJoin = StrokeJoin.round..strokeCap = StrokeCap.round..color = color);
    canvas.drawCircle(at(v.length - 1), 4.5, Paint()..color = color);
  }

  @override
  bool shouldRepaint(covariant _SparkPainter old) => old.v != v || old.color != color;
}

// A number with a label, used in rows of stats. null shows a dash and "hidden".
class StatTile extends StatelessWidget {
  const StatTile(this.label, this.value, {super.key});
  final String label;
  final num? value;
  @override
  Widget build(BuildContext context) => Expanded(
        child: Column(children: [
          Text(value == null ? '–' : '${value!.round()}', style: display(26, color: value == null ? Brand.muted : Brand.forest)),
          Text(value == null ? tr(context, '$label (hidden)', '$label (লুকানো)') : label, textAlign: TextAlign.center, style: body(12, color: Brand.muted)),
        ]),
      );
}
