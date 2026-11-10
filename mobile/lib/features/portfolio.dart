import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// Project portfolio + GitHub link. A project becomes evidence at level 1 for each skill you pick;
// a mentor can endorse it up to their own level. GitHub only suggests projects. It never raises a score by itself.
final portfolioProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/portfolio'));

class PortfolioScreen extends ConsumerWidget {
  const PortfolioScreen({super.key});

  Future<void> _call(BuildContext context, WidgetRef ref, Future<dynamic> Function() run, {String? done}) async {
    try {
      await run();
      ref.invalidate(portfolioProvider);
      if (done != null && context.mounted) toast(context, done);
    } catch (e) {
      if (context.mounted) toast(context, errorText(e));
    }
  }

  Tone _tone(String r) => switch (r) { 'endorsed' => Tone.green, 'needs_work' => Tone.red, 'requested' => Tone.saffron, _ => Tone.grey };
  String _reviewText(BuildContext c, String r) => switch (r) {
        'endorsed' => tr(c, 'Endorsed by a mentor', 'মেন্টর এন্ডোর্স করেছেন'),
        'needs_work' => tr(c, 'Needs more work', 'আরও কাজ দরকার'),
        'requested' => tr(c, 'Review requested', 'রিভিউ চাওয়া হয়েছে'),
        _ => tr(c, 'Not reviewed yet', 'এখনও রিভিউ হয়নি'),
      };

  Future<void> _addSheet(BuildContext context, WidgetRef ref, List skills, {String title = '', String url = '', String description = '', List<String> picked = const [], String source = 'manual'}) async {
    final t = TextEditingController(text: title), u = TextEditingController(text: url), d = TextEditingController(text: description);
    final sel = <String>{...picked};
    await showModalBottomSheet(context: context, isScrollControlled: true, showDragHandle: true, builder: (c) => StatefulBuilder(builder: (c, set) => Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(c).viewInsets.bottom + 20),
      child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(tr(context, 'Add a project', 'প্রজেক্ট যোগ করুন'), style: display(20, color: Brand.ink)),
        const SizedBox(height: 10),
        TextField(controller: t, maxLength: 120, decoration: InputDecoration(labelText: tr(context, 'Project name', 'প্রজেক্টের নাম'))),
        TextField(controller: u, keyboardType: TextInputType.url, decoration: InputDecoration(labelText: tr(context, 'Link (starts with https://)', 'লিংক (https:// দিয়ে শুরু)'))),
        TextField(controller: d, maxLines: 3, maxLength: 600, decoration: InputDecoration(labelText: tr(context, 'What did you build? (optional)', 'কী বানিয়েছেন? (ঐচ্ছিক)'))),
        Text(tr(context, 'Skills it shows (1 to 5)', 'যে দক্ষতা দেখায় (১ থেকে ৫)'), style: body(14, w: FontWeight.w700)),
        const SizedBox(height: 6),
        Wrap(spacing: 8, runSpacing: 4, children: [
          for (final s in skills.cast<Map>()) FilterChip(
            label: Text(nm(context, s, 'nameEn', 'nameBn')), selected: sel.contains(s['key']),
            onSelected: (v) => set(() { if (v && sel.length < 5) { sel.add(s['key'] as String); } else { sel.remove(s['key']); } })),
        ]),
        const SizedBox(height: 14),
        BigButton(tr(context, 'Save project', 'প্রজেক্ট সংরক্ষণ'), onPressed: () async {
          if (sel.isEmpty) { toast(context, tr(context, 'Pick at least one skill', 'অন্তত একটি দক্ষতা বেছে নিন')); return; }
          Navigator.pop(c);
          await _call(context, ref, () => ref.read(dioProvider).post('/me/projects', data: {'title': t.text.trim(), 'url': u.text.trim(), 'description': d.text.trim(), 'skillKeys': sel.toList(), 'source': source}), done: tr(context, 'Project added at level 1. Ask a mentor to review it.', 'প্রজেক্ট লেভেল ১-এ যোগ হয়েছে। মেন্টরকে রিভিউ করতে বলুন।'));
        }),
      ])),
    )));
  }

  Future<void> _askReview(BuildContext context, WidgetRef ref, Map p, List mentors) async {
    if (mentors.isEmpty) { toast(context, tr(context, 'You need a mentor who accepted your request first.', 'আগে এমন একজন মেন্টর লাগবে যিনি আপনার অনুরোধ গ্রহণ করেছেন।')); return; }
    final id = await showModalBottomSheet<String>(context: context, showDragHandle: true, builder: (c) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
      Padding(padding: const EdgeInsets.all(16), child: Text(tr(context, 'Who should review it?', 'কে রিভিউ করবেন?'), style: display(19, color: Brand.ink))),
      for (final m in mentors.cast<Map>()) ListTile(leading: Avatar('${m['name']}', size: 40), title: Text('${m['name']}', style: body(16, w: FontWeight.w600)), onTap: () => Navigator.pop(c, '${m['id']}')),
    ])));
    if (id == null || !context.mounted) return;
    await _call(context, ref, () => ref.read(dioProvider).post('/me/projects/${p['id']}/request-review', data: {'mentorId': id}), done: tr(context, 'Review requested', 'রিভিউ চাওয়া হয়েছে'));
  }

  Widget _github(BuildContext context, WidgetRef ref, Map g) {
    final user = TextEditingController(text: (g['username'] ?? '') as String);
    final dio = ref.read(dioProvider);
    final verified = g['verified'] == true;
    final started = g['username'] != null && !verified;
    return AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [Icon(Icons.code, color: Brand.delta), const SizedBox(width: 10), Expanded(child: Text('GitHub', style: display(19, color: Brand.ink))), if (verified) Pill(tr(context, 'Verified', 'যাচাইকৃত'))]),
      const SizedBox(height: 8),
      if (verified) ...[
        Text(tr(context, '@${g['username']} · ${g['repos']} public repos found. Ownership was proven with a code in your bio.', '@${g['username']} · ${g['repos']}টি পাবলিক রিপো পাওয়া গেছে। বায়োতে কোড দিয়ে মালিকানা প্রমাণ হয়েছে।'), style: body(14, color: Brand.muted)),
        const SizedBox(height: 10),
        BigButton(tr(context, 'Disconnect', 'সংযোগ বিচ্ছিন্ন'), outlined: true, onPressed: () => _call(context, ref, () => dio.post('/me/github/disconnect'))),
      ] else if (started) ...[
        Text(tr(context, 'Put this code in your GitHub profile bio, save it, then tap Verify. You can remove it afterwards.', 'এই কোডটি আপনার GitHub প্রোফাইলের বায়োতে বসিয়ে সেভ করুন, তারপর যাচাই চাপুন। পরে মুছে ফেলতে পারবেন।'), style: body(14, color: Brand.muted)),
        const SizedBox(height: 8),
        Container(width: double.infinity, padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: Brand.lightGreen, borderRadius: BorderRadius.circular(12)), child: SelectableText('${g['code']}', style: display(18, color: Brand.forest))),
        const SizedBox(height: 10),
        BigButton(tr(context, 'Verify', 'যাচাই করুন'), onPressed: () => _call(context, ref, () => dio.post('/me/github/verify'), done: tr(context, 'GitHub verified', 'GitHub যাচাই হয়েছে'))),
        const SizedBox(height: 8),
        BigButton(tr(context, 'Start over', 'আবার শুরু'), outlined: true, onPressed: () => _call(context, ref, () => dio.post('/me/github/disconnect'))),
      ] else ...[
        Text(tr(context, 'Connect your GitHub to get project suggestions. We read public repositories only.', 'প্রজেক্ট সাজেশনের জন্য GitHub যুক্ত করুন। আমরা শুধু পাবলিক রিপো পড়ি।'), style: body(14, color: Brand.muted)),
        TextField(controller: user, decoration: InputDecoration(labelText: tr(context, 'GitHub username', 'GitHub ইউজারনেম'))),
        const SizedBox(height: 10),
        BigButton(tr(context, 'Get my code', 'আমার কোড নিন'), onPressed: () => _call(context, ref, () => dio.post('/me/github/start', data: {'username': user.text.trim()}))),
      ],
    ]));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'Projects & GitHub', 'প্রজেক্ট ও GitHub'), style: display(22, color: Brand.ink))),
      body: AsyncBody(value: ref.watch(portfolioProvider), onRetry: () => ref.invalidate(portfolioProvider), builder: (d) {
        final m = d as Map<String, dynamic>;
        final projects = (m['projects'] as List).cast<Map>(), suggestions = (m['suggestions'] as List).cast<Map>();
        final skills = m['skills'] as List, mentors = m['mentors'] as List;
        final byKey = {for (final s in skills.cast<Map>()) s['key']: s};
        return ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 28), children: [
          Text(m['note'] as String, style: body(13, color: Brand.muted)),
          const SizedBox(height: 10),
          _github(context, ref, m['github'] as Map),
          if (suggestions.isNotEmpty) ...[
            Padding(padding: const EdgeInsets.fromLTRB(4, 8, 4, 8), child: Text(tr(context, 'Suggested from your GitHub', 'আপনার GitHub থেকে সাজেশন'), style: display(18, color: Brand.ink))),
            for (final s in suggestions) AppCard(child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${s['title']}', style: body(16, w: FontWeight.w700)),
                if ((s['description'] as String).isNotEmpty) Text('${s['description']}', style: body(13, color: Brand.muted)),
                if ((s['skillKeys'] as List).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Wrap(spacing: 6, children: [for (final k in s['skillKeys'] as List) Pill(nm(context, byKey[k] ?? {'nameEn': '$k'}, 'nameEn', 'nameBn'), tone: Tone.blue)])),
              ])),
              TextButton(onPressed: () => _addSheet(context, ref, skills, title: '${s['title']}', url: '${s['url']}', description: '${s['description']}', picked: (s['skillKeys'] as List).cast<String>(), source: 'github'), child: Text(tr(context, 'Add', 'যোগ করুন'))),
            ])),
          ],
          Padding(padding: const EdgeInsets.fromLTRB(4, 8, 4, 8), child: Row(children: [
            Expanded(child: Text(tr(context, 'My projects', 'আমার প্রজেক্ট'), style: display(18, color: Brand.ink))),
            FilledButton.icon(style: FilledButton.styleFrom(backgroundColor: Brand.delta), onPressed: () => _addSheet(context, ref, skills), icon: const Icon(Icons.add), label: Text(tr(context, 'Add', 'যোগ করুন'))),
          ])),
          if (projects.isEmpty) AppCard(child: Text(tr(context, 'No projects yet. Add one you built, even a small one. A mentor can then review it.', 'এখনও কোনো প্রজেক্ট নেই। ছোট হলেও একটি যোগ করুন, তারপর মেন্টর রিভিউ করতে পারবেন।'), style: body(15, color: Brand.muted))),
          for (final p in projects) AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text('${p['title']}', style: body(17, w: FontWeight.w700))),
              Pill(_reviewText(context, p['review'] as String), tone: _tone(p['review'] as String)),
            ]),
            if ((p['description'] as String).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text('${p['description']}', style: body(14, color: Brand.muted))),
            Padding(padding: const EdgeInsets.only(top: 8), child: Wrap(spacing: 6, runSpacing: 4, children: [for (final k in p['skillKeys'] as List) Pill(nm(context, byKey[k] ?? {'nameEn': '$k'}, 'nameEn', 'nameBn'), tone: Tone.blue)])),
            Row(children: [
              TextButton.icon(onPressed: () => launchUrl(Uri.parse('${p['url']}'), mode: LaunchMode.externalApplication), icon: const Icon(Icons.open_in_new, size: 18), label: Text(tr(context, 'Open', 'খুলুন'))),
              if (p['review'] == 'none' || p['review'] == 'needs_work') TextButton.icon(onPressed: () => _askReview(context, ref, p, mentors), icon: const Icon(Icons.rate_review_outlined, size: 18), label: Text(tr(context, 'Ask a mentor', 'মেন্টরকে বলুন'))),
              const Spacer(),
              if (p['review'] != 'endorsed') IconButton(tooltip: tr(context, 'Delete', 'মুছুন'), onPressed: () => _call(context, ref, () => ref.read(dioProvider).delete('/me/projects/${p['id']}')), icon: Icon(Icons.delete_outline, color: Brand.muted)),
            ]),
          ])),
        ]);
      }),
    );
  }
}
