import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

class MentorRequests extends ConsumerWidget {
  const MentorRequests({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AsyncBody(value: ref.watch(requestsProvider), onRetry: () => ref.invalidate(requestsProvider), builder: (d) {
      final list = (d['requests'] as List).cast<Map>();
      if (list.isEmpty) return Center(child: Text(tr(context, 'No requests yet.', 'এখনও কোনো অনুরোধ নেই।'), style: body(17, color: Brand.muted)));
      return ListView(padding: const EdgeInsets.all(16), children: [for (final r in list) AppCard(padding: const EdgeInsets.all(18), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [Expanded(child: Text(r['goalText'], style: display(20, color: Brand.ink))), Pill(r['status'], tone: r['status'] == 'accepted' ? Tone.green : r['status'] == 'pending' ? Tone.saffron : Tone.grey)]),
        const SizedBox(height: 6),
        for (final q in r['questions'] as List) Text('• $q', style: body(16, color: Brand.muted)),
        const SizedBox(height: 10),
        if (r['status'] == 'pending') Row(children: [
          Expanded(child: FilledButton(style: FilledButton.styleFrom(backgroundColor: Brand.delta, minimumSize: const Size(0, 48)), onPressed: () => _decide(context, ref, r['_id'], 'accept'), child: Text(tr(context, 'Accept', 'গ্রহণ')))), const SizedBox(width: 10),
          Expanded(child: OutlinedButton(style: OutlinedButton.styleFrom(minimumSize: const Size(0, 48)), onPressed: () => _decide(context, ref, r['_id'], 'decline'), child: Text(tr(context, 'Decline', 'প্রত্যাখ্যান')))),
        ]) else if (r['status'] == 'accepted') Row(children: [Expanded(child: OutlinedButton.icon(style: OutlinedButton.styleFrom(minimumSize: const Size(0, 48)), onPressed: () => context.push('/review-cv/${r['studentId']}'), icon: const Icon(Icons.description_outlined), label: Text(tr(context, 'Review CV', 'সিভি দেখুন')))), const SizedBox(width: 10), Expanded(child: FilledButton.icon(style: FilledButton.styleFrom(backgroundColor: Brand.delta, minimumSize: const Size(0, 48)), onPressed: () => context.push('/chat/${r['_id']}'), icon: const Icon(Icons.chat_bubble_outline), label: Text(tr(context, 'Chat', 'চ্যাট'))))]),
      ]))]);
    });
  }
  Future<void> _decide(BuildContext context, WidgetRef ref, String id, String decision) async {
    try { await ref.read(dioProvider).post('/requests/$id/decision', data: {'decision': decision}); ref.invalidate(requestsProvider); }
    catch (e) { if (context.mounted) toast(context, errorText(e)); }
  }
}
