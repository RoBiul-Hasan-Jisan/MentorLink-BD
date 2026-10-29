import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'launch.dart';
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
    final streak = (plan?['streak'] ?? 0) as int;

    return RefreshIndicator(
      onRefresh: () async { ref.invalidate(briefProvider); ref.invalidate(readinessProvider); ref.invalidate(planProvider); ref.invalidate(matchesProvider); ref.invalidate(sessionsProvider); },
      child: ListView(padding: EdgeInsets.zero, children: [
        GreenHeader(bottomPad: 90, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Avatar(name, size: 52, bg: Brand.saffron, fg: Brand.ink),
            const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr(context, 'Assalamu alaikum', 'আসসালামু আলাইকুম'), style: body(14, color: Colors.white70)),
              Text(name.split(' ').first, style: display(26, color: Colors.white)),
            ])),
            Container(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10), decoration: BoxDecoration(color: Colors.white12, borderRadius: BorderRadius.circular(24)), child: Text(tr(context, '$streak day streak', '$streak দিনের ধারা'), style: display(14, color: Colors.white, w: FontWeight.w700))),
            const SizedBox(width: 8),
            InkWell(borderRadius: BorderRadius.circular(30), onTap: () => context.push('/notifications'), child: Container(width: 46, height: 46, decoration: const BoxDecoration(color: Colors.white12, shape: BoxShape.circle), child: const Icon(Icons.notifications_none, color: Colors.white))),
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
                    Text(weeks == null ? (d['timeNote'] ?? '') : tr(context, 'About $weeks weeks at ${d['weeklyHours']} h/week. ${top2.isEmpty ? '' : 'Close $top2 to reach ${d['projectedReadiness']}%.'}', 'সপ্তাহে ${d['weeklyHours']} ঘণ্টায় প্রায় $weeks সপ্তাহ। ${top2.isEmpty ? '' : '$top2 পূরণ করলে ${d['projectedReadiness']}% হবে।'}'), style: body(14, color: Colors.white70)),
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
          const BriefCard(),
          AppCard(padding: const EdgeInsets.all(20), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Text(tr(context, 'This week', 'এই সপ্তাহ'), style: display(20, color: Brand.ink)),
              GestureDetector(onTap: () => context.push('/plan'), child: Text(tr(context, 'Open plan', 'পরিকল্পনা'), style: display(15, color: Brand.delta, w: FontWeight.w700))),
            ]),
            const SizedBox(height: 12),
            ProgressBar(tasks.isEmpty ? 0 : done / tasks.length),
            const SizedBox(height: 10),
            if (tasks.isEmpty) Text(tr(context, 'No tasks yet. They appear after your first mentor session.', 'এখনও কোনো কাজ নেই। প্রথম সেশনের পর দেখা যাবে।'), style: body(15, color: Brand.muted)),
            for (final t in tasks.where((t) => t['status'] == 'done').take(1).toList() + tasks.where((t) => t['status'] != 'done').take(3).toList())
              _TaskRow(task: t, onChanged: () => ref.invalidate(planProvider)),
          ])),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: AppCard(color: const Color(0xFFFFF7E3), border: Colors.transparent, margin: const EdgeInsets.only(right: 6), onTap: () => onTab(2), child: _mini(context, tr(context, 'Top mentor match', 'সেরা মেন্টর'), (matches?['matches'] as List?)?.isNotEmpty == true ? (matches!['matches'][0]['mentor']['name'] as String) : '—', (matches?['matches'] as List?)?.isNotEmpty == true ? tr(context, '${matches!['matches'][0]['score']}% match', '${matches['matches'][0]['score']}% মিল') : null, Tone.saffron))),
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
  final rawSessions = sessions?['sessions'];

  if (rawSessions is! List || rawSessions.isEmpty) {
    return const SizedBox.shrink();
  }

  // Ignore malformed session records instead of crashing the dashboard.
  final validSessions = rawSessions.whereType<Map>().where((s) {
    if (s['status'] != 'scheduled') return false;

    final startsAt = s['startsAt'];
    if (startsAt is! String || startsAt.trim().isEmpty) {
      return false;
    }

    final date = DateTime.tryParse(startsAt);
    return date != null &&
        date.isAfter(DateTime.now().subtract(const Duration(hours: 1)));
  }).toList();

  if (validSessions.isEmpty) {
    return const SizedBox.shrink();
  }

  // Display the nearest upcoming session first.
  validSessions.sort((a, b) {
    final dateA = DateTime.parse(a['startsAt'] as String);
    final dateB = DateTime.parse(b['startsAt'] as String);
    return dateA.compareTo(dateB);
  });

  final first = validSessions.first;
  final d = DateTime.parse(first['startsAt'] as String).toLocal();

  const mon = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  final now = DateTime.now();

  final dayDiff = DateTime(d.year, d.month, d.day)
      .difference(DateTime(now.year, now.month, now.day))
      .inDays;

  final h12 = d.hour % 12 == 0 ? 12 : d.hour % 12;
  final clock =
      '$h12:${d.minute.toString().padLeft(2, '0')} ${d.hour >= 12 ? 'PM' : 'AM'}';

  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  final when = dayDiff == 0
      ? tr(context, 'Today', 'আজ')
      : dayDiff == 1
          ? tr(context, 'Tomorrow', 'আগামীকাল')
          : wd[d.weekday - 1];

  final who = [
    first['withName'],
    first['withTitle'],
  ]
      .where((x) => x != null && '$x'.trim().isNotEmpty)
      .map((x) => '$x')
      .join(', ');

  final meetingLink = (first['meetingLink'] ?? '').toString();

  return AppCard(
    padding: const EdgeInsets.all(14),
    child: Row(
      children: [
        Container(
          width: 58,
          height: 58,
          decoration: BoxDecoration(
            color: Brand.lightSaffron,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text('${d.day}', style: display(20, color: Brand.ink)),
              Text(
                mon[d.month - 1],
                style: body(13, color: Brand.ink, w: FontWeight.w700),
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                tr(
                  context,
                  'Next session · $when, $clock',
                  'পরবর্তী সেশন · $when, $clock',
                ),
                style: body(14, color: Brand.muted),
              ),
              Text(
                who.isEmpty
                    ? tr(context, 'Mentor session', 'মেন্টর সেশন')
                    : who,
                style: display(17, color: Brand.ink),
              ),
            ],
          ),
        ),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: Brand.delta,
            minimumSize: const Size(72, 48),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
          onPressed: () {
            toast(
              context,
              meetingLink.isEmpty
                  ? tr(context, 'No link yet', 'এখনও লিংক নেই')
                  : meetingLink,
            );
          },
          child: Text(tr(context, 'Join', 'যোগ দিন')),
        ),
      ],
    ),
  );
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
        if (_tag(task) != null) Pill(_tag(task)!, tone: Tone.saffron),
      ])),
    );
  }
}

// Small tag on the right of a task: due weekday (e.g. Fri), else week number.
String? _tag(Map task) {
  if (task['dueDate'] != null) {
    final d = DateTime.tryParse('${task['dueDate']}')?.toLocal();
    if (d != null) return const ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d.weekday - 1];
  }
  return task['week'] != null ? 'W${task['week']}' : null;
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
