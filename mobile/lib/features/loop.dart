import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// Career outcome loop: assess -> plan -> practice -> review -> reassess.
//  - Student: Outcome tracker, mentors for ONE gap (with evidence), mentor feedback.
//  - Mentor: review queue, review pack (endorse a project, ask for more work, advise on the roadmap order).
//  - Admin: impact card (only students who agreed to share, groups under 5 hidden).
// A mentor can endorse only up to their own level, and can never change a score directly.

final outcomeTrackerProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/outcome-tracker'));
final myReviewsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/reviews'));
final gapMentorsProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, key) {
  final parts = key.split('|'); // "<skillKey>|<focus>"
  return getJson(ref, '/me/gaps/${parts.first}/mentors', q: <String, dynamic>{if (parts.length > 1 && parts[1].isNotEmpty) 'focus': parts[1]});
});
final reviewQueueProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/mentor/review-queue'));
final reviewPackProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) => getJson(ref, '/mentees/$id/review-pack'));
final adminImpactProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/admin/impact'));
final loopAcceptedProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/requests'));

const _loopLabels = {
  'assess': ['Assess', 'যাচাই'],
  'plan': ['Plan', 'পরিকল্পনা'],
  'practice': ['Practice', 'অনুশীলন'],
  'review': ['Review', 'রিভিউ'],
  'reassess': ['Reassess', 'পুনরায় যাচাই'],
};

Widget _loopHeader(BuildContext context, String title, String sub) => GreenHeader(
      radius: 36,
      bottomPad: 26,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        BackCircle(dark: true, onTap: () => context.pop()),
        const SizedBox(height: 12),
        Text(title, style: display(30, color: Colors.white)),
        Text(sub, style: body(15, color: Colors.white70)),
      ]),
    );

Widget _stat(BuildContext context, String label, String value) => Expanded(
      child: Column(children: [
        Text(value, style: display(24, color: Brand.forest)),
        Text(label, textAlign: TextAlign.center, style: body(12, color: Brand.muted)),
      ]),
    );

// ---------------------------------------------------------------- student: outcome tracker
class OutcomeTrackerScreen extends ConsumerWidget {
  const OutcomeTrackerScreen({super.key});

  Future<void> _askReview(BuildContext context, WidgetRef ref, String evidenceId) async {
    try {
      final r = await ref.read(dioProvider).get('/requests');
      final mentors = ((r.data['requests'] ?? []) as List).cast<Map>().where((x) => x['status'] == 'accepted').toList();
      if (!context.mounted) return;
      if (mentors.isEmpty) {
        toast(context, tr(context, 'You need a mentor who accepted your request first.', 'আগে এমন মেন্টর লাগবে যিনি আপনার অনুরোধ গ্রহণ করেছেন।'));
        return;
      }
      final pick = await showDialog<String>(
        context: context,
        builder: (c) => SimpleDialog(
          title: Text(tr(context, 'Ask which mentor?', 'কোন মেন্টরকে বলবেন?')),
          children: [for (final m in mentors) SimpleDialogOption(onPressed: () => Navigator.pop(c, '${m['mentorId']}'), child: Text('${m['withName']}'))],
        ),
      );
      if (pick == null) return;
      await ref.read(dioProvider).post('/me/evidence/$evidenceId/request-review', data: {'mentorId': pick});
      ref.invalidate(outcomeTrackerProvider);
      if (context.mounted) toast(context, tr(context, 'Review requested.', 'রিভিউ চাওয়া হয়েছে।'));
    } catch (e) {
      if (context.mounted) toast(context, errorText(e));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(outcomeTrackerProvider),
        onRetry: () => ref.invalidate(outcomeTrackerProvider),
        builder: (d) {
          final rd = (d['readiness'] ?? {}) as Map;
          final comps = ((d['competencies'] ?? []) as List).cast<Map>();
          final port = ((d['portfolio'] ?? []) as List).cast<Map>();
          final mocks = (d['mockInterviews'] ?? {}) as Map;
          final apps = (d['applications'] ?? {}) as Map;
          final mentoring = (d['mentoring'] ?? {}) as Map;
          final loop = (d['loop'] ?? {}) as Map;
          final steps = ((loop['steps'] ?? []) as List).cast<Map>();
          final cur = steps.indexWhere((s) => s['current'] == true);
          final bn = Localizations.localeOf(context).languageCode == 'bn';
          return ListView(padding: EdgeInsets.zero, children: [
            _loopHeader(context, tr(context, 'Outcome tracker', 'ফলাফল ট্র্যাকার'), tr(context, 'What changed, not just what you attended.', 'শুধু কী করেছেন নয়, কী বদলেছে।')),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (steps.isNotEmpty) AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'YOUR CYCLE', 'আপনার চক্র'), style: body(12, color: Brand.muted, w: FontWeight.w800)),
                const SizedBox(height: 10),
                JourneyStepper(labels: [for (final s in steps) tr(context, _loopLabels['${s['key']}']![0], _loopLabels['${s['key']}']![1])], current: cur < 0 ? steps.length : cur),
                if (loop['readinessAtLastReview'] != null && loop['readinessNow'] != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text('${tr(context, 'Readiness at your last mentor review', 'শেষ মেন্টর রিভিউয়ের সময় প্রস্তুতি')}: ${loop['readinessAtLastReview']}% → ${loop['readinessNow']}%', style: body(14, color: Brand.muted))),
              ])),
              AppCard(child: Row(children: [
                _stat(context, tr(context, 'Readiness then', 'আগের প্রস্তুতি'), rd['first'] == null ? '–' : '${rd['first']}%'),
                const Icon(Icons.arrow_forward, color: Brand.muted),
                _stat(context, tr(context, 'Readiness now', 'এখনকার প্রস্তুতি'), rd['latest'] == null ? '–' : '${rd['latest']}%'),
              ])),
              AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'SKILLS THAT CHANGED', 'যে স্কিল বদলেছে'), style: body(12, color: Brand.muted, w: FontWeight.w800)),
                const SizedBox(height: 6),
                if (comps.isEmpty) Text(tr(context, 'No skill evidence yet. Take a quiz or add a project.', 'এখনও কোনো স্কিল প্রমাণ নেই। কুইজ দিন বা প্রজেক্ট যোগ করুন।'), style: body(15, color: Brand.muted)),
                for (final c in comps) Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Row(children: [
                  Expanded(child: Text(nm(context, c, 'nameEn', 'nameBn'), style: body(16, w: FontWeight.w600))),
                  Text('L${c['from']} → L${c['to']}', style: body(14, color: (c['change'] as num) > 0 ? Brand.delta : Brand.muted, w: FontWeight.w700)),
                  const SizedBox(width: 8),
                  Pill(c['proven'] == true ? tr(context, 'proven', 'প্রমাণিত') : tr(context, 'self', 'নিজে'), tone: c['proven'] == true ? Tone.green : Tone.grey),
                ])),
              ])),
              AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'PORTFOLIO', 'পোর্টফোলিও'), style: body(12, color: Brand.muted, w: FontWeight.w800)),
                if (port.isEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(tr(context, 'No projects yet.', 'এখনও কোনো প্রজেক্ট নেই।'), style: body(15, color: Brand.muted))),
                for (final p in port) Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [
                  Expanded(child: Text('${nm(context, p, 'nameEn', 'nameBn')} · L${p['level']}', style: body(16, w: FontWeight.w600))),
                  if (p['url'] != null) IconButton(icon: const Icon(Icons.link, size: 20), onPressed: () => launchUrl(Uri.parse('${p['url']}'), mode: LaunchMode.externalApplication)),
                  Pill(
                    p['reviewStatus'] == 'endorsed' ? tr(context, 'Endorsed', 'এন্ডোর্সড') : p['reviewStatus'] == 'needs_work' ? tr(context, 'Needs work', 'আরও কাজ লাগবে') : p['reviewStatus'] == 'requested' ? tr(context, 'Review asked', 'রিভিউ চাওয়া') : tr(context, 'Not reviewed', 'রিভিউ হয়নি'),
                    tone: p['reviewStatus'] == 'endorsed' ? Tone.green : p['reviewStatus'] == 'needs_work' ? Tone.saffron : Tone.grey,
                  ),
                ])),
              ])),
              AppCard(child: Row(children: [
                _stat(context, tr(context, 'Mock interviews', 'মক ইন্টারভিউ'), '${mocks['count'] ?? 0}'),
                _stat(context, tr(context, 'Applications', 'আবেদন'), '${apps['total'] ?? 0}'),
                _stat(context, tr(context, 'Interviews', 'ইন্টারভিউ'), '${apps['interviews'] ?? 0}'),
                _stat(context, tr(context, 'Selected', 'নির্বাচিত'), '${apps['selected'] ?? 0}'),
              ])),
              if (mocks['first'] != null && mocks['latest'] != null) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text('${tr(context, 'Mock interview score', 'মক ইন্টারভিউ স্কোর')}: ${mocks['first']} → ${mocks['latest']}', style: body(14, color: Brand.muted))),
              AppCard(onTap: () => context.push('/my-reviews'), child: Row(children: [
                const Icon(Icons.rate_review_outlined, color: Brand.delta),
                const SizedBox(width: 12),
                Expanded(child: Text('${tr(context, 'Mentor feedback', 'মেন্টর ফিডব্যাক')} (${mentoring['reviewsReceived'] ?? 0})', style: body(16, w: FontWeight.w700))),
                const Icon(Icons.chevron_right, color: Brand.muted),
              ])),
              AppCard(color: Brand.lightGreen, border: Colors.transparent, child: SwitchListTile(
                contentPadding: EdgeInsets.zero,
                activeColor: Brand.delta,
                title: Text(tr(context, 'Share my results anonymously for research', 'গবেষণার জন্য আমার ফলাফল বেনামে শেয়ার করুন'), style: body(15, w: FontWeight.w700, color: Brand.forest)),
                subtitle: Text(tr(context, 'Only grouped numbers, never your name. Groups under 5 are hidden. You can turn it off any time.', 'শুধু গ্রুপ করা সংখ্যা, নাম নয়। ৫ জনের কম হলে লুকানো। যেকোনো সময় বন্ধ করা যায়।'), style: body(12, color: Brand.muted)),
                value: d['sharingForResearch'] == true,
                onChanged: (v) async {
                  try {
                    await ref.read(dioProvider).put('/me/outcome-sharing', data: {'on': v});
                    ref.invalidate(outcomeTrackerProvider);
                  } catch (e) {
                    if (context.mounted) toast(context, errorText(e));
                  }
                },
              )),
              if (port.any((p) => p['reviewStatus'] == null || p['reviewStatus'] == 'none' || p['reviewStatus'] == 'needs_work')) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(bn ? 'প্রজেক্টের রিভিউ চাইতে নিচের বাটন ব্যবহার করুন।' : 'Ask a mentor to review a project with the button below.', style: body(13, color: Brand.muted))),
              BigButton(tr(context, 'Ask a mentor to review my project', 'আমার প্রজেক্ট রিভিউ করতে মেন্টরকে বলুন'), outlined: true, onPressed: () async {
                try {
                  final ev = await ref.read(dioProvider).get('/me/outcome-tracker');
                  final projects = ((ev.data['portfolio'] ?? []) as List).cast<Map>();
                  if (projects.isEmpty) {
                    if (context.mounted) toast(context, tr(context, 'Add a project first (Skill gap > add evidence).', 'আগে একটি প্রজেক্ট যোগ করুন।'));
                    return;
                  }
                } catch (_) {}
                if (context.mounted) context.push('/my-projects');
              }),
              const SizedBox(height: 8),
              Text('${d['note'] ?? ''}', textAlign: TextAlign.center, style: body(12, color: Brand.muted)),
            ])),
          ]);
        },
      ),
    );
  }
}

// ---------------------------------------------------------------- student: pick a project to send for review
final myProjectsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/skills-evidence'));

// ---------------------------------------------------------------- student: mentors for one gap
class GapMentorsScreen extends ConsumerStatefulWidget {
  const GapMentorsScreen({super.key, required this.skillKey});
  final String skillKey;
  @override
  ConsumerState<GapMentorsScreen> createState() => _GapMentorsState();
}

class _GapMentorsState extends ConsumerState<GapMentorsScreen> {
  String focus = '';
  static const _focus = [
    ['', 'Any help', 'যেকোনো সাহায্য'],
    ['technical_interview', 'Technical interview', 'টেকনিক্যাল ইন্টারভিউ'],
    ['portfolio_review', 'Portfolio review', 'পোর্টফোলিও রিভিউ'],
    ['cv_review', 'CV review', 'সিভি রিভিউ'],
    ['roadmap_review', 'Roadmap review', 'রোডম্যাপ রিভিউ'],
    ['career_switch', 'Career switch', 'ক্যারিয়ার বদল'],
  ];

  @override
  Widget build(BuildContext context) {
    final key = '${widget.skillKey}|$focus';
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(gapMentorsProvider(key)),
        onRetry: () => ref.invalidate(gapMentorsProvider(key)),
        builder: (d) {
          final skill = (d['skill'] ?? {}) as Map;
          final mentors = ((d['mentors'] ?? []) as List).cast<Map>();
          return ListView(padding: EdgeInsets.zero, children: [
            _loopHeader(context, tr(context, 'Help with ${skill['nameEn']}', '${skill['nameBn']}-এ সাহায্য'), tr(context, 'Mentors ranked for this one gap, with the proof.', 'এই একটি ঘাটতির জন্য মেন্টর, প্রমাণসহ।')),
            Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 0), child: SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
              for (final f in _focus) Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(label: Text(tr(context, f[1], f[2])), selected: focus == f[0], onSelected: (_) => setState(() => focus = f[0]))),
            ]))),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (mentors.isEmpty) AppCard(child: Text(tr(context, 'No mentor with open spots for this yet. Try "Any help".', 'এর জন্য এখন ফাঁকা মেন্টর নেই। "যেকোনো সাহায্য" চেষ্টা করুন।'), style: body(16))),
              for (final m in mentors) AppCard(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Avatar('${m['name']}', size: 44, bg: Brand.lightGreen, fg: Brand.forest),
                    const SizedBox(width: 12),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${m['name']}', style: display(19, color: Brand.ink)),
                      Text('${m['roleTitle']} · ${m['industry']}', style: body(14, color: Brand.muted)),
                    ])),
                    Text('${m['score']}%', style: display(24, color: Brand.forest)),
                  ]),
                  const SizedBox(height: 8),
                  Text(tr(context, 'WHY THIS MENTOR', 'কেন এই মেন্টর'), style: body(12, color: Brand.muted, w: FontWeight.w800)),
                  for (final e in ((m['evidence'] ?? []) as List).cast<Map>()) Padding(padding: const EdgeInsets.only(top: 3), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Icon(Icons.check_circle_outline, size: 16, color: Brand.delta),
                    const SizedBox(width: 6),
                    Expanded(child: Text(tr(context, '${e['en']}', '${e['bn']}'), style: body(14))),
                  ])),
                  const SizedBox(height: 10),
                  BigButton(tr(context, 'Request help with ${skill['nameEn']}', '${skill['nameBn']}-এ সাহায্য চান'), onPressed: () => context.push('/request/${m['mentorId']}?skill=${widget.skillKey}&focus=${focus.isEmpty ? 'skill_gap' : focus}')),
                ]),
              ),
              Text('${d['note'] ?? ''}', textAlign: TextAlign.center, style: body(12, color: Brand.muted)),
            ])),
          ]);
        },
      ),
    );
  }
}

// ---------------------------------------------------------------- student: what mentors said
class MyReviewsScreen extends ConsumerWidget {
  const MyReviewsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(myReviewsProvider),
        onRetry: () => ref.invalidate(myReviewsProvider),
        builder: (d) {
          final list = ((d['reviews'] ?? []) as List).cast<Map>();
          String title(Map x) {
            if (x['kind'] == 'evidence') {
              return x['decision'] == 'endorse' ? tr(context, 'Endorsed your ${x['skillEn']} project', 'আপনার ${x['skillEn']} প্রজেক্ট এন্ডোর্স করেছেন') : tr(context, 'Asked for more work on ${x['skillEn']}', '${x['skillEn']}-এ আরও কাজ চেয়েছেন');
            }
            final a = x['action'];
            return a == 'prioritize' ? tr(context, 'Suggests doing "${x['topicKey']}" earlier', '"${x['topicKey']}" আগে করার পরামর্শ') : a == 'deprioritize' ? tr(context, 'Suggests leaving "${x['topicKey']}" for later', '"${x['topicKey']}" পরে করার পরামর্শ') : tr(context, 'Left a note on your ${x['targetKey']} path', '${x['targetKey']} পথে নোট রেখেছেন');
          }
          return ListView(padding: EdgeInsets.zero, children: [
            _loopHeader(context, tr(context, 'Mentor feedback', 'মেন্টর ফিডব্যাক'), tr(context, 'Reviews and roadmap advice from your mentors.', 'আপনার মেন্টরের রিভিউ ও রোডম্যাপ পরামর্শ।')),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (list.isEmpty) AppCard(child: Text(tr(context, 'No feedback yet. After a mentor accepts, ask them to review a project.', 'এখনও ফিডব্যাক নেই। মেন্টর গ্রহণ করলে প্রজেক্ট রিভিউ চান।'), style: body(16))),
              for (final x in list) AppCard(
                color: x['isNew'] == true ? const Color(0xFFF0F9F4) : Colors.white,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${x['mentor']}', style: body(14, color: Brand.muted, w: FontWeight.w700)),
                  Text(title(x), style: display(18, color: Brand.ink)),
                  if ('${x['note'] ?? ''}'.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text('“${x['note']}”', style: body(15))),
                ]),
              ),
            ])),
          ]);
        },
      ),
    );
  }
}

// ---------------------------------------------------------------- mentor: queue and review pack
class MentorReviewsScreen extends ConsumerWidget {
  const MentorReviewsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(reviewQueueProvider),
        onRetry: () => ref.invalidate(reviewQueueProvider),
        builder: (d) {
          final asks = ((d['reviews'] ?? []) as List).cast<Map>();
          final mentees = ((d['mentees'] ?? []) as List).cast<Map>();
          return ListView(padding: EdgeInsets.zero, children: [
            _loopHeader(context, tr(context, 'Reviews', 'রিভিউ'), tr(context, 'Check projects and guide the roadmap.', 'প্রজেক্ট দেখুন ও রোডম্যাপ গাইড করুন।')),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(tr(context, 'WAITING FOR YOUR REVIEW', 'আপনার রিভিউয়ের অপেক্ষায়'), style: body(12, color: Brand.muted, w: FontWeight.w800)),
              const SizedBox(height: 6),
              if (asks.isEmpty) AppCard(child: Text(tr(context, 'Nothing waiting.', 'কিছু অপেক্ষায় নেই।'), style: body(16))),
              for (final a in asks) AppCard(onTap: () => context.push('/mentor/mentee/${a['studentId']}'), child: Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${a['student']}', style: display(18, color: Brand.ink)),
                  Text('${nm(context, a, 'skillEn', 'skillBn')} · L${a['level']}', style: body(14, color: Brand.muted)),
                ])),
                const Icon(Icons.chevron_right, color: Brand.muted),
              ])),
              const SizedBox(height: 8),
              Text(tr(context, 'MY MENTEES', 'আমার মেন্টি'), style: body(12, color: Brand.muted, w: FontWeight.w800)),
              const SizedBox(height: 6),
              for (final m in mentees) AppCard(onTap: () => context.push('/mentor/mentee/${m['studentId']}'), child: Row(children: [
                Avatar('${m['name']}', size: 38, bg: Brand.lightGreen, fg: Brand.forest),
                const SizedBox(width: 10),
                Expanded(child: Text('${m['name']}', style: body(16, w: FontWeight.w700))),
                const Icon(Icons.chevron_right, color: Brand.muted),
              ])),
            ])),
          ]);
        },
      ),
    );
  }
}

class ReviewPackScreen extends ConsumerStatefulWidget {
  const ReviewPackScreen({super.key, required this.studentId});
  final String studentId;
  @override
  ConsumerState<ReviewPackScreen> createState() => _ReviewPackState();
}

class _ReviewPackState extends ConsumerState<ReviewPackScreen> {
  void _reload() {
    ref.invalidate(reviewPackProvider(widget.studentId));
    ref.invalidate(reviewQueueProvider);
  }

  Future<void> _review(Map e, String decision) async {
    final note = TextEditingController();
    int level = (e['level'] as num).toInt();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => StatefulBuilder(
        builder: (c, set) => AlertDialog(
          title: Text(decision == 'endorse' ? tr(context, 'Endorse this project', 'প্রজেক্ট এন্ডোর্স করুন') : tr(context, 'Ask for more work', 'আরও কাজ চান')),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            if (decision == 'endorse') DropdownButton<int>(
              value: level,
              isExpanded: true,
              items: const [DropdownMenuItem(value: 1, child: Text('Level 1')), DropdownMenuItem(value: 2, child: Text('Level 2')), DropdownMenuItem(value: 3, child: Text('Level 3'))],
              onChanged: (v) => set(() => level = v ?? level),
            ),
            TextField(controller: note, maxLength: 400, maxLines: 3, decoration: InputDecoration(labelText: tr(context, 'Feedback for the student', 'শিক্ষার্থীর জন্য ফিডব্যাক'))),
            if (decision == 'endorse') Text(tr(context, 'You can endorse only up to your own level in this skill.', 'এই স্কিলে নিজের লেভেল পর্যন্তই এন্ডোর্স করা যায়।'), style: body(12, color: Brand.muted)),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(context, 'Cancel', 'বাতিল'))),
            FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(tr(context, 'Send', 'পাঠান'))),
          ],
        ),
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(dioProvider).post('/mentees/${widget.studentId}/evidence/${e['id']}/review', data: {'decision': decision, if (decision == 'endorse') 'level': level, if (note.text.trim().isNotEmpty) 'note': note.text.trim()});
      _reload();
    } catch (err) {
      if (mounted) toast(context, errorText(err));
    }
  }

  Future<void> _advise(List targets) async {
    if (targets.isEmpty) {
      toast(context, tr(context, 'This student has not followed a target yet.', 'এই শিক্ষার্থী এখনও কোনো লক্ষ্য অনুসরণ করেননি।'));
      return;
    }
    Map t = targets.first as Map;
    String? topic;
    String action = 'prioritize';
    final note = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => StatefulBuilder(
        builder: (c, set) => AlertDialog(
          title: Text(tr(context, 'Roadmap advice', 'রোডম্যাপ পরামর্শ')),
          content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
            DropdownButton<Map>(
              value: t,
              isExpanded: true,
              items: [for (final x in targets.cast<Map>()) DropdownMenuItem(value: x, child: Text(nm(context, x, 'titleEn', 'titleBn')))],
              onChanged: (v) => set(() { t = v ?? t; topic = null; }),
            ),
            DropdownButton<String>(
              value: topic,
              isExpanded: true,
              hint: Text(tr(context, 'Topic (not needed for a note)', 'টপিক (নোটের জন্য লাগবে না)')),
              items: [for (final x in ((t['topics'] ?? []) as List).cast<Map>()) DropdownMenuItem(value: '${x['key']}', child: Text(nm(context, x, 'titleEn', 'titleBn'), overflow: TextOverflow.ellipsis))],
              onChanged: (v) => set(() => topic = v),
            ),
            DropdownButton<String>(
              value: action,
              isExpanded: true,
              items: [
                DropdownMenuItem(value: 'prioritize', child: Text(tr(context, 'Do this earlier', 'এটি আগে করুন'))),
                DropdownMenuItem(value: 'deprioritize', child: Text(tr(context, 'Leave this for later', 'এটি পরে করুন'))),
                DropdownMenuItem(value: 'note', child: Text(tr(context, 'Just a note', 'শুধু নোট'))),
              ],
              onChanged: (v) => set(() => action = v ?? action),
            ),
            TextField(controller: note, maxLength: 400, maxLines: 2, decoration: InputDecoration(labelText: tr(context, 'Why', 'কারণ'))),
            Text(tr(context, 'Advice changes the order and adds notes. It never changes a score.', 'পরামর্শ ক্রম ও নোট বদলায়। স্কোর বদলায় না।'), style: body(12, color: Brand.muted)),
          ])),
          actions: [
            TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(context, 'Cancel', 'বাতিল'))),
            FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(tr(context, 'Send', 'পাঠান'))),
          ],
        ),
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(dioProvider).post('/mentees/${widget.studentId}/advice', data: {'targetKey': t['key'], if (topic != null) 'topicKey': topic, 'action': action, if (note.text.trim().isNotEmpty) 'note': note.text.trim()});
      if (mounted) toast(context, tr(context, 'Advice sent.', 'পরামর্শ পাঠানো হয়েছে।'));
    } catch (err) {
      if (mounted) toast(context, errorText(err));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(reviewPackProvider(widget.studentId)),
        onRetry: _reload,
        builder: (d) {
          final st = (d['student'] ?? {}) as Map;
          final gaps = ((d['gaps'] ?? []) as List).cast<Map>();
          final ev = ((d['evidence'] ?? []) as List).cast<Map>();
          final hist = ((d['readinessHistory'] ?? []) as List).cast<Map>();
          final targets = ((d['targets'] ?? []) as List);
          final projects = ev.where((e) => e['type'] == 'project').toList();
          return ListView(padding: EdgeInsets.zero, children: [
            _loopHeader(context, '${st['name']}', '${st['department'] ?? ''}'),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              AppCard(child: Row(children: [
                _stat(context, tr(context, 'Readiness first', 'শুরুতে'), hist.isEmpty ? '–' : '${hist.first['percent']}%'),
                const Icon(Icons.arrow_forward, color: Brand.muted),
                _stat(context, tr(context, 'Readiness now', 'এখন'), hist.isEmpty ? '–' : '${hist.last['percent']}%'),
              ])),
              AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'GAPS', 'ঘাটতি'), style: body(12, color: Brand.muted, w: FontWeight.w800)),
                if (gaps.isEmpty) Text(tr(context, 'No gaps for the chosen goal.', 'নির্বাচিত লক্ষ্যে কোনো ঘাটতি নেই।'), style: body(15)),
                for (final g in gaps) Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Row(children: [
                  Expanded(child: Text(nm(context, g, 'nameEn', 'nameBn'), style: body(16, w: FontWeight.w600))),
                  Text('L${g['have']} / L${g['need']}', style: body(14, color: Brand.muted)),
                ])),
              ])),
              Text(tr(context, 'PROJECT EVIDENCE', 'প্রজেক্ট প্রমাণ'), style: body(12, color: Brand.muted, w: FontWeight.w800)),
              const SizedBox(height: 6),
              if (projects.isEmpty) AppCard(child: Text(tr(context, 'No projects yet.', 'এখনও কোনো প্রজেক্ট নেই।'), style: body(16))),
              for (final e in projects) AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text('${e['skillEn']} · L${e['level']}', style: display(18, color: Brand.ink))),
                  Pill('${e['reviewStatus']}'.replaceAll('_', ' '), tone: e['reviewStatus'] == 'endorsed' ? Tone.green : e['reviewStatus'] == 'requested' ? Tone.saffron : Tone.grey),
                ]),
                if (e['url'] != null) TextButton.icon(onPressed: () => launchUrl(Uri.parse('${e['url']}'), mode: LaunchMode.externalApplication), icon: const Icon(Icons.link, size: 18), label: Text('${e['url']}', overflow: TextOverflow.ellipsis)),
                Row(children: [
                  Expanded(child: OutlinedButton(onPressed: () => _review(e, 'needs_work'), child: Text(tr(context, 'Needs work', 'আরও কাজ লাগবে')))),
                  const SizedBox(width: 8),
                  Expanded(child: FilledButton(style: FilledButton.styleFrom(backgroundColor: Brand.delta), onPressed: () => _review(e, 'endorse'), child: Text(tr(context, 'Endorse', 'এন্ডোর্স')))),
                ]),
              ])),
              const SizedBox(height: 4),
              BigButton(tr(context, 'Give roadmap advice', 'রোডম্যাপ পরামর্শ দিন'), outlined: true, onPressed: () => _advise(targets)),
            ])),
          ]);
        },
      ),
    );
  }
}

// ---------------------------------------------------------------- admin: impact
class AdminImpactCard extends ConsumerWidget {
  const AdminImpactCard({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AsyncBody(
      value: ref.watch(adminImpactProvider),
      onRetry: () => ref.invalidate(adminImpactProvider),
      builder: (d) {
        final groups = ((d['groups'] ?? []) as List).cast<Map>();
        return ListView(padding: const EdgeInsets.all(16), children: [
          Text(tr(context, 'Does mentoring help?', 'মেন্টরিং কি কাজে লাগছে?'), style: display(20, color: Brand.ink)),
          Text(d['consentingStudents'] == null ? tr(context, 'Fewer than 5 students agreed to share, so nothing is shown.', '৫ জনের কম শিক্ষার্থী শেয়ার করতে রাজি, তাই কিছু দেখানো হচ্ছে না।') : '${d['consentingStudents']} ${tr(context, 'students agreed to share', 'জন শিক্ষার্থী শেয়ারে রাজি')}', style: body(14, color: Brand.muted)),
          const SizedBox(height: 10),
          for (final g in groups) AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${g['group']}', style: body(16, w: FontWeight.w800)),
            if (g['hidden'] != null) Text('${g['hidden']}', style: body(13, color: Brand.muted))
            else ...[
              Text('${g['students']} ${tr(context, 'students', 'জন')} · ${g['measuredStudents']} ${tr(context, 'measured', 'মাপা হয়েছে')}', style: body(14, color: Brand.muted)),
              Text('${tr(context, 'Median readiness change', 'প্রস্তুতির মধ্যমা পরিবর্তন')}: ${g['medianReadinessChange'] ?? '–'}', style: body(15)),
              Text('${tr(context, 'Reached an interview', 'ইন্টারভিউ পেয়েছে')}: ${g['interviewRate'] == null ? '–' : '${g['interviewRate']}%'}', style: body(15)),
            ],
          ])),
          AppCard(color: Brand.lightSaffron, border: Colors.transparent, child: Text('${d['caveat'] ?? ''}', style: body(13, color: const Color(0xFF5A3600)))),
        ]);
      },
    );
  }
}

final loopRoutes = <RouteBase>[
  GoRoute(path: '/admin-impact', builder: (context, state) => Scaffold(appBar: AppBar(title: Text(tr(context, 'Impact', 'প্রভাব'))), body: const AdminImpactCard())),
  GoRoute(path: '/outcome-tracker', builder: (_, __) => const OutcomeTrackerScreen()),
  GoRoute(path: '/my-reviews', builder: (_, __) => const MyReviewsScreen()),
  GoRoute(path: '/gap/:skillKey/mentors', builder: (_, s) => GapMentorsScreen(skillKey: s.pathParameters['skillKey']!)),
  GoRoute(path: '/mentor/reviews', builder: (_, __) => const MentorReviewsScreen()),
  GoRoute(path: '/mentor/mentee/:id', builder: (_, s) => ReviewPackScreen(studentId: s.pathParameters['id']!)),
];
