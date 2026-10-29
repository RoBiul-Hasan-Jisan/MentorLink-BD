import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// Shared with the mentor profile screen.
Future<void> sendMentorRequest(BuildContext c, WidgetRef r, String mentorId) async { c.push('/request/$mentorId'); }

const _w = {'career': .30, 'gap': .25, 'experience': .15, 'language': .10, 'schedule': .10, 'reliability': .10};

class MentorMatches extends ConsumerWidget {
  const MentorMatches({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rd = ref.watch(readinessProvider).valueOrNull;
    return AsyncBody(value: ref.watch(matchesProvider), onRetry: () => ref.invalidate(matchesProvider), builder: (d) {
      final list = (d['matches'] as List).cast<Map>();
      return ListView(padding: EdgeInsets.zero, children: [
        GreenHeader(radius: 36, bottomPad: 80, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(tr(context, 'Your mentor matches', 'আপনার মেন্টর মিল'), style: display(30, color: Colors.white)),
          const SizedBox(height: 6),
          Text(tr(context, 'Top 5${rd == null ? '' : ' for ${rd['roleTitleEn']}'}. Every score is explained.', 'সেরা ৫ জন। প্রতিটি স্কোরের কারণ দেখানো হয়।'), style: body(16, color: Colors.white70)),
        ])),
        Transform.translate(offset: const Offset(0, -50), child: Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Column(children: [
          if (list.isEmpty) AppCard(child: Text(tr(context, 'No mentors yet. Set a career goal first.', 'এখনও কোনো মেন্টর নেই। আগে লক্ষ্য ঠিক করুন।'), style: body(16))),
          for (int i = 0; i < list.length; i++) i == 0 ? _top(context, ref, list[i]) : _row(context, ref, list[i]),
          if (list.isNotEmpty) Center(child: Padding(padding: const EdgeInsets.only(top: 6), child: Text(tr(context, 'Showing ${list.length}. Scores use 6 weighted factors.', '${list.length} জন দেখানো হচ্ছে। ৬টি ফ্যাক্টর ব্যবহার হয়েছে।'), style: body(15, color: Brand.muted)))),
        ]))),
      ]);
    });
  }

  Widget _top(BuildContext context, WidgetRef ref, Map m) {
    final mentor = m['mentor'] as Map;
    final fs = (m['factorScores'] as Map);
    int pt(String k) => (((fs[k] ?? 0) as num) * _w[k]!).round();
    final List<(String, int)> parts = [
      (tr(context, 'Career', 'ক্যারিয়ার'), pt('career')), (tr(context, 'Gaps', 'ঘাটতি'), pt('gap')),
      (tr(context, 'Exp', 'অভিজ্ঞতা'), pt('experience')), (tr(context, 'Lang', 'ভাষা'), pt('language')),
      (tr(context, 'Time', 'সময়'), pt('schedule')), (tr(context, 'Trust', 'আস্থা'), pt('reliability')),
    ];

    final reasons = (m['reasons'] as List).map((r) => nm(context, r, 'en', 'bn')).join(' ');
    return AppCard(border: Brand.saffron, padding: const EdgeInsets.all(18), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Avatar(mentor['name'], size: 62),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Flexible(child: Text(mentor['name'], style: display(22, color: Brand.ink))), const SizedBox(width: 6), const Icon(Icons.verified, color: Brand.delta, size: 20)]),
          Text('${mentor['roleTitle']} · ${mentor['industry']} · ${mentor['yearsExperience']} ${tr(context, 'yrs', 'বছর')}', style: body(15, color: Brand.muted)),
        ])),
        Ring(value: (m['score'] as num) / 100, size: 66, stroke: 8, dark: false, label: '${m['score']}%', labelStyle: display(15, color: Brand.ink)),
      ]),
      const SizedBox(height: 14),
      FactorBar(parts),
      const SizedBox(height: 12),
      Container(width: double.infinity, padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: const Color(0xFFF0F5F1), borderRadius: BorderRadius.circular(16)), child: Text.rich(TextSpan(children: [TextSpan(text: tr(context, 'Why this mentor: ', 'কেন এই মেন্টর: '), style: body(16, w: FontWeight.w800)), TextSpan(text: reasons, style: body(16))]))),
      const SizedBox(height: 12),
      Wrap(spacing: 8, runSpacing: 6, children: [Pill(tr(context, 'Alumni verified', 'অ্যালামনাই যাচাইকৃত')), if (mentor['isRising'] == true) Pill(tr(context, 'Rising mentor', 'উদীয়মান মেন্টর'), tone: Tone.saffron)]),
      const SizedBox(height: 12),
      BigButton(tr(context, 'Send request', 'অনুরোধ পাঠান'), onPressed: () => context.push('/request/${mentor['id']}')),
      Center(child: TextButton(onPressed: () => context.push('/mentor/${mentor['id']}'), child: Text(tr(context, 'View full profile', 'পূর্ণ প্রোফাইল দেখুন')))),
    ]));
  }

  Widget _row(BuildContext context, WidgetRef ref, Map m) {
    final mentor = m['mentor'] as Map;
    return AppCard(padding: const EdgeInsets.all(16), onTap: () => context.push('/mentor/${mentor['id']}'), child: Row(children: [
      Avatar(mentor['name'], size: 52, bg: Brand.lightGreen, fg: Brand.forest),
      const SizedBox(width: 14),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(mentor['name'], style: display(19, color: Brand.ink)),
        Text('${mentor['roleTitle']} · ${mentor['industry']}${mentor['isRising'] == true ? ' · ${tr(context, 'rising mentor', 'উদীয়মান')}' : ''}', style: body(15, color: Brand.muted)),
      ])),
      Text('${m['score']}%', style: display(24, color: Brand.forest)),
    ]));
  }

  Future<void> _request(BuildContext context, WidgetRef ref, String mentorId) async {
    final goal = TextEditingController(), q = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(
      title: Text(tr(context, 'Request a session', 'সেশনের অনুরোধ'), style: display(20)),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: goal, decoration: InputDecoration(labelText: tr(context, 'Your goal', 'আপনার লক্ষ্য'))), const SizedBox(height: 8),
        TextField(controller: q, decoration: InputDecoration(labelText: tr(context, 'One question', 'একটি প্রশ্ন'))),
      ]),
      actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(context, 'Cancel', 'বাতিল'))), FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(tr(context, 'Send', 'পাঠান')))]));
    if (ok != true) return;
    try {
      await ref.read(dioProvider).post('/requests', data: {'mentorId': mentorId, 'goalText': goal.text, 'questions': [q.text]});
      ref.invalidate(requestsProvider);
      if (context.mounted) toast(context, tr(context, 'Request sent', 'অনুরোধ পাঠানো হয়েছে'));
    } catch (e) { if (context.mounted) toast(context, errorText(e)); }
  }
}
