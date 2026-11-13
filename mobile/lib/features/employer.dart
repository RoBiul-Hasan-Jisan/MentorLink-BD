import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'hiring.dart';
import 'widgets.dart';

// Recruiter dashboard: only for role=employer (the server also checks membership in a verified company).
class EmployerHome extends ConsumerWidget {
  const EmployerHome({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListView(padding: EdgeInsets.zero, children: [
      GreenHeader(radius: 36, bottomPad: 26, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(tr(context, 'Recruiter dashboard', 'রিক্রুটার ড্যাশবোর্ড'), style: display(28, color: Colors.white)),
        const SizedBox(height: 6),
        Text(tr(context, 'Your jobs and applicants', 'আপনার চাকরি ও আবেদনকারী'), style: body(16, color: Colors.white70)),
      ])),
      Padding(padding: const EdgeInsets.all(16), child: Column(children: [
        const HiringInboxCard(),
        BigButton(tr(context, 'Post a job', 'চাকরি পোস্ট করুন'), onPressed: () => _post(context, ref)),
        const SizedBox(height: 12),
        AsyncBody(value: ref.watch(employerJobsProvider), onRetry: () => ref.invalidate(employerJobsProvider), builder: (d) {
          final jobs = (d['jobs'] as List).cast<Map>();
          if (jobs.isEmpty) return AppCard(child: Text(tr(context, 'No jobs yet. Your first post is reviewed by an admin.', 'এখনও কোনো চাকরি নেই। প্রথম পোস্ট অ্যাডমিন পর্যালোচনা করবেন।'), style: body(16)));
          return Column(children: [for (final j in jobs) AppCard(padding: const EdgeInsets.all(16), onTap: () => context.push('/job/${j['_id']}/pipeline'), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [Expanded(child: Text(j['title'], style: display(20, color: Brand.ink))), Pill(j['closed'] == true ? tr(context, 'Closed', 'বন্ধ') : j['status'], tone: j['status'] == 'approved' && j['closed'] != true ? Tone.green : Tone.saffron)]),
            const SizedBox(height: 6),
            Text(tr(context, '${j['applicants']} applicants', '${j['applicants']} জন আবেদনকারী'), style: body(15, color: Brand.muted)),
            if ((j['suspiciousFlags'] as List).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Pill('⚠ ${(j['suspiciousFlags'] as List).join(', ')}', tone: Tone.red)),
            if (j['closed'] != true) Align(alignment: Alignment.centerRight, child: TextButton(onPressed: () async { await ref.read(dioProvider).post('/employer/jobs/${j['_id']}/close'); ref.invalidate(employerJobsProvider); }, child: Text(tr(context, 'Close job', 'চাকরি বন্ধ করুন')))),
          ]))]);
        }),
      ])),
    ]);
  }

  Future<void> _post(BuildContext context, WidgetRef ref) async {
    final title = TextEditingController(), desc = TextEditingController();
    bool noFee = false;
    final ok = await showDialog<bool>(context: context, builder: (c) => StatefulBuilder(builder: (c, set) => AlertDialog(
      title: Text(tr(context, 'New job', 'নতুন চাকরি'), style: display(20)),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: title, decoration: InputDecoration(labelText: tr(context, 'Job title', 'পদবি'))), const SizedBox(height: 8),
        TextField(controller: desc, maxLines: 4, decoration: InputDecoration(labelText: tr(context, 'Description (20+ characters)', 'বিবরণ (২০+ অক্ষর)'))),
        CheckboxListTile(contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.leading, value: noFee, onChanged: (v) => set(() => noFee = v == true), title: Text(tr(context, 'This post never asks applicants for money', 'এই পোস্টে আবেদনকারীর কাছে কখনও টাকা চাওয়া হয় না'), style: body(14))),
      ])),
      actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(context, 'Cancel', 'বাতিল'))), FilledButton(onPressed: noFee ? () => Navigator.pop(c, true) : null, child: Text(tr(context, 'Post', 'পোস্ট')))])));
    if (ok != true) return;
    try {
      await ref.read(dioProvider).post('/employer/jobs', data: {'title': title.text, 'description': desc.text, 'noFeeConfirmed': true});
      ref.invalidate(employerJobsProvider);
      if (context.mounted) toast(context, tr(context, 'Posted', 'পোস্ট হয়েছে'));
    } catch (e) { if (context.mounted) toast(context, errorText(e)); }
  }
}

class ApplicantsScreen extends ConsumerWidget {
  const ApplicantsScreen({super.key, required this.jobId, this.title});
  final String jobId; final String? title;
  // Direct link / refresh: the title is looked up from the recruiter's own job list instead of router state.
  String? _jobTitle(WidgetRef ref) {
    final jobs = ref.watch(employerJobsProvider).valueOrNull;
    if (jobs == null) return null;
    for (final j in (jobs['jobs'] as List)) { if (j is Map && '${j['_id']}' == jobId) return '${j['title']}'; }
    return null;
  }
  static const next = {'Applied': ['Under Review', 'Shortlisted', 'Rejected'], 'Under Review': ['Shortlisted', 'Rejected'], 'Shortlisted': ['Interview', 'Rejected'], 'Interview': ['Offer', 'Rejected'], 'Offer': ['Hired', 'Rejected']};
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(body: Column(children: [
        GreenHeader(radius: 28, bottomPad: 18, child: Row(children: [BackCircle(dark: true, onTap: () => context.pop()), const SizedBox(width: 12), Expanded(child: Text(title ?? _jobTitle(ref) ?? tr(context, 'Applicants', 'আবেদনকারী'), style: display(22, color: Colors.white)))])),
        Expanded(child: AsyncBody(value: ref.watch(applicantsProvider(jobId)), onRetry: () => ref.invalidate(applicantsProvider(jobId)), builder: (d) {
          final list = (d['applicants'] as List).cast<Map>();
          if (list.isEmpty) return Center(child: Text(tr(context, 'No applicants yet.', 'এখনও কোনো আবেদনকারী নেই।'), style: body(17, color: Brand.muted)));
          return ListView(padding: const EdgeInsets.all(16), children: [for (final a in list) AppCard(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [Expanded(child: Text(a['name'] ?? tr(context, 'Name not shared', 'নাম শেয়ার করা হয়নি'), style: display(19, color: Brand.ink))), Pill(a['stage'], tone: Tone.blue)]),
            Text(tr(context, 'Shared with you: ${(a['sharedFields'] as List).join(', ')}', 'আপনার সাথে শেয়ার: ${(a['sharedFields'] as List).join(', ')}'), style: body(14, color: Brand.muted)),
            if (a['cv'] is Map) Padding(padding: const EdgeInsets.only(top: 6), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if ('${(a['cv'] as Map)['headline'] ?? ''}'.isNotEmpty) Text('${(a['cv'] as Map)['headline']}', style: body(15, w: FontWeight.w700)),
              Text('${(a['cv'] as Map)['summary'] ?? ''}', style: body(15)),
              if (((a['cv'] as Map)['projects'] is List) && ((a['cv'] as Map)['projects'] as List).isNotEmpty) Text('${tr(context, 'Projects', 'প্রজেক্ট')}: ${((a['cv'] as Map)['projects'] as List).map((p) => p is Map ? '${p['title']}' : '').where((x) => x.isNotEmpty).join(', ')}', style: body(14, color: Brand.muted)),
              if ((((a['cv'] as Map)['contact'] as Map?)?['email'] ?? '').toString().isNotEmpty) Text('${((a['cv'] as Map)['contact'] as Map)['email']}  ${((a['cv'] as Map)['contact'] as Map)['phone'] ?? ''}', style: body(14, color: Brand.forest)),
            ])),
            if (next[a['stage']] != null) Wrap(spacing: 8, children: [for (final s in next[a['stage']]!) ActionChip(label: Text(s), onPressed: () async {
              try { await ref.read(dioProvider).patch('/employer/applications/${a['id']}/stage', data: {'stage': s}); ref.invalidate(applicantsProvider(jobId)); }
              catch (e) { if (context.mounted) toast(context, errorText(e)); }
            })]),
          ]))]);
        })),
      ]));
}

// A student asks to register a company. Role stays "student" until an admin verifies the company.
Future<void> registerCompany(BuildContext context, WidgetRef ref) async {
  final name = TextEditingController(), web = TextEditingController(), email = TextEditingController(), ev = TextEditingController();
  final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(
    title: Text(tr(context, 'Register your company', 'আপনার কোম্পানি নিবন্ধন করুন'), style: display(20)),
    content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
      TextField(controller: name, decoration: InputDecoration(labelText: tr(context, 'Company name', 'কোম্পানির নাম'))), const SizedBox(height: 8),
      TextField(controller: web, decoration: const InputDecoration(labelText: 'Website (https://…)')), const SizedBox(height: 8),
      TextField(controller: email, decoration: InputDecoration(labelText: tr(context, 'Work email', 'অফিসিয়াল ইমেইল'))), const SizedBox(height: 8),
      TextField(controller: ev, maxLines: 2, decoration: InputDecoration(labelText: tr(context, 'Proof (licence no., LinkedIn page…)', 'প্রমাণ (লাইসেন্স নম্বর, লিংকডইন…)'))),
    ])),
    actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(context, 'Cancel', 'বাতিল'))), FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(tr(context, 'Send for review', 'পর্যালোচনায় পাঠান')))]));
  if (ok != true) return;
  try {
    await ref.read(dioProvider).post('/orgs/register', data: {'name': name.text, if (web.text.isNotEmpty) 'website': web.text, 'workEmail': email.text, 'verificationEvidence': ev.text});
    ref.invalidate(myOrgProvider);
    if (context.mounted) toast(context, tr(context, 'Sent. An admin will review it.', 'পাঠানো হয়েছে। অ্যাডমিন পর্যালোচনা করবেন।'));
  } catch (e) { if (context.mounted) toast(context, errorText(e)); }
}
