import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// Career pathway graph: assessments -> topics (in prerequisite order) -> your target. Every box shows your status.
// All data comes from GET /me/graph (it uses the same scoring as the target screens). Pan and pinch to move around, tap a box for details.
final graphTargetProvider = StateProvider.autoDispose<String>((_) => '');
final graphProvider = FutureProvider.autoDispose((ref) {
  final t = ref.watch(graphTargetProvider);
  return getJson(ref, '/me/graph', q: t.isEmpty ? null : {'target': t});
});

const double _nodeW = 156, _nodeH = 46, _gapX = 64, _gapY = 14, _pad = 16;

class _Layout {
  _Layout(this.rects, this.size);
  final Map<String, Rect> rects;
  final Size size;
}

_Layout _layout(List nodes, int columns) {
  final byCol = <int, List<Map>>{};
  for (final n in nodes.cast<Map>()) { byCol.putIfAbsent(n['col'] as int, () => []).add(n); }
  final rects = <String, Rect>{};
  var tallest = 1;
  for (final e in byCol.entries) { tallest = math.max(tallest, e.value.length); }
  final height = _pad * 2 + tallest * _nodeH + (tallest - 1) * _gapY;
  for (final e in byCol.entries) {
    final list = e.value;
    final colH = list.length * _nodeH + (list.length - 1) * _gapY;
    final top = (height - colH) / 2;
    for (var i = 0; i < list.length; i++) {
      rects[list[i]['id'] as String] = Rect.fromLTWH(_pad + e.key * (_nodeW + _gapX), top + i * (_nodeH + _gapY), _nodeW, _nodeH);
    }
  }
  return _Layout(rects, Size(_pad * 2 + columns * _nodeW + (columns - 1) * _gapX, height));
}

(Color, Color, Color) _style(Map n) {
  // fill, border, text
  if (n['type'] == 'target') return (Brand.forest, Brand.forest, Colors.white);
  if (n['type'] == 'assessment') return (const Color(0xFFE6EEFB), const Color(0xFF7FA0D6), const Color(0xFF1F4A8F));
  return switch (n['status']) {
    'verified' => (Brand.delta, Brand.delta, Colors.white),
    'known' => (Brand.lightGreen, Brand.delta, Brand.forest),
    'ready' => (Brand.lightSaffron, Brand.saffron, const Color(0xFF5A3A00)),
    _ => (const Color(0xFFEDEFEE), const Color(0xFFC3CBC6), Brand.muted),
  };
}

class _GraphPainter extends CustomPainter {
  _GraphPainter(this.nodes, this.edges, this.layout, this.bn);
  final List nodes, edges;
  final _Layout layout;
  final bool bn;

  @override
  void paint(Canvas canvas, Size size) {
    for (final e in edges.cast<Map>()) {
      final a = layout.rects[e['from']], b = layout.rects[e['to']];
      if (a == null || b == null) continue;
      final p = Offset(a.right, a.center.dy), q = Offset(b.left, b.center.dy);
      final mid = (q.dx - p.dx) / 2;
      final path = Path()..moveTo(p.dx, p.dy)..cubicTo(p.dx + mid, p.dy, q.dx - mid, q.dy, q.dx, q.dy);
      canvas.drawPath(path, Paint()..style = PaintingStyle.stroke..strokeWidth = (e['kind'] == 'assessed_by' ? 1.2 : 1.8)..color = e['kind'] == 'required_for' ? const Color(0xFFB9C9C0) : const Color(0xFF9DB0A6));
    }
    for (final n in nodes.cast<Map>()) {
      final r = layout.rects[n['id']];
      if (r == null) continue;
      final (fill, border, text) = _style(n);
      final rr = RRect.fromRectAndRadius(r, const Radius.circular(14));
      canvas.drawRRect(rr, Paint()..color = fill);
      canvas.drawRRect(rr, Paint()..style = PaintingStyle.stroke..strokeWidth = (n['status'] == 'ready' ? 2.2 : 1.4)..color = border);
      final label = (bn ? (n['titleBn'] ?? n['titleEn']) : n['titleEn']) as String? ?? '';
      final tp = TextPainter(
        text: TextSpan(text: label, style: TextStyle(fontSize: 11.5, height: 1.15, fontWeight: n['type'] == 'target' ? FontWeight.w800 : FontWeight.w600, color: text)),
        maxLines: 2, ellipsis: '…', textDirection: TextDirection.ltr,
      )..layout(maxWidth: r.width - 16);
      tp.paint(canvas, Offset(r.left + 8, r.center.dy - tp.height / 2));
    }
  }

  @override
  bool shouldRepaint(covariant _GraphPainter old) => old.nodes != nodes || old.bn != bn;
}

class CareerGraphScreen extends ConsumerWidget {
  const CareerGraphScreen({super.key});

  String _statusText(BuildContext c, String? s) => switch (s) {
        'verified' => tr(c, 'Verified by a quiz, project or mentor', 'কুইজ, প্রজেক্ট বা মেন্টর দিয়ে যাচাইকৃত'),
        'known' => tr(c, 'You ticked this as known', 'আপনি এটি জানা বলে টিক দিয়েছেন'),
        'ready' => tr(c, 'You can start this now', 'এখনই শুরু করতে পারেন'),
        _ => tr(c, 'Learn the topics before it first', 'আগের ধাপগুলো শিখে নিন'),
      };

  void _details(BuildContext context, Map n, String targetKey) {
    final bn = Localizations.localeOf(context).languageCode == 'bn';
    final title = (bn ? (n['titleBn'] ?? n['titleEn']) : n['titleEn']) as String;
    showModalBottomSheet(context: context, showDragHandle: true, builder: (c) => Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: display(20, color: Brand.ink)),
        const SizedBox(height: 8),
        if (n['type'] == 'topic') ...[
          Text(_statusText(context, n['status'] as String?), style: body(15)),
          const SizedBox(height: 6),
          Text(tr(context, 'About ${n['hours']} hours · importance ${n['weight']} of 3', 'প্রায় ${n['hours']} ঘণ্টা · গুরুত্ব ${n['weight']}/৩'), style: body(14, color: Brand.muted)),
          if (((n['missing'] ?? []) as List).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(tr(context, 'Needs ${(n['missing'] as List).length} earlier topic(s) first.', 'আগে ${(n['missing'] as List).length}টি বিষয় লাগবে।'), style: body(14, color: Brand.muted))),
        ] else if (n['type'] == 'target') Text(tr(context, 'Your score here: ${n['percent']}% · verified ${n['verifiedPercent']}%', 'এখানে আপনার স্কোর: ${n['percent']}% · যাচাইকৃত ${n['verifiedPercent']}%'), style: body(15))
        else Text(tr(context, 'A quiz verifies this skill and counts as evidence.', 'কুইজ এই দক্ষতা যাচাই করে এবং প্রমাণ হিসেবে গণ্য হয়।'), style: body(15)),
        const SizedBox(height: 14),
        if (n['type'] == 'assessment' && n['skillKey'] != null) BigButton(tr(context, 'Take the quiz', 'কুইজ দিন'), onPressed: () { Navigator.pop(c); context.push('/quiz/${n['skillKey']}'); }),
        if (n['type'] != 'assessment') BigButton(tr(context, 'Open this target', 'এই লক্ষ্যটি খুলুন'), outlined: true, onPressed: () { Navigator.pop(c); context.push('/target/$targetKey'); }),
      ]),
    ));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bn = Localizations.localeOf(context).languageCode == 'bn';
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'Career pathway map', 'ক্যারিয়ার পথের মানচিত্র'), style: display(22, color: Brand.ink))),
      body: AsyncBody(value: ref.watch(graphProvider), onRetry: () => ref.invalidate(graphProvider), builder: (d) {
        final g = d as Map<String, dynamic>;
        final nodes = g['nodes'] as List, edges = g['edges'] as List;
        final lay = _layout(nodes, g['columns'] as int);
        final counts = g['counts'] as Map;
        final target = g['target'] as Map;
        final available = (g['available'] as List).cast<Map>();
        return ListView(padding: const EdgeInsets.only(bottom: 24), children: [
          SizedBox(height: 52, child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 16), children: [
            for (final t in available) Padding(padding: const EdgeInsets.only(right: 8, top: 8), child: ChoiceChip(
              label: Text(nm(context, t, 'titleEn', 'titleBn')), selected: t['key'] == target['key'],
              onSelected: (_) => ref.read(graphTargetProvider.notifier).state = t['key'] as String)),
          ])),
          Padding(padding: const EdgeInsets.fromLTRB(16, 8, 16, 4), child: Wrap(spacing: 8, runSpacing: 6, children: [
            Pill(tr(context, '${counts['verified']} verified', '${counts['verified']} যাচাইকৃত')),
            Pill(tr(context, '${counts['known']} known', '${counts['known']} জানা'), tone: Tone.blue),
            Pill(tr(context, '${counts['ready']} ready to start', '${counts['ready']} শুরু করা যায়'), tone: Tone.saffron),
            Pill(tr(context, '${counts['locked']} locked', '${counts['locked']} তালাবদ্ধ'), tone: Tone.grey),
          ])),
          Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Text(tr(context, 'Quizzes and projects (left) feed the topics, in order, into your target (right). Pinch to zoom, tap a box.', 'কুইজ ও প্রজেক্ট (বামে) ক্রমানুসারে বিষয়গুলোকে আপনার লক্ষ্যে (ডানে) নিয়ে যায়। জুম করুন, বক্সে ট্যাপ করুন।'), style: body(13, color: Brand.muted))),
          const SizedBox(height: 8),
          Container(
            height: math.min(lay.size.height + 8, 520.0), margin: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFE1E8E3))),
            clipBehavior: Clip.antiAlias,
            child: InteractiveViewer(
              constrained: false, minScale: 0.5, maxScale: 2.5, boundaryMargin: const EdgeInsets.all(40),
              child: GestureDetector(
                onTapUp: (t) {
                  for (final n in nodes.cast<Map>()) {
                    final r = lay.rects[n['id']];
                    if (r != null && r.contains(t.localPosition)) { _details(context, n, target['key'] as String); return; }
                  }
                },
                child: CustomPaint(size: lay.size, painter: _GraphPainter(nodes, edges, lay, bn)),
              ),
            ),
          ),
          Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 0), child: Wrap(spacing: 14, runSpacing: 6, children: [
            for (final s in [(Brand.delta, tr(context, 'Verified', 'যাচাইকৃত')), (Brand.lightGreen, tr(context, 'Known', 'জানা')), (Brand.lightSaffron, tr(context, 'Ready', 'প্রস্তুত')), (const Color(0xFFEDEFEE), tr(context, 'Locked', 'তালাবদ্ধ')), (const Color(0xFFE6EEFB), tr(context, 'Quiz', 'কুইজ'))])
              Row(mainAxisSize: MainAxisSize.min, children: [Container(width: 14, height: 14, decoration: BoxDecoration(color: s.$1, borderRadius: BorderRadius.circular(4), border: Border.all(color: const Color(0xFFB9C9C0)))), const SizedBox(width: 6), Text(s.$2, style: body(12, color: Brand.muted))]),
          ])),
        ]);
      }),
    );
  }
}
