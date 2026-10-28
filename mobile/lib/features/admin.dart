import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

class AdminQueue extends ConsumerWidget {
  const AdminQueue({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    Future<void> act(String path, String decision) async {
      try { await ref.read(dioProvider).post(path, data: {'decision': decision}); ref.invalidate(queueProvider); }
      catch (e) { if (context.mounted) toast(context, errorText(e)); }
    }
    Widget buttons(String path, String yes, String no) => Row(mainAxisSize: MainAxisSize.min, children: [
          IconButton.filled(style: IconButton.styleFrom(backgroundColor: Brand.delta), icon: const Icon(Icons.check), tooltip: tr(context, 'Approve', 'অনুমোদন'), onPressed: () => act(path, yes)),
          IconButton.outlined(icon: const Icon(Icons.close), tooltip: tr(context, 'Reject', 'বাতিল'), onPressed: () => act(path, no)),
        ]);
    Widget item(String title, String sub, Widget trailing) => AppCard(padding: const EdgeInsets.all(14), child: Row(children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: display(18, color: Brand.ink)), Text(sub, style: body(14, color: Brand.muted))])), trailing]));
    return AsyncBody(value: ref.watch(queueProvider), onRetry: () => ref.invalidate(queueProvider), builder: (d) {
      final apps = (d['mentorApplications'] as List).cast<Map>(), users = (d['users'] as List).cast<Map>(), opps = (d['opportunities'] as List).cast<Map>();
      return ListView(padding: const EdgeInsets.all(16), children: [
        if (apps.isEmpty && users.isEmpty && opps.isEmpty) AppCard(child: Text(tr(context, 'Nothing waiting for review.', 'পর্যালোচনার জন্য কিছু নেই।'), style: body(17))),
        for (final u in apps) item('${u['displayName']} → mentor', '${u['mentorApplication']['roleTitle']} · ${u['mentorApplication']['industry']}', buttons('/admin/mentor-applications/${u['_id']}', 'approved', 'rejected')),
        for (final u in users) item(u['displayName'], '${u['role']} · ${u['email']}', buttons('/admin/users/${u['_id']}/verify', 'verified', 'rejected')),
        for (final o in opps) item(o['title'], '${o['organization']}${(o['suspiciousFlags'] as List).isNotEmpty ? '\n⚠ ${(o['suspiciousFlags'] as List).join(', ')}' : ''}', buttons('/admin/opportunities/${o['_id']}/review', 'approve', 'reject')),
      ]);
    });
  }
}

class DeptOverview extends ConsumerWidget {
  const DeptOverview({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => AsyncBody(value: ref.watch(deptProvider), builder: (d) => ListView(padding: const EdgeInsets.all(16), children: [
        AppCard(child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(tr(context, 'Students', 'শিক্ষার্থী'), style: display(19, color: Brand.ink)), Text('${d['students'] ?? '—'}', style: display(26, color: Brand.forest))])),
        AppCard(child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(tr(context, 'Applications', 'আবেদন'), style: display(19, color: Brand.ink)), Text('${d['applications'] ?? '—'}', style: display(26, color: Brand.forest))])),
        for (final g in d['careerGoals'] as List) AppCard(child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(g['role'], style: body(17, w: FontWeight.w700)), Text('${g['count']}', style: display(22, color: Brand.forest))])),
        Text(d['note'] ?? '', style: body(13, color: Brand.muted)),
      ]));
}
