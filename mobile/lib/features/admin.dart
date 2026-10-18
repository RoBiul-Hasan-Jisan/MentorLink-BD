import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../l10n/app_localizations.dart';
import 'widgets.dart';

class AdminQueue extends ConsumerWidget {
  const AdminQueue({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context);
    Future<void> act(String path, String decision) async {
      try { await ref.read(dioProvider).post(path, data: {'decision': decision}); ref.invalidate(queueProvider); }
      catch (e) { if (context.mounted) toast(context, errorText(e)); }
    }
    return AsyncBody(value: ref.watch(queueProvider), onRetry: () => ref.invalidate(queueProvider), builder: (d) => ListView(padding: const EdgeInsets.all(16), children: [
      for (final u in d['mentorApplications'] as List) Card(child: ListTile(title: Text('${u['displayName']} → mentor'), subtitle: Text('${u['mentorApplication']['roleTitle']} · ${u['mentorApplication']['industry']}'),
        trailing: Wrap(children: [IconButton(icon: const Icon(Icons.check), tooltip: t.approve, onPressed: () => act('/admin/mentor-applications/${u['_id']}', 'approved')), IconButton(icon: const Icon(Icons.close), tooltip: t.reject, onPressed: () => act('/admin/mentor-applications/${u['_id']}', 'rejected'))]))),
      for (final u in d['users'] as List) Card(child: ListTile(title: Text(u['displayName']), subtitle: Text('${u['role']} · ${u['email']}'),
        trailing: Wrap(children: [IconButton(icon: const Icon(Icons.check), onPressed: () => act('/admin/users/${u['_id']}/verify', 'verified')), IconButton(icon: const Icon(Icons.close), onPressed: () => act('/admin/users/${u['_id']}/verify', 'rejected'))]))),
      for (final o in d['opportunities'] as List) Card(child: ListTile(title: Text(o['title']), subtitle: Text('${o['organization']}${(o['suspiciousFlags'] as List).isNotEmpty ? '\n⚠ ${(o['suspiciousFlags'] as List).join(', ')}' : ''}'),
        trailing: Wrap(children: [IconButton(icon: const Icon(Icons.check), onPressed: () => act('/admin/opportunities/${o['_id']}/review', 'approve')), IconButton(icon: const Icon(Icons.close), onPressed: () => act('/admin/opportunities/${o['_id']}/review', 'reject'))]))),
    ]));
  }
}

class DeptOverview extends ConsumerWidget {
  const DeptOverview({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => AsyncBody(value: ref.watch(deptProvider), builder: (d) => ListView(padding: const EdgeInsets.all(16), children: [
    Card(child: ListTile(title: const Text('Students'), trailing: Text('${d['students'] ?? '—'}'))),
    Card(child: ListTile(title: const Text('Applications'), trailing: Text('${d['applications'] ?? '—'}'))),
    for (final g in d['careerGoals'] as List) Card(child: ListTile(title: Text(g['role']), trailing: Text('${g['count']}'))),
    Text(d['note'] ?? '', style: const TextStyle(fontSize: 12)),
  ]));
}
