import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// List of all skills with a learning roadmap. A beginner can start here without having any skill gap yet.
class RoadmapsScreen extends ConsumerWidget {
  const RoadmapsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
        body: AsyncBody(value: ref.watch(roadmapsProvider), onRetry: () => ref.invalidate(roadmapsProvider), builder: (d) {
          final list = (d['roadmaps'] as List).cast<Map>();
          return ListView(padding: EdgeInsets.zero, children: [
            GreenHeader(radius: 36, bottomPad: 30, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              BackCircle(dark: true, onTap: () => context.pop()),
              const SizedBox(height: 12),
              Text(tr(context, 'Learning roadmaps', 'শেখার রোডম্যাপ'), style: display(30, color: Colors.white)),
              Text(tr(context, 'New to a skill? Pick it and follow the steps from the beginning.', 'নতুন কোনো স্কিল? বেছে নিয়ে শুরু থেকে ধাপে ধাপে এগোন।'), style: body(15, color: Colors.white70)),
            ])),
            Padding(padding: const EdgeInsets.all(16), child: Column(children: [
              for (final m in list) AppCard(padding: const EdgeInsets.all(16), onTap: () => context.push('/roadmap/${m['skillKey']}'), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(nm(context, m, 'nameEn', 'nameBn'), style: display(20, color: Brand.ink))),
                  Pill('${m['totalHours']} h', tone: Tone.saffron),
                ]),
                const SizedBox(height: 4),
                Text(nm(context, m, 'summaryEn', 'summaryBn'), style: body(14, color: Brand.muted)),
                const SizedBox(height: 8),
                ProgressBar(((m['doneCount'] as num) / ((m['topicCount'] as num) == 0 ? 1 : m['topicCount'])).toDouble()),
                const SizedBox(height: 4),
                Text('${m['doneCount']} / ${m['topicCount']} ${tr(context, 'topics', 'টপিক')}', style: body(13, color: Brand.muted)),
              ])),
            ])),
          ]);
        }),
      );
}

class RoadmapScreen extends ConsumerWidget {
  const RoadmapScreen({super.key, required this.skillKey});
  final String skillKey;

  Future<void> _tick(BuildContext context, WidgetRef ref, String topicKey, bool done) async {
    try {
      await ref.read(dioProvider).put('/roadmaps/$skillKey/topics/$topicKey', data: {'done': done});
      ref.invalidate(roadmapProvider(skillKey)); ref.invalidate(roadmapsProvider);
    } catch (e) { if (context.mounted) toast(context, errorText(e)); }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final role = ref.watch(meProvider).valueOrNull?['role'];
    return Scaffold(
      body: AsyncBody(value: ref.watch(roadmapProvider(skillKey)), onRetry: () => ref.invalidate(roadmapProvider(skillKey)), builder: (d) {
        final stages = (d['stages'] as List).cast<Map>();
        final res = (d['resources'] as List).cast<Map>();
        final start = d['startHere'];
        final isStudent = role == 'student';
        return ListView(padding: EdgeInsets.zero, children: [
          GreenHeader(radius: 36, bottomPad: 40, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            BackCircle(dark: true, onTap: () => context.pop()),
            const SizedBox(height: 12),
            Text(nm(context, d, 'nameEn', 'nameBn'), style: display(30, color: Colors.white)),
            Text(nm(context, d, 'summaryEn', 'summaryBn'), style: body(15, color: Colors.white70)),
            const SizedBox(height: 14),
            Row(children: [
              Expanded(child: ProgressBar(((d['percent'] as num) / 100).toDouble(), color: Brand.saffron)),
              const SizedBox(width: 10),
              Text('${d['percent']}%  ·  ${d['totalHours']} h', style: body(14, color: Colors.white, w: FontWeight.w700)),
            ]),
          ])),
          Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            for (int i = 0; i < stages.length; i++) AppCard(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(width: 30, height: 30, alignment: Alignment.center, decoration: const BoxDecoration(color: Brand.saffron, shape: BoxShape.circle), child: Text('${i + 1}', style: display(15, color: Brand.ink))),
                const SizedBox(width: 10),
                Expanded(child: Text(nm(context, stages[i], 'titleEn', 'titleBn'), style: display(18, color: Brand.ink))),
              ]),
              const SizedBox(height: 6),
              for (final t in (stages[i]['topics'] as List).cast<Map>()) InkWell(
                onTap: isStudent ? () => _tick(context, ref, t['key'], t['done'] != true) : null,
                child: Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Row(children: [
                  Icon(t['done'] == true ? Icons.check_circle : Icons.radio_button_unchecked, color: t['done'] == true ? Brand.delta : Brand.muted, size: 24),
                  const SizedBox(width: 10),
                  Expanded(child: Text(nm(context, t, 'titleEn', 'titleBn'), style: body(16, w: FontWeight.w600, color: t['done'] == true ? Brand.muted : Brand.ink).copyWith(decoration: t['done'] == true ? TextDecoration.lineThrough : null))),
                  if (t['key'] == start) Padding(padding: const EdgeInsets.only(right: 6), child: Pill(tr(context, 'Start here', 'এখান থেকে শুরু'), tone: Tone.saffron)),
                  Text('${t['hours']} h', style: body(13, color: Brand.muted)),
                ])),
              ),
            ])),
            if (res.isNotEmpty) AppCard(color: const Color(0xFFFFF7E3), border: Colors.transparent, padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr(context, 'Where to learn', 'কোথায় শিখবেন'), style: display(19, color: Brand.ink)),
              const SizedBox(height: 6),
              for (final r in res) InkWell(
                onTap: () async { final ok = await launchUrl(Uri.parse(r['url']), mode: LaunchMode.externalApplication); if (!ok && context.mounted) toast(context, tr(context, 'Could not open the link', 'লিংক খোলা যায়নি')); },
                child: Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Row(children: [
                  const Icon(Icons.open_in_new, size: 18, color: Brand.muted), const SizedBox(width: 10),
                  Expanded(child: Text('${r['title']}', style: body(16, w: FontWeight.w600))),
                  Pill(r['language'] == 'bn' ? 'বাংলা' : 'English', tone: r['language'] == 'bn' ? Tone.green : Tone.blue),
                ])),
              ),
            ])),
            if (d['hasQuiz'] == true && isStudent) BigButton(tr(context, 'Take the quiz to prove it', 'কুইজ দিয়ে প্রমাণ করুন'), onPressed: () => context.push('/quiz/$skillKey')),
            const SizedBox(height: 10),
            Text('${d['note']}', textAlign: TextAlign.center, style: body(13, color: Brand.muted)),
            const SizedBox(height: 20),
          ])),
        ]);
      }),
    );
  }
}
