import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'home.dart' show CheckBox;
import 'widgets.dart';

class PlanScreen extends ConsumerStatefulWidget {
  const PlanScreen({super.key});
  @override
  ConsumerState<PlanScreen> createState() => _PlanState();
}
class _PlanState extends ConsumerState<PlanScreen> {
  int? week;
  @override
  Widget build(BuildContext context) {
    final rd = ref.watch(readinessProvider).valueOrNull;
    final reqs = (ref.watch(requestsProvider).valueOrNull?['requests'] as List? ?? []).where((r) => r['status'] == 'accepted').toList();
    return AsyncBody(value: ref.watch(planProvider), onRetry: () => ref.invalidate(planProvider), builder: (d) {
      final tasks = (d['tasks'] as List).cast<Map>();
      bool weekDone(int w) { final t = tasks.where((x) => x['week'] == w); return t.isNotEmpty && t.every((x) => x['status'] == 'done'); }
      int current = 1; for (int w = 1; w <= 4; w++) { if (!weekDone(w)) { current = w; break; } current = w; }
      final sel = week ?? current;
      final inWeek = tasks.where((t) => t['week'] == sel).toList();
      final note = tasks.cast<Map?>().firstWhere((t) => t!['mentorComment'] != null, orElse: () => null);
      String label(int w) => weekDone(w) ? tr(context, 'Done', 'শেষ') : w == current ? tr(context, 'Now', 'এখন') : w == 4 ? tr(context, 'Apply', 'আবেদন') : tr(context, 'Next', 'পরে');
      return ListView(padding: const EdgeInsets.fromLTRB(16, 0, 16, 24), children: [
        SafeArea(bottom: false, child: Padding(padding: const EdgeInsets.only(top: 12, bottom: 12), child: Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr(context, 'Action plan', 'কর্মপরিকল্পনা'), style: display(32, color: Brand.ink)),
            Text('${rd == null ? '' : nm(context, rd, 'roleTitleEn', 'roleTitleBn')} · ${tr(context, '4-week plan', 'চার সপ্তাহের পরিকল্পনা')}', style: body(15, color: Brand.muted)),
          ])),
          Pill(tr(context, 'Saved offline', 'অফলাইনে সংরক্ষিত'), tone: Tone.blue),
        ]))),
        AppCard(padding: const EdgeInsets.all(18), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(tr(context, 'Overall progress', 'মোট অগ্রগতি'), style: display(19, color: Brand.ink)), Text('${d['progress']}%', style: display(20, color: Brand.forest))]),
          const SizedBox(height: 10),
          ProgressBar((d['progress'] as num) / 100),
          const SizedBox(height: 10),
          Text(rd?['timeToReadyWeeks'] == null ? tr(context, 'Set weekly hours to see time to ready', 'সময় দেখতে সাপ্তাহিক ঘণ্টা দিন') : tr(context, 'About ${rd!['timeToReadyWeeks']} weeks to ready', 'প্রস্তুত হতে প্রায় ${rd!['timeToReadyWeeks']} সপ্তাহ'), style: body(15, color: Brand.muted)),
        ])),
        Row(children: [for (int w = 1; w <= 4; w++) Expanded(child: Padding(padding: EdgeInsets.only(right: w == 4 ? 0 : 8), child: InkWell(borderRadius: BorderRadius.circular(20), onTap: () => setState(() => week = w), child: Container(height: 78, decoration: BoxDecoration(color: sel == w ? Brand.delta : Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFE2E8E3))), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Text('W$w', style: display(17, color: sel == w ? Colors.white : Brand.ink, w: FontWeight.w700)), Text(label(w), style: body(15, color: sel == w ? Colors.white : Brand.ink))]))))) ]),
        const SizedBox(height: 12),
        AppCard(padding: const EdgeInsets.all(18), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(tr(context, 'Week $sel', 'সপ্তাহ $sel'), style: display(21, color: Brand.ink)), if (sel == current && inWeek.any((t) => t['status'] != 'done')) Pill(tr(context, 'In progress', 'চলছে'), tone: Tone.saffron)]),
          const SizedBox(height: 8),
          if (inWeek.isEmpty) Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: Text(tr(context, 'No tasks this week yet. Your mentor adds steps after each session.', 'এই সপ্তাহে এখনও কাজ নেই। প্রতিটি সেশনের পর মেন্টর কাজ যোগ করেন।'), style: body(16, color: Brand.muted))),
          for (final t in inWeek) InkWell(
            onTap: () async { await ref.read(dioProvider).patch('/tasks/${t['_id']}', data: {'status': t['status'] == 'done' ? 'todo' : 'done'}); ref.invalidate(planProvider); },
            child: Padding(padding: const EdgeInsets.symmetric(vertical: 10), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              CheckBox(done: t['status'] == 'done'), const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(t['title'], style: body(18, w: FontWeight.w700, color: t['status'] == 'done' ? Brand.muted : Brand.ink).copyWith(decoration: t['status'] == 'done' ? TextDecoration.lineThrough : null)),
                if (t['dueDate'] != null) Text(tr(context, 'Due ${(t['dueDate'] as String).substring(0, 10)}', 'শেষ তারিখ ${(t['dueDate'] as String).substring(0, 10)}'), style: body(15, color: Brand.muted)),
              ])),
            ])),
          ),
        ])),
        if (note != null) AppCard(color: const Color(0xFFF0F5F1), border: Colors.transparent, child: Row(children: [
          const Avatar('M', size: 44, bg: Brand.lightGreen, fg: Brand.forest), const SizedBox(width: 12),
          Expanded(child: Text(note['mentorComment'], style: body(16))),
        ])),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: SizedBox(height: 54, child: OutlinedButton(style: OutlinedButton.styleFrom(side: const BorderSide(color: Brand.delta, width: 2), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18))), onPressed: _cv, child: Text(tr(context, 'CV builder', 'সিভি বিল্ডার'), style: display(17, color: Brand.delta))))),
          const SizedBox(width: 12),
          Expanded(child: SizedBox(height: 54, child: OutlinedButton(style: OutlinedButton.styleFrom(side: const BorderSide(color: Brand.delta, width: 2), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18))), onPressed: () => context.push('/roadmaps'), child: Text(tr(context, 'Roadmaps', 'রোডম্যাপ'), style: display(17, color: Brand.delta))))),
        ]),
        const SizedBox(height: 12),
        SizedBox(height: 54, child: FilledButton(style: FilledButton.styleFrom(backgroundColor: Brand.delta, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18))), onPressed: () => context.push('/targets'), child: Text(tr(context, 'Pick a target (e.g. Machine Learning)', 'লক্ষ্য বেছে নিন (যেমন মেশিন লার্নিং)'), style: display(16, color: Colors.white)))),
        if (reqs.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text(tr(context, 'Chat with your mentor', 'মেন্টরের সাথে চ্যাট'), style: display(19, color: Brand.ink)),
          for (final r in reqs) AppCard(margin: const EdgeInsets.only(top: 8), onTap: () => context.push('/chat/${r['_id']}'), child: Row(children: [const Icon(Icons.chat_bubble_outline, color: Brand.delta), const SizedBox(width: 12), Expanded(child: Text(r['goalText'], style: body(16, w: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis)), const Icon(Icons.chevron_right)])),
        ],
      ]);
    });
  }

  void _cv() => context.push('/cv');
}
