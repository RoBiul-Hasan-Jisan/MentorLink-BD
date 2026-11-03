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
      final shared = <String>{'name', 'cv'};
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
              FilledButton(onPressed: consent ? () => Navigator.pop(c, true) : null, child: Text(tr(context, 'Apply', 'আবেদন'))),
            ],
          ),
        ),
      );
      if (go != true) return;
      await dio.post('/opportunities/$id/apply', data: {'cvVersionId': cvId, 'consent': true, 'sharedFields': shared.toList()});
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
          return ListView(padding: EdgeInsets.zero, children: [
            GreenHeader(radius: 36, bottomPad: 26, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              BackCircle(dark: true, onTap: () => context.pop()),
              const SizedBox(height: 12),
              Text('${o['title']}', style: display(26, color: Colors.white)),
              Text('${o['organization']}${o['locationText'] != null ? ' · ${o['locationText']}' : ''}', style: body(15, color: Colors.white70)),
            ])),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Wrap(spacing: 8, runSpacing: 8, children: [
                Pill(labels['source'] == 'verified_alumni' ? tr(context, 'Verified alumni post', 'যাচাইকৃত অ্যালামনাই পোস্ট') : tr(context, 'Admin post', 'অ্যাডমিন পোস্ট')),
                if (labels['noFeeDeclared'] == true) Pill(tr(context, 'No fee confirmed', 'কোনো ফি নেই')),
                if (labels['listingReviewed'] == true) Pill(tr(context, 'Listing reviewed', 'তালিকা পর্যালোচিত')),
                if (o['applicationDeadline'] != null) Pill(tr(context, 'Closes ${'${o['applicationDeadline']}'.substring(0, 10)}', 'শেষ ${'${o['applicationDeadline']}'.substring(0, 10)}'), tone: Tone.saffron),
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
                        if (b['status'] != 'met') TextButton(onPressed: () => context.push('/roadmap/${b['skillKey']}'), child: Text(tr(context, 'Learn', 'শিখুন'))),
                      ]),
                    ),
                  Text(tr(context, 'Fit uses your verified skill levels. Closing every gap would raise it, but it is not a promise of selection.', 'মিল আপনার যাচাইকৃত স্কিল লেভেল থেকে আসে। ঘাটতি পূরণে বাড়বে, তবে নির্বাচনের নিশ্চয়তা নয়।'), style: body(13, color: Brand.muted)),
                ])),
              AppCard(child: Text('${o['description'] ?? ''}', style: body(16))),
              AppCard(color: Brand.lightSaffron, border: Colors.transparent, child: Text(
                tr(context, 'Never pay to apply. A real listing here is always free. Report anything that asks for money.', 'আবেদনের জন্য কখনো টাকা দেবেন না। এখানে আসল তালিকা সবসময় বিনামূল্যে। টাকা চাইলে রিপোর্ট করুন।'),
                style: body(14, color: const Color(0xFF5A3600)),
              )),
              if (applied)
                AppCard(color: Brand.lightGreen, border: Colors.transparent, onTap: () => context.push('/applications'), child: Row(children: [
                  const Icon(Icons.check_circle, color: Brand.delta),
                  const SizedBox(width: 10),
                  Expanded(child: Text(tr(context, 'You applied (${myApp!['stage']}). One application per job. Tap to track it.', 'আপনি আবেদন করেছেন (${myApp['stage']})। প্রতি চাকরিতে একবারই আবেদন। ট্র্যাক করতে চাপুন।'), style: body(15, color: Brand.forest, w: FontWeight.w700))),
                ]))
              else
                BigButton(closed ? tr(context, 'Closed', 'বন্ধ') : tr(context, 'Apply', 'আবেদন করুন'), onPressed: closed ? null : () => _apply(context, ref, o)),
              TextButton.icon(onPressed: () => _report(context, ref), icon: const Icon(Icons.flag_outlined, color: Color(0xFF9B2C1F)), label: Text(tr(context, 'Report this post', 'পোস্টটি রিপোর্ট করুন'))),
            ])),
          ]);
        },
      ),
    );
  }
}

final jobsMoreRoutes = <RouteBase>[
  GoRoute(path: '/opportunity/:id', builder: (_, s) => OpportunityDetailScreen(id: s.pathParameters['id']!)),
];
