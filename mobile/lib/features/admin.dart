import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

final adminDeptApplicationsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/admin/department-applications'));

// Admin review queue: accounts, mentor applications, department applications and job posts, each with proof and flags.
class AdminQueue extends ConsumerStatefulWidget {
  const AdminQueue({super.key});
  @override
  ConsumerState<AdminQueue> createState() => _AdminQueueState();
}

class _AdminQueueState extends ConsumerState<AdminQueue> {
  String tab = 'accounts'; // accounts | mentors | departments | posts

  void _reload() {
    ref.invalidate(queueProvider);
    ref.invalidate(adminDeptApplicationsProvider);
  }

  Future<void> _act(String path, String decision) async {
    try {
      await ref.read(dioProvider).post(path, data: {'decision': decision});
      _reload();
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  // Opens the private proof images. Every view is written to the audit log by the server.
  Future<void> _proof(String userId) async {
    try {
      final r = await ref.read(dioProvider).get('/admin/verification-docs/$userId');
      final docs = ((r.data['docs'] ?? []) as List).cast<Map>();
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (c) => AlertDialog(
          title: Text(tr(context, 'Proof documents', 'প্রমাণপত্র')),
          content: SizedBox(
            width: 320,
            child: docs.isEmpty
                ? Text(tr(context, 'No document uploaded.', 'কোনো ডকুমেন্ট আপলোড হয়নি।'))
                : SingleChildScrollView(
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      for (final d in docs) ...[
                        Text('${d['kind']}', style: body(14, w: FontWeight.w700)),
                        const SizedBox(height: 4),
                        if ('${d['mime']}'.startsWith('image/'))
                          Image.memory(base64Decode('${d['dataBase64']}'), fit: BoxFit.contain)
                        else
                          Text(tr(context, 'PDF file (${d['sizeBytes']} bytes). Open it from the web admin panel.', 'পিডিএফ ফাইল। ওয়েব অ্যাডমিন প্যানেলে খুলুন।')),
                        const SizedBox(height: 12),
                      ],
                    ]),
                  ),
          ),
          actions: [TextButton(onPressed: () => Navigator.pop(c), child: Text(tr(context, 'Close', 'বন্ধ')))],
        ),
      );
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  Widget _buttons(String path, String yes, String no) => Row(mainAxisSize: MainAxisSize.min, children: [
        IconButton.filled(style: IconButton.styleFrom(backgroundColor: Brand.delta), icon: const Icon(Icons.check), tooltip: tr(context, 'Approve', 'অনুমোদন'), onPressed: () => _act(path, yes)),
        IconButton.outlined(icon: const Icon(Icons.close), tooltip: tr(context, 'Reject', 'বাতিল'), onPressed: () => _act(path, no)),
      ]);

  Widget _item(String title, String sub, Widget trailing, {String? proofUserId, List flags = const []}) => AppCard(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: display(18, color: Brand.ink)),
              if (sub.isNotEmpty) Text(sub, style: body(14, color: Brand.muted)),
            ])),
            trailing,
          ]),
          if (flags.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Wrap(spacing: 6, runSpacing: 4, children: [for (final f in flags) Pill('$f', tone: Tone.red)])),
          if (proofUserId != null) Align(alignment: Alignment.centerLeft, child: TextButton.icon(onPressed: () => _proof(proofUserId), icon: const Icon(Icons.visibility_outlined, size: 18), label: Text(tr(context, 'View proof', 'প্রমাণ দেখুন')))),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final depts = ref.watch(adminDeptApplicationsProvider).valueOrNull;
    return AsyncBody(
      value: ref.watch(queueProvider),
      onRetry: _reload,
      builder: (d) {
        final users = ((d['users'] ?? []) as List).cast<Map>();
        final apps = ((d['mentorApplications'] ?? []) as List).cast<Map>();
        final opps = ((d['opportunities'] ?? []) as List).cast<Map>();
        final hiddenOpps = ((d['hiddenOpportunities'] ?? []) as List).cast<Map>();
        final deptApps = ((depts?['applications'] ?? []) as List).cast<Map>();
        Widget chip(String k, String label, int n) => Padding(
              padding: const EdgeInsets.only(right: 8),
              child: ChoiceChip(label: Text('$label ($n)'), selected: tab == k, onSelected: (_) => setState(() => tab = k)),
            );
        final rows = <Widget>[];
        if (tab == 'accounts') {
          for (final u in users) {
            rows.add(_item('${u['displayName']}', '${u['role']} · ${u['email']}${u['department'] != null ? ' · ${u['department']}' : ''}', _buttons('/admin/users/${u['_id']}/verify', 'verified', 'rejected'), proofUserId: '${u['_id']}'));
          }
        } else if (tab == 'mentors') {
          for (final u in apps) {
            final a = (u['mentorApplication'] ?? {}) as Map;
            rows.add(_item('${u['displayName']}', '${a['roleTitle']} · ${a['industry']} · ${a['yearsExperience']} yrs${a['proof'] != null ? '\n${a['proof']}' : ''}', _buttons('/admin/mentor-applications/${u['_id']}', 'approved', 'rejected'), proofUserId: '${u['_id']}'));
          }
        } else if (tab == 'departments') {
          for (final u in deptApps) {
            final a = (u['departmentApplication'] ?? {}) as Map;
            rows.add(_item('${u['displayName']}', '${u['email']}${a['note'] != null ? '\n${a['note']}' : ''}', _buttons('/admin/department-applications/${u['_id']}', 'approved', 'rejected'), proofUserId: '${u['_id']}'));
          }
        } else if (tab == 'hidden') {
          for (final o in hiddenOpps) {
            rows.add(_item('${o['title']}', '${o['organization']} · ${tr(context, 'hidden after reports', 'রিপোর্টের পর লুকানো')}', Row(mainAxisSize: MainAxisSize.min, children: [
              TextButton(onPressed: () => _act('/admin/opportunities/${o['_id']}/review', 'restore'), child: Text(tr(context, 'Restore', 'ফিরিয়ে দিন'))),
              TextButton(onPressed: () => _act('/admin/opportunities/${o['_id']}/review', 'remove'), child: Text(tr(context, 'Remove', 'মুছুন'), style: const TextStyle(color: Color(0xFF9B2C1F)))),
            ]), flags: (o['suspiciousFlags'] ?? []) as List));
          }
        } else {
          for (final o in opps) {
            rows.add(_item('${o['title']}', '${o['organization']}', _buttons('/admin/opportunities/${o['_id']}/review', 'approve', 'reject'), flags: (o['suspiciousFlags'] ?? []) as List));
          }
        }
        return ListView(padding: const EdgeInsets.all(16), children: [
          SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
            chip('accounts', tr(context, 'Accounts', 'অ্যাকাউন্ট'), users.length),
            chip('mentors', tr(context, 'Mentors', 'মেন্টর'), apps.length),
            chip('departments', tr(context, 'Departments', 'বিভাগ'), deptApps.length),
            chip('posts', tr(context, 'Posts', 'পোস্ট'), opps.length),
            chip('hidden', tr(context, 'Reported', 'রিপোর্টকৃত'), hiddenOpps.length),
          ])),
          const SizedBox(height: 12),
          if (rows.isEmpty) AppCard(child: Text(tr(context, 'Nothing waiting for review.', 'পর্যালোচনার জন্য কিছু নেই।'), style: body(17))),
          ...rows,
          Text(tr(context, 'Roles are set here by an admin only. Viewing proof is logged.', 'রোল শুধু অ্যাডমিন ঠিক করেন। প্রমাণ দেখা লগে থাকে।'), style: body(13, color: Brand.muted)),
        ]);
      },
    );
  }
}
