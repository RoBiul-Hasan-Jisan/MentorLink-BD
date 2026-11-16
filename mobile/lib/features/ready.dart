import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// Job-readiness path: one clear route from "pick a target" to "apply with proof".
//   /ready               checklist, next step, top gaps, weekly plan, success stories
//   /interview-practice  role questions, self-rating, then ask a mentor
//   /ready-jobs          jobs you can apply to now / jobs you are 1-2 skills away from
// The server decides everything shown here (GET /me/ready-path, /me/interview-practice, /me/ready-jobs, /stories).
final readyPathProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/ready-path'));
final interviewPracticeProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/interview-practice'));
final readyJobsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/ready-jobs'));
final storiesProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/stories'));
final storySharingProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/story-sharing'));

/// Home card: "Your next step" with the checklist percentage. Hides itself when the student has no goal yet
/// (the readiness ring above already asks for one) or when the server cannot be reached.
class NextStepCard extends ConsumerWidget {
  const NextStepCard({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = ref.watch(readyPathProvider).valueOrNull;
    if (d == null || d['target'] == null) return const SizedBox();
    final next = (d['nextStep'] ?? {}) as Map;
    final cl = (d['checklist'] ?? {}) as Map;
    return AppCard(
      color: Brand.lightSaffron, border: Colors.transparent, onTap: () => context.push('/ready'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(tr(context, 'YOUR NEXT STEP', 'আপনার পরের ধাপ'), style: body(12, color: Brand.deep, w: FontWeight.w800))),
          Pill('${cl['done'] ?? 0}/${cl['total'] ?? 5} ${tr(context, 'job-ready', 'প্রস্তুত')}', tone: Tone.saffron),
        ]),
        const SizedBox(height: 6),
        Text(nm(context, next, 'titleEn', 'titleBn'), style: body(16, w: FontWeight.w700, color: Brand.ink)),
        const SizedBox(height: 10),
        ProgressBar(((cl['percent'] ?? 0) as num) / 100),
      ]),
    );
  }
}

Future<void> _openFree(BuildContext context, String? url) async {
  final u = Uri.tryParse(url ?? '');
  if (u == null || u.scheme != 'https') { toast(context, tr(context, 'This link is not a secure https link, so it was not opened.', 'এই লিংকটি নিরাপদ https নয়, তাই খোলা হয়নি।')); return; }
  var ok = false;
  try { ok = await launchUrl(u, mode: LaunchMode.externalApplication); } catch (_) { ok = false; }
  if (!ok && context.mounted) toast(context, tr(context, 'Could not open the link.', 'লিংক খোলা যায়নি।'));
}

class ReadyPathScreen extends ConsumerWidget {
  const ReadyPathScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(readyPathProvider),
        onRetry: () => ref.invalidate(readyPathProvider),
        builder: (d) {
          final target = d['target'] as Map?;
          final cl = (d['checklist'] ?? {}) as Map;
          final items = ((cl['items'] ?? []) as List).cast<Map>();
          final gaps = ((d['topGaps'] ?? []) as List).cast<Map>();
          final plan = (d['weeklyPlan'] ?? {}) as Map;
          final tasks = ((plan['tasks'] ?? []) as List).cast<Map>();
          final next = (d['nextStep'] ?? {}) as Map;
          return ListView(padding: EdgeInsets.zero, children: [
            GreenHeader(radius: 36, bottomPad: 26, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              BackCircle(dark: true, onTap: () => context.pop()),
              const SizedBox(height: 12),
              Text(tr(context, 'Get job-ready', 'চাকরির জন্য প্রস্তুত হোন'), style: display(28, color: Colors.white)),
              if (target != null) Text('${nm(context, target, 'titleEn', 'titleBn')} · ${tr(context, 'you are', 'আপনি')} ${d['readiness']}% ${tr(context, 'ready', 'প্রস্তুত')}', style: body(15, color: Colors.white70)),
            ])),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              if (target == null) AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'Pick a target role first. Every step below points at it.', 'আগে একটি লক্ষ্য পদ বেছে নিন। নিচের প্রতিটি ধাপ সেদিকেই যাবে।'), style: body(16)),
                const SizedBox(height: 10),
                BigButton(tr(context, 'Set your career goal', 'আপনার ক্যারিয়ার লক্ষ্য ঠিক করুন'), onPressed: () => context.push('/goal')),
              ])),
              if (target != null) AppCard(color: Brand.lightSaffron, border: Colors.transparent, onTap: () => context.push((next['route'] ?? '/ready') as String), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'YOUR NEXT STEP', 'আপনার পরের ধাপ'), style: body(12, color: Brand.deep, w: FontWeight.w800)),
                const SizedBox(height: 6),
                Text(nm(context, next, 'titleEn', 'titleBn'), style: body(17, w: FontWeight.w700, color: Brand.ink)),
              ])),
              // ---- checklist ----
              AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(tr(context, 'Job-ready checklist', 'চাকরি-প্রস্তুতি চেকলিস্ট'), style: display(20, color: Brand.ink))),
                  Pill('${cl['done'] ?? 0}/${cl['total'] ?? 5}', tone: cl['complete'] == true ? Tone.green : Tone.saffron),
                ]),
                const SizedBox(height: 8),
                ProgressBar(((cl['percent'] ?? 0) as num) / 100),
                const SizedBox(height: 6),
                for (final i in items) InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () => context.push(i['route'] as String),
                  child: Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Icon(i['done'] == true ? Icons.check_circle : Icons.radio_button_unchecked, color: i['done'] == true ? Brand.delta : Brand.muted),
                    const SizedBox(width: 10),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Expanded(child: Text(nm(context, i, 'en', 'bn'), style: body(16, w: FontWeight.w700, color: Brand.ink))),
                        if (i['done'] != true && i['progress'] != null) Text('${i['progress']}', style: body(13, color: Brand.muted)),
                      ]),
                      if (i['done'] != true) Text(nm(context, i, 'hintEn', 'hintBn'), style: body(13, color: Brand.muted)),
                    ])),
                    Icon(Icons.chevron_right, color: Brand.muted),
                  ])),
                ),
              ])),
              // ---- top gaps ----
              if (gaps.isNotEmpty) AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'Your 3 biggest gaps', 'আপনার ৩টি বড় ঘাটতি'), style: display(20, color: Brand.ink)),
                Text(tr(context, 'In the order that moves your readiness most', 'যে ক্রমে প্রস্তুতি সবচেয়ে বেশি বাড়ে'), style: body(13, color: Brand.muted)),
                const SizedBox(height: 6),
                for (var n = 0; n < gaps.length; n++) Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Row(children: [
                  CircleAvatar(radius: 14, backgroundColor: Brand.lightGreen, child: Text('${n + 1}', style: body(14, w: FontWeight.w800, color: Brand.forest))),
                  const SizedBox(width: 10),
                  Expanded(child: Text(nm(context, gaps[n], 'nameEn', 'nameBn'), style: body(16, w: FontWeight.w700))),
                  Text('${tr(context, 'level', 'লেভেল')} ${gaps[n]['current']} → ${gaps[n]['required']}', style: body(13, color: Brand.muted)),
                ])),
              ])),
              // ---- weekly plan ----
              if (tasks.isNotEmpty) AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'This week: ${tasks.length} small tasks', 'এই সপ্তাহ: ${tasks.length}টি ছোট কাজ'), style: display(20, color: Brand.ink)),
                Text(tr(context, 'About ${plan['minutes']} minutes in total. Each ends in proof.', 'মোট প্রায় ${plan['minutes']} মিনিট। প্রতিটি শেষ হয় প্রমাণে।'), style: body(13, color: Brand.muted)),
                const SizedBox(height: 8),
                for (final t in tasks) Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(nm(context, t, 'titleEn', 'titleBn'), style: body(16, w: FontWeight.w700))),
                    Pill('${t['minutes']} ${tr(context, 'min', 'মি.')}', tone: Tone.grey),
                  ]),
                  const SizedBox(height: 6),
                  Wrap(spacing: 8, runSpacing: 4, children: [
                    if (t['resource'] is Map) ActionChip(
                      avatar: const Icon(Icons.open_in_new, size: 16),
                      label: Text('${(t['resource'] as Map)['title']} · ${tr(context, 'free', 'বিনামূল্যে')}', overflow: TextOverflow.ellipsis),
                      onPressed: () => _openFree(context, (t['resource'] as Map)['url'] as String?),
                    ) else ActionChip(avatar: const Icon(Icons.menu_book_outlined, size: 16), label: Text(tr(context, 'Open roadmap', 'রোডম্যাপ খুলুন')), onPressed: () => context.push('/roadmap/${t['skillKey']}')),
                    ActionChip(
                      avatar: Icon(t['proof'] == 'quiz' ? Icons.quiz_outlined : Icons.folder_special_outlined, size: 16),
                      label: Text(t['proof'] == 'quiz' ? tr(context, 'Prove it: quiz', 'প্রমাণ: কুইজ') : tr(context, 'Prove it: project', 'প্রমাণ: প্রজেক্ট')),
                      onPressed: () => context.push(t['proofRoute'] as String),
                    ),
                  ]),
                ])),
              ])),
              Row(children: [
                Expanded(child: BigButton(tr(context, 'Practise interviews', 'ইন্টারভিউ অনুশীলন'), outlined: true, onPressed: () => context.push('/interview-practice'))),
                const SizedBox(width: 10),
                Expanded(child: BigButton(tr(context, 'Jobs for me', 'আমার জন্য চাকরি'), onPressed: () => context.push('/ready-jobs'))),
              ]),
              const SizedBox(height: 16),
              const _StoriesCard(),
              const _StorySwitch(),
              Padding(padding: const EdgeInsets.only(top: 4), child: Text('${d['note'] ?? ''}', style: body(12, color: Brand.muted))),
            ])),
          ]);
        },
      ),
    );
  }
}

class _StoriesCard extends ConsumerWidget {
  const _StoriesCard();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = ref.watch(storiesProvider).valueOrNull;
    if (d == null) return const SizedBox();
    final stories = ((d['stories'] ?? []) as List).cast<Map>();
    if (stories.isEmpty) return const SizedBox(); // never show invented stories; the server hides them until enough students agreed
    return AppCard(color: Brand.lightGreen, border: Colors.transparent, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(tr(context, 'Students like you got hired', 'আপনার মতো শিক্ষার্থীরা চাকরি পেয়েছেন'), style: display(19, color: Brand.ink)),
      const SizedBox(height: 6),
      for (final s in stories.take(3)) Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(Icons.trending_up, color: Brand.delta), const SizedBox(width: 8),
        Expanded(child: Text(nm(context, s, 'en', 'bn'), style: body(15))),
      ])),
      Text(tr(context, 'Real, anonymous, shared with permission.', 'আসল, নামহীন, অনুমতি নিয়ে প্রকাশিত।'), style: body(12, color: Brand.muted)),
    ]));
  }
}

class _StorySwitch extends ConsumerWidget {
  const _StorySwitch();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final on = ref.watch(storySharingProvider).valueOrNull?['on'] == true;
    return SwitchListTile(
      contentPadding: EdgeInsets.zero, value: on,
      title: Text(tr(context, 'Share my journey as an anonymous story if I get hired', 'চাকরি পেলে আমার যাত্রা নামহীন গল্প হিসেবে শেয়ার করুন'), style: body(14)),
      subtitle: Text(tr(context, 'Only "from X% to hired in N months" and the role. No name, no university. Off by default.', 'শুধু "X% থেকে N মাসে চাকরি" ও পদ। নাম বা বিশ্ববিদ্যালয় নয়। শুরুতে বন্ধ।'), style: body(12, color: Brand.muted)),
      onChanged: (v) async {
        try { await ref.read(dioProvider).put('/me/story-sharing', data: {'on': v}); ref.invalidate(storySharingProvider); }
        catch (e) { if (context.mounted) toast(context, errorText(e)); }
      },
    );
  }
}

// ------------------------------------------------------------------ interview practice
class InterviewPracticeScreen extends ConsumerWidget {
  const InterviewPracticeScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(interviewPracticeProvider),
        onRetry: () => ref.invalidate(interviewPracticeProvider),
        builder: (d) {
          final qs = ((d['questions'] ?? []) as List).cast<Map>();
          final s = (d['summary'] ?? {}) as Map;
          final tips = ((d['tips'] ?? []) as List).cast<String>();
          return ListView(padding: EdgeInsets.zero, children: [
            GreenHeader(radius: 36, bottomPad: 26, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              BackCircle(dark: true, onTap: () => context.pop()),
              const SizedBox(height: 12),
              Text(tr(context, 'Interview practice', 'ইন্টারভিউ অনুশীলন'), style: display(28, color: Colors.white)),
              Text('${nm(context, d, 'roleTitleEn', 'roleTitleBn')} · ${s['answered'] ?? 0}/${s['total'] ?? qs.length} ${tr(context, 'practised', 'অনুশীলিত')}${s['average'] != null ? ' · ${tr(context, 'average', 'গড়')} ${s['average']}/5' : ''}', style: body(15, color: Colors.white70)),
            ])),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              AppCard(color: Brand.lightSaffron, border: Colors.transparent, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                for (final t in tips) Padding(padding: const EdgeInsets.symmetric(vertical: 2), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('• '), Expanded(child: Text(t, style: body(14)))])),
              ])),
              for (final q in qs) _QuestionTile(question: q),
              const SizedBox(height: 4),
              BigButton(tr(context, 'Book a real mock interview with a mentor', 'মেন্টরের সাথে আসল মক ইন্টারভিউ বুক করুন'), onPressed: () => context.push('/mock-interviews')),
              const SizedBox(height: 8),
              BigButton(tr(context, 'Ask a mentor to review my practice', 'মেন্টরকে আমার অনুশীলন দেখতে বলুন'), outlined: true, onPressed: () => _askMentor(context, ref)),
            ])),
          ]);
        },
      ),
    );
  }

  // Only mentors who accepted this student can be asked (the server checks it again).
  Future<void> _askMentor(BuildContext context, WidgetRef ref) async {
    try {
      final reqs = (((await ref.read(dioProvider).get('/requests')).data as Map)['requests'] as List? ?? const []).whereType<Map>().where((r) => r['status'] == 'accepted').toList();
      if (reqs.isEmpty) { if (context.mounted) toast(context, tr(context, 'No mentor has accepted you yet. Request a mentor first.', 'এখনও কোনো মেন্টর আপনাকে গ্রহণ করেননি। আগে মেন্টর অনুরোধ করুন।')); return; }
      final r = reqs.first;
      final id = (r['mentorId'] is Map ? r['mentorId']['_id'] : r['mentorId']).toString();
      await ref.read(dioProvider).post('/me/interview-practice/request-feedback', data: {'mentorId': id});
      if (context.mounted) toast(context, tr(context, 'Your mentor was told.', 'আপনার মেন্টরকে জানানো হয়েছে।'));
    } catch (e) {
      if (context.mounted) toast(context, errorText(e));
    }
  }
}

class _QuestionTile extends ConsumerStatefulWidget {
  const _QuestionTile({required this.question});
  final Map question;
  @override
  ConsumerState<_QuestionTile> createState() => _QuestionTileState();
}

class _QuestionTileState extends ConsumerState<_QuestionTile> {
  late final TextEditingController _note = TextEditingController(text: (widget.question['myNote'] ?? '') as String);
  int? _rating;
  bool _saving = false;
  @override
  void initState() { super.initState(); _rating = widget.question['myRating'] as int?; }
  @override
  void dispose() { _note.dispose(); super.dispose(); }

  Future<void> _save() async {
    if (_rating == null) return;
    setState(() => _saving = true);
    try {
      await ref.read(dioProvider).post('/me/interview-practice', data: {'questionId': widget.question['id'], 'rating': _rating, if (_note.text.trim().isNotEmpty) 'note': _note.text.trim()});
      ref.invalidate(readyPathProvider);
      if (mounted) toast(context, tr(context, 'Saved.', 'সংরক্ষিত।'));
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = widget.question;
    final done = q['myRating'] != null;
    return AppCard(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), child: Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 12),
        leading: Icon(done ? Icons.check_circle : Icons.mic_none, color: done ? Brand.delta : Brand.muted),
        title: Text(nm(context, q, 'en', 'bn'), style: body(16, w: FontWeight.w700)),
        subtitle: done ? Text('${tr(context, 'Your rating', 'আপনার রেটিং')}: ${q['myRating']}/5', style: body(13, color: Brand.muted)) : null,
        childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        children: [
          Text(tr(context, 'Say your answer out loud, then rate how it went.', 'জোরে উত্তর বলুন, তারপর কেমন হলো রেটিং দিন।'), style: body(13, color: Brand.muted)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, children: [for (var n = 1; n <= 5; n++) ChoiceChip(label: Text('$n'), selected: _rating == n, onSelected: (_) => setState(() => _rating = n))]),
          const SizedBox(height: 8),
          TextField(controller: _note, maxLines: 3, maxLength: 1000, decoration: InputDecoration(hintText: tr(context, 'Optional: key points you want to remember', 'ঐচ্ছিক: মনে রাখার মূল পয়েন্ট'), border: const OutlineInputBorder())),
          Align(alignment: Alignment.centerRight, child: FilledButton(onPressed: _rating == null || _saving ? null : _save, child: Text(tr(context, 'Save', 'সংরক্ষণ')))),
        ],
      ),
    ));
  }
}

// ------------------------------------------------------------------ ranked jobs
class ReadyJobsScreen extends ConsumerWidget {
  const ReadyJobsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(readyJobsProvider),
        onRetry: () => ref.invalidate(readyJobsProvider),
        builder: (d) {
          final now = ((d['applyNow'] ?? []) as List).cast<Map>();
          final almost = ((d['almostThere'] ?? []) as List).cast<Map>();
          return ListView(padding: EdgeInsets.zero, children: [
            GreenHeader(radius: 36, bottomPad: 26, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              BackCircle(dark: true, onTap: () => context.pop()),
              const SizedBox(height: 12),
              Text(tr(context, 'Jobs for you', 'আপনার জন্য চাকরি'), style: display(28, color: Colors.white)),
              Text(tr(context, 'Ranked by what you can prove today', 'আজ যা প্রমাণ করতে পারেন সে অনুযায়ী সাজানো'), style: body(15, color: Colors.white70)),
            ])),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text(tr(context, 'Jobs you can apply to now (${now.length})', 'এখনই আবেদন করা যায় (${now.length})'), style: display(20, color: Brand.ink)),
              const SizedBox(height: 8),
              if (now.isEmpty) AppCard(child: Text(tr(context, 'None yet. Prove more skills with quizzes and projects, or look at the jobs below.', 'এখনও নেই। কুইজ ও প্রজেক্টে আরও দক্ষতা প্রমাণ করুন, অথবা নিচের চাকরিগুলো দেখুন।'), style: body(15))),
              for (final j in now) _JobCard(job: j, almost: false),
              const SizedBox(height: 10),
              Text(tr(context, 'Almost there: 1–2 skills away (${almost.length})', 'প্রায় তৈরি: ১–২টি দক্ষতা বাকি (${almost.length})'), style: display(20, color: Brand.ink)),
              const SizedBox(height: 8),
              if (almost.isEmpty) AppCard(child: Text(tr(context, 'No jobs are 1–2 skills away right now.', 'এখন ১–২টি দক্ষতা দূরে এমন চাকরি নেই।'), style: body(15))),
              for (final j in almost) _JobCard(job: j, almost: true),
              Text('${d['note'] ?? ''}', style: body(12, color: Brand.muted)),
            ])),
          ]);
        },
      ),
    );
  }
}

class _JobCard extends ConsumerWidget {
  const _JobCard({required this.job, required this.almost});
  final Map job; final bool almost;

  // One tap: the latest CV and the same sharing choices as last time. The student still ticks consent every time.
  Future<void> _quickApply(BuildContext context, WidgetRef ref) async {
    try {
      final defaults = (await ref.read(dioProvider).get('/me/apply-defaults')).data as Map;
      if (defaults['cvVersionId'] == null) { if (context.mounted) { toast(context, tr(context, 'Build a CV first, then apply with one tap.', 'আগে সিভি বানান, তারপর এক ট্যাপে আবেদন করুন।')); context.push('/cv'); } return; }
      if (!context.mounted) return;
      final shared = ((defaults['sharedFields'] ?? ['name', 'cv', 'skills']) as List).join(', ');
      final yes = await showDialog<bool>(context: context, builder: (c) => AlertDialog(
        title: Text(tr(context, 'Apply with your latest CV?', 'সর্বশেষ সিভি দিয়ে আবেদন করবেন?')),
        content: Text(tr(context, 'The employer will see: $shared. You agree to share this with ${job['organization'] ?? 'the company'} for "${job['title']}".', 'নিয়োগদাতা দেখবেন: $shared। "${job['title']}" পদের জন্য ${job['organization'] ?? 'কোম্পানি'}-কে এটি শেয়ার করতে সম্মত হচ্ছেন।')),
        actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(context, 'Cancel', 'বাতিল'))), FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(tr(context, 'I agree, apply', 'সম্মত, আবেদন করুন')))],
      ));
      if (yes != true) return;
      await ref.read(dioProvider).post('/opportunities/${job['id']}/apply', data: {'consent': true, 'sharedFields': defaults['sharedFields'] ?? ['name', 'cv', 'skills']});
      ref.invalidate(readyJobsProvider); ref.invalidate(applicationsProvider); ref.invalidate(readyPathProvider);
      if (context.mounted) toast(context, tr(context, 'Applied. Track it in My applications.', 'আবেদন হয়েছে। "আমার আবেদন" এ দেখুন।'));
    } catch (e) {
      if (context.mounted) toast(context, errorText(e));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final missing = ((job['missing'] ?? []) as List).cast<Map>();
    return AppCard(onTap: () => context.push('/opportunity/${job['id']}'), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Expanded(child: Text('${job['title']}', style: display(18, color: Brand.ink))),
        if (job['fit'] != null) Pill('${job['fit']}%', tone: almost ? Tone.saffron : Tone.green),
      ]),
      Text('${job['organization'] ?? ''}${(job['locationText'] ?? '') != '' ? ' · ${job['locationText']}' : ''}', style: body(14, color: Brand.muted)),
      if (almost) ...[
        const SizedBox(height: 8),
        Text(tr(context, 'Missing:', 'যা বাকি:'), style: body(13, w: FontWeight.w700, color: Brand.deep)),
        for (final m in missing) Row(children: [
          Expanded(child: Text('${nm(context, m, 'nameEn', 'nameBn')} · ${tr(context, 'level', 'লেভেল')} ${m['have']} → ${m['need']}', style: body(14))),
          TextButton(onPressed: () => context.push(m['learnRoute'] as String), child: Text(tr(context, 'Learn', 'শিখুন'))),
        ]),
      ] else Padding(padding: const EdgeInsets.only(top: 8), child: Row(children: [
        Expanded(child: job['hasScreeningQuestions'] == true
            ? OutlinedButton(onPressed: () => context.push('/opportunity/${job['id']}'), child: Text(tr(context, 'Answer questions & apply', 'প্রশ্নের উত্তর দিয়ে আবেদন')))
            : FilledButton(onPressed: () => _quickApply(context, ref), child: Text(tr(context, 'Apply in one tap', 'এক ট্যাপে আবেদন')))),
      ])),
    ]));
  }
}

final readyRoutes = <RouteBase>[
  GoRoute(path: '/ready', builder: (_, __) => const ReadyPathScreen()),
  GoRoute(path: '/interview-practice', builder: (_, __) => const InterviewPracticeScreen()),
  GoRoute(path: '/ready-jobs', builder: (_, __) => const ReadyJobsScreen()),
];