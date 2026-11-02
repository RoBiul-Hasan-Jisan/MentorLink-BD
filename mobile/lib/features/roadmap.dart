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
                onTap: () => context.push('/roadmap/$skillKey/topic/${t['key']}'),
                child: Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Row(children: [
                  InkWell(
                    borderRadius: BorderRadius.circular(20),
                    onTap: isStudent ? () => _tick(context, ref, t['key'], t['done'] != true) : null,
                    child: Padding(padding: const EdgeInsets.all(4), child: Icon(t['done'] == true ? Icons.check_circle : Icons.radio_button_unchecked, color: t['done'] == true ? Brand.delta : Brand.muted, size: 24)),
                  ),
                  const SizedBox(width: 6),
                  Expanded(child: Text(nm(context, t, 'titleEn', 'titleBn'), style: body(16, w: FontWeight.w600, color: t['done'] == true ? Brand.muted : Brand.ink).copyWith(decoration: t['done'] == true ? TextDecoration.lineThrough : null))),
                  if (t['key'] == start) Padding(padding: const EdgeInsets.only(right: 6), child: Pill(tr(context, 'Start here', 'এখান থেকে শুরু'), tone: Tone.saffron)),
                  Text('${t['hours']} h', style: body(13, color: Brand.muted)),
                  const Icon(Icons.chevron_right, size: 20, color: Brand.muted),
                ])),
              ),
            ])),
            if (res.isNotEmpty) AppCard(color: const Color(0xFFFFF7E3), border: Colors.transparent, padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr(context, 'Where to learn', 'কোথায় শিখবেন'), style: display(19, color: Brand.ink)),
              const SizedBox(height: 4),
              Text(tr(context, 'Tap a topic above: it opens the notes, a checklist and links for that exact topic. These are general courses for the whole skill.', 'উপরের একটি টপিকে ট্যাপ করুন: সেই টপিকের নোট, চেকলিস্ট ও লিংক খুলবে। নিচেরগুলো পুরো স্কিলের সাধারণ কোর্স।'), style: body(13, color: Brand.muted)),
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
            if (isStudent) Text(tr(context, 'Tip: tap the circle to tick quickly, or open a topic, read it and finish its checklist: it ticks itself.', 'টিপ: দ্রুত টিক দিতে বৃত্তে ট্যাপ করুন, অথবা টপিক খুলে পড়ে চেকলিস্ট শেষ করুন: নিজে থেকেই টিক পড়বে।'), textAlign: TextAlign.center, style: body(13, color: Brand.muted)),
            const SizedBox(height: 4),
            Text('${d['note']}', textAlign: TextAlign.center, style: body(13, color: Brand.muted)),
            const SizedBox(height: 20),
          ])),
        ]);
      }),
    );
  }
}

// One topic: read the notes here, tick the "I can ..." checklist, open links for this exact topic. When every line is ticked the topic is marked done.
class TopicScreen extends ConsumerStatefulWidget {
  const TopicScreen({super.key, required this.skillKey, required this.topicKey});
  final String skillKey, topicKey;
  @override
  ConsumerState<TopicScreen> createState() => _TopicState();
}

class _TopicState extends ConsumerState<TopicScreen> {
  final checked = <int>{};
  bool seeded = false, busy = false;

  Future<void> _set(bool done) async {
    setState(() => busy = true);
    try {
      await ref.read(dioProvider).put('/roadmaps/${widget.skillKey}/topics/${widget.topicKey}', data: {'done': done});
      ref.invalidate(roadmapProvider(widget.skillKey));
      ref.invalidate(roadmapsProvider);
      if (mounted && done) toast(context, tr(context, 'Topic done. Nice work!', 'টপিক শেষ। দারুণ!'));
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
    if (mounted) setState(() => busy = false);
  }

  Future<void> _open(String url) async {
    final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    if (!ok && mounted) toast(context, tr(context, 'Could not open the link', 'লিংক খোলা যায়নি'));
  }

  @override
  Widget build(BuildContext context) {
    final role = ref.watch(meProvider).valueOrNull?['role'];
    final isStudent = role == 'student';
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(roadmapProvider(widget.skillKey)),
        onRetry: () => ref.invalidate(roadmapProvider(widget.skillKey)),
        builder: (d) {
          final flat = <(Map, Map)>[];
          for (final st in (d['stages'] as List).cast<Map>()) {
            for (final t in (st['topics'] as List).cast<Map>()) { flat.add((st, t)); }
          }
          final idx = flat.indexWhere((e) => e.$2['key'] == widget.topicKey);
          if (idx < 0) return Center(child: Text(tr(context, 'Topic not found', 'টপিক পাওয়া যায়নি')));
          final stage = flat[idx].$1, t = flat[idx].$2;
          final next = idx + 1 < flat.length ? flat[idx + 1].$2 : null;
          final done = t['done'] == true;
          final note = t['note'] as Map?;
          final list = ((note?['checklist'] ?? []) as List).map((x) => '$x').toList();
          final links = ((t['links'] ?? []) as List).cast<Map>();
          if (!seeded) { seeded = true; if (done) checked.addAll([for (int i = 0; i < list.length; i++) i]); }
          return ListView(padding: EdgeInsets.zero, children: [
            GreenHeader(radius: 36, bottomPad: 28, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              BackCircle(dark: true, onTap: () => context.pop()),
              const SizedBox(height: 12),
              Text(nm(context, stage, 'titleEn', 'titleBn'), style: body(14, color: Colors.white70)),
              const SizedBox(height: 4),
              Text(nm(context, t, 'titleEn', 'titleBn'), style: display(26, color: Colors.white)),
              const SizedBox(height: 10),
              Wrap(spacing: 8, children: [
                Pill('${t['hours']} h', tone: Tone.saffron),
                Pill('${idx + 1} / ${flat.length}', tone: Tone.blue),
                if (done) Pill(tr(context, 'Done', 'শেষ'), tone: Tone.green),
              ]),
            ])),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (note != null) AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'Read this first', 'আগে এটি পড়ুন'), style: display(18, color: Brand.ink)),
                const SizedBox(height: 8),
                Text('${note['summary']}', style: body(16)),
                if (note['example'] != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity, padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: const Color(0xFFF1F4F2), borderRadius: BorderRadius.circular(14)),
                    child: SelectableText('${note['example']}', style: const TextStyle(fontFamily: 'monospace', fontSize: 13, height: 1.4)),
                  ),
                ],
              ])),
              if (links.isNotEmpty) AppCard(color: const Color(0xFFFFF7E3), border: Colors.transparent, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'Learn this topic', 'এই টপিক শিখুন'), style: display(18, color: Brand.ink)),
                const SizedBox(height: 4),
                for (final l in links) InkWell(
                  onTap: () => _open('${l['url']}'),
                  child: Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Row(children: [
                    Icon(l['kind'] == 'lesson' ? Icons.menu_book_outlined : Icons.search, size: 20, color: Brand.muted), const SizedBox(width: 10),
                    Expanded(child: Text(nm(context, l, 'label', 'labelBn'), style: body(16, w: FontWeight.w600))),
                    Pill(l['language'] == 'bn' ? 'বাংলা' : 'English', tone: l['language'] == 'bn' ? Tone.green : Tone.blue),
                  ])),
                ),
              ])),
              if (list.isNotEmpty) AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'I can ... (tick when true)', 'আমি পারি ... (সত্য হলে টিক দিন)'), style: display(18, color: Brand.ink)),
                const SizedBox(height: 4),
                for (int i = 0; i < list.length; i++) CheckboxListTile(
                  contentPadding: EdgeInsets.zero, dense: true, controlAffinity: ListTileControlAffinity.leading,
                  value: checked.contains(i),
                  title: Text(list[i], style: body(15, w: FontWeight.w600)),
                  onChanged: !isStudent || busy ? null : (v) {
                    setState(() { if (v == true) { checked.add(i); } else { checked.remove(i); } });
                    if (checked.length == list.length && !done) _set(true);
                  },
                ),
                Text(tr(context, 'When every line is ticked, this topic is marked done for you.', 'সব লাইনে টিক দিলে টপিকটি নিজে থেকেই শেষ হয়ে যাবে।'), style: body(13, color: Brand.muted)),
              ])),
              if (isStudent) ...[
                if (!done) BigButton(busy ? '...' : tr(context, 'Mark this topic done', 'টপিকটি শেষ করুন'), onPressed: busy ? null : () => _set(true))
                else BigButton(tr(context, 'Done. Undo', 'শেষ। বাতিল করুন'), outlined: true, onPressed: busy ? null : () { setState(() => checked.clear()); _set(false); }),
                const SizedBox(height: 10),
              ],
              if (next != null) BigButton(tr(context, 'Next: ${next['titleEn']}', 'পরবর্তী: ${next['titleBn'] ?? next['titleEn']}'), outlined: true, onPressed: () => context.pushReplacement('/roadmap/${widget.skillKey}/topic/${next['key']}')),
              const SizedBox(height: 20),
            ])),
          ]);
        },
      ),
    );
  }
}
