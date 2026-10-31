import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'mentors.dart';
import 'widgets.dart';

// Mentor profile: public card + expertise + open slots. No email, phone or location is ever shown.
class MentorDetailScreen extends ConsumerWidget {
  const MentorDetailScreen({super.key, required this.id});
  final String id;
  static const _slotDay = {'sun': 'Sun', 'mon': 'Mon', 'tue': 'Tue', 'wed': 'Wed', 'thu': 'Thu', 'fri': 'Fri', 'sat': 'Sat'};

  String _slot(String s) {
    final p = s.split('-');
    if (p.length != 2) return s;
    final h = int.tryParse(p[1]);
    if (h == null) return s;
    final h12 = h % 12 == 0 ? 12 : h % 12;
    return '${_slotDay[p[0]] ?? p[0]} $h12 ${h >= 12 ? 'PM' : 'AM'}';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: AsyncBody(value: ref.watch(mentorDetailProvider(id)), onRetry: () => ref.invalidate(mentorDetailProvider(id)), builder: (d) {
        final m = d['mentor'] as Map;
        final skills = (m['expertise'] as List).cast<Map>();
        final slots = (m['openSlots'] as List).cast<String>();
        final langs = (m['languages'] as List).map((l) => l == 'bn' ? 'বাংলা' : 'English').join(' · ');
        return ListView(padding: EdgeInsets.zero, children: [
          GreenHeader(radius: 36, bottomPad: 70, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            BackCircle(dark: true, onTap: () => context.pop()),
            const SizedBox(height: 16),
            Row(children: [
              Avatar(m['name'], size: 72, bg: Brand.saffron, fg: Brand.ink),
              const SizedBox(width: 14),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [Flexible(child: Text(m['name'], style: display(26, color: Colors.white))), const SizedBox(width: 6), const Icon(Icons.verified, color: Brand.saffron, size: 22)]),
                Text('${m['roleTitle']} · ${m['industry']}', style: body(16, color: Colors.white70)),
              ])),
            ]),
          ])),
          Transform.translate(offset: const Offset(0, -44), child: Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Column(children: [
            AppCard(child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
              _stat(tr(context, 'Experience', 'অভিজ্ঞতা'), '${m['yearsExperience']} ${tr(context, 'yrs', 'বছর')}'),
              _stat(tr(context, 'Sessions', 'সেশন'), '${m['sessionsCompleted']}'),
              _stat(tr(context, 'Batch', 'ব্যাচ'), '${m['batchYear'] ?? '—'}'),
            ])),
            AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr(context, 'Can help with', 'যেসব বিষয়ে সাহায্য করতে পারেন'), style: display(19, color: Brand.ink)),
              const SizedBox(height: 10),
              if (skills.isEmpty) Text('—', style: body(15, color: Brand.muted)),
              Wrap(spacing: 8, runSpacing: 8, children: [for (final s in skills) Pill('${nm(context, s, 'nameEn', 'nameBn').isEmpty ? s['skillKey'] : nm(context, s, 'nameEn', 'nameBn')} · L${s['level']}', tone: s['level'] == 3 ? Tone.green : Tone.grey)]),
              const SizedBox(height: 14),
              Text(tr(context, 'Languages', 'ভাষা'), style: display(16, color: Brand.ink)),
              const SizedBox(height: 4),
              Text(langs, style: body(16)),
            ])),
            AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr(context, 'Open slots', 'খালি সময়'), style: display(19, color: Brand.ink)),
              const SizedBox(height: 10),
              if (m['paused'] == true || slots.isEmpty) Text(tr(context, 'No open slots right now.', 'এখন কোনো খালি সময় নেই।'), style: body(15, color: Brand.muted)),
              Wrap(spacing: 8, runSpacing: 8, children: [for (final s in slots) Pill(_slot(s), tone: Tone.saffron)]),
            ])),
            Text(tr(context, 'Contact details stay private. Chat opens only after the mentor accepts.', 'যোগাযোগের তথ্য গোপন থাকে। মেন্টর গ্রহণ করলেই চ্যাট খোলে।'), textAlign: TextAlign.center, style: body(13, color: Brand.muted)),
            const SizedBox(height: 12),
            BigButton(tr(context, 'Send request', 'অনুরোধ পাঠান'), onPressed: () => sendMentorRequest(context, ref, m['id'])),
            const SizedBox(height: 24),
          ]))),
        ]);
      }),
    );
  }

  Widget _stat(String label, String v) => Column(children: [Text(v, style: display(22, color: Brand.forest)), Text(label, style: body(13, color: Brand.muted))]);
}
