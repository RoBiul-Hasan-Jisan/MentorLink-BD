import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'hub.dart';
import 'widgets.dart';

// Pick a target (for example Machine Learning). The student ticks what they already know,
// the server scores them against the target and returns an ordered learning path.
class TargetsScreen extends ConsumerWidget {
  const TargetsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
        body: AsyncBody(value: ref.watch(targetsProvider), onRetry: () => ref.invalidate(targetsProvider), builder: (d) {
          final list = (d['targets'] as List).cast<Map>();
          final chosen = [for (final c in ((ref.watch(myDashboardProvider).valueOrNull?['selected'] ?? []) as List).cast<Map>()) '${c['key']}'];
          return ListView(padding: EdgeInsets.zero, children: [
            GreenHeader(radius: 36, bottomPad: 30, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              BackCircle(dark: true, onTap: () => context.pop()),
              const SizedBox(height: 12),
              Text(tr(context, 'Pick a target', 'লক্ষ্য বেছে নিন'), style: display(30, color: Colors.white)),
              Text(tr(context, 'Choose what you want to become. Tick what you already know and get your score and the next steps.', 'কী হতে চান বেছে নিন। যা জানেন তা টিক দিন, স্কোর ও পরের ধাপ দেখুন।'), style: body(15, color: Colors.white70)),
            ])),
            Padding(padding: const EdgeInsets.all(16), child: Column(children: [
              for (final t in list) AppCard(padding: const EdgeInsets.all(16), onTap: () => context.push('/target/${t['key']}'), child: Row(children: [
                Ring(value: (t['percent'] as num) / 100, size: 70, stroke: 8, dark: false),
                const SizedBox(width: 14),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(nm(context, t, 'titleEn', 'titleBn'), style: display(20, color: Brand.ink)),
                  Text(nm(context, t, 'summaryEn', 'summaryBn'), style: body(14, color: Brand.muted)),
                  const SizedBox(height: 6),
                  Text('${t['topicCount']} ${tr(context, 'topics', 'টপিক')}  ·  ${t['hoursLeft']} h ${tr(context, 'left', 'বাকি')}', style: body(13, color: Brand.muted)),
                ])),
                IconButton(
                  tooltip: tr(context, 'Follow this path (up to 5)', 'এই পথ অনুসরণ করুন (সর্বোচ্চ ৫)'),
                  icon: Icon(chosen.contains('${t['key']}') ? Icons.star : Icons.star_border, color: Brand.saffron),
                  onPressed: () => setChosenTargets(context, ref, chosen.contains('${t['key']}') ? [for (final k in chosen) if (k != '${t['key']}') k] : [...chosen, '${t['key']}']),
                ),
              ])),
            ])),
          ]);
        }),
      );
}

class TargetScreen extends ConsumerWidget {
  const TargetScreen({super.key, required this.targetKey});
  final String targetKey;

  Future<void> _tick(BuildContext context, WidgetRef ref, String topicKey, bool known) async {
    try {
      await ref.read(dioProvider).put('/targets/$targetKey/topics/$topicKey', data: {'known': known});
      ref.invalidate(targetProvider(targetKey)); ref.invalidate(targetsProvider);
    } catch (e) { if (context.mounted) toast(context, errorText(e)); }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
        body: AsyncBody(value: ref.watch(targetProvider(targetKey)), onRetry: () => ref.invalidate(targetProvider(targetKey)), builder: (d) {
          final topics = (d['topics'] as List).cast<Map>();
          final path = (d['path'] as List).cast<Map>();
          final groups = (d['groups'] as List).cast<Map>();
          final title = {for (final t in topics) t['key']: nm(context, t, 'titleEn', 'titleBn')};
          final weeks = d['weeksLeft'];
          return ListView(padding: EdgeInsets.zero, children: [
            GreenHeader(radius: 36, bottomPad: 30, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              BackCircle(dark: true, onTap: () => context.pop()),
              const SizedBox(height: 12),
              Row(children: [
                Ring(value: (d['percent'] as num) / 100, size: 96, stroke: 10),
                const SizedBox(width: 16),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(nm(context, d, 'titleEn', 'titleBn'), style: display(26, color: Colors.white)),
                  Text('${tr(context, 'Readiness', 'প্রস্তুতি')} ${d['percent']}%  ·  ${tr(context, 'proven', 'প্রমাণিত')} ${d['verifiedPercent']}%', style: body(14, color: Colors.white70)),
                  Text(weeks == null
                      ? '${d['hoursLeft']} h ${tr(context, 'left. Set weekly study hours to see weeks.', 'বাকি। সপ্তাহ দেখতে সাপ্তাহিক পড়ার সময় দিন।')}'
                      : '${d['hoursLeft']} h ≈ $weeks ${tr(context, 'weeks left', 'সপ্তাহ বাকি')}', style: body(14, color: Brand.lightSaffron, w: FontWeight.w700)),
                ])),
              ]),
            ])),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              AppCard(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'Where you stand', 'আপনি কোথায়'), style: display(18, color: Brand.ink)),
                const SizedBox(height: 8),
                for (final g in groups) Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [
                  SizedBox(width: 120, child: Text(nm(context, g, 'nameEn', 'nameBn'), style: body(14, w: FontWeight.w600))),
                  Expanded(child: ProgressBar(((g['percent'] as num) / 100).toDouble())),
                  SizedBox(width: 46, child: Text('${g['percent']}%', textAlign: TextAlign.right, style: body(13, color: Brand.muted))),
                ])),
              ])),
              AppCard(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'Your path: what to learn, in order', 'আপনার পথ: কী শিখবেন, ক্রমানুসারে'), style: display(18, color: Brand.ink)),
                const SizedBox(height: 6),
                if (path.isEmpty) Text(tr(context, 'You know everything on this path. Next: take a quiz or ask a mentor to endorse you.', 'এই পথের সবই জানেন। এবার কুইজ দিন বা মেন্টরের এন্ডোর্সমেন্ট নিন।'), style: body(15)),
                for (final t in path) Padding(padding: const EdgeInsets.symmetric(vertical: 7), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Container(width: 28, height: 28, alignment: Alignment.center, decoration: BoxDecoration(color: t['status'] == 'ready' ? Brand.saffron : Brand.lightGreen, shape: BoxShape.circle), child: Text('${t['order']}', style: display(13, color: Brand.ink))),
                  const SizedBox(width: 10),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(nm(context, t, 'titleEn', 'titleBn'), style: body(16, w: FontWeight.w700)),
                    if (t['status'] == 'locked') Text('${tr(context, 'First learn', 'আগে শিখুন')}: ${(t['missing'] as List).map((k) => title[k] ?? k).join(', ')}', style: body(13, color: Brand.muted)),
                  ])),
                  const SizedBox(width: 6),
                  if (t['status'] == 'ready') Pill(tr(context, 'Start now', 'এখনই শুরু'), tone: Tone.saffron) else Pill('${t['hours']} h', tone: Tone.grey),
                ])),
              ])),
              AppCard(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'What I already know', 'যা আমি আগে থেকে জানি'), style: display(18, color: Brand.ink)),
                Text(tr(context, 'Tap to tick. Be honest: ticks are private and only you see them.', 'টিক দিতে ট্যাপ করুন। সৎ থাকুন: টিক শুধু আপনিই দেখেন।'), style: body(13, color: Brand.muted)),
                const SizedBox(height: 6),
                for (final t in topics) InkWell(
                  onTap: t['status'] == 'verified' ? null : () => _tick(context, ref, t['key'], t['status'] != 'known'),
                  child: Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Row(children: [
                    Icon(t['status'] == 'verified' ? Icons.verified : (t['status'] == 'known' ? Icons.check_circle : Icons.radio_button_unchecked), color: t['status'] == 'verified' || t['status'] == 'known' ? Brand.delta : Brand.muted, size: 24),
                    const SizedBox(width: 10),
                    Expanded(child: Text(nm(context, t, 'titleEn', 'titleBn'), style: body(15, w: FontWeight.w600))),
                    if (t['status'] == 'verified') Pill(tr(context, 'Proven', 'প্রমাণিত'), tone: Tone.green),
                  ])),
                ),
              ])),
              Text('${d['formula']}', textAlign: TextAlign.center, style: body(13, color: Brand.muted)),
              const SizedBox(height: 20),
            ])),
          ]);
        }),
      );
}
