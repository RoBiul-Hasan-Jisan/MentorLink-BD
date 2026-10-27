import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// Admin sections that are embedded in the Queue and Insights tabs (not scrollable on their own: put them inside a ListView).
final adminAuditProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/admin/audit-logs'));
final adminFairnessProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/admin/fairness'));
final adminQaProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/admin/qa'));
final adminOutcomesProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/admin/outcomes'));

const double adminFairnessLimit = 25; // percent, from the design: "limit 25%"

Map adminMap(dynamic x) => x is Map ? x : <String, dynamic>{};
List<Map> adminList(dynamic x) => x is List ? x.whereType<Map>().toList() : <Map>[];
String adminTail(dynamic id) { final s = '${id ?? ''}'; return s.length > 6 ? s.substring(s.length - 6) : s; }

// Small helper for embedded sections: loading / error / data without needing a full-screen AsyncBody.
Widget adminAsync(BuildContext context, AsyncValue<dynamic> v, VoidCallback retry, Widget Function(dynamic data) builder) => v.when(
      data: (d) => builder(d),
      loading: () => const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
      error: (e, _) => AppCard(child: Column(children: [Text(errorText(e), textAlign: TextAlign.center, style: body(14)), TextButton(onPressed: retry, child: Text(tr(context, 'Try again', 'আবার চেষ্টা করুন')))])),
    );

Widget adminSectionTitle(String text) => Padding(padding: const EdgeInsets.fromLTRB(2, 18, 2, 8), child: Text(text, style: display(20, color: Brand.ink)));

// ---------- Audit log ----------
class AdminAuditList extends ConsumerStatefulWidget {
  const AdminAuditList({super.key, this.initialCount = 8});
  final int initialCount;
  @override
  ConsumerState<AdminAuditList> createState() => _AdminAuditListState();
}

class _AdminAuditListState extends ConsumerState<AdminAuditList> {
  bool all = false;
  @override
  Widget build(BuildContext context) => adminAsync(context, ref.watch(adminAuditProvider), () => ref.invalidate(adminAuditProvider), (d) {
        final logs = adminList(adminMap(d)['logs']);
        if (logs.isEmpty) return AppCard(child: Text(tr(context, 'No actions yet.', 'এখনও কোনো কাজ নেই।'), style: body(16, color: Brand.muted)));
        final shown = all ? logs : logs.take(widget.initialCount).toList();
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          for (final l in shown)
            AppCard(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${l['action'] ?? ''}', style: body(16, w: FontWeight.w700)),
              Text('${('${l['createdAt'] ?? ''}').replaceFirst('T', ' ').split('.').first} · ${l['targetType'] ?? ''} ${adminTail(l['targetId'])}', style: body(13, color: Brand.muted)),
            ])),
          if (logs.length > widget.initialCount)
            TextButton(style: TextButton.styleFrom(minimumSize: const Size(48, 48)), onPressed: () => setState(() => all = !all), child: Text(all ? tr(context, 'Show less', 'কম দেখান') : tr(context, 'Show all ${logs.length}', 'সব ${logs.length}টি দেখান'))),
        ]);
      });
}

// ---------- Fairness check ----------
class AdminFairnessCard extends ConsumerWidget {
  const AdminFairnessCard({super.key, this.showAll = false});
  final bool showAll; // true: also list every mentor's share
  @override
  Widget build(BuildContext context, WidgetRef ref) => adminAsync(context, ref.watch(adminFairnessProvider), () => ref.invalidate(adminFairnessProvider), (d) {
        final m = adminMap(d);
        final mentors = adminList(m['mentors']);
        final total = (m['total'] is num) ? (m['total'] as num).toInt() : 0;
        double top = 0;
        String topName = '';
        for (final x in mentors) {
          final s = (x['share'] is num) ? (x['share'] as num).toDouble() : 0.0;
          if (s > top) { top = s; topName = '${x['name'] ?? ''}'; }
        }
        final over = top > adminFairnessLimit;
        return AppCard(
          color: over ? const Color(0xFFFDECEA) : Colors.white,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(tr(context, 'Fairness check (monthly)', 'ন্যায্যতা যাচাই (মাসিক)'), style: display(18, color: Brand.ink))),
              Pill(over ? tr(context, 'Over limit', 'সীমার বেশি') : tr(context, 'Within limit', 'সীমার মধ্যে'), tone: over ? Tone.red : Tone.green),
            ]),
            const SizedBox(height: 6),
            Text(total == 0 ? tr(context, 'No recommendations yet.', 'এখনও কোনো সুপারিশ নেই।') : tr(context, 'Highest single-mentor share of recommendations: ${top.round()}% (limit ${adminFairnessLimit.round()}%)', 'একজন মেন্টরের সর্বোচ্চ সুপারিশের ভাগ: ${top.round()}% (সীমা ${adminFairnessLimit.round()}%)'), style: body(15)),
            if (total > 0 && topName.isNotEmpty) Text(tr(context, 'Top: $topName · $total recommendations in total', 'সর্বোচ্চ: $topName · মোট $total টি সুপারিশ'), style: body(13, color: Brand.muted)),
            const SizedBox(height: 8),
            ProgressBar((top / adminFairnessLimit).clamp(0.0, 1.0).toDouble(), color: over ? Colors.red.shade700 : Brand.delta),
            if (showAll && mentors.isNotEmpty) ...[
              const SizedBox(height: 12),
              for (final x in mentors)
                Padding(padding: const EdgeInsets.only(bottom: 10), child: Column(children: [
                  Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Expanded(child: Text('${x['name'] ?? ''}', style: body(15, w: FontWeight.w700))), Text('${x['share'] ?? 0}%', style: display(15, color: Brand.forest))]),
                  const SizedBox(height: 4),
                  ProgressBar((((x['share'] is num) ? (x['share'] as num).toDouble() : 0.0) / 100).clamp(0.0, 1.0).toDouble()),
                ])),
            ],
          ]),
        );
      });
}

// ---------- Q&A moderation ----------
class AdminQaModeration extends ConsumerWidget {
  const AdminQaModeration({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    Future<void> act(String id, String decision) async {
      try {
        await ref.read(dioProvider).post('/admin/qa/$id/moderate', data: {'decision': decision});
        ref.invalidate(adminQaProvider);
      } catch (e) { if (context.mounted) toast(context, errorText(e)); }
    }
    return adminAsync(context, ref.watch(adminQaProvider), () => ref.invalidate(adminQaProvider), (d) {
      final qs = adminList(adminMap(d)['questions']);
      if (qs.isEmpty) return AppCard(child: Text(tr(context, 'No reported or hidden questions.', 'কোনো রিপোর্ট করা বা লুকানো প্রশ্ন নেই।'), style: body(16, color: Brand.muted)));
      return Column(children: [
        for (final q in qs)
          AppCard(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text('${q['title'] ?? ''}', style: body(16, w: FontWeight.w700))),
              Pill('${q['status']}' == 'hidden' ? tr(context, 'Auto-hidden', 'স্বয়ংক্রিয়ভাবে লুকানো') : tr(context, 'Visible', 'দৃশ্যমান'), tone: '${q['status']}' == 'hidden' ? Tone.red : Tone.saffron),
            ]),
            const SizedBox(height: 4),
            Text(tr(context, 'Reported by ${adminList(q['reporters']).isNotEmpty ? adminList(q['reporters']).length : (q['reporters'] is List ? (q['reporters'] as List).length : 0)} people', 'রিপোর্ট করেছেন ${q['reporters'] is List ? (q['reporters'] as List).length : 0} জন'), style: body(13, color: Brand.muted)),
            const SizedBox(height: 8),
            Wrap(spacing: 8, runSpacing: 8, children: [
              OutlinedButton(style: OutlinedButton.styleFrom(minimumSize: const Size(48, 48)), onPressed: () => act('${q['_id']}', 'restore'), child: Text(tr(context, 'Restore', 'ফিরিয়ে আনুন'))),
              if ('${q['status']}' != 'hidden') OutlinedButton(style: OutlinedButton.styleFrom(minimumSize: const Size(48, 48)), onPressed: () => act('${q['_id']}', 'hide'), child: Text(tr(context, 'Hide', 'লুকান'))),
              FilledButton(style: FilledButton.styleFrom(backgroundColor: Colors.red.shade800, minimumSize: const Size(48, 48)), onPressed: () => act('${q['_id']}', 'remove'), child: Text(tr(context, 'Remove', 'সরান'))),
            ]),
          ])),
      ]);
    });
  }
}

// ---------- Outcomes ----------
class AdminOutcomes extends ConsumerWidget {
  const AdminOutcomes({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => adminAsync(context, ref.watch(adminOutcomesProvider), () => ref.invalidate(adminOutcomesProvider), (d) {
        final m = adminMap(d);
        final o = adminMap(m['outcomes']);
        int n(String k) => o[k] is num ? (o[k] as num).toInt() : 0;
        final yes = n('yes'), little = n('little'), notYet = n('not_yet');
        final total = yes + little + notYet;
        Widget row(String label, int v, Color c) => Padding(padding: const EdgeInsets.only(bottom: 10), child: Column(children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(label, style: body(15, w: FontWeight.w700)), Text('$v', style: display(18, color: Brand.forest))]),
              const SizedBox(height: 4),
              ProgressBar(total == 0 ? 0.0 : v / total, color: c),
            ]));
        return AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(tr(context, 'Did mentoring help? ($total answers)', 'মেন্টরিং কি কাজে লেগেছে? ($totalটি উত্তর)'), style: body(14, color: Brand.muted)),
          const SizedBox(height: 10),
          row(tr(context, 'Yes a lot', 'হ্যাঁ, অনেক'), yes, Brand.delta),
          row(tr(context, 'A little', 'একটু'), little, Brand.saffron),
          row(tr(context, 'Not yet', 'এখনও না'), notYet, Colors.grey),
          Text(tr(context, 'Used to evaluate recommendations. It never changes match weights automatically.', 'সুপারিশ মূল্যায়নের জন্য ব্যবহৃত। এটি কখনো নিজে থেকে ম্যাচের ওজন বদলায় না।'), style: body(13, color: Brand.muted)),
        ]));
      });
}

// ---------- Campus coordinates (admin only; shows the campus pin, never a user location) ----------
class AdminUniversityEdit extends ConsumerWidget {
  const AdminUniversityEdit({super.key});

  Future<void> _edit(BuildContext context, WidgetRef ref, Map u) async {
    final campus = adminMap(u['campus']);
    final lat = TextEditingController(text: campus['lat'] is num ? (campus['lat'] as num).toStringAsFixed(4) : '');
    final lng = TextEditingController(text: campus['lng'] is num ? (campus['lng'] as num).toStringAsFixed(4) : '');
    String? err;
    final ok = await showDialog<bool>(context: context, builder: (c) => StatefulBuilder(builder: (c, set) => AlertDialog(
      title: Text('${u['shortName'] ?? u['name'] ?? ''}'),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(tr(c, 'Campus pin only. Use the exact campus, not the city centre.', 'শুধু ক্যাম্পাসের পিন। শহরের কেন্দ্র নয়, ক্যাম্পাসের সঠিক অবস্থান দিন।'), style: body(13, color: Brand.muted)),
        const SizedBox(height: 10),
        TextField(controller: lat, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: InputDecoration(labelText: tr(c, 'Latitude (20.5 to 26.7)', 'অক্ষাংশ (২০.৫ থেকে ২৬.৭)'))),
        const SizedBox(height: 8),
        TextField(controller: lng, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: InputDecoration(labelText: tr(c, 'Longitude (88 to 92.8)', 'দ্রাঘিমাংশ (৮৮ থেকে ৯২.৮)'))),
        if (err != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(err!, style: body(13, color: Colors.red.shade800))),
      ])),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(c, 'Cancel', 'বাতিল'))),
        FilledButton(onPressed: () {
          final la = double.tryParse(lat.text.trim());
          final lo = double.tryParse(lng.text.trim());
          if (la == null || lo == null || la < 20.5 || la > 26.7 || lo < 88 || lo > 92.8) {
            set(() => err = tr(c, 'Enter coordinates inside Bangladesh.', 'বাংলাদেশের ভেতরের স্থানাঙ্ক দিন।'));
            return;
          }
          Navigator.pop(c, true);
        }, child: Text(tr(c, 'Save', 'সংরক্ষণ'))),
      ],
    )));
    if (ok != true) return;
    final la = double.tryParse(lat.text.trim());
    final lo = double.tryParse(lng.text.trim());
    if (la == null || lo == null) return;
    try {
      await ref.read(dioProvider).patch('/admin/universities/${u['id']}', data: {'lat': la, 'lng': lo});
      ref.invalidate(universitiesProvider);
      if (context.mounted) toast(context, tr(context, 'Campus pin updated.', 'ক্যাম্পাসের পিন হালনাগাদ হয়েছে।'));
    } catch (e) { if (context.mounted) toast(context, errorText(e)); }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) => adminAsync(context, ref.watch(universitiesProvider), () => ref.invalidate(universitiesProvider), (d) {
        final list = adminList(d);
        return Column(children: [
          for (final u in list)
            AppCard(padding: const EdgeInsets.fromLTRB(14, 8, 6, 8), child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${u['name'] ?? ''}', style: display(16, color: Brand.ink)),
                Text('${u['city'] ?? ''} · ${adminMap(u['campus'])['lat'] is num ? (adminMap(u['campus'])['lat'] as num).toStringAsFixed(4) : '—'}, ${adminMap(u['campus'])['lng'] is num ? (adminMap(u['campus'])['lng'] as num).toStringAsFixed(4) : '—'}', style: body(13, color: Brand.muted)),
              ])),
              IconButton(tooltip: tr(context, 'Edit campus pin', 'ক্যাম্পাস পিন সম্পাদনা'), icon: const Icon(Icons.edit_location_alt_outlined), onPressed: () => _edit(context, ref, u)),
            ])),
        ]);
      });
}
