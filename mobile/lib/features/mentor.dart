import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'mentor_sessions.dart';
import 'widgets.dart';

final mentorHomeProfileProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) => getJson(ref, '/me/mentor-profile'));
final mentorImpactProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) => getJson(ref, '/me/impact'));

// Slot ids look like "sun-20" (day, 24-hour clock). Shown as "Sun 8 PM".
String mentorSlotLabel(String s) {
  const days = {'sun': 'Sun', 'mon': 'Mon', 'tue': 'Tue', 'wed': 'Wed', 'thu': 'Thu', 'fri': 'Fri', 'sat': 'Sat'};
  final p = s.split('-');
  if (p.length != 2) return s;
  final h = int.tryParse(p[1]);
  if (h == null) return s;
  final h12 = h % 12 == 0 ? 12 : h % 12;
  return '${days[p[0]] ?? p[0]} $h12 ${h >= 12 ? 'PM' : 'AM'}';
}

String _formatLabel(BuildContext context, String f) {
  if (f == 'phone') return tr(context, 'Phone call', 'ফোন কল');
  if (f == 'in_person') return tr(context, 'In person', 'সরাসরি');
  return tr(context, 'Video link', 'ভিডিও লিংক');
}

int? _pct(dynamic v) => v is num ? v.round() : null;

List<Map> _gapsOf(dynamic r) {
  final g = r['gaps'];
  return g is List ? g.whereType<Map>().toList() : <Map>[];
}

String _gapNames(BuildContext context, List<Map> gaps) => gaps.map((g) => nm(context, g, 'nameEn', 'nameBn')).where((s) => s.isNotEmpty).join(', ');

class MentorRequests extends ConsumerWidget {
  const MentorRequests({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final meName = '${ref.watch(meProvider).valueOrNull?['displayName'] ?? ''}';
    final verified = ref.watch(meProvider).valueOrNull?['verificationStatus'] == 'verified';
    final profile = ref.watch(mentorHomeProfileProvider).valueOrNull;
    final mp = profile == null ? null : profile['profile'];
    return AsyncBody(
      value: ref.watch(requestsProvider),
      onRetry: () => ref.invalidate(requestsProvider),
      builder: (d) {
        final all = (d['requests'] as List).cast<Map>();
        final pending = all.where((r) => r['status'] == 'pending').toList();
        final accepted = all.where((r) => r['status'] == 'accepted').toList();
        final cap = mp is Map ? ((mp['weeklyCapacity'] as num?) ?? 0).toInt() : 0;
        final used = mp is Map ? ((mp['acceptedRequests'] as num?) ?? 0).toInt() : 0;
        final paused = mp is Map && mp['paused'] == true;
        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(requestsProvider);
            ref.invalidate(mentorHomeProfileProvider);
            ref.invalidate(mentorImpactProvider);
          },
          child: ListView(padding: EdgeInsets.zero, children: [
            GreenHeader(radius: 36, bottomPad: 26, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr(context, 'Mentor view · Assalamu alaikum', 'মেন্টর ভিউ · আসসালামু আলাইকুম'), style: body(14, color: Colors.white70)),
              const SizedBox(height: 6),
              Row(children: [
                Expanded(child: Text(meName, style: display(30, color: Colors.white))),
                if (verified) Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(color: Brand.saffron, borderRadius: BorderRadius.circular(20)),
                  child: Text(tr(context, 'Alumni verified', 'অ্যালামনাই যাচাইকৃত'), style: body(13, color: Brand.ink, w: FontWeight.w800)),
                ),
              ]),
            ])),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              AppCard(padding: const EdgeInsets.all(18), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(tr(context, 'Weekly capacity', 'সাপ্তাহিক ক্ষমতা'), style: display(19, color: Brand.ink))),
                  Text(tr(context, '$used of $cap', '$cap এর মধ্যে $used'), style: display(19, color: Brand.forest)),
                ]),
                const SizedBox(height: 10),
                ProgressBar(cap == 0 ? 0 : used / cap, color: paused ? Brand.saffron : Brand.delta),
                const SizedBox(height: 8),
                Text(paused ? tr(context, 'Requests are paused. You reached your cap.', 'অনুরোধ বন্ধ আছে। আপনি সীমায় পৌঁছেছেন।') : tr(context, 'Requests pause automatically when you reach your cap.', 'সীমায় পৌঁছালে অনুরোধ নিজে থেকেই বন্ধ হয়ে যায়।'), style: body(14, color: Brand.muted)),
                const SizedBox(height: 6),
                TextButton.icon(onPressed: () => context.push('/mentor/setup'), icon: const Icon(Icons.tune), label: Text(tr(context, 'Edit mentoring setup', 'মেন্টরিং সেটআপ বদলান'))),
              ])),
              const SizedBox(height: 6),
              Row(children: [
                Expanded(child: Text(tr(context, 'New requests', 'নতুন অনুরোধ'), style: display(22, color: Brand.ink))),
                Pill(tr(context, '${pending.length} waiting', '${pending.length}টি অপেক্ষায়'), tone: Tone.saffron),
              ]),
              const SizedBox(height: 10),
              if (pending.isEmpty) Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: Text(tr(context, 'No new requests right now.', 'এখন কোনো নতুন অনুরোধ নেই।'), style: body(16, color: Brand.muted))),
              for (final r in pending) _RequestCard(r: r),
              if (accepted.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(tr(context, 'Your mentees', 'আপনার মেন্টি'), style: display(22, color: Brand.ink)),
                const SizedBox(height: 10),
                for (final r in accepted) _MenteeCard(r: r),
              ],
              const SizedBox(height: 8),
              const _ImpactMini(),
              const SizedBox(height: 14),
              BigButton(tr(context, 'Post a verified opportunity', 'যাচাইকৃত সুযোগ পোস্ট করুন'), onPressed: () => context.push('/mentor/post-opportunity')),
              const SizedBox(height: 24),
            ])),
          ]),
        );
      },
    );
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.r});
  final Map r;
  @override
  Widget build(BuildContext context) {
    final name = '${r['withName'] ?? ''}';
    final dept = '${r['department'] ?? ''}';
    final match = _pct(r['matchScore']);
    final ready = _pct(r['readiness']);
    final gaps = _gapsOf(r);
    final helpable = gaps.where((g) => g['canHelp'] == true).toList();
    final qn = (r['questions'] is List) ? (r['questions'] as List).length : 0;
    final goal = '${r['goalText'] ?? ''}';
    return AppCard(
      padding: const EdgeInsets.all(16),
      onTap: () => context.push('/mentor/request/${r['_id']}', extra: r),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Avatar(name, size: 48),
          const SizedBox(width: 12),
          Expanded(child: Text(dept.isEmpty ? name : '$name · $dept', style: display(18, color: Brand.ink))),
          if (match != null) Pill(tr(context, '$match% match', '$match% মিল'), tone: Tone.green),
        ]),
        const SizedBox(height: 8),
        Text(ready == null ? goal : tr(context, 'Goal: $goal · $ready% ready', 'লক্ষ্য: $goal · $ready% প্রস্তুত'), style: body(15, color: Brand.muted)),
        if (helpable.isNotEmpty || qn > 0) ...[
          const SizedBox(height: 8),
          Text(
            '${helpable.isNotEmpty ? tr(context, 'Gaps you can help with: ${_gapNames(context, helpable)}.', 'যেসব ঘাটতিতে আপনি সাহায্য করতে পারেন: ${_gapNames(context, helpable)}।') : ''} ${qn > 0 ? tr(context, '$qn questions attached.', '$qnটি প্রশ্ন যুক্ত আছে।') : ''}'.trim(),
            style: body(15, color: Brand.ink),
          ),
        ],
      ]),
    );
  }
}

class _MenteeCard extends ConsumerWidget {
  const _MenteeCard({required this.r});
  final Map r;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AppCard(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Avatar('${r['withName'] ?? ''}', size: 44),
        const SizedBox(width: 12),
        Expanded(child: Text('${r['withName'] ?? ''}', style: display(18, color: Brand.ink))),
        Pill(tr(context, 'accepted', 'গৃহীত'), tone: Tone.green),
      ]),
      const SizedBox(height: 4),
      Text('${r['goalText'] ?? ''}', style: body(15, color: Brand.muted)),
      const SizedBox(height: 10),
      Row(children: [
        Expanded(child: OutlinedButton.icon(style: OutlinedButton.styleFrom(minimumSize: const Size(0, 48)), onPressed: () => context.push('/review-cv/${r['studentId']}'), icon: const Icon(Icons.description_outlined), label: Text(tr(context, 'Review CV', 'সিভি দেখুন')))),
        const SizedBox(width: 10),
        Expanded(child: FilledButton.icon(style: FilledButton.styleFrom(backgroundColor: Brand.delta, minimumSize: const Size(0, 48)), onPressed: () => context.push('/chat/${r['_id']}'), icon: const Icon(Icons.chat_bubble_outline), label: Text(tr(context, 'Chat', 'চ্যাট')))),
      ]),
    ]));
  }
}

class _ImpactMini extends ConsumerWidget {
  const _ImpactMini();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final v = ref.watch(mentorImpactProvider).valueOrNull;
    if (v == null) return const SizedBox.shrink();
    final outcomes = v['outcomes'];
    final interviews = outcomes is Map ? ((outcomes['interviews'] as num?) ?? 0).toInt() : 0;
    Widget stat(String n, String label) => Expanded(child: Column(children: [Text(n, style: display(30, color: Brand.forest)), Text(label, style: body(13, color: Brand.muted))]));
    return AppCard(padding: const EdgeInsets.all(18), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(tr(context, 'Your impact', 'আপনার প্রভাব'), style: display(20, color: Brand.ink)),
      const SizedBox(height: 12),
      Row(children: [
        stat('${(v['sessionsHeld'] as num?) ?? 0}', tr(context, 'sessions', 'সেশন')),
        stat('${(v['studentsHelped'] as num?) ?? 0}', tr(context, 'students', 'শিক্ষার্থী')),
        stat('$interviews', tr(context, 'interviews', 'ইন্টারভিউ')),
      ]),
    ]));
  }
}

// ---------------- full-screen request detail ----------------
class MentorRequestDetail extends ConsumerStatefulWidget {
  const MentorRequestDetail({super.key, required this.request});
  final Map request;
  @override
  ConsumerState<MentorRequestDetail> createState() => _MentorRequestDetailState();
}

class _MentorRequestDetailState extends ConsumerState<MentorRequestDetail> {
  String? _reason;
  bool _busy = false;

  static const _reasons = [
    ('At capacity', 'ক্ষমতার সীমায় আছি'),
    ('Outside my expertise', 'আমার দক্ষতার বাইরে'),
    ('Time conflict', 'সময় মিলছে না'),
  ];

  Future<void> _decide(String decision) async {
    setState(() => _busy = true);
    try {
      final Map<String, dynamic> data = {'decision': decision};
      if (decision == 'decline' && _reason != null) data['reason'] = _reason;
      await ref.read(dioProvider).post('/requests/${widget.request['_id']}/decision', data: data);
      ref.invalidate(requestsProvider);
      ref.invalidate(mentorHomeProfileProvider);
      if (!mounted) return;
      toast(context, decision == 'accept' ? tr(context, 'Request accepted.', 'অনুরোধ গ্রহণ করা হয়েছে।') : tr(context, 'Request declined.', 'অনুরোধ প্রত্যাখ্যান করা হয়েছে।'));
      context.pop();
    } catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        toast(context, errorText(e));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.request;
    final name = '${r['withName'] ?? ''}';
    final dept = '${r['department'] ?? ''}';
    final match = _pct(r['matchScore']);
    final ready = _pct(r['readiness']);
    final gaps = _gapsOf(r);
    final questions = (r['questions'] is List) ? (r['questions'] as List).map((q) => '$q').toList() : <String>[];
    final slots = (r['preferredSlots'] is List) ? (r['preferredSlots'] as List).map((s) => mentorSlotLabel('$s')).toList() : <String>[];
    final pending = r['status'] == 'pending';
    Widget stat(String big, String label) => Expanded(child: Column(children: [Text(big, style: display(22, color: Brand.forest)), const SizedBox(height: 2), Text(label, style: body(13, color: Brand.muted), textAlign: TextAlign.center)]));
    return Scaffold(
      body: ListView(padding: EdgeInsets.zero, children: [
        GreenHeader(radius: 36, bottomPad: 26, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          BackCircle(dark: true, onTap: () => context.pop()),
          const SizedBox(height: 12),
          Text(tr(context, 'Mentoring request', 'মেন্টরিং অনুরোধ'), style: body(14, color: Colors.white70)),
          const SizedBox(height: 8),
          Row(children: [
            Avatar(name, size: 56, bg: Brand.saffron, fg: Brand.ink),
            const SizedBox(width: 14),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, style: display(26, color: Colors.white)),
              if (dept.isNotEmpty) Text('$dept · ${tr(context, 'University verified', 'বিশ্ববিদ্যালয় যাচাইকৃত')}', style: body(14, color: Colors.white70)),
            ])),
          ]),
        ])),
        Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          AppCard(child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            stat(match == null ? '—' : '$match%', tr(context, 'match', 'মিল')),
            stat(gaps.isEmpty ? '—' : _gapNames(context, gaps), tr(context, 'Gaps', 'ঘাটতি')),
            stat(ready == null ? '—' : '$ready%', tr(context, 'ready', 'প্রস্তুত')),
          ])),
          AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr(context, 'Goal', 'লক্ষ্য'), style: body(13, color: Brand.muted, w: FontWeight.w700)),
            const SizedBox(height: 4),
            Text('${r['goalText'] ?? ''}', style: body(17)),
          ])),
          AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr(context, 'Their questions', 'তাদের প্রশ্ন'), style: display(19, color: Brand.ink)),
            const SizedBox(height: 8),
            for (int i = 0; i < questions.length; i++) Padding(padding: const EdgeInsets.only(bottom: 6), child: Text('${i + 1}. ${questions[i]}', style: body(16))),
          ])),
          AppCard(child: Text(
            '${tr(context, 'Requested', 'অনুরোধকৃত সময়')}: ${slots.isEmpty ? tr(context, 'flexible', 'নমনীয়') : slots.join(', ')} · ${_formatLabel(context, '${r['format'] ?? 'video'}')}',
            style: body(16),
          )),
          if (pending) ...[
            const SizedBox(height: 4),
            Text(tr(context, 'If declining, tell them why (they see this)', 'প্রত্যাখ্যান করলে কারণ জানান (তারা দেখবে)'), style: body(15, color: Brand.muted, w: FontWeight.w700)),
            const SizedBox(height: 8),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final x in _reasons) ChoiceChip(
                label: Text(tr(context, x.$1, x.$2)),
                selected: _reason == x.$1,
                onSelected: (s) => setState(() => _reason = s ? x.$1 : null),
              ),
            ]),
            const SizedBox(height: 18),
            Row(children: [
              Expanded(child: OutlinedButton(style: OutlinedButton.styleFrom(minimumSize: const Size(0, 56)), onPressed: _busy ? null : () => _decide('decline'), child: Text(tr(context, 'Decline', 'প্রত্যাখ্যান')))),
              const SizedBox(width: 12),
              Expanded(child: FilledButton(style: FilledButton.styleFrom(backgroundColor: Brand.delta, minimumSize: const Size(0, 56)), onPressed: _busy ? null : () => _decide('accept'), child: Text(tr(context, 'Accept', 'গ্রহণ')))),
            ]),
          ] else ...[
            Pill('${r['status'] ?? ''}', tone: r['status'] == 'accepted' ? Tone.green : Tone.grey),
            if (r['status'] == 'accepted') ...[
              const SizedBox(height: 14),
              BigButton(tr(context, 'Schedule a session', 'সেশন নির্ধারণ করুন'), onPressed: () => scheduleSessionDialog(context, ref, r)),
              const SizedBox(height: 10),
              BigButton(tr(context, 'Open chat', 'চ্যাট খুলুন'), outlined: true, onPressed: () => context.push('/chat/${r['_id']}')),
            ],
          ],
          if ('${r['studentId'] ?? ''}'.isNotEmpty) Align(alignment: Alignment.centerLeft, child: TextButton.icon(
            onPressed: () => context.push(Uri(path: '/report-user', queryParameters: {'id': '${r['studentId']}', 'name': name}).toString()),
            icon: const Icon(Icons.flag_outlined, size: 18),
            label: Text(tr(context, 'Report this student', 'এই শিক্ষার্থীকে রিপোর্ট করুন')),
          )),
          const SizedBox(height: 24),
        ])),
      ]),
    );
  }
}
