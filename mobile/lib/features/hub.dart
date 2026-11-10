import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// "My paths": the student's dashboard for several chosen targets (up to 5), one roadmap card each,
// named skill levels (Beginner to Advanced), the next step, and mentors for each chosen target.
final myDashboardProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/dashboard'));
final targetMentorsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/target-mentors'));

// Adds or removes a target from the student's chosen list. Returns true when it worked.
Future<bool> setChosenTargets(BuildContext context, WidgetRef ref, List<String> keys) async {
  try {
    await ref.read(dioProvider).put('/me/targets', data: {'keys': keys});
    ref.invalidate(myDashboardProvider);
    ref.invalidate(targetMentorsProvider);
    return true;
  } catch (e) {
    if (context.mounted) toast(context, errorText(e));
    return false;
  }
}

class MyPathsScreen extends ConsumerWidget {
  const MyPathsScreen({super.key});

  Widget _card(BuildContext context, Map c) {
    final next = c['next'] as Map?;
    final weeks = c['weeksLeft'];
    return AppCard(
      padding: const EdgeInsets.all(16),
      onTap: () => context.push('/target/${c['key']}'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Ring(value: (c['percent'] as num) / 100, size: 64, stroke: 8, dark: false),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(nm(context, c, 'titleEn', 'titleBn'), style: display(20, color: Brand.ink)),
            Text('${tr(context, 'Verified', 'যাচাইকৃত')} ${c['verifiedPercent']}%${weeks != null ? ' · ~$weeks ${tr(context, 'weeks left', 'সপ্তাহ বাকি')}' : ''}', style: body(13, color: Brand.muted)),
          ])),
          Icon(Icons.chevron_right, color: Brand.muted),
        ]),
        if (next != null) ...[
          const SizedBox(height: 10),
          Pill('${tr(context, 'Next', 'পরবর্তী')}: ${nm(context, next, 'titleEn', 'titleBn')}', tone: Tone.saffron),
        ],
      ]),
    );
  }

  Widget _mentor(BuildContext context, Map m) => InkWell(
        onTap: () => context.push('/mentor/${m['mentorId']}'),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(children: [
            Avatar('${m['name']}', size: 38, bg: Brand.lightGreen, fg: Brand.forest),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${m['name']}', style: body(16, w: FontWeight.w700)),
              Text('${m['roleTitle']} · ${m['industry']}', style: body(13, color: Brand.muted)),
              if (((m['why'] ?? []) as List).isNotEmpty) Text(((m['why'] as List).cast<Map>()).map((w) => nm(context, w, 'nameEn', 'nameBn')).join(', '), style: body(12, color: Brand.delta)),
            ])),
            Text('${m['fit']}%', style: display(18, color: Brand.forest)),
          ]),
        ),
      );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mentors = ref.watch(targetMentorsProvider).valueOrNull;
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(myDashboardProvider),
        onRetry: () => ref.invalidate(myDashboardProvider),
        builder: (d) {
          final sel = ((d['selected'] ?? []) as List).cast<Map>();
          final skills = ((d['skills'] ?? []) as List).cast<Map>();
          final ns = d['nextStep'] as Map?;
          final max = (d['maxTargets'] ?? 5) as int;
          final byTarget = <String, List<Map>>{};
          for (final t in ((mentors?['targets'] ?? []) as List).cast<Map>()) {
            byTarget['${t['key']}'] = ((t['mentors'] ?? []) as List).cast<Map>();
          }
          return ListView(padding: EdgeInsets.zero, children: [
            GreenHeader(radius: 36, bottomPad: 26, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              BackCircle(dark: true, onTap: () => context.pop()),
              const SizedBox(height: 12),
              Text(tr(context, 'My paths', 'আমার পথ'), style: display(30, color: Colors.white)),
              Text(tr(context, 'One roadmap for each skill you chose.', 'আপনার বাছাই করা প্রতিটি স্কিলের জন্য একটি রোডম্যাপ।'), style: body(15, color: Colors.white70)),
            ])),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, '1. What do I already know?', '১. আমি কী জানি?'), style: body(15, w: FontWeight.w800)),
                const SizedBox(height: 8),
                if (skills.isEmpty) Text(tr(context, 'Nothing proven yet. Take a quiz to see your level.', 'এখনও কিছু প্রমাণিত নয়। লেভেল জানতে কুইজ দিন।'), style: body(14, color: Brand.muted))
                else Wrap(spacing: 6, runSpacing: 6, children: [for (final s in skills) Pill('${nm(context, s, 'nameEn', 'nameBn')}: ${nm(context, s, 'levelEn', 'levelBn')}${s['proven'] == true ? '' : ' *'}', tone: s['proven'] == true ? Tone.green : Tone.grey)]),
                if (skills.any((s) => s['proven'] != true)) Padding(padding: const EdgeInsets.only(top: 6), child: Text(tr(context, '* self-rated, not yet proven by a quiz or project', '* নিজে দেওয়া, কুইজ বা প্রজেক্টে এখনও প্রমাণিত নয়'), style: body(12, color: Brand.muted))),
              ])),
              AppCard(color: Brand.lightSaffron, border: Colors.transparent, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, '2. What should I learn next?', '২. পরে কী শিখব?'), style: body(15, w: FontWeight.w800, color: const Color(0xFF5A3600))),
                const SizedBox(height: 6),
                Text(ns == null ? tr(context, 'Choose a target to get your next step.', 'পরের ধাপ পেতে একটি লক্ষ্য বাছুন।') : '${nm(context, ns, 'titleEn', 'titleBn')}  (${nm(context, ns, 'targetTitleEn', 'targetTitleBn')})', style: display(18, color: const Color(0xFF5A3600))),
              ])),
              Text(tr(context, '3. How can I use my skills?', '৩. স্কিল দিয়ে কী করব?'), style: body(15, w: FontWeight.w800)),
              const SizedBox(height: 8),
              if (sel.isEmpty) AppCard(child: Text(tr(context, 'You have not chosen a target yet.', 'আপনি এখনও কোনো লক্ষ্য বাছেননি।'), style: body(16))),
              for (final c in sel) ...[
                _card(context, c),
                if ((byTarget['${c['key']}'] ?? []).isNotEmpty) Padding(padding: const EdgeInsets.only(left: 8, bottom: 12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(tr(context, 'Mentors for this path', 'এই পথের মেন্টর'), style: body(12, color: Brand.muted, w: FontWeight.w800)),
                  for (final m in byTarget['${c['key']}']!) _mentor(context, m),
                ])),
              ],
              BigButton(sel.length >= max ? tr(context, 'Change my targets', 'লক্ষ্য বদলান') : tr(context, 'Add a target', 'লক্ষ্য যোগ করুন'), outlined: true, onPressed: () => context.push('/targets')),
              const SizedBox(height: 4),
              Center(child: Text(tr(context, 'You can follow up to $max targets.', 'সর্বোচ্চ $max টি লক্ষ্য অনুসরণ করা যায়।'), style: body(12, color: Brand.muted))),
            ])),
          ]);
        },
      ),
    );
  }
}

final hubRoutes = <RouteBase>[
  GoRoute(path: '/my-paths', builder: (_, __) => const MyPathsScreen()),
];
