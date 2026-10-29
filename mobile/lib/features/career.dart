import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'career_graph.dart';
import 'charts.dart';
import 'plan.dart';
import 'portfolio.dart';
import 'widgets.dart';

// Career tab: the student's career-planning hub. Everything here already exists on the server; this screen only gathers it in one place.
final planReviewProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/plan-review'));
final helpFinderProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/help-finder'));
final helpMentorsProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, focus) => getJson(ref, '/me/help-finder/mentors', q: {'focus': focus}));
final mentorPlanReviewsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/mentor/plan-reviews'));
final helpFocusProvider = StateProvider.autoDispose<String>((_) => '');

class CareerHub extends ConsumerWidget {
  const CareerHub({super.key});

  Widget _tile(BuildContext context, IconData icon, String title, String sub, String route) => AppCard(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        margin: const EdgeInsets.only(bottom: 8),
        onTap: () => context.push(route),
        child: Row(children: [
          Container(width: 44, height: 44, decoration: BoxDecoration(color: Brand.lightGreen, borderRadius: BorderRadius.circular(14)), child: Icon(icon, color: Brand.delta)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: body(16, w: FontWeight.w700)), Text(sub, style: body(13, color: Brand.muted))])),
          const Icon(Icons.chevron_right, color: Brand.muted),
        ]),
      );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rd = ref.watch(readinessProvider).valueOrNull;
    final plan = ref.watch(planProvider).valueOrNull;
    final gaps = ((rd?['gaps'] ?? []) as List).cast<Map>().take(4).toList();
    final pct = ((rd?['readiness'] ?? 0) as num).toDouble();
    return ListView(padding: EdgeInsets.zero, children: [
      GreenHeader(radius: 36, bottomPad: 26, child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(tr(context, 'Career', 'ক্যারিয়ার'), style: display(30, color: Colors.white)),
          const SizedBox(height: 4),
          Text(rd == null ? tr(context, 'Choose a goal to see your score', 'স্কোর দেখতে একটি লক্ষ্য বেছে নিন') : nm(context, rd, 'roleTitleEn', 'roleTitleBn'), style: body(15, color: Colors.white70)),
        ])),
        if (rd != null) Ring(value: pct / 100, size: 84, stroke: 10, label: '${pct.round()}%'),
      ])),
      Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (gaps.isNotEmpty) AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(tr(context, 'Hours to close your biggest gaps', 'বড় ঘাটতি পূরণে প্রয়োজনীয় ঘণ্টা'), style: display(17, color: Brand.ink)),
          const SizedBox(height: 10),
          BarChartBox(height: 90, data: [for (final g in gaps) BarDatum(nm(context, g, 'nameEn', 'nameBn'), ((g['hours'] ?? 0) as num).toDouble(), color: Brand.saffron)]),
        ])),
        AppCard(onTap: () => context.push('/plan'), child: Row(children: [
          const Icon(Icons.checklist, color: Brand.delta), const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr(context, '4-week learning plan', '৪ সপ্তাহের শেখার পরিকল্পনা'), style: body(17, w: FontWeight.w700)),
            const SizedBox(height: 6),
            ProgressBar(((plan?['progress'] ?? 0) as num) / 100),
          ])),
          const SizedBox(width: 10), Text('${plan?['progress'] ?? 0}%', style: display(18, color: Brand.forest)),
        ])),
        const _PlanReviewCard(),
        Padding(padding: const EdgeInsets.fromLTRB(2, 8, 2, 8), child: Text(tr(context, 'Decide', 'সিদ্ধান্ত'), style: display(18, color: Brand.ink))),
        _tile(context, Icons.science_outlined, tr(context, 'Career Decision Lab', 'ক্যারিয়ার ডিসিশন ল্যাব'), tr(context, 'Compare careers and run a what-if', 'ক্যারিয়ার তুলনা ও হোয়াট-ইফ'), '/decision-lab'),
        _tile(context, Icons.fact_check_outlined, tr(context, 'Skill gaps', 'দক্ষতার ঘাটতি'), tr(context, 'What is missing for your goal', 'লক্ষ্যের জন্য কী বাকি'), '/skill-gap'),
        _tile(context, Icons.account_tree_outlined, tr(context, 'Career pathway map', 'ক্যারিয়ার পথের মানচিত্র'), tr(context, 'Topics, quizzes and your target on one map', 'বিষয়, কুইজ ও লক্ষ্য এক মানচিত্রে'), '/career-graph'),
        _tile(context, Icons.alt_route, tr(context, 'My paths', 'আমার পথ'), tr(context, 'Targets and roadmaps you follow', 'যে লক্ষ্য ও রোডম্যাপ অনুসরণ করছেন'), '/my-paths'),
        _tile(context, Icons.people_alt_outlined, tr(context, 'Path Twin', 'পাথ টুইন'), tr(context, 'Mentors who were where you are', 'আপনার মতো জায়গায় থাকা মেন্টর'), '/path-twins'),
        Padding(padding: const EdgeInsets.fromLTRB(2, 14, 2, 8), child: Text(tr(context, 'Build proof', 'প্রমাণ তৈরি করুন'), style: display(18, color: Brand.ink))),
        _tile(context, Icons.bolt_outlined, tr(context, 'Mentor Sprint', 'মেন্টর স্প্রিন্ট'), tr(context, '7 days on one skill, then a mentor review', '৭ দিনে একটি দক্ষতা, তারপর মেন্টর রিভিউ'), '/sprints'),
        _tile(context, Icons.badge_outlined, tr(context, 'Career Passport', 'ক্যারিয়ার পাসপোর্ট'), tr(context, 'Your proof in one shareable link', 'আপনার প্রমাণ এক শেয়ারযোগ্য লিংকে'), '/passport'),
        _tile(context, Icons.folder_special_outlined, tr(context, 'Projects & GitHub', 'প্রজেক্ট ও GitHub'), tr(context, 'Add projects, link GitHub, ask for review', 'প্রজেক্ট যোগ, GitHub যুক্ত, রিভিউ চান'), '/portfolio'),
        _tile(context, Icons.support_agent, tr(context, 'Find help for a problem', 'সমস্যার জন্য সাহায্য খুঁজুন'), tr(context, 'A skill gap or a kind of help to a mentor', 'দক্ষতার ঘাটতি বা সাহায্যের ধরন থেকে মেন্টর'), '/help-finder'),
        _tile(context, Icons.work_outline, tr(context, 'What employers ask for', 'নিয়োগদাতারা কী চান'), tr(context, 'Gap check against real postings', 'আসল পোস্টিংয়ের সঙ্গে ঘাটতি যাচাই'), '/job-gaps'),
        _tile(context, Icons.mic_none, tr(context, 'Mock interviews', 'মক ইন্টারভিউ'), tr(context, 'Practice with a mentor', 'মেন্টরের সঙ্গে অনুশীলন'), '/mock-interviews'),
        _tile(context, Icons.menu_book_outlined, tr(context, 'Free resources', 'বিনামূল্যে রিসোর্স'), tr(context, 'Vetted learning links', 'যাচাই করা শেখার লিংক'), '/resources'),
        Padding(padding: const EdgeInsets.fromLTRB(2, 14, 2, 8), child: Text(tr(context, 'Track', 'অগ্রগতি'), style: display(18, color: Brand.ink))),
        _tile(context, Icons.insights_outlined, tr(context, 'My progress & badges', 'আমার অগ্রগতি ও ব্যাজ'), tr(context, 'Readiness over time', 'সময়ের সঙ্গে প্রস্তুতি'), '/progress'),
        _tile(context, Icons.rate_review_outlined, tr(context, 'Mentor feedback', 'মেন্টরের ফিডব্যাক'), tr(context, 'Reviews of your work', 'আপনার কাজের রিভিউ'), '/my-reviews'),
        _tile(context, Icons.timeline, tr(context, 'Career outcome tracker', 'ক্যারিয়ার ফলাফল ট্র্যাকার'), tr(context, 'Interviews, offers, internships', 'ইন্টারভিউ, অফার, ইন্টার্নশিপ'), '/outcome-tracker'),
      ])),
    ]);
  }
}

// Ask a mentor you already work with to look over the 4-week plan. They approve it or ask for changes. It never changes a score.
class _PlanReviewCard extends ConsumerWidget {
  const _PlanReviewCard();

  Future<void> _ask(BuildContext context, WidgetRef ref, List mentors) async {
    if (mentors.isEmpty) { toast(context, tr(context, 'You need a mentor who accepted your request first.', 'আগে এমন একজন মেন্টর লাগবে যিনি আপনার অনুরোধ গ্রহণ করেছেন।')); return; }
    String? pick = '${mentors.first['id']}';
    final note = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (c) => StatefulBuilder(builder: (c, set) => AlertDialog(
      title: Text(tr(context, 'Ask for a plan review', 'পরিকল্পনা রিভিউ চান'), style: display(19)),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        DropdownButton<String>(isExpanded: true, value: pick, items: [for (final m in mentors.cast<Map>()) DropdownMenuItem(value: '${m['id']}', child: Text('${m['name']}'))], onChanged: (v) => set(() => pick = v)),
        TextField(controller: note, maxLength: 300, maxLines: 3, decoration: InputDecoration(labelText: tr(context, 'What should they look at? (optional)', 'কী দেখবেন? (ঐচ্ছিক)'))),
      ]),
      actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(context, 'Cancel', 'বাতিল'))), FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(tr(context, 'Send', 'পাঠান')))],
    )));
    if (ok != true || pick == null) return;
    try {
      await ref.read(dioProvider).post('/me/plan-review', data: {'mentorId': pick, if (note.text.trim().isNotEmpty) 'note': note.text.trim()});
      ref.invalidate(planReviewProvider);
      if (context.mounted) toast(context, tr(context, 'Sent to your mentor', 'মেন্টরের কাছে পাঠানো হয়েছে'));
    } catch (e) { if (context.mounted) toast(context, errorText(e)); }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = ref.watch(planReviewProvider).valueOrNull;
    if (d == null) return const SizedBox.shrink();
    final r = d['review'] as Map?;
    final mentors = d['mentors'] as List;
    final status = r == null ? null : r['status'] as String;
    final who = r == null ? '' : '${r['mentor']}';
    final (tone, text) = switch (status) {
      'approved' => (Tone.green, tr(context, 'Approved by $who', '$who অনুমোদন করেছেন')),
      'changes' => (Tone.red, tr(context, '$who suggested changes', '$who পরিবর্তন চেয়েছেন')),
      'requested' => (Tone.saffron, tr(context, 'Waiting for $who', '$who-এর অপেক্ষায়')),
      _ => (Tone.grey, tr(context, 'Not reviewed yet', 'এখনও রিভিউ হয়নি')),
    };
    return AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        const Icon(Icons.verified_outlined, color: Brand.delta), const SizedBox(width: 12),
        Expanded(child: Text(tr(context, 'Mentor plan review', 'মেন্টরের পরিকল্পনা রিভিউ'), style: body(17, w: FontWeight.w700))),
        Pill(text, tone: tone),
      ]),
      if (r != null && (r['mentorNote'] as String).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text('“${r['mentorNote']}”', style: body(15))),
      if (status != 'requested') Padding(padding: const EdgeInsets.only(top: 10), child: BigButton(status == null ? tr(context, 'Ask a mentor to review my plan', 'মেন্টরকে পরিকল্পনা রিভিউ করতে বলুন') : tr(context, 'Ask again', 'আবার চান'), outlined: true, onPressed: () => _ask(context, ref, mentors))),
    ]));
  }
}

// ---------------------------------------------------------------- help finder
class HelpFinderScreen extends ConsumerWidget {
  const HelpFinderScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final focus = ref.watch(helpFocusProvider);
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'Find help for a problem', 'সমস্যার জন্য সাহায্য খুঁজুন'), style: display(22, color: Brand.ink))),
      body: AsyncBody(value: ref.watch(helpFinderProvider), onRetry: () => ref.invalidate(helpFinderProvider), builder: (d) {
        final m = d as Map<String, dynamic>;
        final skills = (m['skills'] as List).cast<Map>(), kinds = (m['interventions'] as List).cast<Map>();
        return ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 28), children: [
          Text(tr(context, 'Pick the problem you have. We find mentors for exactly that.', 'আপনার সমস্যাটি বেছে নিন। আমরা ঠিক সেটির জন্য মেন্টর খুঁজে দেব।'), style: body(14, color: Brand.muted)),
          const SizedBox(height: 12),
          Text(tr(context, 'A skill I am missing', 'যে দক্ষতা আমার নেই'), style: display(17, color: Brand.ink)),
          const SizedBox(height: 8),
          if (skills.isEmpty) AppCard(child: Text(tr(context, 'Choose a career goal to see your gaps.', 'ঘাটতি দেখতে ক্যারিয়ার লক্ষ্য বেছে নিন।'), style: body(15, color: Brand.muted))),
          for (final s in skills) AppCard(margin: const EdgeInsets.only(bottom: 8), padding: const EdgeInsets.all(14), onTap: () => context.push('/gap/${s['skillKey']}/mentors'), child: Row(children: [
            Expanded(child: Text(nm(context, s, 'nameEn', 'nameBn'), style: body(16, w: FontWeight.w700))),
            Pill(tr(context, 'level ${s['current']} of ${s['required']}', 'লেভেল ${s['current']}/${s['required']}'), tone: Tone.saffron),
            const Icon(Icons.chevron_right, color: Brand.muted),
          ])),
          const SizedBox(height: 10),
          Text(tr(context, 'A kind of help', 'যে ধরনের সাহায্য'), style: display(17, color: Brand.ink)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 6, children: [
            for (final k in kinds) ChoiceChip(label: Text(nm(context, k, 'labelEn', 'labelBn')), selected: focus == k['key'], onSelected: (_) => ref.read(helpFocusProvider.notifier).state = k['key'] as String),
          ]),
          const SizedBox(height: 12),
          if (focus.isNotEmpty) AsyncBody(value: ref.watch(helpMentorsProvider(focus)), builder: (x) {
            final list = ((x as Map)['mentors'] as List).cast<Map>();
            if (list.isEmpty) return AppCard(child: Text(tr(context, 'No mentor with open spots offers this yet.', 'এই সাহায্য দেন এমন কোনো মেন্টরের এখন ফাঁকা জায়গা নেই।'), style: body(15, color: Brand.muted)));
            return Column(children: [
              for (final mm in list) AppCard(margin: const EdgeInsets.only(bottom: 8), padding: const EdgeInsets.all(14), onTap: () => context.push('/mentor/${mm['mentorId']}'), child: Row(children: [
                Avatar('${mm['name']}', size: 44),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${mm['name']}', style: body(16, w: FontWeight.w700)),
                  Text('${mm['roleTitle'] ?? ''} · ${mm['industry'] ?? ''}', style: body(13, color: Brand.muted)),
                  Text(tr(context, '${mm['openSpots']} open spot(s)${mm['rating'] == null ? '' : ' · rated ${(mm['rating'] as num).toStringAsFixed(1)}'}', '${mm['openSpots']}টি ফাঁকা জায়গা${mm['rating'] == null ? '' : ' · রেটিং ${(mm['rating'] as num).toStringAsFixed(1)}'}'), style: body(13, color: Brand.muted)),
                ])),
                const Icon(Icons.chevron_right, color: Brand.muted),
              ])),
              Text('${(x)['note']}', style: body(12, color: Brand.muted)),
            ]);
          }),
        ]);
      }),
    );
  }
}

// ---------------------------------------------------------------- mentor: plan reviews
class MentorPlanReviewsScreen extends ConsumerWidget {
  const MentorPlanReviewsScreen({super.key});

  Future<void> _decide(BuildContext context, WidgetRef ref, Map r, String decision) async {
    final note = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(
      title: Text(decision == 'approved' ? tr(context, 'Approve this plan?', 'এই পরিকল্পনা অনুমোদন করবেন?') : tr(context, 'What should change?', 'কী বদলাতে হবে?'), style: display(19)),
      content: TextField(controller: note, maxLength: 400, maxLines: 4, decoration: InputDecoration(labelText: decision == 'approved' ? tr(context, 'Note (optional)', 'নোট (ঐচ্ছিক)') : tr(context, 'Note (required)', 'নোট (আবশ্যক)'))),
      actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(context, 'Cancel', 'বাতিল'))), FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(tr(context, 'Send', 'পাঠান')))],
    ));
    if (ok != true) return;
    try {
      await ref.read(dioProvider).post('/mentor/plan-reviews/${r['id']}', data: {'decision': decision, if (note.text.trim().isNotEmpty) 'note': note.text.trim()});
      ref.invalidate(mentorPlanReviewsProvider);
      if (context.mounted) toast(context, tr(context, 'Sent', 'পাঠানো হয়েছে'));
    } catch (e) { if (context.mounted) toast(context, errorText(e)); }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
        appBar: AppBar(title: Text(tr(context, 'Plan reviews', 'পরিকল্পনা রিভিউ'), style: display(22, color: Brand.ink))),
        body: AsyncBody(value: ref.watch(mentorPlanReviewsProvider), onRetry: () => ref.invalidate(mentorPlanReviewsProvider), builder: (d) {
          final list = ((d as Map)['reviews'] as List).cast<Map>();
          if (list.isEmpty) return Center(child: Text(tr(context, 'No plans waiting for you.', 'আপনার জন্য কোনো পরিকল্পনা অপেক্ষায় নেই।'), style: body(16, color: Brand.muted)));
          return ListView(padding: const EdgeInsets.all(16), children: [
            for (final r in list) AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${r['student']}', style: display(19, color: Brand.ink)),
              if ((r['studentNote'] as String).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text('“${r['studentNote']}”', style: body(15))),
              const SizedBox(height: 10),
              for (final t in (r['tasks'] as List).cast<Map>()) Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Icon(t['status'] == 'done' ? Icons.check_circle : Icons.radio_button_unchecked, size: 18, color: t['status'] == 'done' ? Brand.delta : Brand.muted),
                const SizedBox(width: 8),
                Expanded(child: Text('${tr(context, 'W', 'স')}${t['week']} · ${t['title']}', style: body(14))),
              ])),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: BigButton(tr(context, 'Approve', 'অনুমোদন'), onPressed: () => _decide(context, ref, r, 'approved'))),
                const SizedBox(width: 10),
                Expanded(child: BigButton(tr(context, 'Ask changes', 'পরিবর্তন চান'), outlined: true, onPressed: () => _decide(context, ref, r, 'changes'))),
              ]),
            ])),
          ]);
        }),
      );
}

// ---------------------------------------------------------------- routes
final careerRoutes = <RouteBase>[
  GoRoute(path: '/plan', builder: (context, _) => Scaffold(appBar: AppBar(title: Text(tr(context, 'Action plan', 'কর্মপরিকল্পনা'), style: display(22, color: Brand.ink))), body: const PlanScreen())),
  GoRoute(path: '/career-graph', builder: (_, __) => const CareerGraphScreen()),
  GoRoute(path: '/portfolio', builder: (_, __) => const PortfolioScreen()),
  GoRoute(path: '/help-finder', builder: (_, __) => const HelpFinderScreen()),
  GoRoute(path: '/mentor/plan-reviews', builder: (_, __) => const MentorPlanReviewsScreen()),
];
