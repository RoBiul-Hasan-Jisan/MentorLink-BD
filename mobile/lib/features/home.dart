import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

class StudentHome extends ConsumerWidget {
  const StudentHome({super.key, required this.onTab});
  final ValueChanged<int> onTab;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).valueOrNull ?? {};
    final rd = ref.watch(readinessProvider);
    final plan = ref.watch(planProvider).valueOrNull;
    final matches = ref.watch(matchesProvider).valueOrNull;
    final opps = ref.watch(opportunitiesProvider).valueOrNull;
    final sessions = ref.watch(sessionsProvider).valueOrNull;
    final name = (me['displayName'] ?? '') as String;
    final tasks = ((plan?['tasks'] ?? []) as List);
    final done = tasks.where((t) => t['status'] == 'done').length;

    return RefreshIndicator(
      onRefresh: () async { ref.invalidate(readinessProvider); ref.invalidate(planProvider); ref.invalidate(matchesProvider); ref.invalidate(sessionsProvider); },
      child: ListView(padding: EdgeInsets.zero, children: [
        GreenHeader(bottomPad: 90, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Avatar(name, size: 52, bg: Brand.saffron, fg: Brand.ink),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr(context, 'Assalamu alaikum', 'আসসালামু আলাইকুম'), style: body(14, color: Colors.white70)),
              Text(name.split(' ').first, style: display(26, color: Colors.white)),
            ])),
            Container(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10), decoration: BoxDecoration(color: Colors.white12, borderRadius: BorderRadius.circular(24)), child: Text(tr(context, '$done tasks done', '$done টি কাজ শেষ'), style: display(14, color: Colors.white, w: FontWeight.w700))),
          ]),
          const SizedBox(height: 18),
          rd.when(
            loading: () => const Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator(color: Colors.white))),
            error: (e, _) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(errorText(e), style: body(15, color: Colors.white70)), const SizedBox(height: 12),
              FilledButton(style: FilledButton.styleFrom(backgroundColor: Brand.saffron, foregroundColor: Brand.ink), onPressed: () => showGoalSheet(context, ref), child: Text(tr(context, 'Set your career goal', 'আপনার ক্যারিয়ার লক্ষ্য ঠিক করুন'))),
            ]),
            data: (d) {
              final gaps = (d['gaps'] as List);
              final weeks = d['timeToReadyWeeks'];
              final top2 = gaps.take(2).map((g) => nm(context, g, 'nameEn', 'nameBn')).join(tr(context, ' and ', ' ও '));
              return Column(children: [
                InkWell(onTap: () => context.push('/skill-gap'), child: Row(children: [
                  Ring(value: (d['readiness'] as num) / 100, size: 124, stroke: 14),
                  const SizedBox(width: 18),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(tr(context, 'Your readiness for', 'আপনার প্রস্তুতি'), style: body(15, color: Colors.white70)),
                    Text(nm(context, d, 'roleTitleEn', 'roleTitleBn'), style: display(26, color: Colors.white)),
                    const SizedBox(height: 6),
                    Text(weeks == null ? (d['timeNote'] ?? '') : tr(context, 'About $weeks weeks at ${d['weeklyHours']} h/week. ${top2.isEmpty ? '' : 'Close $top2.'}', 'সপ্তাহে ${d['weeklyHours']} ঘণ্টায় প্রায় $weeks সপ্তাহ। ${top2.isEmpty ? '' : '$top2 ঘাটতি পূরণ করুন।'}'), style: body(14, color: Colors.white70)),
                  ])),
                ])),
                const SizedBox(height: 20),
                JourneyStepper(labels: [tr(context, 'Skills', 'দক্ষতা'), tr(context, 'Mentor', 'মেন্টর'), tr(context, 'Interview', 'ইন্টারভিউ'), tr(context, 'Job', 'চাকরি')], current: (sessions?['sessions'] as List? ?? []).isNotEmpty ? 2 : (matches != null ? 1 : 0)),
              ]);
            },
          ),
        ])),
        Transform.translate(offset: const Offset(0, -64), child: Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Column(children: [
          _nextSession(context, sessions),
          AppCard(padding: const EdgeInsets.all(20), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text(tr(context, 'This week', 'এই সপ্তাহ'), style: display(20, color: Brand.ink)),
              GestureDetector(onTap: () => onTab(2), child: Text(tr(context, 'Open plan', 'পরিকল্পনা'), style: display(15, color: Brand.delta, w: FontWeight.w700))),
            ]),
            const SizedBox(height: 12),
            ProgressBar(tasks.isEmpty ? 0 : done / tasks.length),
            const SizedBox(height: 10),
            if (tasks.isEmpty) Text(tr(context, 'No tasks yet. They appear after your first mentor session.', 'এখনও কোনো কাজ নেই। প্রথম সেশনের পর দেখা যাবে।'), style: body(15, color: Brand.muted)),
            for (final t in tasks.where((t) => t['status'] != 'done').take(3).toList() + tasks.where((t) => t['status'] == 'done').take(1).toList())
              _TaskRow(task: t, onChanged: () => ref.invalidate(planProvider)),
          ])),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: AppCard(color: const Color(0xFFFFF7E3), border: Colors.transparent, margin: const EdgeInsets.only(right: 6), onTap: () => onTab(1), child: _mini(context, tr(context, 'Top mentor match', 'সেরা মেন্টর'), (matches?['matches'] as List?)?.isNotEmpty == true ? (matches!['matches'][0]['mentor']['name'] as String) : '—', (matches?['matches'] as List?)?.isNotEmpty == true ? tr(context, '${matches!['matches'][0]['score']}% match', '${matches['matches'][0]['score']}% মিল') : null, Tone.saffron))),
            Expanded(child: AppCard(margin: const EdgeInsets.only(left: 6), onTap: () => onTab(3), child: _mini(context, tr(context, 'New vetted listing', 'নতুন যাচাইকৃত সুযোগ'), (opps?['opportunities'] as List?)?.isNotEmpty == true ? (opps!['opportunities'][0]['title'] as String) : '—', (opps?['opportunities'] as List?)?.isNotEmpty == true && opps!['opportunities'][0]['fit'] != null ? tr(context, '${opps['opportunities'][0]['fit']}% fit', '${opps['opportunities'][0]['fit']}% মিল') : null, Tone.green))),
          ]),
        ]))),
      ]),
    );
  }

  Widget _mini(BuildContext c, String label, String title, String? pill, Tone tone) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: body(14, color: Brand.muted)), const SizedBox(height: 4),
        Text(title, style: display(18, color: Brand.ink), maxLines: 2, overflow: TextOverflow.ellipsis),
        if (pill != null) ...[const SizedBox(height: 8), Pill(pill, tone: tone)],
      ]);

  Widget _nextSession(BuildContext context, Map<String, dynamic>? sessions) {
    final list = ((sessions?['sessions'] ?? []) as List).where((s) => s['status'] == 'scheduled').toList();
    if (list.isEmpty) return const SizedBox.shrink();
    final d = DateTime.parse(list.first['startsAt']).toLocal();
    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return AppCard(padding: const EdgeInsets.all(14), child: Row(children: [
      Container(width: 56, height: 56, decoration: BoxDecoration(color: Brand.lightSaffron, borderRadius: BorderRadius.circular(14)), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Text('${d.day}', style: display(20, color: Brand.ink)), Text(mon[d.month - 1], style: body(13, color: Brand.ink, w: FontWeight.w700))])),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(tr(context, 'Next session · ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}', 'পরবর্তী সেশন · ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}'), style: body(14, color: Brand.muted)),
        Text(tr(context, 'Mentor session (${list.first['mode']})', 'মেন্টর সেশন (${list.first['mode']})'), style: display(17, color: Brand.ink)),
      ])),
      FilledButton(style: FilledButton.styleFrom(backgroundColor: Brand.delta, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))), onPressed: () => toast(context, list.first['meetingLink'] ?? tr(context, 'No link yet', 'এখনও লিংক নেই')), child: Text(tr(context, 'Join', 'যোগ দিন'))),
    ]));
  }
}

class _TaskRow extends ConsumerWidget {
  const _TaskRow({required this.task, required this.onChanged});
  final Map task; final VoidCallback onChanged;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final done = task['status'] == 'done';
    return InkWell(
      onTap: () async { await ref.read(dioProvider).patch('/tasks/${task['_id']}', data: {'status': done ? 'todo' : 'done'}); onChanged(); },
      child: Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Row(children: [
        CheckBox(done: done), const SizedBox(width: 12),
        Expanded(child: Text(task['title'], style: body(17, color: done ? Brand.muted : Brand.ink, w: FontWeight.w600).copyWith(decoration: done ? TextDecoration.lineThrough : null))),
        Pill('W${task['week']}', tone: Tone.saffron),
      ])),
    );
  }
}

class CheckBox extends StatelessWidget {
  const CheckBox({super.key, required this.done});
  final bool done;
  @override
  Widget build(BuildContext context) => Container(width: 28, height: 28, decoration: BoxDecoration(color: done ? Brand.delta : Colors.transparent, borderRadius: BorderRadius.circular(8), border: Border.all(color: done ? Brand.delta : const Color(0xFFB9C9C0), width: 2.5)), child: done ? const Icon(Icons.check, size: 18, color: Colors.white) : null);
}

Future<void> showGoalSheet(BuildContext context, WidgetRef ref) async {
  final roles = ((await ref.read(dioProvider).get('/roles')).data['roles'] as List);
  if (!context.mounted) return;
  final hours = TextEditingController(text: '6');
  await showModalBottomSheet(context: context, isScrollControlled: true, backgroundColor: Colors.white, shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))), builder: (c) => Padding(padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(c).viewInsets.bottom + 20), child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(tr(context, 'Choose your career goal', 'ক্যারিয়ার লক্ষ্য বেছে নিন'), style: display(22)),
    const SizedBox(height: 12),
    TextField(controller: hours, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: tr(context, 'Study hours per week', 'সপ্তাহে পড়ার ঘণ্টা'))),
    const SizedBox(height: 8),
    for (final r in roles) ListTile(title: Text(nm(context, r, 'titleEn', 'titleBn'), style: body(17, w: FontWeight.w700)), trailing: const Icon(Icons.chevron_right), onTap: () async {
      try {
        await ref.read(dioProvider).put('/me/goal', data: {'careerGoalRoleKey': r['key'], 'weeklyHours': double.tryParse(hours.text) ?? 6, 'languages': ['bn', 'en']});
        ref.invalidate(readinessProvider); ref.invalidate(matchesProvider);
        if (c.mounted) Navigator.pop(c);
      } catch (e) { if (c.mounted) toast(c, errorText(e)); }
    }),
  ])));
}
