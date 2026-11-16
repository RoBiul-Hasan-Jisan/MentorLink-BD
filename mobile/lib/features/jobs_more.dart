import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// Opportunity detail: "Your fit before applying" with a skill-by-skill breakdown, apply with explicit consent, report.
final opportunityDetailProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) => getJson(ref, '/opportunities/$id'));

class OpportunityDetailScreen extends ConsumerWidget {
  const OpportunityDetailScreen({super.key, required this.id});
  final String id;

  Future<void> _apply(BuildContext context, WidgetRef ref, Map o) async {
    try {
      final dio = ref.read(dioProvider);
      var cvs = (await dio.get('/me/cv')).data['versions'] as List;
      if (cvs.isEmpty) {
        await dio.post('/me/cv', data: {'data': {'summary': 'Student at my university'}});
        cvs = (await dio.get('/me/cv')).data['versions'] as List;
      }
      if (!context.mounted) return;
      String cvId = '${cvs.first['_id']}';
      final shared = <String>{'name', 'cv', 'skills'};
      final qs = ((o['screeningQuestions'] as List?) ?? const []).map((e) => '$e').toList();
      final answers = [for (final _ in qs) TextEditingController()];
      bool consent = false;
      final go = await showDialog<bool>(
        context: context,
        builder: (c) => StatefulBuilder(
          builder: (c, set) => AlertDialog(
            title: Text(tr(context, 'Apply to ${o['organization']}', '${o['organization']}-এ আবেদন'), style: display(20)),
            content: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'CV version', 'সিভি ভার্সন'), style: body(15, w: FontWeight.w700)),
                DropdownButton<String>(
                  isExpanded: true,
                  value: cvId,
                  items: [for (final v in cvs.cast<Map>()) DropdownMenuItem(value: '${v['_id']}', child: Text('v${v['version']}'))],
                  onChanged: (v) => set(() => cvId = v ?? cvId),
                ),
                const SizedBox(height: 6),
                Text(tr(context, 'Share with the poster', 'পোস্টদাতার সাথে শেয়ার'), style: body(15, w: FontWeight.w700)),
                Wrap(spacing: 8, children: [
                  FilterChip(label: Text(tr(context, 'Name', 'নাম')), selected: true, onSelected: null),
                  FilterChip(label: Text('CV'), selected: true, onSelected: null),
                  FilterChip(label: Text(tr(context, 'Skill levels', 'স্কিল লেভেল')), selected: shared.contains('skills'), onSelected: (v) => set(() { if (v) { shared.add('skills'); } else { shared.remove('skills'); } })),
                  FilterChip(label: Text(tr(context, 'Contact (phone, email)', 'যোগাযোগ (ফোন, ইমেইল)')), selected: shared.contains('contact'), onSelected: (v) => set(() { if (v) { shared.add('contact'); } else { shared.remove('contact'); } })),
                ]),
                if (qs.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(tr(context, 'Questions from the employer', 'নিয়োগকর্তার প্রশ্ন'), style: body(15, w: FontWeight.w700)),
                  for (var i = 0; i < qs.length; i++) Padding(padding: const EdgeInsets.only(top: 6), child: TextField(controller: answers[i], maxLines: 2, onChanged: (_) => set(() {}), decoration: InputDecoration(labelText: qs[i], isDense: true))),
                ],
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  value: consent,
                  controlAffinity: ListTileControlAffinity.leading,
                  title: Text(tr(context, 'I agree to share the fields above with this poster. Nothing else is shared.', 'আমি উপরের তথ্য এই পোস্টদাতার সাথে শেয়ার করতে রাজি। আর কিছু শেয়ার হবে না।'), style: body(14)),
                  onChanged: (v) => set(() => consent = v ?? false),
                ),
              ]),
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(context, 'Cancel', 'বাতিল'))),
              FilledButton(onPressed: consent && answers.every((a) => a.text.trim().isNotEmpty) ? () => Navigator.pop(c, true) : null, child: Text(tr(context, 'Apply', 'আবেদন'))),
            ],
          ),
        ),
      );
      if (go != true) return;
      await dio.post('/opportunities/$id/apply', data: {'cvVersionId': cvId, 'consent': true, 'sharedFields': shared.toList(), 'answers': [for (final a in answers) a.text.trim()]});
      ref.invalidate(applicationsProvider);
      ref.invalidate(opportunityDetailProvider(id));
      if (context.mounted) {
        toast(context, tr(context, 'Applied. Track it in My applications.', 'আবেদন হয়েছে। "আমার আবেদন"-এ দেখুন।'));
        context.push('/applications');
      }
    } catch (e) {
      if (context.mounted) toast(context, errorText(e));
    }
  }

  // Saved jobs: a private shortlist (POST/DELETE /opportunities/:id/save).
  Future<void> _toggleSave(BuildContext context, WidgetRef ref, bool saved) async {
    try {
      final dio = ref.read(dioProvider);
      if (saved) {
        await dio.delete('/opportunities/$id/save');
      } else {
        await dio.post('/opportunities/$id/save');
      }
      ref.invalidate(opportunityDetailProvider(id));
      if (context.mounted) toast(context, saved ? tr(context, 'Removed from saved jobs', 'সংরক্ষণ থেকে সরানো হয়েছে') : tr(context, 'Saved. Find it under Saved in Jobs.', 'সংরক্ষিত। জবসে "সংরক্ষিত" ফিল্টারে পাবেন।'));
    } catch (e) {
      if (context.mounted) toast(context, errorText(e));
    }
  }

  Future<void> _report(BuildContext context, WidgetRef ref) async {
    final reason = TextEditingController(text: tr(context, 'Asks for money or looks suspicious', 'টাকা চায় বা সন্দেহজনক'));
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(tr(context, 'Report this post', 'পোস্টটি রিপোর্ট করুন')),
        content: TextField(controller: reason, maxLength: 300),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(context, 'Cancel', 'বাতিল'))),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(tr(context, 'Send', 'পাঠান'))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(dioProvider).post('/reports', data: {'targetType': 'opportunity', 'targetId': id, 'reason': reason.text.trim().isEmpty ? 'Suspicious' : reason.text.trim()});
      if (context.mounted) toast(context, tr(context, 'Reported. Thank you.', 'রিপোর্ট হয়েছে। ধন্যবাদ।'));
    } catch (e) {
      if (context.mounted) toast(context, errorText(e));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(opportunityDetailProvider(id)),
        onRetry: () => ref.invalidate(opportunityDetailProvider(id)),
        builder: (d) {
          final o = d['opportunity'] as Map;
          final fit = d['fit'] as num?;
          final breakdown = ((d['breakdown'] ?? []) as List).cast<Map>();
          final labels = (o['labels'] ?? {}) as Map;
          final closed = o['closed'] == true;
          final myApp = d['myApplication'] as Map?;
          final applied = myApp != null && myApp['withdrawn'] != true;
          final saved = d['saved'] == true;
          final days = (o['daysLeft'] as num?)?.toInt();
          return ListView(padding: EdgeInsets.zero, children: [
            GreenHeader(radius: 36, bottomPad: 26, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              BackCircle(dark: true, onTap: () => context.pop()),
              const SizedBox(height: 12),
              Text('${o['title']}', style: display(26, color: Colors.white)),
              Text('${o['organization']}${o['locationText'] != null ? ' · ${o['locationText']}' : ''}', style: body(15, color: Colors.white70)),
            ])),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Wrap(spacing: 8, runSpacing: 8, children: [
                Pill(labels['source'] == 'verified_alumni' ? tr(context, 'Verified alumni post', 'যাচাইকৃত অ্যালামনাই পোস্ট') : labels['source'] == 'student' ? tr(context, 'Student post (reviewed by admin)', 'শিক্ষার্থীর পোস্ট (অ্যাডমিন দেখেছেন)') : labels['source'] == 'employer' ? tr(context, 'Company post', 'কোম্পানির পোস্ট') : tr(context, 'Admin post', 'অ্যাডমিন পোস্ট')),
                if (labels['noFeeDeclared'] == true) Pill(tr(context, 'No fee confirmed', 'কোনো ফি নেই')),
                if (labels['listingReviewed'] == true) Pill(tr(context, 'Listing reviewed', 'তালিকা পর্যালোচিত')),
                if (o['salaryMin'] != null || o['salaryMax'] != null) Pill('৳ ${o['salaryMin'] ?? ''}${o['salaryMin'] != null && o['salaryMax'] != null ? '–' : ''}${o['salaryMax'] ?? ''} / ${tr(context, 'month', 'মাস')}'),
                if (((o['vacancies'] as num?) ?? 1) > 1) Pill(tr(context, '${o['vacancies']} vacancies', '${o['vacancies']}টি পদ')),
                if (o['experienceLevel'] != null) Pill('${o['experienceLevel']}'),
                if (o['applicationDeadline'] != null) Pill(tr(context, 'Closes ${'${o['applicationDeadline']}'.substring(0, 10)}${days != null && days >= 0 ? ' ($days days left)' : ''}', 'শেষ ${'${o['applicationDeadline']}'.substring(0, 10)}${days != null && days >= 0 ? ' ($days দিন বাকি)' : ''}'), tone: days != null && days <= 7 ? Tone.red : Tone.saffron),
              ]),
              const SizedBox(height: 12),
              if (fit != null)
                AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(tr(context, 'Your fit before applying', 'আবেদনের আগে আপনার মিল'), style: body(17, w: FontWeight.w800))),
                    Text('$fit%', style: display(28, color: fit >= 60 ? Brand.forest : const Color(0xFF9A5B00))),
                  ]),
                  const SizedBox(height: 8),
                  ProgressBar(fit / 100, color: fit >= 60 ? Brand.delta : Brand.saffron, height: 8),
                  const SizedBox(height: 10),
                  for (final b in breakdown)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(children: [
                        Icon(b['status'] == 'met' ? Icons.check_circle : Icons.error_outline, size: 20, color: b['status'] == 'met' ? Brand.delta : const Color(0xFF9A5B00)),
                        const SizedBox(width: 8),
                        Expanded(child: Text(nm(context, b, 'nameEn', 'nameBn'), style: body(15, w: FontWeight.w600))),
                        Text('${b['have']}/${b['need']}', style: body(14, color: Brand.muted)),
                        TextButton(onPressed: () => context.push('/roadmap/${b['skillKey']}'), child: Text(b['status'] != 'met' ? tr(context, 'Learn', 'শিখুন') : tr(context, 'Revise', 'রিভিশন'))),
                      ]),
                    ),
                  if (fit >= 100) Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(tr(context, '100% means you meet the levels this job lists. It does not mean you are done: tap Revise on any skill to practise before you apply or interview.', '১০০% মানে এই চাকরির চাহিদার লেভেল আপনার আছে। শেখা শেষ নয়: আবেদন বা ইন্টারভিউয়ের আগে যেকোনো স্কিলে "রিভিশন" চেপে অনুশীলন করুন।'), style: body(14, color: Brand.forest, w: FontWeight.w700))),
                  Text(tr(context, 'Fit uses your verified skill levels. Closing every gap would raise it, but it is not a promise of selection.', 'মিল আপনার যাচাইকৃত স্কিল লেভেল থেকে আসে। ঘাটতি পূরণে বাড়বে, তবে নির্বাচনের নিশ্চয়তা নয়।'), style: body(13, color: Brand.muted)),
                ])),
              AppCard(child: Text('${o['description'] ?? ''}', style: body(16))),
              if (o['companyId'] != null) TextButton.icon(onPressed: () => context.push('/company/${o['companyId']}'), icon: const Icon(Icons.business_outlined), label: Text(tr(context, 'About ${o['organization']}', '${o['organization']} সম্পর্কে'))),
              _SimilarJobs(id: id),
              AppCard(color: Brand.lightSaffron, border: Colors.transparent, child: Text(
                tr(context, 'Never pay to apply. A real listing here is always free. Report anything that asks for money.', 'আবেদনের জন্য কখনো টাকা দেবেন না। এখানে আসল তালিকা সবসময় বিনামূল্যে। টাকা চাইলে রিপোর্ট করুন।'),
                style: body(14, color: const Color(0xFF5A3600)),
              )),
              if (applied)
                AppCard(color: Brand.lightGreen, border: Colors.transparent, onTap: () => context.push('/applications'), child: Row(children: [
                  Icon(Icons.check_circle, color: Brand.delta),
                  const SizedBox(width: 10),
                  Expanded(child: Text(tr(context, 'You applied (${myApp!['stage']}). One application per job. Tap to track it.', 'আপনি আবেদন করেছেন (${myApp['stage']})। প্রতি চাকরিতে একবারই আবেদন। ট্র্যাক করতে চাপুন।'), style: body(15, color: Brand.forest, w: FontWeight.w700))),
                ]))
              else
                BigButton(closed ? tr(context, 'Closed', 'বন্ধ') : tr(context, 'Apply', 'আবেদন করুন'), onPressed: closed ? null : () => _apply(context, ref, o)),
              TextButton.icon(onPressed: () => _toggleSave(context, ref, saved), icon: Icon(saved ? Icons.favorite : Icons.favorite_border, color: saved ? const Color(0xFF9B2C1F) : Brand.muted), label: Text(saved ? tr(context, 'Saved. Tap to remove', 'সংরক্ষিত। সরাতে ট্যাপ করুন') : tr(context, 'Save this job', 'চাকরিটি সংরক্ষণ করুন'))),
              TextButton.icon(onPressed: () => _report(context, ref), icon: const Icon(Icons.flag_outlined, color: Color(0xFF9B2C1F)), label: Text(tr(context, 'Report this post', 'পোস্টটি রিপোর্ট করুন'))),
            ])),
          ]);
        },
      ),
    );
  }
}

final similarJobsProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) => getJson(ref, '/opportunities/$id/similar'));
final companyProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) => getJson(ref, '/companies/$id'));

// "Similar jobs": shown under a job, nothing is drawn when there are none.
class _SimilarJobs extends ConsumerWidget {
  const _SimilarJobs({required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final list = ((ref.watch(similarJobsProvider(id)).valueOrNull ?? const {})['opportunities'] as List?)?.cast<Map>() ?? const [];
    if (list.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(padding: const EdgeInsets.only(top: 8, bottom: 4), child: Text(tr(context, 'Similar jobs', 'একই ধরনের চাকরি'), style: body(17, w: FontWeight.w800))),
      for (final j in list) AppCard(onTap: () => context.push('/opportunity/${j['id']}'), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('${j['title']}', style: body(16, w: FontWeight.w700)),
        Text('${j['organization']}', style: body(14, color: Brand.muted)),
      ])),
    ]);
  }
}

// Company page: public facts, how quickly it replies, and its open jobs. Never the private proof.
class CompanyScreen extends ConsumerWidget {
  const CompanyScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(body: AsyncBody(
        value: ref.watch(companyProvider(id)), onRetry: () => ref.invalidate(companyProvider(id)),
        builder: (d) {
          final c = d['company'] as Map;
          final resp = (d['responsiveness'] ?? {}) as Map;
          final jobs = (d['jobs'] as List).cast<Map>();
          return ListView(padding: EdgeInsets.zero, children: [
            GreenHeader(radius: 36, bottomPad: 26, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              BackCircle(dark: true, onTap: () => context.pop()),
              const SizedBox(height: 12),
              Text('${c['name']}', style: display(26, color: Colors.white)),
              Text([if (c['industry'] != null) c['industry'], if (c['city'] != null) c['city']].join(' · '), style: body(15, color: Colors.white70)),
            ])),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Wrap(spacing: 8, runSpacing: 8, children: [
                Pill(tr(context, 'Verified company', 'যাচাই করা কোম্পানি')),
                if (resp['responseRate'] != null) Pill(tr(context, 'Replies to ${resp['responseRate']}% of applicants', '${resp['responseRate']}% আবেদনকারীকে উত্তর দেয়'), tone: (resp['responseRate'] as num) >= 60 ? Tone.green : Tone.saffron),
                if (resp['avgReplyDays'] != null) Pill(tr(context, 'Usually replies in ${resp['avgReplyDays']} days', 'সাধারণত ${resp['avgReplyDays']} দিনে উত্তর দেয়')),
              ]),
              if ('${c['publicDescription'] ?? ''}'.isNotEmpty) AppCard(child: Text('${c['publicDescription']}', style: body(16))),
              const SizedBox(height: 8),
              Text(tr(context, 'Open jobs', 'চলমান চাকরি'), style: body(17, w: FontWeight.w800)),
              if (jobs.isEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text(tr(context, 'No open jobs right now.', 'এখন কোনো চলমান চাকরি নেই।'), style: body(15, color: Brand.muted))),
              for (final j in jobs) AppCard(onTap: () => context.push('/opportunity/${j['id']}'), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${j['title']}', style: body(16, w: FontWeight.w700)),
                Text([j['type'], j['workplaceMode'], if (j['locationText'] != null) j['locationText']].join(' · '), style: body(14, color: Brand.muted)),
              ])),
            ])),
          ]);
        },
      ));
}

final jobsMoreRoutes = <RouteBase>[
  GoRoute(path: '/company/:id', builder: (_, s) => CompanyScreen(id: s.pathParameters['id']!)),
  GoRoute(path: '/opportunity/:id', builder: (_, s) => OpportunityDetailScreen(id: s.pathParameters['id']!)),
];
