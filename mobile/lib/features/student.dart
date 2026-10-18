import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../l10n/app_localizations.dart';
import 'widgets.dart';

String pick(BuildContext c, Map m, String en, String bn) => Localizations.localeOf(c).languageCode == 'bn' ? (m[bn] ?? m[en] ?? '') : (m[en] ?? '');

class StudentHome extends ConsumerWidget {
  const StudentHome({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context);
    final r = ref.watch(readinessProvider);
    return RefreshIndicator(onRefresh: () async => ref.refresh(readinessProvider.future), child: ListView(padding: const EdgeInsets.all(16), children: [
      r.when(
        data: (d) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Card(color: Brand.forest, child: Padding(padding: const EdgeInsets.all(20), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(t.readiness, style: const TextStyle(color: Colors.white70)),
            Text('${d['readiness']}%', style: const TextStyle(color: Colors.white, fontSize: 44, fontWeight: FontWeight.w800)),
            Text('${t.confidence}: ${d['confidence']}%  ·  ${t.weeksToReady}: ${d['timeToReadyWeeks'] ?? '—'}', style: const TextStyle(color: Brand.lightSaffron)),
            if (d['timeNote'] != null) Text(d['timeNote'], style: const TextStyle(color: Colors.white70, fontSize: 12)),
          ]))),
          Padding(padding: const EdgeInsets.only(top: 12, bottom: 4), child: Text(t.gaps, style: Theme.of(context).textTheme.titleLarge)),
          for (final g in d['gaps'] as List) Card(child: ListTile(
            title: Text(pick(context, g, 'nameEn', 'nameBn').isEmpty ? g['skillKey'] : pick(context, g, 'nameEn', 'nameBn')),
            subtitle: Text('${g['current']} → ${g['required']}  ·  ~${g['hours']}h'),
            trailing: Pill('#${(d['gaps'] as List).indexOf(g) + 1}', color: Brand.lightSaffron, fg: Brand.ink))),
        ]),
        loading: () => const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator())),
        error: (e, _) => Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(children: [Text(errorText(e)), FilledButton(onPressed: () => showGoalSheet(context, ref), child: Text(t.setGoal))]))),
      ),
      TextButton.icon(onPressed: () => showGoalSheet(context, ref), icon: const Icon(Icons.flag_outlined), label: Text(t.setGoal)),
    ]));
  }
}

Future<void> showGoalSheet(BuildContext context, WidgetRef ref) async {
  final roles = (await getJsonDirect(ref, '/roles'))['roles'] as List;
  if (!context.mounted) return;
  final hours = TextEditingController(text: '6');
  await showModalBottomSheet(context: context, isScrollControlled: true, builder: (c) => Padding(padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(c).viewInsets.bottom + 16), child: Column(mainAxisSize: MainAxisSize.min, children: [
    TextField(controller: hours, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Weekly study hours')),
    const SizedBox(height: 8),
    for (final r in roles) ListTile(title: Text(pick(c, r, 'titleEn', 'titleBn')), onTap: () async {
      try {
        await ref.read(dioProvider).put('/me/goal', data: {'careerGoalRoleKey': r['key'], 'weeklyHours': double.tryParse(hours.text) ?? 6, 'languages': ['bn', 'en']});
        ref.invalidate(readinessProvider); ref.invalidate(matchesProvider);
        if (c.mounted) Navigator.pop(c);
      } catch (e) { if (c.mounted) toast(c, errorText(e)); }
    }),
  ])));
}
Future<Map<String, dynamic>> getJsonDirect(WidgetRef ref, String p) async => (await ref.read(dioProvider).get(p)).data as Map<String, dynamic>;

class MentorMatches extends ConsumerWidget {
  const MentorMatches({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context);
    return AsyncBody(value: ref.watch(matchesProvider), onRetry: () => ref.invalidate(matchesProvider), builder: (d) {
      final list = d['matches'] as List;
      if (list.isEmpty) return const Center(child: Text('No mentors available yet.'));
      return ListView(padding: const EdgeInsets.all(16), children: [for (final m in list) Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [Expanded(child: Text(m['mentor']['name'], style: Theme.of(context).textTheme.titleLarge)), Pill('${m['score']}%')]),
        Text('${m['mentor']['roleTitle']} · ${m['mentor']['industry']}', style: const TextStyle(color: Brand.muted)),
        if (m['mentor']['isRising'] == true) const Padding(padding: EdgeInsets.only(top: 6), child: Pill('Rising mentor', color: Brand.lightSaffron, fg: Brand.ink)),
        const SizedBox(height: 8),
        Text(t.whyMatch, style: const TextStyle(fontWeight: FontWeight.w700)),
        for (final r in m['reasons'] as List) Text('• ${pick(context, r, 'en', 'bn')}'),
        const SizedBox(height: 8),
        Wrap(spacing: 6, children: [for (final e in (m['factorScores'] as Map).entries) Pill('${e.key} ${e.value}')]),
        const SizedBox(height: 8),
        FilledButton(onPressed: () => _request(context, ref, m['mentor']['id']), child: Text(t.sendRequest)),
      ])))]);
    });
  }
  Future<void> _request(BuildContext context, WidgetRef ref, String mentorId) async {
    final goal = TextEditingController(), q = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(title: const Text('Request'), content: Column(mainAxisSize: MainAxisSize.min, children: [
      TextField(controller: goal, decoration: const InputDecoration(labelText: 'Your goal')), const SizedBox(height: 8),
      TextField(controller: q, decoration: const InputDecoration(labelText: 'One question')),
    ]), actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')), FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Send'))]));
    if (ok != true) return;
    try {
      await ref.read(dioProvider).post('/requests', data: {'mentorId': mentorId, 'goalText': goal.text, 'questions': [q.text]});
      if (context.mounted) toast(context, 'Request sent');
    } catch (e) { if (context.mounted) toast(context, errorText(e)); }
  }
}

class PlanScreen extends ConsumerWidget {
  const PlanScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context);
    final reqs = ref.watch(requestsProvider).valueOrNull?['requests'] as List? ?? [];
    return AsyncBody(value: ref.watch(planProvider), onRetry: () => ref.invalidate(planProvider), builder: (d) {
      final tasks = d['tasks'] as List;
      return ListView(padding: const EdgeInsets.all(16), children: [
        Text('${t.tasksDone}: ${d['progress']}%', style: Theme.of(context).textTheme.titleLarge),
        LinearProgressIndicator(value: (d['progress'] as num) / 100, minHeight: 8),
        const SizedBox(height: 8),
        for (final k in tasks) Card(child: CheckboxListTile(
          value: k['status'] == 'done', title: Text(k['title']), subtitle: Text('Week ${k['week']}${k['mentorComment'] != null ? '\n💬 ${k['mentorComment']}' : ''}'),
          onChanged: (v) async { await ref.read(dioProvider).patch('/tasks/${k['_id']}', data: {'status': v == true ? 'done' : 'todo'}); ref.invalidate(planProvider); })),
        const Divider(), Text(t.chat, style: Theme.of(context).textTheme.titleLarge),
        for (final r in reqs.where((r) => r['status'] == 'accepted')) ListTile(leading: const Icon(Icons.chat_bubble_outline), title: Text(r['goalText']), onTap: () => context.push('/chat/${r['_id']}')),
      ]);
    });
  }
}

class OpportunitiesScreen extends ConsumerWidget {
  const OpportunitiesScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context);
    return DefaultTabController(length: 2, child: Column(children: [
      TabBar(tabs: [Tab(text: t.jobs), Tab(text: t.tracker)]),
      Expanded(child: TabBarView(children: [
        AsyncBody(value: ref.watch(opportunitiesProvider), onRetry: () => ref.invalidate(opportunitiesProvider), builder: (d) => ListView(padding: const EdgeInsets.all(16), children: [
          for (final o in d['opportunities'] as List) Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(o['title'], style: Theme.of(context).textTheme.titleLarge), Text(o['organization']),
            const SizedBox(height: 6),
            Wrap(spacing: 6, children: [
              Pill('${t.sourceLabel}: ${o['labels']['source']}'),
              if (o['labels']['listingReviewed'] == true) Pill(t.listingReviewed),
              if (o['labels']['noFeeDeclared'] == true) Pill(t.noFee, color: Brand.lightSaffron, fg: Brand.ink),
              if (o['fit'] != null) Pill('Fit ${o['fit']}%'),
            ]),
            Row(children: [
              FilledButton(onPressed: () => _apply(context, ref, o['id']), child: Text(t.apply)),
              TextButton(onPressed: () => _report(context, ref, o['id']), child: Text(t.report)),
            ]),
          ]))),
        ])),
        AsyncBody(value: ref.watch(applicationsProvider), builder: (d) => ListView(padding: const EdgeInsets.all(16), children: [
          for (final a in d['applications'] as List) Card(child: ListTile(title: Text(a['opportunity']?['title'] ?? ''), subtitle: Text(a['statusMessage'] ?? ''), trailing: Pill(a['withdrawn'] == true ? 'Withdrawn' : a['stage']))),
        ])),
      ])),
    ]));
  }

  Future<void> _apply(BuildContext context, WidgetRef ref, String id) async {
    final t = AppLocalizations.of(context);
    bool consent = false;
    final go = await showDialog<bool>(context: context, builder: (c) => StatefulBuilder(builder: (c, set) => AlertDialog(
      content: CheckboxListTile(value: consent, title: Text(t.consent), onChanged: (v) => set(() => consent = v == true)),
      actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')), FilledButton(onPressed: consent ? () => Navigator.pop(c, true) : null, child: Text(t.apply))])));
    if (go != true) return;
    try {
      final dio = ref.read(dioProvider);
      var cvs = ((await dio.get('/me/cv')).data['versions'] as List);
      if (cvs.isEmpty) { await dio.post('/me/cv', data: {'data': {'summary': 'Student at my university'}}); cvs = ((await dio.get('/me/cv')).data['versions'] as List); }
      await dio.post('/opportunities/$id/apply', data: {'cvVersionId': cvs.first['_id'], 'consent': true, 'sharedFields': ['name', 'cv']});
      ref.invalidate(applicationsProvider);
      if (context.mounted) toast(context, 'Applied');
    } catch (e) { if (context.mounted) toast(context, errorText(e)); }
  }
  Future<void> _report(BuildContext context, WidgetRef ref, String id) async {
    try { await ref.read(dioProvider).post('/reports', data: {'targetType': 'opportunity', 'targetId': id, 'reason': 'Suspicious or asks for money'}); if (context.mounted) toast(context, 'Reported. Thank you.'); }
    catch (e) { if (context.mounted) toast(context, errorText(e)); }
  }
}
