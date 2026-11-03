import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// Launch features: Daily Brief (home card), Career Passport, Mentor Sprint, company invitations and the company Talent Pool.
// The server decides everything (roles, limits, privacy). This file only shows it.

final briefProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/brief'));
final passportProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/passport'));
final sprintsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/sprints'));
final invitesProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/invites'));
final sprintReviewsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/mentor/sprint-reviews'));
final talentQueryProvider = StateProvider.autoDispose<String>((_) => '');
final talentProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final q = ref.watch(talentQueryProvider);
  if (q.trim().isEmpty) return {'cards': [], 'wanted': []};
  return getJson(ref, '/employer/talent', q: {'skills': q});
});
final employerInvitesProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/employer/invites'));

Future<void> _open(String url) async {
  final u = Uri.tryParse(url);
  if (u != null && u.scheme == 'https') await launchUrl(u, mode: LaunchMode.externalApplication);
}

Widget _header(BuildContext context, String title, String sub, {Widget? trailing}) => GreenHeader(radius: 36, bottomPad: 26, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      BackCircle(dark: true, onTap: () => context.pop()),
      const SizedBox(height: 12),
      Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: display(28, color: Colors.white)),
          if (sub.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(sub, style: body(15, color: Colors.white70))),
        ])),
        if (trailing != null) trailing,
      ]),
    ]));

// ====================== Daily Brief (home card) ======================
class BriefCard extends ConsumerWidget {
  const BriefCard({super.key});

  Future<void> _shareWeek(BuildContext context, WidgetRef ref) async {
    try {
      final c = (await ref.read(dioProvider).get('/me/week-card')).data as Map;
      final items = ((c['items'] ?? []) as List).cast<Map>();
      final text = '${tr(context, c['headlineEn'] ?? '', c['headlineBn'] ?? '')}\n'
          '${items.map((x) => '• ${tr(context, x['en'] ?? '', x['bn'] ?? '')}').join('\n')}\n'
          '${tr(context, 'Proof strength', 'প্রমাণের শক্তি')}: ${c['proofStrength']}/100  #MentorLinkBD';
      if (!context.mounted) return;
      await showDialog<void>(context: context, builder: (d) => AlertDialog(
        title: Text(tr(context, 'My week', 'আমার সপ্তাহ'), style: display(19)),
        content: SelectableText(text, style: body(15)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(d), child: Text(tr(context, 'Close', 'বন্ধ'))),
          FilledButton(onPressed: () async { await Clipboard.setData(ClipboardData(text: text)); if (d.mounted) Navigator.pop(d); if (context.mounted) toast(context, tr(context, 'Copied', 'কপি হয়েছে')); }, child: Text(tr(context, 'Copy', 'কপি'))),
        ],
      ));
    } catch (e) { if (context.mounted) toast(context, errorText(e)); }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final b = ref.watch(briefProvider);
    return b.when(
      loading: () => const SizedBox(),
      error: (_, __) => const SizedBox(),
      data: (d) {
        final m = (d['move'] ?? {}) as Map;
        final also = ((d['also'] ?? []) as List).cast<Map>();
        if (m.isEmpty) return const SizedBox();
        return AppCard(color: Brand.forest, border: Colors.transparent, padding: const EdgeInsets.all(18), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text(tr(context, 'TODAY: ONE MOVE', 'আজ: একটি পদক্ষেপ'), style: body(12, color: Brand.saffron, w: FontWeight.w800)),
            const Spacer(),
            if ((d['streakDays'] ?? 0) > 0) Pill(tr(context, '${d['streakDays']} day streak', '${d['streakDays']} দিনের ধারা'), tone: Tone.saffron),
          ]),
          const SizedBox(height: 8),
          InkWell(onTap: () => context.push('${m['route']}'), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(nm(context, m, 'titleEn', 'titleBn'), style: display(20, color: Colors.white)),
            const SizedBox(height: 4),
            Text(nm(context, m, 'whyEn', 'whyBn'), style: body(14, color: Colors.white70)),
          ])),
          if (also.isNotEmpty) ...[
            const SizedBox(height: 10),
            for (final a in also) InkWell(onTap: () => context.push('${a['route']}'), child: Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Row(children: [
              const Icon(Icons.arrow_forward, size: 16, color: Colors.white54), const SizedBox(width: 8),
              Expanded(child: Text(nm(context, a, 'titleEn', 'titleBn'), style: body(13, color: Colors.white70))),
            ]))),
          ],
          const SizedBox(height: 8),
          Row(children: [
            FilledButton(style: FilledButton.styleFrom(backgroundColor: Brand.saffron, foregroundColor: Brand.ink), onPressed: () => context.push('${m['route']}'), child: Text(tr(context, 'Do it', 'শুরু করুন'))),
            const SizedBox(width: 8),
            TextButton(onPressed: () => _shareWeek(context, ref), child: Text(tr(context, 'Share my week', 'আমার সপ্তাহ শেয়ার'), style: body(14, color: Colors.white))),
          ]),
        ]));
      },
    );
  }
}

// ====================== Career Passport ======================
class PassportScreen extends ConsumerWidget {
  const PassportScreen({super.key});

  Future<void> _save(BuildContext context, WidgetRef ref, Map<String, dynamic> data) async {
    try {
      await ref.read(dioProvider).put('/me/passport', data: data);
      ref.invalidate(passportProvider);
    } catch (e) { if (context.mounted) toast(context, errorText(e)); }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(passportProvider),
        onRetry: () => ref.invalidate(passportProvider),
        builder: (d) {
          final st = (d['settings'] ?? {}) as Map;
          final pv = (d['publicView'] ?? {}) as Map;
          final show = (st['show'] ?? {}) as Map;
          final skills = ((pv['skills'] ?? []) as List).cast<Map>();
          final projects = ((pv['projects'] ?? []) as List).cast<Map>();
          final badges = ((pv['badges'] ?? []) as List).cast<Map>();
          final selfOnly = ((d['selfRatedOnly'] ?? []) as List).cast<Map>();
          final parts = ((d['view'] ?? {})['proofParts'] ?? {}) as Map;
          final score = (((d['view'] ?? {})['proofStrength'] ?? 0) as num).toInt();
          final enabled = st['enabled'] == true;
          final slug = st['slug'] as String?;
          final link = slug == null ? null : '$apiUrl/p/$slug';
          final headline = TextEditingController(text: '${st['headline'] ?? ''}');
          Widget sw(String key, String en, String bn) => SwitchListTile(contentPadding: EdgeInsets.zero, dense: true, title: Text(tr(context, en, bn), style: body(15)), value: show[key] != false, onChanged: (v) => _save(context, ref, {'show': {key: v}}));
          return ListView(padding: EdgeInsets.zero, children: [
            _header(context, tr(context, 'Career Passport', 'ক্যারিয়ার পাসপোর্ট'), tr(context, 'Proof, not promises', 'প্রমাণ, প্রতিশ্রুতি নয়'), trailing: Ring(value: score / 100, size: 78, stroke: 9, label: '$score')),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                SwitchListTile(contentPadding: EdgeInsets.zero, title: Text(tr(context, 'Share my passport link', 'আমার পাসপোর্ট লিংক শেয়ার'), style: body(16, w: FontWeight.w700)), subtitle: Text(tr(context, 'Anyone with the link sees only what you allow below. No email, phone or address is ever included.', 'লিংক যাঁর কাছে আছে তিনি শুধু নিচে অনুমতি দেওয়া অংশ দেখবেন। ইমেইল, ফোন বা ঠিকানা কখনও থাকে না।'), style: body(13, color: Brand.muted)), value: enabled, onChanged: (v) => _save(context, ref, {'enabled': v})),
                if (enabled && link != null) ...[
                  const SizedBox(height: 8),
                  Center(child: Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8E3))), child: QrImageView(data: link, size: 160))),
                  const SizedBox(height: 8),
                  SelectableText(link, textAlign: TextAlign.center, style: body(13, color: Brand.delta)),
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    TextButton.icon(onPressed: () async { await Clipboard.setData(ClipboardData(text: link)); if (context.mounted) toast(context, tr(context, 'Link copied', 'লিংক কপি হয়েছে')); }, icon: const Icon(Icons.copy, size: 18), label: Text(tr(context, 'Copy', 'কপি'))),
                    TextButton.icon(onPressed: () async {
                      try { await ref.read(dioProvider).post('/me/passport/rotate'); ref.invalidate(passportProvider); if (context.mounted) toast(context, tr(context, 'New link created. The old one stopped working.', 'নতুন লিংক তৈরি হয়েছে। পুরনোটি বন্ধ।')); } catch (e) { if (context.mounted) toast(context, errorText(e)); }
                    }, icon: const Icon(Icons.refresh, size: 18), label: Text(tr(context, 'New link', 'নতুন লিংক'))),
                  ]),
                  Text('${tr(context, 'Views', 'দেখেছেন')}: ${st['views'] ?? 0}', textAlign: TextAlign.center, style: body(12, color: Brand.muted)),
                ],
              ])),
              AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                SwitchListTile(contentPadding: EdgeInsets.zero, title: Text(tr(context, 'Let verified companies find me', 'যাচাইকৃত কোম্পানি আমাকে খুঁজে পাক'), style: body(16, w: FontWeight.w700)), subtitle: Text(tr(context, 'They see my first name, university and proven skills only. They can invite me, and I choose to accept or decline.', 'তারা শুধু আমার প্রথম নাম, বিশ্ববিদ্যালয় ও প্রমাণিত দক্ষতা দেখে। আমন্ত্রণ পাঠাতে পারে; গ্রহণ বা প্রত্যাখ্যান আমার সিদ্ধান্ত।'), style: body(13, color: Brand.muted)), value: st['talentPool'] == true, onChanged: (v) => _save(context, ref, {'talentPool': v})),
                TextField(controller: headline, maxLength: 80, decoration: InputDecoration(labelText: tr(context, 'Headline (optional)', 'শিরোনাম (ঐচ্ছিক)')), onSubmitted: (v) => _save(context, ref, {'headline': v.trim()})),
              ])),
              AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'What others can see', 'অন্যরা কী দেখবে'), style: display(17, color: Brand.ink)),
                sw('skills', 'Proven skills', 'প্রমাণিত দক্ষতা'), sw('endorsements', 'Mentor endorsements', 'মেন্টর এন্ডোর্সমেন্ট'), sw('projects', 'Projects', 'প্রজেক্ট'),
                sw('github', 'GitHub (if verified)', 'GitHub (যাচাই হলে)'), sw('badges', 'Milestones', 'মাইলস্টোন'), sw('sprints', 'Finished sprints', 'শেষ করা স্প্রিন্ট'),
              ])),
              AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'My passport', 'আমার পাসপোর্ট'), style: display(17, color: Brand.ink)),
                const SizedBox(height: 6),
                if (skills.isEmpty) Text(tr(context, 'No proven skills yet. Take a quiz or finish a sprint.', 'এখনও প্রমাণিত দক্ষতা নেই। কুইজ দিন বা স্প্রিন্ট শেষ করুন।'), style: body(14, color: Brand.muted)),
                for (final s in skills) Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [
                  Expanded(child: Text(nm(context, s, 'nameEn', 'nameBn'), style: body(16, w: FontWeight.w700))),
                  if (s['endorsed'] == true) Padding(padding: const EdgeInsets.only(right: 6), child: Pill(tr(context, 'Endorsed', 'এন্ডোর্সড'), tone: Tone.saffron)),
                  Pill(nm(context, s, 'levelEn', 'levelBn')),
                ])),
                if (projects.isNotEmpty) ...[const Divider(), for (final p in projects) InkWell(onTap: () => _open('${p['url']}'), child: Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [const Icon(Icons.folder_outlined, size: 18, color: Brand.delta), const SizedBox(width: 8), Expanded(child: Text('${p['title']}', style: body(15))), if (p['review'] == 'endorsed') Pill(tr(context, 'Reviewed', 'রিভিউড'), tone: Tone.saffron)])))],
                if (badges.isNotEmpty) ...[const Divider(), Wrap(spacing: 6, runSpacing: 6, children: [for (final b in badges) Pill(nm(context, b, 'titleEn', 'titleBn'), tone: Tone.grey)])],
              ])),
              AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'How the proof score is counted', 'প্রমাণের স্কোর কীভাবে গোনা হয়'), style: display(17, color: Brand.ink)),
                const SizedBox(height: 6),
                for (final e in [('skills', 40, 'Proven skills (8 each)', 'প্রমাণিত দক্ষতা (প্রতিটি ৮)'), ('endorsed', 25, 'Endorsed skills (8 each)', 'এন্ডোর্সড দক্ষতা (প্রতিটি ৮)'), ('projects', 15, 'Projects (5 each)', 'প্রজেক্ট (প্রতিটি ৫)'), ('sprints', 15, 'Finished sprints (5 each)', 'শেষ স্প্রিন্ট (প্রতিটি ৫)'), ('github', 5, 'Verified GitHub', 'যাচাইকৃত GitHub')])
                  Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [
                    Expanded(flex: 5, child: Text(tr(context, e.$3, e.$4), style: body(13))),
                    Expanded(flex: 4, child: ProgressBar(((parts[e.$1] ?? 0) as num) / e.$2, color: Brand.saffron, height: 8)),
                    SizedBox(width: 44, child: Text('${parts[e.$1] ?? 0}/${e.$2}', textAlign: TextAlign.end, style: body(12, color: Brand.muted))),
                  ])),
                Text(tr(context, 'A simple count, not a prediction of job success.', 'এটি সহজ গণনা, চাকরি পাওয়ার ভবিষ্যদ্বাণী নয়।'), style: body(12, color: Brand.muted)),
              ])),
              if (selfOnly.isNotEmpty) AppCard(color: Brand.lightSaffron, border: Colors.transparent, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'Self-rated only: prove these', 'শুধু নিজে দেওয়া: প্রমাণ করুন'), style: display(16, color: const Color(0xFF5A3600))),
                for (final s in selfOnly) Row(children: [
                  Expanded(child: Text(nm(context, s, 'nameEn', 'nameBn'), style: body(15))),
                  TextButton(onPressed: () => context.push('/quiz/${s['skillKey']}'), child: Text(tr(context, 'Quiz', 'কুইজ'))),
                ]),
              ])),
              const SizedBox(height: 16),
            ])),
          ]);
        },
      ),
    );
  }
}

// ====================== Mentor Sprint (student) ======================
class SprintsScreen extends ConsumerStatefulWidget {
  const SprintsScreen({super.key});
  @override
  ConsumerState<SprintsScreen> createState() => _SprintsState();
}

class _SprintsState extends ConsumerState<SprintsScreen> {

  // What to do for each kind of day. Each button opens a screen that already exists in the app.
  Widget _dayActions(BuildContext context, String skillKey, Map x) {
    final kind = '${x['kind']}';
    final acts = <(String, String, IconData)>[
      if (kind == 'quiz' || kind == 'review') (tr(context, kind == 'quiz' ? 'Take the quiz now' : 'Retake the quiz', kind == 'quiz' ? 'এখন কুইজ দিন' : 'আবার কুইজ দিন'), '/quiz/$skillKey', Icons.quiz_outlined),
      if (kind == 'learn') (tr(context, 'Open today\'s lesson links', 'আজকের পাঠের লিংক খুলুন'), '/sprint-learn/$skillKey', Icons.menu_book_outlined),
      if (kind == 'build' || kind == 'proof') (tr(context, 'Open my projects', 'আমার প্রজেক্ট খুলুন'), '/portfolio', Icons.folder_special_outlined),
      if (kind == 'build') (tr(context, 'Need help? Study links', 'সাহায্য লাগবে? পড়ার লিংক'), '/sprint-learn/$skillKey', Icons.lightbulb_outline),
    ];
    return Padding(padding: const EdgeInsets.only(left: 40, bottom: 8), child: Wrap(spacing: 8, runSpacing: 4, children: [
      for (final a in acts) FilledButton.tonalIcon(
        style: FilledButton.styleFrom(visualDensity: VisualDensity.compact),
        onPressed: () => context.push(a.$2), icon: Icon(a.$3, size: 18), label: Text(a.$1)),
    ]));
  }

  String? skill, mentor;
  bool busy = false;
  // Day ticks update on screen at once (optimistic) and sync in the background, so ticking is instant and never blocks the list.
  final Map<String, bool> _opt = {};
  bool _dayDone(Map sp, Map x) => _opt['${sp['id']}-${x['n']}'] ?? (x['done'] == true);

  Future<void> _tickDay(Map sp, Map x, bool v) async {
    final k = '${sp['id']}-${x['n']}';
    setState(() => _opt[k] = v);
    try {
      await ref.read(dioProvider).patch('/me/sprints/${sp['id']}/days/${x['n']}', data: {'done': v});
      ref.invalidate(sprintsProvider);
    } catch (e) {
      if (mounted) { setState(() => _opt.remove(k)); toast(context, errorText(e)); }
    }
  }

  Future<void> _call(Future<dynamic> Function() f) async {
    setState(() => busy = true);
    try { await f(); ref.invalidate(sprintsProvider); } catch (e) { if (mounted) toast(context, errorText(e)); }
    if (mounted) setState(() => busy = false);
  }

  // Start again: the student can keep the same skill/mentor or choose different ones, as many times as they like.
  // Works even if the current sprint is already with the mentor (it is withdrawn first).
  Future<void> _restart(Map sp, List<Map> skills, List mentors) async {
    String pickSkill = '${sp['skillKey']}';
    if (!skills.any((x) => '${x['skillKey']}' == pickSkill) && skills.isNotEmpty) pickSkill = '${skills.first['skillKey']}';
    String? pickMentor = sp['mentorId'] != null && mentors.cast<Map>().any((m) => '${m['id']}' == '${sp['mentorId']}') ? '${sp['mentorId']}' : null;
    final open = ['active', 'needs_work', 'submitted'].contains('${sp['status']}');
    final ok = await showDialog<bool>(context: context, builder: (c) => StatefulBuilder(builder: (c, set) => AlertDialog(
      title: Text(tr(context, 'Choose again', 'আবার বেছে নিন'), style: display(19)),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (open) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(tr(context, 'Your current sprint will be closed and a fresh 7 days will start.', 'বর্তমান স্প্রিন্ট বন্ধ হবে এবং নতুন ৭ দিন শুরু হবে।'), style: body(13, color: Brand.muted))),
        DropdownButton<String>(isExpanded: true, hint: Text(tr(context, 'Skill', 'দক্ষতা')), value: skills.any((x) => '${x['skillKey']}' == pickSkill) ? pickSkill : null,
          items: [for (final s in skills) DropdownMenuItem(value: '${s['skillKey']}', child: Text(nm(context, s, 'nameEn', 'nameBn')))], onChanged: (v) => set(() => pickSkill = v ?? pickSkill)),
        DropdownButton<String>(isExpanded: true, hint: Text(tr(context, 'Mentor (optional now)', 'মেন্টর (এখন ঐচ্ছিক)')), value: pickMentor,
          items: [for (final m in mentors.cast<Map>()) DropdownMenuItem(value: '${m['id']}', child: Text('${m['name']}'))], onChanged: (v) => set(() => pickMentor = v)),
      ])),
      actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(context, 'Cancel', 'বাতিল'))), FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(tr(context, 'Start the 7 days', '৭ দিন শুরু করুন')))],
    )));
    if (ok != true) return;
    _opt.clear();
    await _call(() => ref.read(dioProvider).post('/me/sprints/${sp['id']}/restart', data: {'skillKey': pickSkill, if (pickMentor != null) 'mentorId': pickMentor}));
    if (mounted) toast(context, tr(context, 'New 7-day sprint started.', 'নতুন ৭ দিনের স্প্রিন্ট শুরু হয়েছে।'));
  }

  Future<void> _submit(Map sp, List mentors) async {
    final url = TextEditingController(text: '${sp['proofUrl'] ?? ''}');
    final note = TextEditingController(text: '${sp['proofNote'] ?? ''}');
    String? pick = sp['mentorId'] != null ? '${sp['mentorId']}' : (mentors.isNotEmpty ? '${(mentors.first as Map)['id']}' : null);
    final ok = await showDialog<bool>(context: context, builder: (c) => StatefulBuilder(builder: (c, set) => AlertDialog(
      title: Text(tr(context, 'Send to my mentor', 'মেন্টরকে পাঠান'), style: display(19)),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: url, keyboardType: TextInputType.url, decoration: InputDecoration(labelText: tr(context, 'Proof link (https://)', 'প্রমাণের লিংক (https://)'))),
        TextField(controller: note, maxLength: 400, maxLines: 3, decoration: InputDecoration(labelText: tr(context, 'What did you build and learn?', 'কী বানালেন ও শিখলেন?'))),
        if (mentors.isEmpty) Text(tr(context, 'You need a mentor who accepted your request.', 'এমন একজন মেন্টর লাগবে যিনি আপনার অনুরোধ গ্রহণ করেছেন।'), style: body(13, color: Brand.muted))
        else DropdownButton<String>(isExpanded: true, value: pick, items: [for (final m in mentors.cast<Map>()) DropdownMenuItem(value: '${m['id']}', child: Text('${m['name']}'))], onChanged: (v) => set(() => pick = v)),
      ])),
      actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(context, 'Cancel', 'বাতিল'))), FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(tr(context, 'Send', 'পাঠান')))],
    )));
    if (ok != true || pick == null) return;
    await _call(() => ref.read(dioProvider).post('/me/sprints/${sp['id']}/submit', data: {'proofUrl': url.text.trim(), if (note.text.trim().isNotEmpty) 'note': note.text.trim(), 'mentorId': pick}));
    if (mounted) toast(context, tr(context, 'Sent. Your mentor will review it.', 'পাঠানো হয়েছে। মেন্টর রিভিউ করবেন।'));
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(sprintsProvider);
    return Scaffold(
      body: AsyncBody(
        value: async,
        onRetry: () => ref.invalidate(sprintsProvider),
        builder: (d) {
          final all = ((d['sprints'] ?? []) as List).cast<Map>();
          final mentors = (d['mentors'] ?? []) as List;
          final skills = ((d['skills'] ?? []) as List).cast<Map>();
          final open = all.where((s) => ['active', 'needs_work', 'submitted'].contains(s['status'])).toList();
          final past = all.where((s) => !['active', 'needs_work', 'submitted'].contains(s['status'])).toList();
          final sp = open.isEmpty ? null : open.first;
          return ListView(padding: EdgeInsets.zero, children: [
            _header(context, tr(context, 'Mentor Sprint', 'মেন্টর স্প্রিন্ট'), tr(context, '7 days. One skill. A mentor checks your work.', '৭ দিন। একটি দক্ষতা। মেন্টর কাজ দেখেন।')),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (sp == null) AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'Start a sprint', 'স্প্রিন্ট শুরু করুন'), style: display(19, color: Brand.ink)),
                const SizedBox(height: 6),
                Text(tr(context, 'Pick the one skill you want to prove this week.', 'এই সপ্তাহে যে দক্ষতাটি প্রমাণ করতে চান সেটি বেছে নিন।'), style: body(14, color: Brand.muted)),
                DropdownButton<String>(isExpanded: true, hint: Text(tr(context, 'Skill', 'দক্ষতা')), value: skill, items: [for (final s in skills) DropdownMenuItem(value: '${s['skillKey']}', child: Text(nm(context, s, 'nameEn', 'nameBn')))], onChanged: (v) => setState(() => skill = v)),
                DropdownButton<String>(isExpanded: true, hint: Text(tr(context, 'Mentor (optional now)', 'মেন্টর (এখন ঐচ্ছিক)')), value: mentor, items: [for (final m in mentors.cast<Map>()) DropdownMenuItem(value: '${m['id']}', child: Text('${m['name']}'))], onChanged: (v) => setState(() => mentor = v)),
                const SizedBox(height: 8),
                BigButton(tr(context, 'Start the 7 days', '৭ দিন শুরু করুন'), onPressed: busy || skill == null ? null : () => _call(() => ref.read(dioProvider).post('/me/sprints', data: {'skillKey': skill, if (mentor != null) 'mentorId': mentor}))),
              ])),
              if (sp != null) ...[
                () {
                  final days = ((sp['days'] ?? []) as List).cast<Map>();
                  final done = days.where((x) => _dayDone(sp, x)).length;
                  final status = '${sp['status']}';
                  final locked = status == 'submitted';
                  return AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Ring(value: done / 7, size: 64, stroke: 8, dark: false, label: '$done/7', labelStyle: display(15, color: Brand.ink)),
                      const SizedBox(width: 14),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(nm(context, sp, 'titleEn', 'titleBn'), style: display(19, color: Brand.ink)),
                        Text(tr(context, 'Day ${sp['dayIndex']} of 7', '৭ দিনের দিন ${sp['dayIndex']}'), style: body(13, color: Brand.muted)),
                      ])),
                      Pill(status == 'submitted' ? tr(context, 'With mentor', 'মেন্টরের কাছে') : status == 'needs_work' ? tr(context, 'More work', 'আরও কাজ') : tr(context, 'Active', 'চলছে'), tone: status == 'needs_work' ? Tone.saffron : status == 'submitted' ? Tone.blue : Tone.green),
                    ]),
                    if (status == 'needs_work' && sp['review'] != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text('${tr(context, 'Mentor note', 'মেন্টরের নোট')}: ${(sp['review'] as Map)['note'] ?? ''}', style: body(14, color: const Color(0xFF7A4A00)))),
                    const Divider(height: 24),
                    Container(
                      padding: const EdgeInsets.all(12), margin: const EdgeInsets.only(bottom: 8),
                      decoration: BoxDecoration(color: Brand.lightGreen, borderRadius: BorderRadius.circular(14)),
                      child: Text(tr(context,
                        'How it works: each day has one small task. Tap the green button under the task to do it (take the quiz, study a lesson, build, publish), then tick the box. On day 7 your mentor checks your project. If they endorse it, a proven level is added to your Career Passport and employers can trust it.',
                        'কীভাবে কাজ করে: প্রতিদিন একটি ছোট কাজ। কাজের নিচের সবুজ বোতামে ট্যাপ করে কাজটি করুন (কুইজ, পড়া, বানানো, প্রকাশ), তারপর বক্স টিক দিন। ৭ম দিনে মেন্টর আপনার প্রজেক্ট দেখেন। এন্ডোর্স করলে ক্যারিয়ার পাসপোর্টে প্রমাণিত লেভেল যোগ হয়।'), style: body(13, color: Brand.forest)),
                    ),
                    for (final x in days) ...[CheckboxListTile(
                      contentPadding: EdgeInsets.zero, dense: true, controlAffinity: ListTileControlAffinity.leading,
                      value: _dayDone(sp, x),
                      onChanged: locked || ((x['n'] as num) > ((sp['dayIndex'] ?? 1) as num) && !_dayDone(sp, x)) ? null : (v) => _tickDay(sp, x, v == true),
                      title: Text('${tr(context, 'Day', 'দিন')} ${x['n']}: ${nm(context, x, 'titleEn', 'titleBn')}', style: body(15, w: FontWeight.w700)),
                      subtitle: Text(((x['n'] as num) > ((sp['dayIndex'] ?? 1) as num) && !_dayDone(sp, x)) ? tr(context, 'Opens on day ${x['n']}', 'দিন ${x['n']}-এ খুলবে') : nm(context, x, 'taskEn', 'taskBn'), style: body(13, color: Brand.muted)),
                    ),
                    if (!locked && !_dayDone(sp, x) && (x['n'] as num) <= ((sp['dayIndex'] ?? 1) as num)) _dayActions(context, '${sp['skillKey']}', x),
                    ],
                    const SizedBox(height: 8),
                    if (status != 'submitted') BigButton(tr(context, 'Send to my mentor', 'মেন্টরকে পাঠান'), onPressed: busy || done < 5 ? null : () => _submit(sp, mentors)),
                    if (status != 'submitted' && done < 5) Padding(padding: const EdgeInsets.only(top: 6), child: Text(tr(context, 'Finish at least 5 days first.', 'আগে অন্তত ৫ দিন শেষ করুন।'), textAlign: TextAlign.center, style: body(12, color: Brand.muted))),
                    if (status == 'submitted') Text(tr(context, 'Waiting for your mentor to review.', 'মেন্টরের রিভিউয়ের অপেক্ষা।'), textAlign: TextAlign.center, style: body(14, color: Brand.muted)),
                    OutlinedButton.icon(onPressed: busy ? null : () => _restart(sp, skills, mentors), icon: const Icon(Icons.swap_horiz), label: Text(tr(context, 'Change skill / start again', 'দক্ষতা বদলান / আবার শুরু করুন'))),
                    TextButton(onPressed: busy ? null : () => _call(() => ref.read(dioProvider).post('/me/sprints/${sp['id']}/stop')), child: Text(status == 'submitted' ? tr(context, 'Withdraw this sprint', 'এই স্প্রিন্ট প্রত্যাহার করুন') : tr(context, 'Stop this sprint', 'এই স্প্রিন্ট বন্ধ করুন'))),
                  ]));
                }(),
              ],
              if (past.isNotEmpty) Padding(padding: const EdgeInsets.fromLTRB(2, 8, 2, 8), child: Text(tr(context, 'Earlier sprints', 'আগের স্প্রিন্ট'), style: display(18, color: Brand.ink))),
              for (final s in past) AppCard(margin: const EdgeInsets.only(bottom: 8), child: Row(children: [
                Icon(s['badge'] == true ? Icons.workspace_premium : Icons.history, color: s['badge'] == true ? Brand.saffron : Brand.muted),
                const SizedBox(width: 12),
                Expanded(child: Text(nm(context, s, 'titleEn', 'titleBn'), style: body(16, w: FontWeight.w700))),
                Pill(s['badge'] == true ? tr(context, 'Endorsed', 'এন্ডোর্সড') : '${s['status']}', tone: s['badge'] == true ? Tone.saffron : Tone.grey),
                if (sp == null) IconButton(tooltip: tr(context, 'Do it again', 'আবার করুন'), onPressed: busy ? null : () => _restart(s, skills, mentors), icon: const Icon(Icons.replay, color: Brand.forest)),
              ])),
              Text(tr(context, 'An endorsement adds a proven level to your Career Passport. Finishing the days alone does not change your score.', 'এন্ডোর্সমেন্ট আপনার ক্যারিয়ার পাসপোর্টে প্রমাণিত লেভেল যোগ করে। শুধু দিনগুলো শেষ করলে স্কোর বদলায় না।'), textAlign: TextAlign.center, style: body(12, color: Brand.muted)),
              const SizedBox(height: 16),
            ])),
          ]);
        },
      ),
    );
  }
}

// ====================== Mentor: sprint reviews ======================
class SprintReviewsScreen extends ConsumerWidget {
  const SprintReviewsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(sprintReviewsProvider),
        onRetry: () => ref.invalidate(sprintReviewsProvider),
        builder: (d) {
          final list = ((d['reviews'] ?? []) as List).cast<Map>();
          return ListView(padding: EdgeInsets.zero, children: [
            _header(context, tr(context, 'Sprint reviews', 'স্প্রিন্ট রিভিউ'), tr(context, 'Endorse up to your own level', 'নিজের লেভেল পর্যন্ত এন্ডোর্স করুন')),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (list.isEmpty) Padding(padding: const EdgeInsets.all(24), child: Text(tr(context, 'No sprints are waiting for you.', 'আপনার জন্য কোনো স্প্রিন্ট অপেক্ষায় নেই।'), textAlign: TextAlign.center, style: body(15, color: Brand.muted))),
              for (final s in list) _ReviewCard(s, onDone: () => ref.invalidate(sprintReviewsProvider)),
            ])),
          ]);
        },
      ),
    );
  }
}

class _ReviewCard extends ConsumerStatefulWidget {
  const _ReviewCard(this.s, {required this.onDone});
  final Map s; final VoidCallback onDone;
  @override
  ConsumerState<_ReviewCard> createState() => _ReviewCardState();
}

class _ReviewCardState extends ConsumerState<_ReviewCard> {
  int level = 1;
  final note = TextEditingController();
  bool busy = false;

  Future<void> _send(String decision) async {
    setState(() => busy = true);
    try {
      await ref.read(dioProvider).post('/mentor/sprints/${widget.s['id']}/review', data: {'decision': decision, if (decision == 'endorse') 'level': level, if (note.text.trim().isNotEmpty) 'note': note.text.trim()});
      widget.onDone();
    } catch (e) { if (mounted) toast(context, errorText(e)); }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.s;
    final my = ((s['myLevel'] ?? 0) as num).toInt();
    final days = ((s['days'] ?? []) as List).cast<Map>();
    final done = days.where((x) => x['done'] == true).length;
    return AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [Avatar('${s['student']}', size: 40), const SizedBox(width: 10), Expanded(child: Text('${s['student']} · ${nm(context, s, 'titleEn', 'titleBn')}', style: body(16, w: FontWeight.w700))), Pill('$done/7')]),
      if ((s['proofNote'] ?? '').toString().isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text('${s['proofNote']}', style: body(14))),
      if (s['proofUrl'] != null) TextButton.icon(onPressed: () => _open('${s['proofUrl']}'), icon: const Icon(Icons.open_in_new, size: 16), label: Text(tr(context, 'Open the proof', 'প্রমাণ খুলুন'))),
      if (my == 0) Text(tr(context, 'This skill is not in your profile, so you can only ask for more work.', 'এই দক্ষতা আপনার প্রোফাইলে নেই, তাই শুধু আরও কাজ চাইতে পারবেন।'), style: body(13, color: Brand.muted))
      else Row(children: [
        Text(tr(context, 'Level', 'লেভেল'), style: body(14)), const SizedBox(width: 8),
        for (var l = 1; l <= my; l++) Padding(padding: const EdgeInsets.only(right: 6), child: ChoiceChip(label: Text('$l'), selected: level == l, onSelected: (_) => setState(() => level = l))),
        Text(tr(context, '(max $my)', '(সর্বোচ্চ $my)'), style: body(12, color: Brand.muted)),
      ]),
      TextField(controller: note, maxLength: 400, maxLines: 2, decoration: InputDecoration(labelText: tr(context, 'Note to the student', 'শিক্ষার্থীর জন্য নোট'))),
      Row(children: [
        Expanded(child: FilledButton(onPressed: busy || my == 0 ? null : () => _send('endorse'), child: Text(tr(context, 'Endorse', 'এন্ডোর্স')))),
        const SizedBox(width: 8),
        Expanded(child: OutlinedButton(onPressed: busy ? null : () => _send('needs_work'), child: Text(tr(context, 'Needs work', 'আরও কাজ দরকার')))),
      ]),
    ]));
  }
}

// ====================== Student: company invitations ======================
class InvitesScreen extends ConsumerWidget {
  const InvitesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    Future<void> respond(String id, bool accept) async {
      try { await ref.read(dioProvider).post('/me/invites/$id/respond', data: {'accept': accept}); ref.invalidate(invitesProvider); } catch (e) { if (context.mounted) toast(context, errorText(e)); }
    }
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(invitesProvider),
        onRetry: () => ref.invalidate(invitesProvider),
        builder: (d) {
          final list = ((d['invites'] ?? []) as List).cast<Map>();
          return ListView(padding: EdgeInsets.zero, children: [
            _header(context, tr(context, 'Company invitations', 'কোম্পানির আমন্ত্রণ'), tr(context, 'You decide. Nothing is shared until you accept.', 'সিদ্ধান্ত আপনার। গ্রহণ না করা পর্যন্ত কিছু শেয়ার হয় না।')),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (list.isEmpty) Padding(padding: const EdgeInsets.all(24), child: Text(tr(context, 'No invitations yet. Turn on "Let verified companies find me" in your Career Passport.', 'এখনও আমন্ত্রণ নেই। ক্যারিয়ার পাসপোর্টে "যাচাইকৃত কোম্পানি আমাকে খুঁজে পাক" চালু করুন।'), textAlign: TextAlign.center, style: body(15, color: Brand.muted))),
              for (final i in list) AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [Expanded(child: Text('${i['company']}', style: display(18, color: Brand.ink))), if (i['verified'] == true) Pill(tr(context, 'Verified company', 'যাচাইকৃত কোম্পানি'))]),
                Text('${i['industry'] ?? ''} ${i['city'] == null ? '' : '· ${i['city']}'}', style: body(13, color: Brand.muted)),
                if (i['job'] != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text('${tr(context, 'Job', 'চাকরি')}: ${(i['job'] as Map)['title']}', style: body(14, w: FontWeight.w700))),
                if ((i['message'] ?? '').toString().isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text('${i['message']}', style: body(14))),
                const SizedBox(height: 8),
                if (i['status'] == 'pending') Row(children: [
                  Expanded(child: FilledButton(onPressed: () => respond('${i['id']}', true), child: Text(tr(context, 'Accept', 'গ্রহণ')))), const SizedBox(width: 8),
                  Expanded(child: OutlinedButton(onPressed: () => respond('${i['id']}', false), child: Text(tr(context, 'Decline', 'প্রত্যাখ্যান')))),
                ]) else Pill('${i['status']}', tone: i['status'] == 'accepted' ? Tone.green : Tone.grey),
              ])),
            ])),
          ]);
        },
      ),
    );
  }
}

// ====================== Employer: Talent Pool ======================
class TalentScreen extends ConsumerStatefulWidget {
  const TalentScreen({super.key});
  @override
  ConsumerState<TalentScreen> createState() => _TalentState();
}

class _TalentState extends ConsumerState<TalentScreen> {
  final q = TextEditingController();

  Future<void> _invite(Map c) async {
    final msg = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (d) => AlertDialog(
      title: Text(tr(context, 'Invite ${c['name']}', '${c['name']}-কে আমন্ত্রণ'), style: display(19)),
      content: TextField(controller: msg, maxLength: 300, maxLines: 3, decoration: InputDecoration(labelText: tr(context, 'Message (why this student?)', 'বার্তা (কেন এই শিক্ষার্থী?)'))),
      actions: [TextButton(onPressed: () => Navigator.pop(d, false), child: Text(tr(context, 'Cancel', 'বাতিল'))), FilledButton(onPressed: () => Navigator.pop(d, true), child: Text(tr(context, 'Send', 'পাঠান')))],
    ));
    if (ok != true) return;
    try {
      await ref.read(dioProvider).post('/employer/talent/${c['talentId']}/invite', data: {if (msg.text.trim().isNotEmpty) 'message': msg.text.trim()});
      ref.invalidate(employerInvitesProvider);
      if (mounted) toast(context, tr(context, 'Invitation sent', 'আমন্ত্রণ পাঠানো হয়েছে'));
    } catch (e) { if (mounted) toast(context, errorText(e)); }
  }

  @override
  Widget build(BuildContext context) {
    final res = ref.watch(talentProvider);
    final inv = ref.watch(employerInvitesProvider);
    return DefaultTabController(length: 2, child: Column(children: [
      GreenHeader(radius: 36, bottomPad: 20, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(tr(context, 'Talent Pool', 'ট্যালেন্ট পুল'), style: display(28, color: Colors.white)),
        Text(tr(context, 'Search proof, not CVs. Students opted in.', 'প্রমাণ খুঁজুন, সিভি নয়। শিক্ষার্থীরা নিজে রাজি।'), style: body(15, color: Colors.white70)),
      ])),
      TabBar(labelColor: Brand.forest, indicatorColor: Brand.saffron, tabs: [Tab(text: tr(context, 'Search', 'খুঁজুন')), Tab(text: tr(context, 'Invitations', 'আমন্ত্রণ'))]),
      Expanded(child: TabBarView(children: [
        ListView(padding: const EdgeInsets.all(16), children: [
          Row(children: [
            Expanded(child: TextField(controller: q, decoration: InputDecoration(labelText: tr(context, 'Skills and level, e.g. sql:2, python:1', 'দক্ষতা ও লেভেল, যেমন sql:2, python:1')), onSubmitted: (v) => ref.read(talentQueryProvider.notifier).state = v.trim())),
            const SizedBox(width: 8),
            IconButton.filled(onPressed: () => ref.read(talentQueryProvider.notifier).state = q.text.trim(), icon: const Icon(Icons.search)),
          ]),
          const SizedBox(height: 8),
          res.when(
            loading: () => const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator())),
            error: (e, _) => Padding(padding: const EdgeInsets.all(16), child: Text(errorText(e), style: body(14, color: Colors.redAccent))),
            data: (d) {
              final cards = ((d['cards'] ?? []) as List).cast<Map>();
              if (ref.read(talentQueryProvider).isEmpty) return Padding(padding: const EdgeInsets.all(16), child: Text(tr(context, 'Type the skills you need. Levels: 1 Elementary, 2 Intermediate, 3 Advanced.', 'প্রয়োজনীয় দক্ষতা লিখুন। লেভেল: ১ এলিমেন্টারি, ২ ইন্টারমিডিয়েট, ৩ অ্যাডভান্সড।'), style: body(14, color: Brand.muted)));
              if (cards.isEmpty) return Padding(padding: const EdgeInsets.all(16), child: Text(tr(context, 'No matching students yet.', 'এখনও মিল পাওয়া যায়নি।'), style: body(14, color: Brand.muted)));
              return Column(children: [
                for (final c in cards) AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Avatar('${c['name']}', size: 44), const SizedBox(width: 10),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${c['name']}', style: body(17, w: FontWeight.w800)),
                      Text('${c['university'] ?? ''}${c['department'] == null ? '' : ' · ${c['department']}'}', style: body(13, color: Brand.muted)),
                    ])),
                    Ring(value: ((c['matchPct'] ?? 0) as num) / 100, size: 54, stroke: 7, dark: false, label: '${c['matchPct']}%', labelStyle: display(13, color: Brand.ink)),
                  ]),
                  if ((c['headline'] ?? '').toString().isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text('${c['headline']}', style: body(14))),
                  const SizedBox(height: 8),
                  Wrap(spacing: 6, runSpacing: 6, children: [
                    for (final m in ((c['matched'] ?? []) as List).cast<Map>()) Pill('${m['skillKey']} · L${m['level']}${m['endorsed'] == true ? ' ✓' : ''}'),
                    for (final m in ((c['notProven'] ?? []) as List).cast<Map>()) Pill('${m['skillKey']} · ${tr(context, 'not proven', 'প্রমাণ নেই')}', tone: Tone.grey),
                  ]),
                  const SizedBox(height: 4),
                  Row(children: [
                    Text('${tr(context, 'Proof strength', 'প্রমাণের শক্তি')} ${c['proofStrength']}/100', style: body(12, color: Brand.muted)),
                    const Spacer(),
                    FilledButton(onPressed: () => _invite(c), child: Text(tr(context, 'Invite', 'আমন্ত্রণ'))),
                  ]),
                ])),
                Text('${d['note'] ?? ''}', textAlign: TextAlign.center, style: body(12, color: Brand.muted)),
              ]);
            },
          ),
        ]),
        AsyncBody(value: inv, onRetry: () => ref.invalidate(employerInvitesProvider), builder: (d) {
          final list = ((d['invites'] ?? []) as List).cast<Map>();
          if (list.isEmpty) return Center(child: Text(tr(context, 'No invitations sent yet.', 'এখনও আমন্ত্রণ পাঠানো হয়নি।'), style: body(14, color: Brand.muted)));
          return ListView(padding: const EdgeInsets.all(16), children: [
            for (final i in list) AppCard(margin: const EdgeInsets.only(bottom: 8), child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${i['student']}', style: body(16, w: FontWeight.w700)), if ((i['message'] ?? '').toString().isNotEmpty) Text('${i['message']}', style: body(13, color: Brand.muted))])),
              Pill('${i['status']}', tone: i['status'] == 'accepted' ? Tone.green : i['status'] == 'declined' ? Tone.grey : Tone.saffron),
            ])),
          ]);
        }),
      ])),
    ]));
  }
}

// Sprint "learn" days: the free, approved study links for this skill, one tap away. Nothing is invented: the links come from /resources.
final _sprintLinksProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, skill) => getJson(ref, '/resources', q: {'skillKey': skill}));

class SprintLearnScreen extends ConsumerWidget {
  const SprintLearnScreen({super.key, required this.skillKey});
  final String skillKey;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final res = ref.watch(_sprintLinksProvider(skillKey));
    final hasRoadmap = ref.watch(roadmapProvider(skillKey)).hasValue;
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'Study links', 'পড়ার লিংক'), style: display(22, color: Brand.ink))),
      body: AsyncBody(value: res, onRetry: () => ref.invalidate(_sprintLinksProvider(skillKey)), builder: (d) {
        final list = ((d['resources'] ?? []) as List).cast<Map>();
        return ListView(padding: const EdgeInsets.all(16), children: [
          AppCard(color: Brand.lightGreen, border: Colors.transparent, child: Text(tr(context, 'Pick ONE link, study for about 45 minutes, then write 3 lines of notes in your own words. Come back here and tick the day.', 'একটি লিংক বাছুন, প্রায় ৪৫ মিনিট পড়ুন, তারপর নিজের ভাষায় ৩ লাইন নোট লিখুন। ফিরে এসে দিনটি টিক দিন।'), style: body(14, color: Brand.forest))),
          if (list.isEmpty) AppCard(child: Text(tr(context, 'No approved links for this skill yet. Search for a free beginner course and note what you learned.', 'এই দক্ষতার জন্য এখনও অনুমোদিত লিংক নেই। একটি বিনামূল্যে বেসিক কোর্স খুঁজে কী শিখলেন লিখুন।'), style: body(15, color: Brand.muted))),
          for (final r in list) AppCard(
            margin: const EdgeInsets.only(bottom: 8),
            onTap: () async {
              final ok = await launchUrl(Uri.parse('${r['url']}'), mode: LaunchMode.externalApplication);
              if (!ok && context.mounted) toast(context, tr(context, 'Could not open the link', 'লিংক খোলা যায়নি'));
            },
            child: Row(children: [
              const Icon(Icons.open_in_new, color: Brand.delta), const SizedBox(width: 12),
              Expanded(child: Text('${r['title']}', style: body(16, w: FontWeight.w700))),
              Pill(r['language'] == 'bn' ? 'বাংলা' : 'English', tone: r['language'] == 'bn' ? Tone.green : Tone.blue),
            ]),
          ),
          if (hasRoadmap) BigButton(tr(context, 'Open the step-by-step roadmap', 'ধাপে ধাপে রোডম্যাপ খুলুন'), outlined: true, onPressed: () => context.push('/roadmap/$skillKey')),
        ]);
      }),
    );
  }
}

final launchRoutes = <RouteBase>[
  GoRoute(path: '/passport', builder: (_, __) => const PassportScreen()),
  GoRoute(path: '/sprints', builder: (_, __) => const SprintsScreen()),
  GoRoute(path: '/sprint-learn/:skillKey', builder: (_, s) => SprintLearnScreen(skillKey: s.pathParameters['skillKey']!)),
  GoRoute(path: '/invites', builder: (_, __) => const InvitesScreen()),
  GoRoute(path: '/mentor/sprint-reviews', builder: (_, __) => const SprintReviewsScreen()),
];
