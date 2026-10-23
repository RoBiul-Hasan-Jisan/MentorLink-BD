import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

class SkillGapScreen extends ConsumerWidget {
  const SkillGapScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
        body: AsyncBody(value: ref.watch(readinessProvider), onRetry: () => ref.invalidate(readinessProvider), builder: (d) {
          final skills = (d['skills'] as List).cast<Map>();
          final gaps = (d['gaps'] as List).cast<Map>();
          final met = skills.where((s) => (s['current'] as num) >= (s['required'] as num)).map((s) => nm(context, s, 'nameEn', 'nameBn')).join(', ');
          final topNames = gaps.take(2).map((g) => nm(context, g, 'nameEn', 'nameBn')).join(tr(context, ' and ', ' ও '));
          return ListView(padding: EdgeInsets.zero, children: [
            GreenHeader(radius: 36, bottomPad: 90, child: Column(children: [
              Row(children: [
                BackCircle(dark: true, onTap: () => context.pop()),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(tr(context, 'Skill-gap report', 'দক্ষতার ঘাটতি'), style: display(24, color: Colors.white)), Text(nm(context, d, 'roleTitleEn', 'roleTitleBn'), style: body(15, color: Colors.white70))])),
                Column(children: [Text('${d['readiness']}%', style: display(30, color: Brand.saffron)), Text(tr(context, 'ready', 'প্রস্তুত'), style: body(14, color: Colors.white70))]),
              ]),
              const SizedBox(height: 8),
              Center(child: Radar(
                labels: [for (final s in skills) nm(context, s, 'nameEn', 'nameBn')],
                need: [for (final s in skills) 1.0],
                have: [for (final s in skills) ((s['current'] as num) / (s['required'] as num)).clamp(0.08, 1.0).toDouble()],
              )),
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                const Text('- -  ', style: TextStyle(color: Colors.white60, fontWeight: FontWeight.bold)), Text(tr(context, 'What the role needs', 'পদের চাহিদা'), style: body(14, color: Colors.white70)),
                const SizedBox(width: 18), Container(width: 14, height: 14, decoration: BoxDecoration(color: Brand.saffron, borderRadius: BorderRadius.circular(4))), const SizedBox(width: 6), Text(tr(context, 'Where you are', 'আপনি এখন'), style: body(14, color: Colors.white70)),
              ]),
            ])),
            Transform.translate(offset: const Offset(0, -60), child: Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Column(children: [
              AppCard(padding: const EdgeInsets.all(20), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  Text(tr(context, 'Close these first', 'আগে এগুলো পূরণ করুন'), style: display(20, color: Brand.ink)),
                  if (gaps.isNotEmpty && ['sql', 'excel', 'python'].contains(gaps.first['skillKey'])) InkWell(borderRadius: BorderRadius.circular(24), onTap: () => context.push('/quiz/${gaps.first['skillKey']}'), child: Pill(tr(context, 'Take ${nm(context, gaps.first, 'nameEn', 'nameBn')} quiz', '${nm(context, gaps.first, 'nameEn', 'nameBn')} কুইজ'), tone: Tone.blue)),
                ]),
                const SizedBox(height: 12),
                if (gaps.isEmpty) Text(tr(context, 'No gaps. You meet every requirement.', 'কোনো ঘাটতি নেই।'), style: body(16)),
                for (int i = 0; i < gaps.length; i++) Padding(padding: const EdgeInsets.symmetric(vertical: 9), child: Row(children: [
                  SizedBox(width: 96, child: Text(nm(context, gaps[i], 'nameEn', 'nameBn'), style: display(17, color: Brand.ink, w: FontWeight.w700))),
                  Expanded(child: ProgressBar(((gaps[i]['current'] as num) / (gaps[i]['required'] as num)).toDouble(), color: i < 2 ? const Color(0xFFB3382B) : Brand.saffron)),
                  const SizedBox(width: 10),
                  Pill(tr(context, 'Gap ${i + 1}', 'ঘাটতি ${i + 1}'), tone: i < 2 ? Tone.red : Tone.saffron),
                ])),
                const SizedBox(height: 6),
                if (met.isNotEmpty) Text(tr(context, 'Met: $met', 'পূরণ হয়েছে: $met'), style: body(15, color: Brand.muted)),
                Text(tr(context, 'Confidence ${d['confidence']}% (more proof raises it)', 'আস্থা ${d['confidence']}% (প্রমাণ দিলে বাড়ে)'), style: body(14, color: Brand.muted)),
              ])),
              _resources(context, ref, gaps),
              if (topNames.isNotEmpty) BigButton(tr(context, 'Find mentors for $topNames', '$topNames এর মেন্টর খুঁজুন'), onPressed: () => context.pop()),
            ]))),
          ]);
        }),
      );

  Widget _resources(BuildContext context, WidgetRef ref, List<Map> gaps) {
    final keys = gaps.map((g) => g['skillKey']).toSet();
    final all = (ref.watch(resourcesProvider).valueOrNull?['resources'] as List? ?? []).cast<Map>();
    final list = all.where((r) => keys.contains(r['skillKey'])).toList();
    if (list.isEmpty) return const SizedBox.shrink();
    return AppCard(color: const Color(0xFFFFF7E3), border: Colors.transparent, padding: const EdgeInsets.all(18), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(tr(context, 'Start with free resources', 'বিনামূল্যের রিসোর্স দিয়ে শুরু করুন'), style: display(20, color: Brand.ink)),
      const SizedBox(height: 8),
      for (final r in list) InkWell(
        onTap: () async {
          final ok = await launchUrl(Uri.parse(r['url']), mode: LaunchMode.externalApplication);
          if (!ok && context.mounted) toast(context, tr(context, 'Could not open the link', 'লিংক খোলা যায়নি'));
          try { await ref.read(dioProvider).post('/resources/${r['id']}/complete'); ref.invalidate(resourcesProvider); } catch (e) { if (context.mounted) toast(context, errorText(e)); }
        },
        child: Padding(padding: const EdgeInsets.symmetric(vertical: 9), child: Row(children: [
          Icon(r['done'] == true ? Icons.check_circle : Icons.open_in_new, color: r['done'] == true ? Brand.delta : Brand.muted, size: 20), const SizedBox(width: 10),
          Expanded(child: Text(r['title'], style: body(16, w: FontWeight.w600))),
          Pill(r['language'] == 'bn' ? 'বাংলা' : 'English', tone: r['language'] == 'bn' ? Tone.green : Tone.blue),
        ])),
      ),
    ]));
  }
}
