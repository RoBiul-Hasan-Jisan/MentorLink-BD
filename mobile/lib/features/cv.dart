import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// CV builder. Each save creates a new numbered version. No phone, email or address is stored in a CV.
class CvScreen extends ConsumerStatefulWidget {
  const CvScreen({super.key});
  @override
  ConsumerState<CvScreen> createState() => _Cv();
}

class _Cv extends ConsumerState<CvScreen> {
  final summary = TextEditingController(), skills = TextEditingController(), languages = TextEditingController();
  final eduInst = TextEditingController(), eduDeg = TextEditingController(), eduYear = TextEditingController();
  final projTitle = TextEditingController(), projDesc = TextEditingController(), projUrl = TextEditingController();
  final expRole = TextEditingController(), expOrg = TextEditingController(), expDetails = TextEditingController();
  bool busy = false, loaded = false;

  List<String> _split(String t) => t.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();

  // Old or hand-made CV data may hold a plain string where a list is expected. Treat anything that is not a list of maps as empty.
  List _list(dynamic v) => v is List ? v : const [];
  Map _first(dynamic v) { final l = _list(v); return l.isNotEmpty && l.first is Map ? l.first as Map : const {}; }

  void _prefill(Map? d) {
    if (loaded || d == null) return;
    loaded = true;
    summary.text = (d['summary'] ?? '').toString();
    skills.text = _list(d['skills']).join(', ');
    languages.text = _list(d['languages']).join(', ');
    final e = _first(d['education']); if (e.isNotEmpty) { eduInst.text = '${e['institution'] ?? ''}'; eduDeg.text = '${e['degree'] ?? ''}'; eduYear.text = '${e['year'] ?? ''}'; }
    final p = _first(d['projects']); if (p.isNotEmpty) { projTitle.text = '${p['title'] ?? ''}'; projDesc.text = '${p['description'] ?? ''}'; projUrl.text = '${p['url'] ?? ''}'; }
    final x = _first(d['experience']); if (x.isNotEmpty) { expRole.text = '${x['role'] ?? ''}'; expOrg.text = '${x['organization'] ?? ''}'; expDetails.text = '${x['details'] ?? ''}'; }
  }

  Future<void> _save() async {
    setState(() => busy = true);
    try {
      final data = <String, dynamic>{
        'summary': summary.text.trim(),
        'skills': _split(skills.text),
        'languages': _split(languages.text),
        'education': eduInst.text.trim().isEmpty && eduDeg.text.trim().isEmpty ? [] : [{'institution': eduInst.text.trim(), 'degree': eduDeg.text.trim(), if (eduYear.text.trim().isNotEmpty) 'year': eduYear.text.trim()}],
        'projects': projTitle.text.trim().isEmpty ? [] : [{'title': projTitle.text.trim(), 'description': projDesc.text.trim(), if (projUrl.text.trim().isNotEmpty) 'url': projUrl.text.trim()}],
        'experience': expRole.text.trim().isEmpty ? [] : [{'role': expRole.text.trim(), 'organization': expOrg.text.trim(), 'details': expDetails.text.trim()}],
      };
      final r = await ref.read(dioProvider).post('/me/cv', data: {'data': data});
      ref.invalidate(cvProvider);
      if (mounted) toast(context, tr(context, 'CV version ${r.data['cv']['version']} saved', 'সিভি সংস্করণ ${r.data['cv']['version']} সংরক্ষিত'));
    } catch (e) { if (mounted) toast(context, errorText(e)); }
    finally { if (mounted) setState(() => busy = false); }
  }

  Widget _f(TextEditingController c, String en, String bn, {int lines = 1, String? hint}) => Padding(padding: const EdgeInsets.only(bottom: 10), child: TextField(controller: c, minLines: lines, maxLines: lines + 2, decoration: InputDecoration(labelText: tr(context, en, bn), hintText: hint)));
  Widget _h(String en, String bn) => Padding(padding: const EdgeInsets.only(top: 10, bottom: 8), child: Text(tr(context, en, bn), style: display(19, color: Brand.ink)));

  @override
  Widget build(BuildContext context) {
    final versions = ((ref.watch(cvProvider).valueOrNull?['versions'] ?? []) as List);
    _prefill(versions.isEmpty ? null : versions.first['data'] as Map?);
    return Scaffold(body: ListView(padding: EdgeInsets.zero, children: [
      GreenHeader(radius: 36, bottomPad: 30, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        BackCircle(dark: true, onTap: () => context.pop()),
        const SizedBox(height: 12),
        Text(tr(context, 'CV builder', 'সিভি বিল্ডার'), style: display(30, color: Colors.white)),
        Text(tr(context, 'No phone or address is saved here. You choose what to share when you apply.', 'এখানে ফোন বা ঠিকানা সংরক্ষণ হয় না। আবেদনের সময় আপনি ঠিক করবেন কী শেয়ার করবেন।'), style: body(15, color: Colors.white70)),
      ])),
      Padding(padding: const EdgeInsets.all(20), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _f(summary, 'Short summary', 'সংক্ষিপ্ত পরিচিতি', lines: 3),
        _f(skills, 'Skills (comma separated)', 'দক্ষতা (কমা দিয়ে)', hint: 'SQL, Excel, Python'),
        _f(languages, 'Languages (comma separated)', 'ভাষা (কমা দিয়ে)', hint: 'Bangla, English'),
        _h('Education', 'শিক্ষা'), _f(eduInst, 'University', 'বিশ্ববিদ্যালয়'), _f(eduDeg, 'Degree', 'ডিগ্রি'), _f(eduYear, 'Year', 'সাল'),
        _h('Best project', 'সেরা প্রজেক্ট'), _f(projTitle, 'Title', 'শিরোনাম'), _f(projDesc, 'What you did', 'কী করেছেন', lines: 2), _f(projUrl, 'Link (https://...)', 'লিংক (https://...)'),
        _h('Experience', 'অভিজ্ঞতা'), _f(expRole, 'Role', 'ভূমিকা'), _f(expOrg, 'Organization', 'প্রতিষ্ঠান'), _f(expDetails, 'Details', 'বিস্তারিত', lines: 2),
        const SizedBox(height: 6),
        BigButton(tr(context, 'Save as new version', 'নতুন সংস্করণ হিসেবে সংরক্ষণ'), onPressed: busy ? null : _save),
        if (versions.isNotEmpty) ...[
          _h('Saved versions', 'সংরক্ষিত সংস্করণ'),
          for (final v in versions) AppCard(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('v${v['version']} · ${(v['createdAt'] ?? '').toString().split('T').first}', style: display(16, color: Brand.ink)),
            Text(((v['data'] as Map)['summary'] ?? '').toString(), maxLines: 2, overflow: TextOverflow.ellipsis, style: body(14, color: Brand.muted)),
            for (final c in ((v['reviewComments'] ?? []) as List)) Padding(padding: const EdgeInsets.only(top: 6), child: Pill('${tr(context, 'Mentor', 'মেন্টর')}: ${c['text']}', tone: Tone.saffron)),
          ])),
        ],
      ])),
    ]));
  }
}

// Mentor view: reads a mentee's CV versions and leaves a comment (the student sees it under that version).
class ReviewCvScreen extends ConsumerStatefulWidget {
  const ReviewCvScreen({super.key, required this.studentId});
  final String studentId;
  @override
  ConsumerState<ReviewCvScreen> createState() => _ReviewCv();
}

class _ReviewCv extends ConsumerState<ReviewCvScreen> {
  final text = TextEditingController();
  Future<void> _send(String cvId) async {
    if (text.text.trim().length < 2) return;
    try {
      await ref.read(dioProvider).post('/cv/$cvId/review', data: {'text': text.text.trim()});
      text.clear();
      ref.invalidate(menteeCvProvider(widget.studentId));
      if (mounted) toast(context, tr(context, 'Comment sent', 'মন্তব্য পাঠানো হয়েছে'));
    } catch (e) { if (mounted) toast(context, errorText(e)); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'Mentee CV', 'মেন্টির সিভি'))),
      body: AsyncBody(value: ref.watch(menteeCvProvider(widget.studentId)), onRetry: () => ref.invalidate(menteeCvProvider(widget.studentId)), builder: (d) {
        final vs = (d['versions'] as List).cast<Map>();
        if (vs.isEmpty) return Center(child: Text(tr(context, 'No CV yet.', 'এখনও কোনো সিভি নেই।'), style: body(16, color: Brand.muted)));
        final v = vs.first; final c = v['data'] as Map;
        String list(String k) => ((c[k] ?? []) as List).join(', ');
        return ListView(padding: const EdgeInsets.all(16), children: [
          AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('v${v['version']}', style: display(18, color: Brand.ink)),
            const SizedBox(height: 8),
            Text('${c['summary'] ?? ''}', style: body(16)),
            if (list('skills').isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text('${tr(context, 'Skills', 'দক্ষতা')}: ${list('skills')}', style: body(15, color: Brand.muted))),
            for (final p in ((c['projects'] ?? []) as List)) Padding(padding: const EdgeInsets.only(top: 8), child: Text('• ${p['title']}${(p['description'] ?? '').toString().isEmpty ? '' : ': ${p['description']}'}', style: body(15))),
            for (final e in ((c['education'] ?? []) as List)) Padding(padding: const EdgeInsets.only(top: 8), child: Text('${e['degree']}, ${e['institution']} ${e['year'] ?? ''}', style: body(15, color: Brand.muted))),
            for (final r in ((v['reviewComments'] ?? []) as List)) Padding(padding: const EdgeInsets.only(top: 6), child: Pill('${r['text']}', tone: Tone.saffron)),
          ])),
          TextField(controller: text, minLines: 2, maxLines: 4, decoration: InputDecoration(labelText: tr(context, 'Your comment', 'আপনার মন্তব্য'))),
          const SizedBox(height: 10),
          BigButton(tr(context, 'Send comment', 'মন্তব্য পাঠান'), onPressed: () => _send(v['_id'])),
        ]);
      }),
    );
  }
}
