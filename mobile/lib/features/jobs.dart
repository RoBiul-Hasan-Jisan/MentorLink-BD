import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

class OpportunitiesScreen extends ConsumerStatefulWidget {
  const OpportunitiesScreen({super.key});
  @override
  ConsumerState<OpportunitiesScreen> createState() => _OppState();
}
class _OppState extends ConsumerState<OpportunitiesScreen> {
  String filter = 'all';
  @override
  Widget build(BuildContext context) {
    final chips = {'all': tr(context, 'All', 'সব'), 'internship': tr(context, 'Internship', 'ইন্টার্নশিপ'), 'job': tr(context, 'Full time', 'ফুল টাইম'), 'other': tr(context, 'Freelance', 'ফ্রিল্যান্স')};
    return AsyncBody(value: ref.watch(opportunitiesProvider), onRetry: () => ref.invalidate(opportunitiesProvider), builder: (d) {
      final list = (d['opportunities'] as List).cast<Map>().where((o) => filter == 'all' || o['type'] == filter).toList();
      return ListView(padding: const EdgeInsets.fromLTRB(16, 0, 16, 24), children: [
        SafeArea(bottom: false, child: Padding(padding: const EdgeInsets.only(top: 12, bottom: 12), child: Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(tr(context, 'Opportunities', 'সুযোগ'), style: display(32, color: Brand.ink)), Text(tr(context, 'Vetted by admins · no fee, ever', 'অ্যাডমিন যাচাইকৃত · কখনও ফি নয়'), style: body(15, color: Brand.muted))])),
          InkWell(borderRadius: BorderRadius.circular(24), onTap: () => context.push('/applications'), child: Pill(tr(context, 'My applications', 'আমার আবেদন'), tone: Tone.blue)),
        ]))),
        AppCard(color: Brand.lightSaffron, border: Colors.transparent, padding: const EdgeInsets.all(16), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Icon(Icons.shield_outlined, color: Color(0xFF7A4A00)), const SizedBox(width: 12),
          Expanded(child: Text.rich(TextSpan(children: [TextSpan(text: tr(context, 'Scam tip: ', 'স্ক্যাম টিপ: '), style: body(16, color: const Color(0xFF5A3600), w: FontWeight.w800)), TextSpan(text: tr(context, 'Real internships never ask for registration fees or money for a "security deposit". Tap Report if unsure.', 'আসল ইন্টার্নশিপে কখনও রেজিস্ট্রেশন ফি বা সিকিউরিটি ডিপোজিট চায় না। সন্দেহ হলে রিপোর্ট করুন।'), style: body(16, color: const Color(0xFF5A3600))) ]))),
        ])),
        SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [for (final e in chips.entries) Padding(padding: const EdgeInsets.only(right: 8), child: InkWell(borderRadius: BorderRadius.circular(30), onTap: () => setState(() => filter = e.key), child: Container(padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14), decoration: BoxDecoration(color: filter == e.key ? Brand.delta : Colors.white, borderRadius: BorderRadius.circular(30), border: Border.all(color: const Color(0xFFD5DDD7))), child: Text(e.value, style: display(16, color: filter == e.key ? Colors.white : Brand.ink, w: FontWeight.w700)))))])),
        const SizedBox(height: 12),
        if (list.isEmpty) AppCard(child: Text(tr(context, 'No approved listings yet.', 'এখনও কোনো অনুমোদিত সুযোগ নেই।'), style: body(16))),
        for (int i = 0; i < list.length; i++) _card(context, list[i], i == 0),
      ]);
    });
  }

  Widget _card(BuildContext context, Map o, bool first) {
    final fit = o['fit'] as num?;
    final labels = o['labels'] as Map;
    final src = labels['source'] == 'verified_alumni' ? tr(context, 'Verified alumni post', 'যাচাইকৃত অ্যালামনাই পোস্ট') : tr(context, 'Admin post', 'অ্যাডমিন পোস্ট');
    return AppCard(border: first ? Brand.delta : null, padding: const EdgeInsets.all(18), onTap: () => context.push('/opportunity/${o['id']}'), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(o['title'], style: display(21, color: Brand.ink)), Text('${o['organization']}${o['locationText'] != null ? ' · ${o['locationText']}' : ''}', style: body(15, color: Brand.muted))])),
        if (fit != null) Column(children: [Text('$fit%', style: display(24, color: fit >= 60 ? Brand.forest : const Color(0xFF9A5B00))), Text(tr(context, 'your fit', 'আপনার মিল'), style: body(14, color: Brand.muted))]),
      ]),
      if (fit != null) ...[const SizedBox(height: 10), ProgressBar(fit / 100, color: fit >= 60 ? Brand.delta : Brand.saffron, height: 8)],
      const SizedBox(height: 12),
      Wrap(spacing: 8, runSpacing: 8, children: [
        Pill(src),
        if (labels['noFeeDeclared'] == true) Pill(tr(context, 'No fee confirmed', 'কোনো ফি নেই')),
        if (labels['listingReviewed'] == true) Pill(tr(context, 'Listing reviewed', 'তালিকা পর্যালোচিত')),
        if (o['applicationDeadline'] != null) Pill(tr(context, 'Closes ${(o['applicationDeadline'] as String).substring(0, 10)}', 'শেষ ${(o['applicationDeadline'] as String).substring(0, 10)}'), tone: Tone.saffron),
      ]),
    ]));
  }

  void _detail(BuildContext context, Map o) {
    showModalBottomSheet(context: context, isScrollControlled: true, backgroundColor: Colors.white, shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))), builder: (c) => Padding(padding: const EdgeInsets.all(20), child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(o['title'], style: display(24, color: Brand.ink)), Text(o['organization'], style: body(16, color: Brand.muted)),
      const SizedBox(height: 12), Text(o['description'], style: body(16)), const SizedBox(height: 16),
      BigButton(tr(context, 'Apply', 'আবেদন করুন'), onPressed: () { Navigator.pop(c); _apply(context, o['id']); }),
      TextButton.icon(onPressed: () { Navigator.pop(c); _report(context, o['id']); }, icon: const Icon(Icons.flag_outlined, color: Color(0xFF9B2C1F)), label: Text(tr(context, 'Report this post', 'পোস্টটি রিপোর্ট করুন'), style: body(16, color: const Color(0xFF9B2C1F), w: FontWeight.w700))),
    ])));
  }

  Future<void> _apply(BuildContext context, String id) async {
    bool consent = false;
    final go = await showDialog<bool>(context: context, builder: (c) => StatefulBuilder(builder: (c, set) => AlertDialog(
      title: Text(tr(context, 'Share with this poster?', 'এই পোস্টদাতার সাথে শেয়ার করবেন?'), style: display(20)),
      content: CheckboxListTile(value: consent, controlAffinity: ListTileControlAffinity.leading, title: Text(tr(context, 'I agree to share my name and CV with this poster', 'আমি এই পোস্টদাতার সাথে আমার নাম ও সিভি শেয়ার করতে রাজি')), onChanged: (v) => set(() => consent = v == true)),
      actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(context, 'Cancel', 'বাতিল'))), FilledButton(onPressed: consent ? () => Navigator.pop(c, true) : null, child: Text(tr(context, 'Apply', 'আবেদন')))])));
    if (go != true) return;
    try {
      final dio = ref.read(dioProvider);
      var cvs = (await dio.get('/me/cv')).data['versions'] as List;
      if (cvs.isEmpty) { await dio.post('/me/cv', data: {'data': {'summary': 'Student at my university'}}); cvs = (await dio.get('/me/cv')).data['versions'] as List; }
      await dio.post('/opportunities/$id/apply', data: {'cvVersionId': cvs.first['_id'], 'consent': true, 'sharedFields': ['name', 'cv']});
      ref.invalidate(applicationsProvider);
      if (context.mounted) toast(context, tr(context, 'Applied', 'আবেদন করা হয়েছে'));
    } catch (e) { if (context.mounted) toast(context, errorText(e)); }
  }

  Future<void> _report(BuildContext context, String id) async {
    try { await ref.read(dioProvider).post('/reports', data: {'targetType': 'opportunity', 'targetId': id, 'reason': 'Suspicious or asks for money'}); if (context.mounted) toast(context, tr(context, 'Reported. Thank you.', 'রিপোর্ট করা হয়েছে। ধন্যবাদ।')); }
    catch (e) { if (context.mounted) toast(context, errorText(e)); }
  }
}

class ApplicationsScreen extends ConsumerWidget {
  const ApplicationsScreen({super.key});
  static const stages = ['Applied', 'Shortlisted', 'Interview', 'Selected'];
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
        body: SafeArea(child: AsyncBody(value: ref.watch(applicationsProvider), onRetry: () => ref.invalidate(applicationsProvider), builder: (d) {
          final apps = (d['applications'] as List).cast<Map>();
          return ListView(padding: const EdgeInsets.all(16), children: [
            Row(children: [BackCircle(onTap: () => context.pop()), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(tr(context, 'My applications', 'আমার আবেদন'), style: display(28, color: Brand.ink)), Text(tr(context, '${apps.length} total', 'মোট ${apps.length}'), style: body(15, color: Brand.muted))]))]),
            const SizedBox(height: 14),
            if (apps.isEmpty) AppCard(child: Text(tr(context, 'No applications yet.', 'এখনও কোনো আবেদন নেই।'), style: body(16))),
            for (int i = 0; i < apps.length; i++) _app(context, ref, apps[i], i == 0),
            AppCard(color: const Color(0xFFF0F5F1), padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr(context, 'Help improve recommendations', 'সুপারিশ উন্নত করতে সাহায্য করুন'), style: display(19, color: Brand.ink)),
              const SizedBox(height: 4), Text(tr(context, 'Did mentoring help with your applications?', 'মেন্টরিং কি আপনার আবেদনে সাহায্য করেছে?'), style: body(16, color: Brand.muted)),
              const SizedBox(height: 10),
              Row(children: [for (final o in [('yes', tr(context, 'Yes, a lot', 'হ্যাঁ, অনেক')), ('little', tr(context, 'A little', 'একটু')), ('not_yet', tr(context, 'Not yet', 'এখনও না'))]) Expanded(child: Padding(padding: const EdgeInsets.only(right: 8), child: OutlinedButton(style: OutlinedButton.styleFrom(minimumSize: const Size(0, 48), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), side: const BorderSide(color: Color(0xFFD5DDD7))), onPressed: apps.isEmpty ? null : () async { await ref.read(dioProvider).post('/applications/${apps.first['id']}/outcome', data: {'outcomeFeedback': o.$1}); if (context.mounted) toast(context, tr(context, 'Thanks!', 'ধন্যবাদ!')); }, child: Text(o.$2, style: display(14, color: Brand.ink, w: FontWeight.w700)))))]),
            ])),
          ]);
        })),
      );

  Widget _app(BuildContext context, WidgetRef ref, Map a, bool first) {
    final stage = a['stage'] as String;
    final reached = stages.indexOf(stage);
    final withdrawn = a['withdrawn'] == true;
    final notSel = stage == 'Not selected';
    return AppCard(border: first ? Brand.delta : null, padding: const EdgeInsets.all(18), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [Expanded(child: Text(a['opportunity']?['title'] ?? '', style: display(21, color: Brand.ink))), Pill(withdrawn ? tr(context, 'Withdrawn', 'প্রত্যাহার') : stage, tone: notSel || withdrawn ? Tone.grey : (stage == 'Applied' ? Tone.blue : Tone.saffron))]),
      Text(a['opportunity']?['organization'] ?? '', style: body(15, color: Brand.muted)),
      const SizedBox(height: 12),
      if (!withdrawn && !notSel) for (int i = 0; i < stages.length; i++) Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Column(children: [
          Container(width: 30, height: 30, decoration: BoxDecoration(shape: BoxShape.circle, color: i < reached ? Brand.delta : (i == reached ? Brand.saffron : Colors.transparent), border: Border.all(color: i <= reached ? (i == reached ? Brand.saffron : Brand.delta) : Brand.field, width: 3)), child: i < reached ? const Icon(Icons.check, size: 16, color: Colors.white) : null),
          if (i < stages.length - 1) Container(width: 3, height: 30, color: i < reached ? Brand.delta : Brand.line),
        ]),
        const SizedBox(width: 12),
        Expanded(child: Padding(padding: const EdgeInsets.only(top: 3), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(stages[i], style: display(17, color: i <= reached ? Brand.ink : Brand.muted, w: FontWeight.w700)),
          if (i == reached && (a['statusMessage'] ?? '') != '') Text(a['statusMessage'], style: body(15, color: Brand.muted)),
        ]))),
      ]),
      if (withdrawn || notSel) Text(a['statusMessage'] ?? '', style: body(15, color: Brand.muted)),
      if (stage == 'Interview' && !withdrawn) Padding(padding: const EdgeInsets.only(top: 8), child: BigButton(tr(context, 'Practise with a mock interview', 'মক ইন্টারভিউ অনুশীলন করুন'), outlined: true, onPressed: () => context.push('/mock-interviews'))),
      if (!withdrawn && !notSel && stage != 'Selected') TextButton(onPressed: () async { await ref.read(dioProvider).post('/applications/${a['id']}/withdraw'); ref.invalidate(applicationsProvider); }, child: Text(tr(context, 'Withdraw application', 'আবেদন প্রত্যাহার'), style: body(15, color: const Color(0xFF9B2C1F), w: FontWeight.w700))),
    ]));
  }
}
