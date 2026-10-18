import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../l10n/app_localizations.dart';
import 'widgets.dart';

class MentorRequests extends ConsumerWidget {
  const MentorRequests({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context);
    return AsyncBody(value: ref.watch(requestsProvider), onRetry: () => ref.invalidate(requestsProvider), builder: (d) {
      final list = d['requests'] as List;
      if (list.isEmpty) return Center(child: Text(AppLocalizations.of(context).noRequests));
      return ListView(padding: const EdgeInsets.all(16), children: [for (final r in list) Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(r['goalText'], style: Theme.of(context).textTheme.titleLarge),
        for (final q in r['questions'] as List) Text('• $q'),
        const SizedBox(height: 8),
        if (r['status'] == 'pending') Row(children: [
          FilledButton(onPressed: () => _decide(context, ref, r['_id'], 'accept'), child: Text(t.accept)), const SizedBox(width: 8),
          OutlinedButton(onPressed: () => _decide(context, ref, r['_id'], 'decline'), child: Text(t.decline)),
        ]) else Row(children: [Pill(r['status']), if (r['status'] == 'accepted') TextButton(onPressed: () => context.push('/chat/${r['_id']}'), child: Text(t.chat))]),
      ])))]);
    });
  }
  Future<void> _decide(BuildContext context, WidgetRef ref, String id, String decision) async {
    try { await ref.read(dioProvider).post('/requests/$id/decision', data: {'decision': decision}); ref.invalidate(requestsProvider); }
    catch (e) { if (context.mounted) toast(context, errorText(e)); }
  }
}
