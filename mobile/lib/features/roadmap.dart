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
                Container(width: 30, height: 30, alignment: Alignment.center, decoration: BoxDecoration(color: Brand.saffron, shape: BoxShape.circle), child: Text('${i + 1}', style: display(15, color: Brand.ink))),
                const SizedBox(width: 10),
                Expanded(child: Text(nm(context, stages[i], 'titleEn', 'titleBn'), style: display(18, color: Brand.ink))),
              ]),
              const SizedBox(height: 6),
              for (final t in (stages[i]['topics'] as List).cast<Map>()) InkWell(
                // Tap the row to STUDY the topic inside the app. Tap the circle to tick it quickly.
                onTap: () => context.push('/roadmap/$skillKey/topic/${t['key']}').then((_) { ref.invalidate(roadmapProvider(skillKey)); ref.invalidate(roadmapsProvider); }),
                child: Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [
                  InkResponse(
                    radius: 24,
                    onTap: isStudent ? () => _tick(context, ref, t['key'], t['done'] != true) : null,
                    child: Padding(padding: const EdgeInsets.all(6), child: Icon(t['done'] == true ? Icons.check_circle : Icons.radio_button_unchecked, color: t['done'] == true ? Brand.delta : Brand.muted, size: 24)),
                  ),
                  const SizedBox(width: 6),
                  Expanded(child: Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Text(nm(context, t, 'titleEn', 'titleBn'), style: body(16, w: FontWeight.w600, color: t['done'] == true ? Brand.muted : Brand.ink).copyWith(decoration: t['done'] == true ? TextDecoration.lineThrough : null)))),
                  if (t['key'] == start) Padding(padding: const EdgeInsets.only(right: 6), child: Pill(tr(context, 'Start here', 'এখান থেকে শুরু'), tone: Tone.saffron)),
                  Text('${t['hours']} h', style: body(13, color: Brand.muted)),
                  Icon(Icons.chevron_right, color: Brand.muted, size: 20),
                ])),
              ),
            ])),
            if (res.isNotEmpty) AppCard(color: const Color(0xFFFFF7E3), border: Colors.transparent, padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr(context, 'More places to learn', 'আরও শেখার জায়গা'), style: display(19, color: Brand.ink)),
              Text(tr(context, 'Tap a topic above to read notes and get links for that topic.', 'নির্দিষ্ট টপিকের নোট ও লিংক পেতে উপরের টপিকে চাপুন।'), style: body(13, color: Brand.muted)),
              const SizedBox(height: 6),
              for (final r in res) InkWell(
                onTap: () async { final ok = await launchUrl(Uri.parse(r['url']), mode: LaunchMode.externalApplication); if (!ok && context.mounted) toast(context, tr(context, 'Could not open the link', 'লিংক খোলা যায়নি')); },
                child: Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Row(children: [
                  Icon(Icons.open_in_new, size: 18, color: Brand.muted), const SizedBox(width: 10),
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


// One topic: read the notes here, open a link for the topic, and when you come back the app asks if you finished.
class TopicScreen extends ConsumerStatefulWidget {
  const TopicScreen({super.key, required this.skillKey, required this.topicKey});
  final String skillKey, topicKey;
  @override
  ConsumerState<TopicScreen> createState() => _TopicState();
}

class _TopicState extends ConsumerState<TopicScreen> with WidgetsBindingObserver {
  bool _openedLink = false, _asked = false, _busy = false;
  bool? _doneLocal;
  String get _k => '${widget.skillKey}|${widget.topicKey}';

  @override
  void initState() { super.initState(); WidgetsBinding.instance.addObserver(this); }
  @override
  void dispose() { WidgetsBinding.instance.removeObserver(this); super.dispose(); }

  // Coming back from the browser: ask once, so the student does not have to remember to tick.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _openedLink && !_asked && mounted && _doneLocal != true) {
      _asked = true;
      _askFinished();
    }
  }

  Future<void> _askFinished() async {
    final yes = await showModalBottomSheet<bool>(context: context, showDragHandle: true, builder: (c) => SafeArea(child: Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(tr(context, 'Did you finish studying this topic?', 'এই টপিকটা কি পড়া শেষ?'), style: display(20, color: Brand.ink)),
        const SizedBox(height: 6),
        Text(tr(context, 'Be honest. Tick it only if you could explain it to a friend.', 'সৎভাবে বলুন। বন্ধুকে বোঝাতে পারলে তবেই টিক দিন।'), style: body(14, color: Brand.muted)),
        const SizedBox(height: 14),
        BigButton(tr(context, 'Yes, mark as studied', 'হ্যাঁ, পড়া হয়েছে'), onPressed: () => Navigator.pop(c, true)),
        TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(context, 'Not yet, I will continue', 'এখনও না, আরও পড়ব'))),
      ]),
    )));
    if (yes == true) await _setDone(true);
  }

  Future<void> _setDone(bool v) async {
    setState(() { _busy = true; _doneLocal = v; });
    try {
      await ref.read(dioProvider).put('/roadmaps/${widget.skillKey}/topics/${widget.topicKey}', data: {'done': v});
      ref.invalidate(topicProvider(_k)); ref.invalidate(roadmapProvider(widget.skillKey)); ref.invalidate(roadmapsProvider);
    } catch (e) {
      if (mounted) { setState(() => _doneLocal = !v); toast(context, errorText(e)); }
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _open(String url) async {
    bool ok = false;
    try { ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication); } catch (_) {}
    if (!mounted) return;
    if (ok) { _openedLink = true; _asked = false; } else { toast(context, tr(context, 'Could not open the link', 'লিংক খোলা যায়নি')); }
  }

  @override
  Widget build(BuildContext context) {
    final role = ref.watch(meProvider).valueOrNull?['role'];
    final isStudent = role == 'student';
    return Scaffold(
      body: AsyncBody(value: ref.watch(topicProvider(_k)), onRetry: () => ref.invalidate(topicProvider(_k)), builder: (d) {
        final t = (d['topic'] ?? {}) as Map;
        final g = (d['guide'] ?? {}) as Map;
        final notes = ((g['notes'] ?? []) as List).map((x) => '$x').toList();
        final links = ((g['links'] ?? []) as List).cast<Map>();
        final example = g['example'] as String?;
        final done = _doneLocal ?? (t['done'] == true);
        final next = d['next'] as Map?;
        return ListView(padding: EdgeInsets.zero, children: [
          GreenHeader(radius: 36, bottomPad: 26, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            BackCircle(dark: true, onTap: () => context.pop()),
            const SizedBox(height: 12),
            Text('${nm(context, d, 'skillNameEn', 'skillNameBn')} · ${d['number']}/${d['total']}', style: body(14, color: Colors.white70)),
            const SizedBox(height: 4),
            Text(nm(context, t, 'titleEn', 'titleBn'), style: display(26, color: Colors.white)),
            const SizedBox(height: 6),
            Text('${nm(context, d, 'stageTitleEn', 'stageTitleBn')}  ·  ${t['hours']} h', style: body(14, color: Colors.white70)),
          ])),
          Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            AppCard(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr(context, 'Read this first', 'আগে এটি পড়ুন'), style: display(19, color: Brand.ink)),
              const SizedBox(height: 8),
              for (final n in notes) Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(padding: EdgeInsets.only(top: 7, right: 10), child: Icon(Icons.circle, size: 6, color: Brand.forest)),
                Expanded(child: Text(n, style: body(16))),
              ])),
              if (example != null) ...[
                const SizedBox(height: 10),
                Text(tr(context, 'Example', 'উদাহরণ'), style: body(13, color: Brand.muted, w: FontWeight.w800)),
                const SizedBox(height: 6),
                Container(
                  width: double.infinity, padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: const Color(0xFF10261C), borderRadius: BorderRadius.circular(12)),
                  child: SelectableText(example, style: const TextStyle(fontFamily: 'monospace', fontSize: 13.5, color: Colors.white, height: 1.45)),
                ),
              ],
            ])),
            AppCard(color: const Color(0xFFFFF7E3), border: Colors.transparent, padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr(context, 'Learn more: links for this topic', 'আরও শিখুন: এই টপিকের লিংক'), style: display(19, color: Brand.ink)),
              const SizedBox(height: 4),
              Text(tr(context, 'When you come back, the app will ask if you finished.', 'ফিরে এলে অ্যাপ জিজ্ঞেস করবে পড়া শেষ কি না।'), style: body(13, color: Brand.muted)),
              for (final l in links) InkWell(
                onTap: () => _open('${l['url']}'),
                child: Padding(padding: const EdgeInsets.symmetric(vertical: 10), child: Row(children: [
                  Icon(Icons.open_in_new, size: 18, color: Brand.muted), const SizedBox(width: 10),
                  Expanded(child: Text('${l['title']}', style: body(15, w: FontWeight.w600))),
                  Pill(l['language'] == 'bn' ? 'বাংলা' : 'English', tone: l['language'] == 'bn' ? Tone.green : Tone.blue),
                ])),
              ),
            ])),
            if (isStudent) ...[
              BigButton(done ? tr(context, 'Studied. Tap to undo', 'পড়া হয়েছে। বাতিল করতে চাপুন') : tr(context, 'Mark as studied', 'পড়া শেষ, টিক দিন'), outlined: done, onPressed: _busy ? null : () => _setDone(!done)),
              if (done && next != null) ...[
                const SizedBox(height: 8),
                BigButton(tr(context, 'Next topic: ${next['titleEn']}', 'পরের টপিক: ${next['titleBn'] ?? next['titleEn']}'), onPressed: () => context.pushReplacement('/roadmap/${widget.skillKey}/topic/${next['key']}')),
              ],
            ],
            const SizedBox(height: 10),
            Text('${d['note']}', textAlign: TextAlign.center, style: body(13, color: Brand.muted)),
            const SizedBox(height: 20),
          ])),
        ]);
      }),
    );
  }
}
