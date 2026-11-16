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
    // A recruiter whose company is not verified yet can do nothing but wait (the server enforces this too).
    final org = (ref.watch(myOrgProvider).valueOrNull ?? const {})['organization'] as Map?;
    if (org != null && org['verificationStatus'] != 'verified') {
      final rejected = org['verificationStatus'] == 'rejected' || org['verificationStatus'] == 'suspended';
      return ListView(padding: const EdgeInsets.all(24), children: [
        const SizedBox(height: 40),
        AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(rejected ? tr(context, 'Your company was not approved', 'আপনার কোম্পানি অনুমোদিত হয়নি') : tr(context, 'Waiting for admin verification', 'অ্যাডমিনের যাচাইয়ের অপেক্ষায়'), style: display(22, color: Brand.ink)),
          const SizedBox(height: 8),
          Text('${org['name']}', style: body(17, w: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(rejected ? tr(context, 'Please contact support if you think this is a mistake.', 'ভুল মনে হলে সাপোর্টের সাথে যোগাযোগ করুন।') : tr(context, 'An admin checks your company proof. You can post jobs as soon as it is verified.', 'অ্যাডমিন আপনার কোম্পানির প্রমাণ দেখছেন। যাচাই হলেই চাকরি পোস্ট করতে পারবেন।'), style: body(15, color: Brand.muted)),
        ])),
      ]);
    }
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
          if (jobs.isEmpty) return AppCard(child: Text(tr(context, 'No jobs yet. Every new post is reviewed by an admin before students can see it.', 'এখনও কোনো চাকরি নেই। প্রতিটি নতুন পোস্ট অ্যাডমিন অনুমোদন করলে তবেই শিক্ষার্থীরা দেখবে।'), style: body(16)));
          return Column(children: [for (final j in jobs) AppCard(padding: const EdgeInsets.all(16), onTap: () => context.push('/job/${j['_id']}/pipeline'), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [Expanded(child: Text(j['title'], style: display(20, color: Brand.ink))), Pill(j['closed'] == true ? tr(context, 'Closed', 'বন্ধ') : j['status'], tone: j['status'] == 'approved' && j['closed'] != true ? Tone.green : Tone.saffron)]),
            const SizedBox(height: 6),
            Text(tr(context, '${j['applicants']} applicants', '${j['applicants']} জন আবেদনকারী'), style: body(15, color: Brand.muted)),
            if ((j['suspiciousFlags'] as List).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Pill('⚠ ${(j['suspiciousFlags'] as List).join(', ')}', tone: Tone.red)),
            Padding(padding: const EdgeInsets.only(top: 6), child: Text(tr(context, '${j['views'] ?? 0} views · ${j['saves'] ?? 0} saves', '${j['views'] ?? 0} বার দেখা · ${j['saves'] ?? 0} সেভ'), style: body(14, color: Brand.muted))),
            if (_deadlineOf(j) != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(
              _deadlineOf(j)!.isBefore(DateTime.now()) ? tr(context, 'Deadline passed: ${_fmt(_deadlineOf(j)!)}', 'ডেডলাইন শেষ: ${_fmt(_deadlineOf(j)!)}') : tr(context, 'Deadline: ${_fmt(_deadlineOf(j)!)}', 'ডেডলাইন: ${_fmt(_deadlineOf(j)!)}'),
              style: body(14, color: _deadlineOf(j)!.isBefore(DateTime.now()) ? const Color(0xFFC62828) : Brand.muted))),
            Wrap(spacing: 4, children: [
              TextButton(onPressed: () => _jobForm(context, ref, job: j), child: Text(tr(context, 'Edit', 'এডিট'))),
              if (j['status'] == 'draft') TextButton(onPressed: () => _act(context, ref, '/employer/jobs/${j['_id']}/submit', {'noFeeConfirmed': true}), child: Text(tr(context, 'Publish', 'পাবলিশ'))),
              if (j['status'] != 'draft' && j['closed'] != true) TextButton(onPressed: () => _act(context, ref, '/employer/jobs/${j['_id']}/close'), child: Text(tr(context, 'Close', 'বন্ধ করুন'))),
              if (j['closed'] == true) TextButton(onPressed: () => _reopen(context, ref, j), child: Text(tr(context, 'Reopen', 'আবার খুলুন'))),
              if (j['status'] == 'approved' || j['status'] == 'pending') TextButton(onPressed: () => _act(context, ref, '/employer/jobs/${j['_id']}/repost', {}), child: Text(tr(context, 'Repost', 'আবার পোস্ট'))),
              TextButton(onPressed: () => _delete(context, ref, j), child: Text(tr(context, 'Delete', 'ডিলিট'), style: const TextStyle(color: Color(0xFFC62828)))),
            ]),
          ]))]);
        }),
      ])),
    ]);
  }

  Future<void> _post(BuildContext context, WidgetRef ref) => _jobForm(context, ref);

  // Delete for good, after a confirmation. A job with applicants shows the count and needs a second, stronger confirmation.
  Future<void> _delete(BuildContext context, WidgetRef ref, Map j) async {
    final n = (j['applicants'] as num?)?.toInt() ?? 0;
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(
      title: Text(tr(context, 'Delete this job?', 'এই চাকরি ডিলিট করবেন?'), style: display(20)),
      content: Text(n > 0
          ? tr(context, '"${j['title']}" has $n applicant(s). Deleting it also removes their applications. This cannot be undone.', '"${j['title']}"-এ $n জন আবেদনকারী আছে। ডিলিট করলে তাদের আবেদনও মুছে যাবে। এটি ফেরানো যাবে না।')
          : tr(context, '"${j['title']}" will be removed for good. This cannot be undone.', '"${j['title']}" চিরতরে মুছে যাবে। এটি ফেরানো যাবে না।'), style: body(15)),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(context, 'Cancel', 'বাতিল'))),
        FilledButton(style: FilledButton.styleFrom(backgroundColor: const Color(0xFFC62828)), onPressed: () => Navigator.pop(c, true), child: Text(tr(context, 'Delete', 'ডিলিট'))),
      ],
    ));
    if (ok != true || !context.mounted) return;
    try {
      await ref.read(dioProvider).delete('/employer/jobs/${j['_id']}', queryParameters: {if (n > 0) 'force': 'true'});
      ref.invalidate(employerJobsProvider);
      if (context.mounted) toast(context, tr(context, 'Job deleted', 'চাকরি ডিলিট হয়েছে'));
    } catch (e) { if (context.mounted) toast(context, errorText(e)); }
  }

  static DateTime? _deadlineOf(Map j) => j['applicationDeadline'] == null ? null : DateTime.tryParse('${j['applicationDeadline']}')?.toLocal();
  static String _fmt(DateTime d) => '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

  // Date picker; the deadline is the end of the chosen day, so applicants can apply all that day.
  Future<DateTime?> _pickDeadline(BuildContext context, DateTime? current) async {
    final now = DateTime.now();
    final first = DateTime(now.year, now.month, now.day);
    final initial = (current != null && !current.isBefore(first)) ? current : first.add(const Duration(days: 14));
    final d = await showDatePicker(context: context, initialDate: initial, firstDate: first, lastDate: first.add(const Duration(days: 365 * 2)), helpText: tr(context, 'Application deadline', 'আবেদনের শেষ তারিখ'));
    return d == null ? null : DateTime(d.year, d.month, d.day, 23, 59, 59);
  }

  // Reopen: if the deadline is gone (or the server says so) ask for a new one first, then reopen in one go.
  Future<void> _reopen(BuildContext context, WidgetRef ref, Map j) async {
    final old = _deadlineOf(j);
    Map<String, dynamic> data = {};
    if (old != null && old.isBefore(DateTime.now())) {
      final nd = await _pickDeadline(context, null);
      if (nd == null) return;
      data = {'applicationDeadline': nd.toUtc().toIso8601String()};
    }
    if (!context.mounted) return;
    await _act(context, ref, '/employer/jobs/${j['_id']}/reopen', data);
  }

  Future<void> _act(BuildContext context, WidgetRef ref, String path, [Map<String, dynamic>? data]) async {
    try { await ref.read(dioProvider).post(path, data: data); ref.invalidate(employerJobsProvider); }
    catch (e) { if (context.mounted) toast(context, errorText(e)); }
  }

  // New job, or edit one (job != null). "Save draft" keeps it private; "Post" sends it for publishing (the first post of a company is reviewed).
  Future<void> _jobForm(BuildContext context, WidgetRef ref, {Map? job}) async {
    final title = TextEditingController(text: '${job?['title'] ?? ''}'), desc = TextEditingController(text: '${job?['description'] ?? ''}');
    final city = TextEditingController(text: '${job?['locationText'] ?? ''}');
    final smin = TextEditingController(text: job?['salaryMin'] == null ? '' : '${job!['salaryMin']}');
    final smax = TextEditingController(text: job?['salaryMax'] == null ? '' : '${job!['salaryMax']}');
    final vac = TextEditingController(text: '${job?['vacancies'] ?? 1}');
    final oldQs = (job?['screeningQuestions'] as List?) ?? const [];
    final qs = [for (var i = 0; i < 3; i++) TextEditingController(text: i < oldQs.length ? '${oldQs[i]}' : '')];
    String? level = job?['experienceLevel'] as String?;
    DateTime? deadline = job == null ? null : _deadlineOf(job);
    bool deadlineChanged = false;
    bool noFee = job != null; // an existing job already carries the no-fee promise
    final res = await showDialog<String>(context: context, builder: (c) => StatefulBuilder(builder: (c, set) => AlertDialog(
      title: Text(job == null ? tr(context, 'New job', 'নতুন চাকরি') : tr(context, 'Edit job', 'চাকরি এডিট'), style: display(20)),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: title, decoration: InputDecoration(labelText: tr(context, 'Job title', 'পদের নাম'))), const SizedBox(height: 8),
        TextField(controller: desc, maxLines: 4, decoration: InputDecoration(labelText: tr(context, 'Description (20+ characters)', 'বিবরণ (২০+ অক্ষর)'))), const SizedBox(height: 8),
        TextField(controller: city, decoration: InputDecoration(labelText: tr(context, 'City / location', 'শহর / স্থান'))), const SizedBox(height: 8),
        Row(children: [
          Expanded(child: TextField(controller: smin, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: tr(context, 'Salary from (BDT/month)', 'বেতন থেকে (টাকা/মাস)')))), const SizedBox(width: 8),
          Expanded(child: TextField(controller: smax, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: tr(context, 'to', 'পর্যন্ত')))),
        ]), const SizedBox(height: 8),
        Row(children: [
          Expanded(child: TextField(controller: vac, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: tr(context, 'Vacancies', 'পদ সংখ্যা')))), const SizedBox(width: 8),
          Expanded(child: DropdownButtonFormField<String>(
            initialValue: level, isExpanded: true, decoration: InputDecoration(labelText: tr(context, 'Level', 'অভিজ্ঞতা')),
            items: [for (final l in const ['fresher', 'junior', 'mid']) DropdownMenuItem(value: l, child: Text(l))],
            onChanged: (v) => set(() => level = v),
          )),
        ]), const SizedBox(height: 8),
        InkWell(
          onTap: () async { final nd = await _pickDeadline(c, deadline); if (nd != null) set(() { deadline = nd; deadlineChanged = true; }); },
          child: InputDecorator(
            decoration: InputDecoration(labelText: tr(context, 'Application deadline (optional)', 'আবেদনের শেষ তারিখ (ঐচ্ছিক)'), suffixIcon: deadline == null
                ? const Icon(Icons.calendar_today_outlined, size: 20)
                : IconButton(icon: const Icon(Icons.close, size: 20), tooltip: tr(context, 'No deadline', 'ডেডলাইন নেই'), onPressed: () => set(() { deadline = null; deadlineChanged = true; }))),
            child: Text(deadline == null ? tr(context, 'No deadline', 'ডেডলাইন নেই') : _fmt(deadline!) + (deadline!.isBefore(DateTime.now()) ? tr(context, ' (passed, pick a new date)', ' (শেষ, নতুন তারিখ দিন)') : ''), style: body(16, color: deadline != null && deadline!.isBefore(DateTime.now()) ? const Color(0xFFC62828) : null)),
          ),
        ), const SizedBox(height: 8),
        Align(alignment: Alignment.centerLeft, child: Text(tr(context, 'Questions for applicants (optional, up to 3)', 'আবেদনকারীর জন্য প্রশ্ন (ঐচ্ছিক, সর্বোচ্চ ৩টি)'), style: body(14, color: Brand.muted))),
        for (final q in qs) TextField(controller: q, decoration: const InputDecoration(isDense: true)),
        if (job == null) CheckboxListTile(contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.leading, value: noFee, onChanged: (v) => set(() => noFee = v == true), title: Text(tr(context, 'This post never asks applicants for money.', 'এই পোস্টে আবেদনকারীর কাছে কখনো টাকা চাওয়া হয় না।'), style: body(14))),
      ])),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c), child: Text(tr(context, 'Cancel', 'বাতিল'))),
        if (job == null) TextButton(onPressed: () => Navigator.pop(c, 'draft'), child: Text(tr(context, 'Save draft', 'ড্রাফট রাখুন'))),
        FilledButton(onPressed: noFee ? () => Navigator.pop(c, 'post') : null, child: Text(job == null ? tr(context, 'Post', 'পোস্ট') : tr(context, 'Save', 'সেভ'))),
      ],
    )));
    if (res == null) return;
    final payload = <String, dynamic>{
      'title': title.text.trim(), 'description': desc.text.trim(), 'vacancies': int.tryParse(vac.text) ?? 1,
      if (city.text.trim().isNotEmpty) 'locationText': city.text.trim(),
      if (int.tryParse(smin.text) != null) 'salaryMin': int.parse(smin.text),
      if (int.tryParse(smax.text) != null) 'salaryMax': int.parse(smax.text),
      if (level != null) 'experienceLevel': level,
      if (deadlineChanged || (job == null && deadline != null)) 'applicationDeadline': deadline?.toUtc().toIso8601String(),
      'screeningQuestions': [for (final q in qs) if (q.text.trim().length >= 3) q.text.trim()],
    };
    try {
      if (job == null) {
        await ref.read(dioProvider).post('/employer/jobs', data: {...payload, 'noFeeConfirmed': noFee, if (res == 'draft') 'saveAsDraft': true});
      } else {
        await ref.read(dioProvider).patch('/employer/jobs/${job['_id']}', data: payload);
      }
      ref.invalidate(employerJobsProvider);
      if (context.mounted) toast(context, res == 'draft' ? tr(context, 'Draft saved', 'ড্রাফট সেভ হয়েছে') : (job != null && job['closed'] == true && deadlineChanged ? tr(context, 'Saved. The job is open again.', 'সেভ হয়েছে। চাকরি আবার খোলা হয়েছে।') : tr(context, 'Saved', 'সেভ হয়েছে')));
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
            // "Skill endorsed by a mentor": shown only when the student shared skills, and never with the mentor's name.
            if (a['mentorEndorsed'] == true) Padding(padding: const EdgeInsets.only(top: 6), child: Row(children: [
              Icon(Icons.verified, size: 18, color: Brand.delta), const SizedBox(width: 6),
              Expanded(child: Text(tr(context, 'Skill endorsed by a mentor: ${(a['endorsedSkills'] as List).join(', ')}', 'মেন্টর এন্ডোর্স করা দক্ষতা: ${(a['endorsedSkills'] as List).join(', ')}'), style: body(14, w: FontWeight.w700, color: Brand.forest))),
            ])),
            if (a['fit'] != null) Padding(padding: const EdgeInsets.only(top: 6), child: Pill(tr(context, 'Skill fit ${a['fit']}%', 'স্কিল ফিট ${a['fit']}%'), tone: (a['fit'] as num) >= 70 ? Tone.green : Tone.saffron)),
            if (((a['answers'] as List?) ?? const []).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              for (var i = 0; i < (a['answers'] as List).length; i++) Text('${i < ((d['job']?['screeningQuestions'] as List?)?.length ?? 0) ? (d['job']['screeningQuestions'] as List)[i] : tr(context, 'Answer', 'উত্তর')}: ${(a['answers'] as List)[i]}', style: body(14)),
            ])),
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
