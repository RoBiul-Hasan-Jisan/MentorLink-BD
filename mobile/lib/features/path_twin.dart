import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// Path Twin: mentors whose skills at graduation looked like yours today, and what they learned next (in order).
// Matched on skills only. Journeys are shared by the mentor's choice. It shows what happened for them, not a promise.
final pathTwinsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/path-twins'));
final pathTwinSkillsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/skills'));
final pathTwinJourneyProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/journey'));

String _monthLabel(BuildContext context, num m) {
  if (m == 0) return tr(context, 'Graduation', 'গ্র্যাজুয়েশন');
  return m > 0 ? tr(context, 'Month $m', 'মাস $m') : tr(context, '${-m} mo before', '${-m} মাস আগে');
}

class PathTwinScreen extends ConsumerWidget {
  const PathTwinScreen({super.key});

  Widget _step(BuildContext context, Map s) {
    final have = s['youHave'] == true;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(width: 92, child: Text(_monthLabel(context, s['month'] as num), style: body(13, color: Brand.muted, w: FontWeight.w700))),
        Icon(have ? Icons.check_circle : Icons.arrow_forward, size: 18, color: have ? Brand.delta : Brand.saffron),
        const SizedBox(width: 8),
        Expanded(child: Text('${nm(context, s, 'nameEn', 'nameBn')} · ${tr(context, 'level', 'লেভেল')} ${s['level']}', style: body(15, w: have ? FontWeight.w500 : FontWeight.w700, color: have ? Brand.muted : Brand.ink))),
      ]),
    );
  }

  Widget _twin(BuildContext context, Map t) {
    final next = ((t['next'] ?? []) as List).cast<Map>();
    final grad = ((t['atGraduation'] ?? []) as List).cast<Map>();
    final fj = t['firstJobMonths'];
    return AppCard(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Avatar('${t['name']}', size: 46, bg: Brand.lightGreen, fg: Brand.forest),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${t['name']}', style: display(19, color: Brand.ink)),
            Text('${t['roleTitle']} · ${t['industry']}', style: body(14, color: Brand.muted)),
          ])),
          Column(children: [
            Text('${t['similarity']}%', style: display(24, color: Brand.forest)),
            Text(tr(context, 'like you', 'আপনার মতো'), style: body(12, color: Brand.muted)),
          ]),
        ]),
        const SizedBox(height: 10),
        Text(tr(context, 'AT GRADUATION THEY HAD', 'গ্র্যাজুয়েশনে তাঁর ছিল'), style: body(12, color: Brand.muted, w: FontWeight.w800)),
        const SizedBox(height: 4),
        Wrap(spacing: 6, runSpacing: 4, children: [for (final g in grad) Pill('${nm(context, g, 'nameEn', 'nameBn')} ${g['level']}', tone: Tone.grey)]),
        const SizedBox(height: 12),
        Text(tr(context, 'THEN, IN ORDER', 'তারপর, ক্রমানুসারে'), style: body(12, color: Brand.muted, w: FontWeight.w800)),
        for (final s in next) _step(context, s),
        if (fj != null) Padding(padding: const EdgeInsets.only(top: 8), child: Pill(tr(context, 'First job after $fj months', 'প্রথম চাকরি $fj মাস পর'), tone: Tone.saffron)),
        if ('${t['note'] ?? ''}'.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text('“${t['note']}”', style: body(14, color: Brand.muted))),
        const SizedBox(height: 8),
        BigButton(tr(context, 'Ask ${t['name']} for a session', '${t['name']}-এর কাছে সেশন চান'), outlined: true, onPressed: () => context.push('/request/${t['mentorId']}')),
      ]),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(pathTwinsProvider),
        onRetry: () => ref.invalidate(pathTwinsProvider),
        builder: (d) {
          final you = ((d['you'] ?? []) as List).cast<Map>();
          final twins = ((d['twins'] ?? []) as List).cast<Map>();
          final cons = ((d['consensus'] ?? []) as List).cast<Map>();
          return ListView(padding: EdgeInsets.zero, children: [
            GreenHeader(radius: 36, bottomPad: 26, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              BackCircle(dark: true, onTap: () => context.pop()),
              const SizedBox(height: 12),
              Text(tr(context, 'Path Twin', 'পাথ টুইন'), style: display(32, color: Colors.white)),
              Text(tr(context, 'People who were where you are now, and what they did next.', 'আপনি এখন যেখানে, তাঁরা সেখানে ছিলেন। তারপর কী করেছেন দেখুন।'), style: body(15, color: Colors.white70)),
            ])),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'YOU TODAY', 'আজ আপনি'), style: body(12, color: Brand.muted, w: FontWeight.w800)),
                const SizedBox(height: 6),
                if (you.isEmpty) Text(tr(context, 'No skills yet. Take a quiz or add a project first.', 'এখনও কোনো স্কিল নেই। আগে কুইজ দিন বা প্রজেক্ট যোগ করুন।'), style: body(15))
                else Wrap(spacing: 6, runSpacing: 4, children: [for (final s in you) Pill('${nm(context, s, 'nameEn', 'nameBn')} ${s['level']}')]),
              ])),
              if (cons.isNotEmpty) AppCard(color: Brand.lightSaffron, border: Colors.transparent, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'WHAT MOST TWINS LEARNED NEXT', 'বেশিরভাগ টুইন পরে যা শিখেছেন'), style: body(12, color: const Color(0xFF7A4A00), w: FontWeight.w800)),
                const SizedBox(height: 6),
                for (final c in cons.take(4))
                  Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Text('${nm(context, c, 'nameEn', 'nameBn')}: ${c['count']} ${tr(context, 'of', '/')} ${c['ofTwins']}${c['medianMonth'] != null ? ' · ${tr(context, 'around month', 'প্রায় মাস')} ${c['medianMonth']}' : ''}', style: body(16, w: FontWeight.w700, color: const Color(0xFF5A3600)))),
              ])),
              if (twins.isEmpty) AppCard(child: Text(tr(context, 'No twins yet. Mentors share their journeys by choice, so more will appear over time.', 'এখনও কোনো টুইন নেই। মেন্টররা নিজের ইচ্ছায় যাত্রা শেয়ার করেন, তাই সময়ের সাথে বাড়বে।'), style: body(16))),
              for (final t in twins) _twin(context, t),
              Text('${d['note'] ?? ''}', textAlign: TextAlign.center, style: body(13, color: Brand.muted)),
              const SizedBox(height: 20),
            ])),
          ]);
        },
      ),
    );
  }
}

// Mentor side: share your own skills-only journey. No employer names, no salary.
class MentorJourneyScreen extends ConsumerStatefulWidget {
  const MentorJourneyScreen({super.key});
  @override
  ConsumerState<MentorJourneyScreen> createState() => _JourneyState();
}

class _JourneyState extends ConsumerState<MentorJourneyScreen> {
  bool loaded = false, shared = false, busy = false;
  final firstJob = TextEditingController();
  final note = TextEditingController();
  final rows = <Map<String, dynamic>>[]; // {skillKey, month, level}

  void _prefill(Map j) {
    if (loaded) return;
    loaded = true;
    shared = j['shared'] == true;
    firstJob.text = j['firstJobMonths'] == null ? '' : '${j['firstJobMonths']}';
    note.text = '${j['note'] ?? ''}';
    for (final m in ((j['milestones'] ?? []) as List).cast<Map>()) {
      rows.add({'skillKey': '${m['skillKey']}', 'month': (m['month'] as num).toInt(), 'level': (m['level'] as num).toInt()});
    }
    rows.sort((a, b) => (a['month'] as int).compareTo(b['month'] as int));
  }

  Future<void> _save() async {
    setState(() => busy = true);
    try {
      await ref.read(dioProvider).put('/me/journey', data: {
        'shared': shared,
        if (firstJob.text.trim().isNotEmpty) 'firstJobMonths': int.tryParse(firstJob.text.trim()) ?? 0,
        'milestones': rows,
        'note': note.text.trim(),
      });
      ref.invalidate(pathTwinJourneyProvider);
      if (mounted) toast(context, tr(context, 'Saved', 'সংরক্ষিত'));
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final skillsAsync = ref.watch(pathTwinSkillsProvider);
    final skills = ((skillsAsync.valueOrNull?['skills'] ?? []) as List).cast<Map>();
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(pathTwinJourneyProvider),
        onRetry: () => ref.invalidate(pathTwinJourneyProvider),
        builder: (d) {
          _prefill((d['journey'] ?? {}) as Map);
          return ListView(padding: EdgeInsets.zero, children: [
            GreenHeader(radius: 36, bottomPad: 26, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              BackCircle(dark: true, onTap: () => context.pop()),
              const SizedBox(height: 12),
              Text(tr(context, 'My journey', 'আমার যাত্রা'), style: display(30, color: Colors.white)),
              Text(tr(context, 'Help students who are where you once were.', 'যারা একসময় আপনার জায়গায় ছিল তাদের সাহায্য করুন।'), style: body(15, color: Colors.white70)),
            ])),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              AppCard(padding: const EdgeInsets.all(6), child: SwitchListTile(
                activeColor: Brand.delta,
                title: Text(tr(context, 'Share my journey with students', 'শিক্ষার্থীদের সাথে আমার যাত্রা শেয়ার করুন'), style: body(16, w: FontWeight.w600)),
                subtitle: Text(tr(context, 'Only skills and months. No employer, no salary. Shown by first name.', 'শুধু স্কিল ও মাস। প্রতিষ্ঠান বা বেতন নয়। শুধু প্রথম নাম।'), style: body(13, color: Brand.muted)),
                value: shared,
                onChanged: (v) => setState(() => shared = v),
              )),
              AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                TextField(controller: firstJob, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: tr(context, 'Months from graduation to first job', 'গ্র্যাজুয়েশন থেকে প্রথম চাকরি পর্যন্ত মাস'))),
                const SizedBox(height: 10),
                TextField(controller: note, maxLength: 300, maxLines: 2, decoration: InputDecoration(labelText: tr(context, 'One tip for students (optional)', 'শিক্ষার্থীদের জন্য একটি পরামর্শ (ঐচ্ছিক)'))),
              ])),
              AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'Skill milestones (month 0 = graduation, negative = before)', 'স্কিল মাইলস্টোন (মাস ০ = গ্র্যাজুয়েশন, ঋণাত্মক = আগে)'), style: body(14, color: Brand.muted, w: FontWeight.w700)),
                const SizedBox(height: 6),
                for (int i = 0; i < rows.length; i++)
                  Row(children: [
                    Expanded(flex: 5, child: DropdownButton<String>(
                      isExpanded: true,
                      value: skills.any((s) => s['key'] == rows[i]['skillKey']) ? rows[i]['skillKey'] as String : null,
                      hint: Text(tr(context, 'Skill', 'স্কিল')),
                      items: [for (final s in skills) DropdownMenuItem(value: '${s['key']}', child: Text(nm(context, s, 'nameEn', 'nameBn'), overflow: TextOverflow.ellipsis))],
                      onChanged: (v) => setState(() => rows[i]['skillKey'] = v ?? rows[i]['skillKey']),
                    )),
                    const SizedBox(width: 6),
                    SizedBox(width: 56, child: TextFormField(
                      initialValue: '${rows[i]['month']}',
                      keyboardType: const TextInputType.numberWithOptions(signed: true),
                      decoration: InputDecoration(labelText: tr(context, 'Month', 'মাস')),
                      onChanged: (v) => rows[i]['month'] = (int.tryParse(v) ?? 0).clamp(-24, 60),
                    )),
                    const SizedBox(width: 6),
                    DropdownButton<int>(
                      value: rows[i]['level'] as int,
                      items: const [DropdownMenuItem(value: 1, child: Text('L1')), DropdownMenuItem(value: 2, child: Text('L2')), DropdownMenuItem(value: 3, child: Text('L3'))],
                      onChanged: (v) => setState(() => rows[i]['level'] = v ?? 1),
                    ),
                    IconButton(icon: const Icon(Icons.close, size: 20), onPressed: () => setState(() => rows.removeAt(i))),
                  ]),
                TextButton.icon(
                  onPressed: rows.length >= 20 || skills.isEmpty ? null : () => setState(() => rows.add({'skillKey': '${skills.first['key']}', 'month': 0, 'level': 1})),
                  icon: const Icon(Icons.add),
                  label: Text(tr(context, 'Add a milestone', 'মাইলস্টোন যোগ করুন')),
                ),
              ])),
              BigButton(busy ? '...' : tr(context, 'Save', 'সংরক্ষণ করুন'), onPressed: busy ? null : _save),
            ])),
          ]);
        },
      ),
    );
  }
}

final pathTwinRoutes = <RouteBase>[
  GoRoute(path: '/path-twins', builder: (_, __) => const PathTwinScreen()),
  GoRoute(path: '/mentor/journey', builder: (_, __) => const MentorJourneyScreen()),
];
