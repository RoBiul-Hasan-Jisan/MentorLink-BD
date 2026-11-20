import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// Four career tools added together:
//   /actions                 Career Action Center: ranked "do this next, because ..." list   (GET /me/actions)
//   /tracker                 Application tracker board: saved, applied, interview, offer, done (GET /me/tracker)
//   /my-practice-feedback    what mentors said about my interview practice                   (GET /me/practice-feedback)
//   /mentor/practice         mentor inbox: score a student's interview practice              (GET /mentor/practice-requests)
//   /employer/analytics      recruiter: hiring funnel, reply and hire times                   (GET /employer/analytics)
// The server decides everything shown here. These screens only draw it.
final actionsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/actions'));
final trackerProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/tracker'));
final practiceFeedbackProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/practice-feedback'));
final mentorPracticeProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/mentor/practice-requests'));
final employerAnalyticsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/employer/analytics'));

Widget _screenHeader(BuildContext context, String title, {String? sub}) => GreenHeader(radius: 36, bottomPad: 26, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      BackCircle(dark: true, onTap: () => context.pop()),
      const SizedBox(height: 12),
      Text(title, style: display(28, color: Colors.white)),
      if (sub != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(sub, style: body(15, color: Colors.white70))),
    ]));

// ------------------------------------------------------------------ 1. Career Action Center
/// Home card. Shows the top 3 actions with the reason for each. Hides itself when there is nothing to do or the server cannot be reached.
class ActionCenterCard extends ConsumerWidget {
  const ActionCenterCard({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = ref.watch(actionsProvider).valueOrNull;
    if (d == null) return const SizedBox();
    final all = ((d['actions'] ?? []) as List).cast<Map>();
    if (all.isEmpty) return const SizedBox();
    final shown = all.take(3).toList();
    final total = (d['total'] ?? all.length) as int;
    return AppCard(
      color: Colors.white, padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(tr(context, 'DO THIS NEXT', 'এখন এটি করুন'), style: body(12, color: Brand.deep, w: FontWeight.w800))),
          if (d['hasUrgent'] == true) Pill(tr(context, 'Urgent', 'জরুরি'), tone: Tone.red),
          InkWell(onTap: () => context.push('/actions'), child: Padding(padding: const EdgeInsets.only(left: 10), child: Text(total > shown.length ? tr(context, 'See all $total', 'সব $total টি দেখুন') : tr(context, 'Open', 'খুলুন'), style: body(14, color: Brand.delta, w: FontWeight.w700)))),
        ]),
        const SizedBox(height: 6),
        for (final a in shown) _ActionRow(a: a),
      ]),
    );
  }
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({required this.a, this.showReason = true});
  final Map a;
  final bool showReason;
  @override
  Widget build(BuildContext context) {
    final urgent = a['urgent'] == true;
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => context.push('${a['route']}'),
      child: Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(urgent ? Icons.priority_high : Icons.arrow_circle_right_outlined, color: urgent ? const Color(0xFFC62828) : Brand.delta),
        const SizedBox(width: 10),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(nm(context, a, 'titleEn', 'titleBn'), style: body(16, w: FontWeight.w700, color: Brand.ink)),
          if (showReason) Text(nm(context, a, 'reasonEn', 'reasonBn'), style: body(13, color: Brand.muted)),
        ])),
        Icon(Icons.chevron_right, color: Brand.muted),
      ])),
    );
  }
}

class ActionCenterScreen extends ConsumerWidget {
  const ActionCenterScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(actionsProvider),
        onRetry: () => ref.invalidate(actionsProvider),
        builder: (d) {
          final list = ((d['actions'] ?? []) as List).cast<Map>();
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(actionsProvider),
            child: ListView(padding: EdgeInsets.zero, children: [
              _screenHeader(context, tr(context, 'Career Action Center', 'ক্যারিয়ার অ্যাকশন সেন্টার'), sub: tr(context, 'The most useful things to do now, and why', 'এখন সবচেয়ে কাজের কাজগুলো, আর কেন')),
              Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                if (list.isEmpty) AppCard(child: Row(children: [
                  Icon(Icons.check_circle, color: Brand.delta), const SizedBox(width: 10),
                  Expanded(child: Text(tr(context, 'You are all caught up. Nothing is waiting for you right now.', 'সব ঠিক আছে। এখন আপনার জন্য কিছু অপেক্ষা করছে না।'), style: body(16, w: FontWeight.w600))),
                ])),
                for (final a in list) AppCard(child: _ActionRow(a: a)),
                const SizedBox(height: 4),
                Text('${d['note'] ?? ''}', style: body(12, color: Brand.muted)),
                const SizedBox(height: 12),
                BigButton(tr(context, 'Application tracker', 'আবেদন ট্র্যাকার'), outlined: true, onPressed: () => context.push('/tracker')),
              ])),
            ]),
          );
        },
      ),
    );
  }
}

// ------------------------------------------------------------------ 2. Application tracker
IconData _colIcon(String k) {
  switch (k) {
    case 'saved': return Icons.bookmark_border;
    case 'applied': return Icons.send_outlined;
    case 'interview': return Icons.record_voice_over_outlined;
    case 'offer': return Icons.local_offer_outlined;
    default: return Icons.flag_outlined;
  }
}

String _colName(BuildContext c, String k) {
  switch (k) {
    case 'saved': return tr(c, 'Saved', 'সংরক্ষিত');
    case 'applied': return tr(c, 'Applied', 'আবেদন করেছি');
    case 'interview': return tr(c, 'Interview', 'ইন্টারভিউ');
    case 'offer': return tr(c, 'Offer', 'অফার');
    default: return tr(c, 'Finished', 'শেষ');
  }
}

class TrackerScreen extends ConsumerWidget {
  const TrackerScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(trackerProvider),
        onRetry: () => ref.invalidate(trackerProvider),
        builder: (d) {
          final cols = ((d['columns'] ?? []) as List).cast<Map>();
          final stale = (d['staleCount'] ?? 0) as int;
          final total = (d['total'] ?? 0) as int;
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(trackerProvider),
            child: ListView(padding: EdgeInsets.zero, children: [
              _screenHeader(context, tr(context, 'Application tracker', 'আবেদন ট্র্যাকার'), sub: tr(context, '$total jobs on your board', 'আপনার বোর্ডে $total টি চাকরি')),
              Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                if (stale > 0) AppCard(color: const Color(0xFFFDECEC), border: Colors.transparent, child: Row(children: [
                  const Icon(Icons.hourglass_bottom, color: Color(0xFFC62828)), const SizedBox(width: 10),
                  Expanded(child: Text(tr(context, '$stale application(s) have had no reply for ${d['staleDays'] ?? 7}+ days. Message the employer politely or apply to a similar job.', '$stale টি আবেদনে ${d['staleDays'] ?? 7}+ দিন ধরে উত্তর নেই। নিয়োগকর্তাকে ভদ্রভাবে বার্তা দিন বা অনুরূপ চাকরিতে আবেদন করুন।'), style: body(14, w: FontWeight.w600))),
                ])),
                if (total == 0) EmptyState(icon: Icons.work_outline, title: tr(context, 'Nothing here yet', 'এখনও কিছু নেই'), subtitle: tr(context, 'Save or apply to a job and it appears on this board.', 'চাকরি সংরক্ষণ বা আবেদন করলে এখানে দেখা যাবে।'), actionLabel: tr(context, 'Find jobs', 'চাকরি খুঁজুন'), onAction: () => context.push('/ready-jobs')),
                for (final c in cols) if (((c['cards'] ?? []) as List).isNotEmpty) ...[
                  Padding(padding: const EdgeInsets.fromLTRB(2, 10, 2, 8), child: Row(children: [
                    Icon(_colIcon('${c['key']}'), color: Brand.delta), const SizedBox(width: 8),
                    Expanded(child: Text(_colName(context, '${c['key']}'), style: display(19, color: Brand.ink))),
                    Pill('${c['count']}', tone: Tone.grey),
                  ])),
                  for (final card in ((c['cards'] ?? []) as List).cast<Map>()) _TrackerCard(card: card, col: '${c['key']}'),
                ],
              ])),
            ]),
          );
        },
      ),
    );
  }
}

class _TrackerCard extends StatelessWidget {
  const _TrackerCard({required this.card, required this.col});
  final Map card;
  final String col;
  @override
  Widget build(BuildContext context) {
    final stale = card['stale'] == true;
    final outcome = card['outcome'];
    return AppCard(
      padding: const EdgeInsets.all(14), border: stale ? const Color(0xFFC62828) : null,
      onTap: () => context.push('${card['route']}'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('${card['title']}', style: display(17, color: Brand.ink)),
        if ('${card['organization'] ?? ''}'.isNotEmpty) Text('${card['organization']}', style: body(14, color: Brand.muted)),
        const SizedBox(height: 8),
        Wrap(spacing: 6, runSpacing: 4, children: [
          if (col == 'saved' && card['daysLeft'] != null) Pill(tr(context, '${card['daysLeft']} day(s) left', '${card['daysLeft']} দিন বাকি'), tone: card['closingSoon'] == true ? Tone.red : Tone.grey),
          if (col == 'saved' && card['daysLeft'] == null) Pill(tr(context, 'No deadline', 'শেষ তারিখ নেই'), tone: Tone.grey),
          if (col != 'saved' && card['stage'] != null) Pill('${card['stage']}', tone: outcome == 'hired' ? Tone.green : outcome == 'rejected' ? Tone.red : Tone.blue),
          if (stale) Pill(tr(context, 'No reply · ${card['daysWaiting']} days', 'উত্তর নেই · ${card['daysWaiting']} দিন'), tone: Tone.red),
          if (!stale && col != 'saved' && card['daysWaiting'] != null && card['outcome'] == null) Pill(tr(context, 'Updated ${card['daysWaiting']} d ago', '${card['daysWaiting']} দিন আগে আপডেট'), tone: Tone.grey),
        ]),
      ]),
    );
  }
}

// ------------------------------------------------------------------ 3. Mock-interview practice feedback
/// Student: what mentors said about my interview practice.
class MyPracticeFeedbackScreen extends ConsumerWidget {
  const MyPracticeFeedbackScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(practiceFeedbackProvider),
        onRetry: () => ref.invalidate(practiceFeedbackProvider),
        builder: (d) {
          final list = ((d['feedback'] ?? []) as List).cast<Map>();
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(practiceFeedbackProvider),
            child: ListView(padding: EdgeInsets.zero, children: [
              _screenHeader(context, tr(context, 'Practice feedback', 'অনুশীলনের মতামত'), sub: tr(context, 'What your mentors said about your interview practice', 'ইন্টারভিউ অনুশীলন নিয়ে মেন্টরদের মতামত')),
              Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                if (list.isEmpty) EmptyState(icon: Icons.mic_none, title: tr(context, 'No feedback yet', 'এখনও কোনো মতামত নেই'), subtitle: tr(context, 'Practise a few questions, then ask a mentor to score them.', 'কয়েকটি প্রশ্ন অনুশীলন করে মেন্টরকে স্কোর দিতে বলুন।'), actionLabel: tr(context, 'Practise now', 'এখন অনুশীলন করুন'), onAction: () => context.push('/interview-practice')),
                for (final f in list) AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text('${f['mentor'] ?? ''}'.isEmpty ? tr(context, 'Mentor', 'মেন্টর') : '${f['mentor']}', style: display(18, color: Brand.ink))),
                    Pill(f['status'] == 'done' ? tr(context, 'Scored', 'স্কোর দেওয়া হয়েছে') : tr(context, 'Waiting', 'অপেক্ষায়'), tone: f['status'] == 'done' ? Tone.green : Tone.saffron),
                  ]),
                  const SizedBox(height: 6),
                  Text(tr(context, 'Your self-rating: ${f['selfAverage']}/5', 'আপনার নিজের রেটিং: ${f['selfAverage']}/5'), style: body(14, color: Brand.muted)),
                  if (f['status'] == 'done') ...[
                    Text(tr(context, 'Mentor score: ${f['mentorScore']}/5', 'মেন্টরের স্কোর: ${f['mentorScore']}/5'), style: body(16, w: FontWeight.w700)),
                    if ('${f['strengths'] ?? ''}'.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text('+ ${f['strengths']}', style: body(15))),
                    if ('${f['improve'] ?? ''}'.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text('→ ${f['improve']}', style: body(15))),
                  ],
                ])),
              ])),
            ]),
          );
        },
      ),
    );
  }
}

/// Mentor: inbox of students who asked for a score on their interview practice.
class MentorPracticeScreen extends ConsumerWidget {
  const MentorPracticeScreen({super.key});

  Future<void> _answer(BuildContext context, WidgetRef ref, Map r) async {
    final strengths = TextEditingController(), improve = TextEditingController();
    var score = 3;
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => StatefulBuilder(builder: (c, setS) => AlertDialog(
        title: Text(tr(context, 'Score ${r['student'] ?? 'student'}\'s practice', '${r['student'] ?? 'শিক্ষার্থীর'} এর অনুশীলনের স্কোর'), style: display(19)),
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(tr(context, '${r['answered']} question(s), self-rated ${r['selfAverage']}/5', '${r['answered']} টি প্রশ্ন, নিজের রেটিং ${r['selfAverage']}/5'), style: body(14, color: Brand.muted)),
          const SizedBox(height: 10),
          Text(tr(context, 'Your score', 'আপনার স্কোর'), style: body(14, w: FontWeight.w700)),
          Wrap(spacing: 6, children: [for (var i = 1; i <= 5; i++) ChoiceChip(label: Text('$i'), selected: score == i, onSelected: (_) => setS(() => score = i))]),
          const SizedBox(height: 10),
          TextField(controller: strengths, maxLength: 400, maxLines: 2, decoration: InputDecoration(labelText: tr(context, 'What went well (optional)', 'কী ভালো হয়েছে (ঐচ্ছিক)'))),
          TextField(controller: improve, maxLength: 400, maxLines: 3, decoration: InputDecoration(labelText: tr(context, 'One thing to improve', 'একটি উন্নতির বিষয়'))),
        ])),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(context, 'Cancel', 'বাতিল'))),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(tr(context, 'Send', 'পাঠান'))),
        ],
      )),
    );
    if (ok != true) return;
    if (improve.text.trim().length < 3) { if (context.mounted) toast(context, tr(context, 'Write one thing to improve.', 'উন্নতির একটি বিষয় লিখুন।')); return; }
    try {
      await ref.read(dioProvider).post('/mentor/practice-requests/${r['id']}/feedback', data: {'score': score, 'strengths': strengths.text.trim(), 'improve': improve.text.trim()});
      ref.invalidate(mentorPracticeProvider);
      if (context.mounted) toast(context, tr(context, 'Feedback sent', 'মতামত পাঠানো হয়েছে'));
    } catch (e) {
      if (context.mounted) toast(context, errorText(e));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(mentorPracticeProvider),
        onRetry: () => ref.invalidate(mentorPracticeProvider),
        builder: (d) {
          final list = ((d['requests'] ?? []) as List).cast<Map>();
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(mentorPracticeProvider),
            child: ListView(padding: EdgeInsets.zero, children: [
              _screenHeader(context, tr(context, 'Interview practice requests', 'ইন্টারভিউ অনুশীলনের অনুরোধ'), sub: tr(context, 'Students who want your score and one tip', 'যে শিক্ষার্থীরা আপনার স্কোর ও একটি পরামর্শ চান')),
              Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                if (list.isEmpty) EmptyState(icon: Icons.inbox_outlined, title: tr(context, 'No requests', 'কোনো অনুরোধ নেই'), subtitle: tr(context, 'When a mentee asks for practice feedback it appears here.', 'কোনো মেন্টি অনুশীলনের মতামত চাইলে এখানে দেখা যাবে।')),
                for (final r in list) AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text('${r['student'] ?? ''}', style: display(18, color: Brand.ink))),
                    Pill(r['status'] == 'done' ? tr(context, 'Done', 'শেষ') : tr(context, 'New', 'নতুন'), tone: r['status'] == 'done' ? Tone.green : Tone.saffron),
                  ]),
                  Text(nm(context, r, 'roleTitleEn', 'roleTitleBn'), style: body(14, color: Brand.muted)),
                  const SizedBox(height: 6),
                  Text(tr(context, '${r['answered']} question(s) · self-rated ${r['selfAverage']}/5', '${r['answered']} টি প্রশ্ন · নিজের রেটিং ${r['selfAverage']}/5'), style: body(15)),
                  if (r['status'] == 'done') Padding(padding: const EdgeInsets.only(top: 6), child: Text(tr(context, 'Your score: ${r['mentorScore']}/5', 'আপনার স্কোর: ${r['mentorScore']}/5'), style: body(15, w: FontWeight.w700))),
                  if (r['status'] != 'done') Padding(padding: const EdgeInsets.only(top: 10), child: BigButton(tr(context, 'Give score and tip', 'স্কোর ও পরামর্শ দিন'), onPressed: () => _answer(context, ref, r))),
                ])),
              ])),
            ]),
          );
        },
      ),
    );
  }
}

// ------------------------------------------------------------------ 4. Employer analytics
/// Recruiter dashboard card that opens the analytics screen.
class EmployerAnalyticsCard extends StatelessWidget {
  const EmployerAnalyticsCard({super.key});
  @override
  Widget build(BuildContext context) => AppCard(
        color: Brand.lightGreen, border: Colors.transparent, onTap: () => context.push('/employer/analytics'),
        child: Row(children: [
          Icon(Icons.insights_outlined, color: Brand.forest), const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr(context, 'Hiring analytics', 'নিয়োগ বিশ্লেষণ'), style: body(16, w: FontWeight.w700, color: Brand.ink)),
            Text(tr(context, 'Funnel, reply time and time to hire', 'ফানেল, উত্তরের সময় ও নিয়োগের সময়'), style: body(13, color: Brand.muted)),
          ])),
          Icon(Icons.chevron_right, color: Brand.muted),
        ]),
      );
}

String _days(BuildContext c, dynamic v) => v == null ? tr(c, 'not enough data', 'যথেষ্ট তথ্য নেই') : tr(c, '$v days', '$v দিন');

class EmployerAnalyticsScreen extends ConsumerWidget {
  const EmployerAnalyticsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(employerAnalyticsProvider),
        onRetry: () => ref.invalidate(employerAnalyticsProvider),
        builder: (d) {
          final co = (d['company'] ?? {}) as Map;
          final steps = ((co['steps'] ?? []) as List).cast<Map>();
          final jobs = ((d['jobs'] ?? []) as List).cast<Map>();
          final total = (co['total'] ?? 0) as int;
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(employerAnalyticsProvider),
            child: ListView(padding: EdgeInsets.zero, children: [
              _screenHeader(context, tr(context, 'Hiring analytics', 'নিয়োগ বিশ্লেষণ'), sub: tr(context, '$total applications across all your jobs', 'আপনার সব চাকরিতে $total টি আবেদন')),
              Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                if (co['smallSample'] == true) AppCard(color: Brand.lightSaffron, border: Colors.transparent, child: Text(tr(context, 'Fewer than 3 applicants so far. Treat these numbers as a hint, not a result.', 'এখন পর্যন্ত ৩ জনের কম আবেদনকারী। সংখ্যাগুলোকে ফলাফল নয়, ইঙ্গিত ভাবুন।'), style: body(14, w: FontWeight.w600))),
                Row(children: [
                  Expanded(child: AppCard(margin: const EdgeInsets.only(right: 6, bottom: 12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(tr(context, 'First reply', 'প্রথম উত্তর'), style: body(13, color: Brand.muted)), const SizedBox(height: 4),
                    Text(_days(context, co['medianFirstReplyDays']), style: display(18, color: Brand.ink)),
                  ]))),
                  Expanded(child: AppCard(margin: const EdgeInsets.only(left: 6, bottom: 12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(tr(context, 'Time to hire', 'নিয়োগের সময়'), style: body(13, color: Brand.muted)), const SizedBox(height: 4),
                    Text(_days(context, co['medianDaysToHire']), style: display(18, color: Brand.ink)),
                  ]))),
                ]),
                AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(tr(context, 'Hiring funnel', 'নিয়োগ ফানেল'), style: display(20, color: Brand.ink)),
                  const SizedBox(height: 10),
                  for (final s in steps) Padding(padding: const EdgeInsets.only(bottom: 10), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(child: Text(nm(context, s, 'en', 'bn'), style: body(15, w: FontWeight.w700))),
                      Text('${s['count']} · ${s['percentOfApplied']}%', style: body(14, color: Brand.muted)),
                    ]),
                    const SizedBox(height: 4),
                    ProgressBar(((s['percentOfApplied'] ?? 0) as num) / 100),
                    if (co['biggestDropAt'] == s['key']) Padding(padding: const EdgeInsets.only(top: 4), child: Text(tr(context, 'Biggest drop: ${s['droppedFromPrevious']} left before this step', 'সবচেয়ে বেশি ঝরে পড়া: এই ধাপের আগে ${s['droppedFromPrevious']} জন'), style: body(12, color: const Color(0xFFC62828)))),
                  ])),
                  Text(tr(context, 'Rejected ${co['rejected'] ?? 0} · Withdrawn ${co['withdrawn'] ?? 0}', 'বাদ ${co['rejected'] ?? 0} · প্রত্যাহার ${co['withdrawn'] ?? 0}'), style: body(13, color: Brand.muted)),
                ])),
                Padding(padding: const EdgeInsets.fromLTRB(2, 6, 2, 8), child: Text(tr(context, 'By job', 'চাকরি অনুযায়ী'), style: display(19, color: Brand.ink))),
                if (jobs.isEmpty) AppCard(child: Text(tr(context, 'No jobs yet.', 'এখনও কোনো চাকরি নেই।'), style: body(15))),
                for (final j in jobs) AppCard(padding: const EdgeInsets.all(14), onTap: () => context.push('/job/${j['id']}/pipeline'), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text('${j['title']}', style: display(17, color: Brand.ink))),
                    Pill(j['closed'] == true ? tr(context, 'Closed', 'বন্ধ') : '${j['status']}', tone: j['status'] == 'approved' && j['closed'] != true ? Tone.green : Tone.grey),
                  ]),
                  const SizedBox(height: 6),
                  Text(tr(context, '${j['views']} views · ${j['saves']} saves · ${j['applications']} applied · ${j['hired']} hired', '${j['views']} বার দেখা · ${j['saves']} সংরক্ষণ · ${j['applications']} আবেদন · ${j['hired']} নিয়োগ'), style: body(13, color: Brand.muted)),
                  if (j['applyRatePercent'] != null) Text(tr(context, '${j['applyRatePercent']}% of viewers applied', 'যারা দেখেছেন তাদের ${j['applyRatePercent']}% আবেদন করেছেন'), style: body(13, color: Brand.muted)),
                ])),
                Text('${d['note'] ?? ''}', style: body(12, color: Brand.muted)),
              ])),
            ]),
          );
        },
      ),
    );
  }
}

final actionCenterRoutes = <RouteBase>[
  GoRoute(path: '/actions', builder: (_, __) => const ActionCenterScreen()),
  GoRoute(path: '/tracker', builder: (_, __) => const TrackerScreen()),
  GoRoute(path: '/my-practice-feedback', builder: (_, __) => const MyPracticeFeedbackScreen()),
  GoRoute(path: '/mentor/practice', builder: (_, __) => const MentorPracticeScreen()),
  GoRoute(path: '/employer/analytics', builder: (_, __) => const EmployerAnalyticsScreen()),
];
