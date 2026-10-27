import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// Admin tools inside the same app (same Firebase sign-in as everyone else; the SERVER checks the admin role on every call).
final _orgsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/admin/organizations'));
final _auditProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/admin/audit-logs'));
final _fairProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/admin/fairness'));

String _tail(dynamic id) { final s = '${id ?? ''}'; return s.length > 6 ? s.substring(s.length - 6) : s; }

// ---------- Companies ----------
class AdminCompanies extends ConsumerWidget {
  const AdminCompanies({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    Future<void> act(String id, String decision) async {
      try { await ref.read(dioProvider).post('/admin/organizations/$id/review', data: {'decision': decision}); ref.invalidate(_orgsProvider); }
      catch (e) { if (context.mounted) toast(context, errorText(e)); }
    }
    return AsyncBody(value: ref.watch(_orgsProvider), onRetry: () => ref.invalidate(_orgsProvider), builder: (d) {
      final list = (d['organizations'] as List).cast<Map>();
      if (list.isEmpty) return Center(child: Text(tr(context, 'No company requests.', 'কোনো কোম্পানির অনুরোধ নেই।'), style: body(17, color: Brand.muted)));
      return ListView(padding: const EdgeInsets.all(16), children: [for (final o in list) AppCard(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [Expanded(child: Text('${o['name']}', style: display(19, color: Brand.ink))), Pill('${o['verificationStatus']}', tone: o['verificationStatus'] == 'verified' ? Tone.green : Tone.saffron)]),
        Text('${o['industry'] ?? ''} · ${o['city'] ?? ''} · ${o['workEmail'] ?? ''}', style: body(14, color: Brand.muted)),
        Text('${tr(context, 'Website', 'ওয়েবসাইট')}: ${o['website'] ?? '-'}', style: body(14, color: Brand.muted)),
        const SizedBox(height: 6),
        Text('${tr(context, 'Private proof (admins only)', 'গোপন প্রমাণ (শুধু অ্যাডমিন)')}: ${o['verificationEvidence'] ?? ''}', style: body(15)),
        const SizedBox(height: 10),
        Wrap(spacing: 8, children: [
          FilledButton(style: FilledButton.styleFrom(backgroundColor: Brand.delta), onPressed: () => act(o['_id'], 'verified'), child: Text(tr(context, 'Verify', 'যাচাই'))),
          OutlinedButton(onPressed: () => act(o['_id'], 'rejected'), child: Text(tr(context, 'Reject', 'বাতিল'))),
          OutlinedButton(style: OutlinedButton.styleFrom(foregroundColor: Colors.red.shade800), onPressed: () => act(o['_id'], 'suspended'), child: Text(tr(context, 'Suspend', 'স্থগিত'))),
        ]),
      ]))]);
    });
  }
}

// ---------- Learning resources ----------
class AdminResources extends ConsumerStatefulWidget {
  const AdminResources({super.key});
  @override
  ConsumerState<AdminResources> createState() => _AdminResources();
}
class _AdminResources extends ConsumerState<AdminResources> {
  bool checking = false;

  Future<void> _check() async {
    setState(() => checking = true);
    try {
      final r = (await ref.read(dioProvider).post('/admin/resources/check-links')).data as Map;
      ref.invalidate(resourcesProvider);
      if (mounted) toast(context, '${r['ok']} ok, ${r['broken']} broken, ${r['blocked']} blocked');
    } catch (e) { if (mounted) toast(context, errorText(e)); }
    finally { if (mounted) setState(() => checking = false); }
  }

  Future<void> _hide(String id) async {
    try { await ref.read(dioProvider).delete('/admin/resources/$id'); ref.invalidate(resourcesProvider); }
    catch (e) { if (mounted) toast(context, errorText(e)); }
  }

  Future<void> _add() async {
    final title = TextEditingController(), url = TextEditingController(), skill = TextEditingController(text: 'sql');
    String lang = 'bn';
    final ok = await showDialog<bool>(context: context, builder: (c) => StatefulBuilder(builder: (c, set) => AlertDialog(
      title: Text(tr(context, 'Add a resource', 'রিসোর্স যোগ করুন')),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: title, decoration: InputDecoration(labelText: tr(context, 'Title', 'শিরোনাম'))), const SizedBox(height: 8),
        TextField(controller: url, decoration: const InputDecoration(labelText: 'https://…')), const SizedBox(height: 8),
        TextField(controller: skill, decoration: InputDecoration(labelText: tr(context, 'Skill key (sql, excel, python…)', 'স্কিল কী (sql, excel, python…)'))), const SizedBox(height: 8),
        SegmentedButton<String>(segments: const [ButtonSegment(value: 'bn', label: Text('বাংলা')), ButtonSegment(value: 'en', label: Text('English'))], selected: {lang}, onSelectionChanged: (s) => set(() => lang = s.first)),
      ])),
      actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(context, 'Cancel', 'বাতিল'))), FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(tr(context, 'Add', 'যোগ করুন')))],
    )));
    if (ok != true) return;
    try {
      await ref.read(dioProvider).post('/admin/resources', data: {'title': title.text.trim(), 'url': url.text.trim(), 'skillKey': skill.text.trim(), 'language': lang});
      ref.invalidate(resourcesProvider);
    } catch (e) { if (mounted) toast(context, errorText(e)); }
  }

  @override
  Widget build(BuildContext context) => AsyncBody(value: ref.watch(resourcesProvider), onRetry: () => ref.invalidate(resourcesProvider), builder: (d) {
        final list = (d['resources'] as List).cast<Map>();
        return ListView(padding: const EdgeInsets.all(16), children: [
          Row(children: [
            Expanded(child: FilledButton.icon(style: FilledButton.styleFrom(backgroundColor: Brand.delta, minimumSize: const Size(0, 48)), onPressed: checking ? null : _check, icon: const Icon(Icons.link), label: Text(tr(context, 'Check all links', 'সব লিংক যাচাই')))),
            const SizedBox(width: 10),
            Expanded(child: OutlinedButton.icon(style: OutlinedButton.styleFrom(minimumSize: const Size(0, 48)), onPressed: _add, icon: const Icon(Icons.add), label: Text(tr(context, 'Add', 'যোগ')))),
          ]),
          const SizedBox(height: 10),
          for (final r in list) AppCard(padding: const EdgeInsets.all(14), child: Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${r['title']}', style: display(16, color: Brand.ink)),
              Text('${r['skillKey']} · ${r['language']}', style: body(13, color: Brand.muted)),
              Pill(r['linkStatus'] == null ? tr(context, 'not checked', 'যাচাই হয়নি') : '${r['linkStatus']} · ${(r['lastLinkCheckedAt'] ?? '').toString().split('T').first}', tone: r['linkStatus'] == 'ok' ? Tone.green : (r['linkStatus'] == null ? Tone.grey : Tone.red)),
            ])),
            IconButton(tooltip: tr(context, 'Hide', 'লুকান'), icon: const Icon(Icons.visibility_off_outlined), onPressed: () => _hide(r['id'])),
          ])),
        ]);
      });
}

// ---------- Insights: audit log, fairness, universities ----------
class AdminInsights extends ConsumerStatefulWidget {
  const AdminInsights({super.key});
  @override
  ConsumerState<AdminInsights> createState() => _AdminInsights();
}
class _AdminInsights extends ConsumerState<AdminInsights> {
  String view = 'audit';

  Future<void> _addUni() async {
    final name = TextEditingController(), short = TextEditingController(), city = TextEditingController(), lat = TextEditingController(), lng = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(
      title: Text(tr(context, 'Add a university', 'বিশ্ববিদ্যালয় যোগ করুন')),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: name, decoration: InputDecoration(labelText: tr(context, 'Full name', 'পূর্ণ নাম'))), const SizedBox(height: 8),
        TextField(controller: short, decoration: InputDecoration(labelText: tr(context, 'Short name', 'সংক্ষিপ্ত নাম'))), const SizedBox(height: 8),
        TextField(controller: city, decoration: InputDecoration(labelText: tr(context, 'City', 'শহর'))), const SizedBox(height: 8),
        TextField(controller: lat, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Latitude (22.3726)')), const SizedBox(height: 8),
        TextField(controller: lng, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Longitude (91.8076)')),
        const SizedBox(height: 8),
        Text(tr(context, 'Use the exact campus pin, not the city centre.', 'শহরের কেন্দ্র নয়, ক্যাম্পাসের সঠিক পিন দিন।'), style: body(13, color: Brand.muted)),
      ])),
      actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(context, 'Cancel', 'বাতিল'))), FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(tr(context, 'Add', 'যোগ করুন')))],
    ));
    if (ok != true) return;
    try {
      await ref.read(dioProvider).post('/admin/universities', data: {'name': name.text.trim(), 'shortName': short.text.trim(), 'city': city.text.trim(), 'lat': double.tryParse(lat.text), 'lng': double.tryParse(lng.text)});
      ref.invalidate(universitiesProvider);
    } catch (e) { if (mounted) toast(context, errorText(e)); }
  }

  @override
  Widget build(BuildContext context) {
    final body0 = switch (view) {
      'fair' => AsyncBody(value: ref.watch(_fairProvider), onRetry: () => ref.invalidate(_fairProvider), builder: (d) => ListView(padding: const EdgeInsets.all(16), children: [
          Text(tr(context, 'Share of recent recommendations', 'সাম্প্রতিক সুপারিশের ভাগ'), style: display(19, color: Brand.ink)),
          Text('${d['total']} ${tr(context, 'recommendations. No mentor should dominate.', 'সুপারিশ। কোনো মেন্টর যেন আধিপত্য না করে।')}', style: body(14, color: Brand.muted)),
          const SizedBox(height: 10),
          for (final m in (d['mentors'] as List).cast<Map>()) Padding(padding: const EdgeInsets.only(bottom: 12), child: Column(children: [
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text('${m['name']}', style: body(16, w: FontWeight.w700)), Text('${m['share']}%', style: display(16, color: Brand.forest))]),
            const SizedBox(height: 4), ProgressBar(((m['share'] ?? 0) as num) / 100),
          ])),
        ])),
      'uni' => AsyncBody(value: ref.watch(universitiesProvider), onRetry: () => ref.invalidate(universitiesProvider), builder: (d) => ListView(padding: const EdgeInsets.all(16), children: [
          FilledButton.icon(style: FilledButton.styleFrom(backgroundColor: Brand.delta, minimumSize: const Size(0, 48)), onPressed: _addUni, icon: const Icon(Icons.add), label: Text(tr(context, 'Add a university', 'বিশ্ববিদ্যালয় যোগ করুন'))),
          const SizedBox(height: 10),
          for (final u in (d as List).cast<Map>()) AppCard(padding: const EdgeInsets.all(14), child: Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${u['name']}', style: display(16, color: Brand.ink)), Text('${u['city']}', style: body(13, color: Brand.muted))])),
            Text('${((u['campus']?['lat'] ?? 0) as num).toStringAsFixed(4)}, ${((u['campus']?['lng'] ?? 0) as num).toStringAsFixed(4)}', style: body(13, color: Brand.muted)),
          ])),
        ])),
      _ => AsyncBody(value: ref.watch(_auditProvider), onRetry: () => ref.invalidate(_auditProvider), builder: (d) {
          final logs = (d['logs'] as List).cast<Map>();
          if (logs.isEmpty) return Center(child: Text(tr(context, 'No actions yet.', 'এখনও কোনো কাজ নেই।'), style: body(16, color: Brand.muted)));
          return ListView(padding: const EdgeInsets.all(16), children: [for (final l in logs) AppCard(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${l['action']}', style: body(16, w: FontWeight.w700)),
            Text('${(l['createdAt'] ?? '').toString().replaceFirst('T', ' ').split('.').first} · ${l['targetType'] ?? ''} ${_tail(l['targetId'])}', style: body(13, color: Brand.muted)),
          ]))]);
        }),
    };
    return Column(children: [
      Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 4), child: SegmentedButton<String>(
        segments: [ButtonSegment(value: 'audit', label: Text(tr(context, 'Audit log', 'অডিট'))), ButtonSegment(value: 'fair', label: Text(tr(context, 'Fairness', 'ন্যায্যতা'))), ButtonSegment(value: 'uni', label: Text(tr(context, 'Campuses', 'ক্যাম্পাস')))],
        selected: {view}, onSelectionChanged: (s) => setState(() => view = s.first),
      )),
      Expanded(child: body0),
    ]);
  }
}
