import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// Career Gap Intelligence from real postings: what the approved postings for my goal ask for,
// and where my EVIDENCE stands: proven, self-rated only (needs proof), or missing.
final jobGapsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/job-gaps'));

class JobGapsScreen extends ConsumerWidget {
  const JobGapsScreen({super.key});

  Widget _section(BuildContext context, String title, String sub, List<Map> items, Color tint, Widget Function(Map) trailing) {
    if (items.isEmpty) return const SizedBox();
    return AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: display(19, color: Brand.ink)),
      Text(sub, style: body(13, color: Brand.muted)),
      const SizedBox(height: 8),
      for (final x in items) Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Row(children: [
        Container(width: 8, height: 36, decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(4))),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(nm(context, x, 'nameEn', 'nameBn'), style: body(16, w: FontWeight.w700)),
          Text('${tr(context, 'asked in', 'চাওয়া হয়েছে')} ${x['share']}% ${tr(context, 'of postings · level', 'পোস্টে · লেভেল')} ${x['level']}', style: body(12, color: Brand.muted)),
        ])),
        trailing(x),
      ])),
    ]));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(jobGapsProvider),
        onRetry: () => ref.invalidate(jobGapsProvider),
        builder: (d) {
          final role = (d['role'] ?? {}) as Map;
          final strengths = ((d['strengths'] ?? []) as List).cast<Map>();
          final needs = ((d['evidenceNeeded'] ?? []) as List).cast<Map>();
          final missing = ((d['missing'] ?? []) as List).cast<Map>();
          final next = ((d['next'] ?? []) as List).cast<Map>();
          final samples = ((d['sampleTitles'] ?? []) as List).cast<Map>();
          return ListView(padding: EdgeInsets.zero, children: [
            GreenHeader(radius: 36, bottomPad: 26, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              BackCircle(dark: true, onTap: () => context.pop()),
              const SizedBox(height: 12),
              Text(tr(context, 'What employers ask for', 'নিয়োগদাতারা কী চান'), style: display(28, color: Colors.white)),
              Text('${nm(context, role, 'titleEn', 'titleBn')} · ${d['postingsUsed']} ${tr(context, 'postings', 'পোস্ট')}', style: body(15, color: Colors.white70)),
            ])),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (next.isNotEmpty) AppCard(color: Brand.lightSaffron, border: Colors.transparent, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'DO THESE NEXT', 'এগুলো আগে করুন'), style: body(12, color: const Color(0xFF7A4A00), w: FontWeight.w800)),
                for (final n in next) Padding(padding: const EdgeInsets.only(top: 6), child: Row(children: [
                  Expanded(child: Text(nm(context, n, 'nameEn', 'nameBn'), style: body(16, w: FontWeight.w700, color: const Color(0xFF5A3600)))),
                  TextButton(onPressed: () => context.push('/roadmap/${n['skillKey']}'), child: Text(tr(context, 'Roadmap', 'রোডম্যাপ'))),
                  TextButton(onPressed: () => context.push('/gap/${n['skillKey']}/mentors'), child: Text(tr(context, 'Mentors', 'মেন্টর'))),
                ])),
              ])),
              _section(context, tr(context, 'Missing', 'নেই'), tr(context, 'Most asked first', 'যেটা বেশি চাওয়া হয় সেটা আগে'), missing, Colors.redAccent, (x) => x['hasQuiz'] == true
                  ? TextButton(onPressed: () => context.push('/quiz/${x['skillKey']}'), child: Text(tr(context, 'Quiz', 'কুইজ')))
                  : const SizedBox()),
              _section(context, tr(context, 'Evidence still needed', 'প্রমাণ এখনও দরকার'), tr(context, 'You rated yourself, but nothing proves it yet', 'আপনি নিজে দিয়েছেন, এখনও প্রমাণ নেই'), needs, Brand.saffron, (x) => x['hasQuiz'] == true
                  ? TextButton(onPressed: () => context.push('/quiz/${x['skillKey']}'), child: Text(tr(context, 'Prove it', 'প্রমাণ করুন')))
                  : const SizedBox()),
              _section(context, tr(context, 'Proven strengths', 'প্রমাণিত শক্তি'), tr(context, 'Backed by a quiz, project or mentor', 'কুইজ, প্রজেক্ট বা মেন্টর দ্বারা প্রমাণিত'), strengths, Brand.delta, (x) => const Icon(Icons.check_circle, color: Brand.delta)),
              if (samples.isNotEmpty) AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'POSTINGS USED', 'ব্যবহৃত পোস্ট'), style: body(12, color: Brand.muted, w: FontWeight.w800)),
                for (final s in samples) Text('${s['title']} · ${s['organization']}', style: body(14)),
              ])),
              Text('${d['note'] ?? ''}', textAlign: TextAlign.center, style: body(13, color: Brand.muted)),
              const SizedBox(height: 16),
            ])),
          ]);
        },
      ),
    );
  }
}

final jobGapRoutes = <RouteBase>[
  GoRoute(path: '/job-gaps', builder: (_, __) => const JobGapsScreen()),
];
