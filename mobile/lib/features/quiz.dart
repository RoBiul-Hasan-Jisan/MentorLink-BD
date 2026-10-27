import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'hub.dart';
import 'widgets.dart';

class QuizScreen extends ConsumerStatefulWidget {
  const QuizScreen({super.key, required this.skill});
  final String skill;
  @override
  ConsumerState<QuizScreen> createState() => _QuizState();
}
class _QuizState extends ConsumerState<QuizScreen> {
  final Map<int, int> picked = {};
  Map<String, dynamic>? result;

  // Result: score, NAMED level (Beginner to Advanced), strong and weak topics, and what to do next.
  Widget _result(BuildContext context) {
    final r = result!;
    final lvl = (r['levelName'] ?? {}) as Map;
    final topics = ((r['topics'] ?? []) as List).cast<Map>();
    final weak = ((r['weak'] ?? []) as List).map((e) => '$e').toList();
    final res = ((r['resources'] ?? []) as List).cast<Map>();
    final bn = Localizations.localeOf(context).languageCode == 'bn';
    return ListView(padding: const EdgeInsets.all(20), children: [
      Center(child: Ring(value: (r['percent'] as num) / 100, dark: false, size: 140, stroke: 14, label: '${r['correct']}/${r['total']}', labelStyle: display(30, color: Brand.ink))),
      const SizedBox(height: 14),
      Center(child: Pill('${tr(context, 'Your level', 'আপনার লেভেল')}: ${bn ? lvl['bn'] : lvl['en']}', tone: Tone.saffron)),
      const SizedBox(height: 6),
      Center(child: Text((r['levelAwarded'] as num) > 0 ? tr(context, 'Level ${r['levelAwarded']} was added as quiz evidence.', 'লেভেল ${r['levelAwarded']} কুইজ প্রমাণ হিসেবে যোগ হয়েছে।') : tr(context, 'No level added yet. Study the weak topics and try again.', 'এখনও লেভেল যোগ হয়নি। দুর্বল টপিক পড়ে আবার চেষ্টা করুন।'), textAlign: TextAlign.center, style: body(15, color: Brand.muted))),
      const SizedBox(height: 14),
      AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(tr(context, 'BY TOPIC', 'টপিক অনুযায়ী'), style: body(12, color: Brand.muted, w: FontWeight.w800)),
        const SizedBox(height: 8),
        for (final t in topics) Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [
          Expanded(flex: 4, child: Text('${t['topic']}', style: body(15, w: FontWeight.w600))),
          Expanded(flex: 5, child: ProgressBar((t['percent'] as num) / 100, color: (t['percent'] as num) < 60 ? Brand.saffron : Brand.delta, height: 8)),
          SizedBox(width: 52, child: Text('${t['correct']}/${t['total']}', textAlign: TextAlign.right, style: body(14, color: Brand.muted))),
        ])),
      ])),
      if (weak.isNotEmpty) AppCard(color: Brand.lightSaffron, border: Colors.transparent, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(tr(context, 'Review these first', 'আগে এগুলো পড়ুন'), style: display(18, color: const Color(0xFF5A3600))),
        const SizedBox(height: 4),
        Text(weak.join(', '), style: body(16, w: FontWeight.w700, color: const Color(0xFF5A3600))),
        for (final x in res) TextButton(onPressed: () => launchUrl(Uri.parse('${x['url']}'), mode: LaunchMode.externalApplication), child: Align(alignment: Alignment.centerLeft, child: Text('${x['title']}'))),
        TextButton(onPressed: () => context.push('/roadmap/${widget.skill}'), child: Text(tr(context, 'Open the roadmap', 'রোডম্যাপ খুলুন'))),
      ])),
      const SizedBox(height: 8),
      BigButton(tr(context, 'Done', 'শেষ'), onPressed: () { ref.invalidate(readinessProvider); ref.invalidate(myDashboardProvider); context.pop(); }),
    ]);
  }
  @override
  Widget build(BuildContext context) => Scaffold(body: Column(children: [
        GreenHeader(radius: 28, bottomPad: 18, child: Row(children: [BackCircle(dark: true, onTap: () => context.pop()), const SizedBox(width: 12), Text(tr(context, 'Quiz: ${widget.skill.toUpperCase()}', 'কুইজ: ${widget.skill.toUpperCase()}'), style: display(22, color: Colors.white))])),
        Expanded(child: AsyncBody(value: ref.watch(quizProvider(widget.skill)), builder: (d) {
          final qs = (d['questions'] as List).cast<Map>();
          if (result != null) return _result(context);
          return ListView(padding: const EdgeInsets.all(16), children: [
            for (int i = 0; i < qs.length; i++) AppCard(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${i + 1}. ${qs[i]['q']}', style: display(18, color: Brand.ink)),
              for (int o = 0; o < (qs[i]['options'] as List).length; o++) RadioListTile<int>(contentPadding: EdgeInsets.zero, activeColor: Brand.delta, value: o, groupValue: picked[i], title: Text(qs[i]['options'][o], style: body(16)), onChanged: (v) => setState(() => picked[i] = v!)),
            ])),
            BigButton(tr(context, 'Submit', 'জমা দিন'), onPressed: picked.length < qs.length ? null : () async {
              try { final r = await ref.read(dioProvider).post('/quizzes/${widget.skill}/submit', data: {'answers': [for (int i = 0; i < qs.length; i++) picked[i]]}); setState(() => result = r.data as Map<String, dynamic>); }
              catch (e) { if (context.mounted) toast(context, errorText(e)); }
            }),
          ]);
        })),
      ]));
}
