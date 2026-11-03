import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:printing/printing.dart';
import 'package:file_saver/file_saver.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'cv_pdf.dart';
import 'widgets.dart';

// CV builder v2. Sections and items can be dragged into any order, hidden, edited and saved as a new version.
// The PDF is made on the phone from the same data, so the preview and the download are identical.
// Phone and email are only stored on the CV; employers see them only if the student ticks "Contact" when applying.

const _sectionTitles = {
  'summary': ['Summary', 'সারসংক্ষেপ'],
  'skills': ['Skills', 'দক্ষতা'],
  'projects': ['Projects', 'প্রজেক্ট'],
  'experience': ['Experience', 'অভিজ্ঞতা'],
  'education': ['Education', 'শিক্ষা'],
  'achievements': ['Achievements', 'অর্জন'],
  'languages': ['Languages', 'ভাষা'],
};
const _accents = ['#1F5FBF', '#0A4A39', '#7A2E8E', '#B4441A', '#222222'];

int _seq = 0;
String _nk() => 'k${_seq++}';
String _t(dynamic v) => (v ?? '').toString();
List _lst(dynamic v) => v is List ? v : const [];
Map _mp(dynamic v) => v is Map ? v : const {};

// One editable row: text fields by name, plus optional bullet lines and link rows.
class _Item {
  _Item(this.fields, {List<_Line>? bullets, List<_Item>? links}) : bullets = bullets ?? [], links = links ?? [];
  final String key = _nk();
  final Map<String, TextEditingController> fields;
  final List<_Line> bullets;
  final List<_Item> links;
  String v(String f) => fields[f]?.text.trim() ?? '';
  void dispose() { for (final c in fields.values) { c.dispose(); } for (final b in bullets) { b.c.dispose(); } for (final l in links) { l.dispose(); } }
}

class _Line {
  _Line(String text) : c = TextEditingController(text: text);
  final String key = _nk();
  final TextEditingController c;
}

_Item _mk(List<String> names, Map src, {bool bullets = false, bool links = false}) => _Item(
      {for (final n in names) n: TextEditingController(text: _t(src[n]))},
      bullets: bullets ? [for (final b in _lst(src['bullets'])) _Line(_t(b))] : null,
      links: links ? [for (final l in _lst(src['links'])) _mk(['label', 'url'], _mp(l))] : null,
    );

class CvScreen extends ConsumerStatefulWidget {
  const CvScreen({super.key});
  @override
  ConsumerState<CvScreen> createState() => _Cv();
}

class _Cv extends ConsumerState<CvScreen> {
  final name = TextEditingController(), headline = TextEditingController(), city = TextEditingController(), email = TextEditingController(), phone = TextEditingController();
  final summary = TextEditingController(), languages = TextEditingController();
  final contactLinks = <_Item>[], skills = <_Item>[], projects = <_Item>[], experience = <_Item>[], education = <_Item>[], achievements = <_Item>[];
  List<String> order = ['summary', 'skills', 'projects', 'experience', 'education', 'achievements', 'languages'];
  final hidden = <String>{};
  final open = <String>{};
  String template = 'classic', accent = _accents.first;
  bool loaded = false, busy = false, preview = false;
  int previewRev = 0;
  List<Map> tips = [];
  int? score;

  @override
  void dispose() {
    for (final c in [name, headline, city, email, phone, summary, languages]) { c.dispose(); }
    for (final l in [contactLinks, skills, projects, experience, education, achievements]) { for (final i in l) { i.dispose(); } }
    super.dispose();
  }

  void _load(Map d) {
    loaded = true;
    name.text = _t(d['fullName']); headline.text = _t(d['headline']);
    final c = _mp(d['contact']);
    city.text = _t(c['city']); email.text = _t(c['email']); phone.text = _t(c['phone']);
    contactLinks..clear()..addAll([for (final l in _lst(c['links'])) _mk(['label', 'url'], _mp(l))]);
    summary.text = _t(d['summary']);
    languages.text = _lst(d['languages']).map(_t).join(', ');
    skills..clear()..addAll([for (final g in _lst(d['skills'])) _Item({'label': TextEditingController(text: _t(_mp(g)['label'])), 'items': TextEditingController(text: _lst(_mp(g)['items']).map(_t).join(', '))})]);
    projects..clear()..addAll([for (final p in _lst(d['projects'])) _mk(['title', 'tech'], _mp(p), bullets: true, links: true)]);
    experience..clear()..addAll([for (final x in _lst(d['experience'])) _mk(['role', 'organization', 'period'], _mp(x), bullets: true)]);
    education..clear()..addAll([for (final e in _lst(d['education'])) _mk(['degree', 'institution', 'period', 'note'], _mp(e))]);
    achievements..clear()..addAll([for (final a in _lst(d['achievements'])) _mk(['lead', 'text'], _mp(a))]);
    final so = _lst(d['sectionOrder']).map(_t).where(_sectionTitles.containsKey).toList();
    for (final k in _sectionTitles.keys) { if (!so.contains(k)) so.add(k); }
    order = so;
    hidden..clear()..addAll(_lst(d['hidden']).map(_t));
    template = _t(d['template']) == 'compact' ? 'compact' : 'classic';
    accent = _accents.contains(_t(d['accent'])) ? _t(d['accent']) : _accents.first;
  }

  Map<String, dynamic> _json() {
    List<Map> links(_Item i) => [for (final l in i.links) if (l.v('url').isNotEmpty) {'label': l.v('label').isEmpty ? l.v('url') : l.v('label'), 'url': l.v('url')}];
    List<String> csv(String s) => s.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
    return {
      'v': 2, 'template': template, 'accent': accent,
      'fullName': name.text.trim(), 'headline': headline.text.trim(),
      'contact': {'city': city.text.trim(), 'email': email.text.trim(), 'phone': phone.text.trim(), 'links': [for (final l in contactLinks) if (l.v('url').isNotEmpty) {'label': l.v('label').isEmpty ? l.v('url') : l.v('label'), 'url': l.v('url')}]},
      'sectionOrder': order, 'hidden': hidden.toList(),
      'summary': summary.text.trim(),
      'skills': [for (final g in skills) if (g.v('items').isNotEmpty) {'label': g.v('label'), 'items': csv(g.v('items'))}],
      'projects': [for (final p in projects) if (p.v('title').isNotEmpty) {'title': p.v('title'), 'tech': p.v('tech'), 'links': links(p), 'bullets': [for (final b in p.bullets) if (b.c.text.trim().isNotEmpty) b.c.text.trim()]}],
      'experience': [for (final x in experience) if (x.v('role').isNotEmpty) {'role': x.v('role'), 'organization': x.v('organization'), 'period': x.v('period'), 'bullets': [for (final b in x.bullets) if (b.c.text.trim().isNotEmpty) b.c.text.trim()]}],
      'education': [for (final e in education) if (e.v('degree').isNotEmpty || e.v('institution').isNotEmpty) {'degree': e.v('degree'), 'institution': e.v('institution'), 'period': e.v('period'), 'note': e.v('note')}],
      'achievements': [for (final a in achievements) if (a.v('lead').isNotEmpty || a.v('text').isNotEmpty) {'lead': a.v('lead'), 'text': a.v('text')}],
      'languages': csv(languages.text),
    };
  }

  Future<void> _save() async {
    setState(() => busy = true);
    try {
      final r = await ref.read(dioProvider).post('/me/cv', data: {'data': _json()});
      ref.invalidate(cvProvider);
      if (mounted) toast(context, tr(context, 'CV version ${r.data['cv']['version']} saved', 'সিভি সংস্করণ ${r.data['cv']['version']} সংরক্ষিত'));
    } catch (e) { if (mounted) toast(context, errorText(e)); }
    finally { if (mounted) setState(() => busy = false); }
  }

  Future<void> _check() async {
    setState(() => busy = true);
    try {
      final r = await ref.read(dioProvider).post('/me/cv/check', data: {'data': _json()});
      final d = r.data as Map;
      setState(() { tips = _lst(d['tips']).whereType<Map>().toList(); score = d['score'] is num ? (d['score'] as num).toInt() : null; });
    } catch (e) { if (mounted) toast(context, errorText(e)); }
    finally { if (mounted) setState(() => busy = false); }
  }

  Future<Uint8List> _pdfBytes() => buildCvPdf(_json());
  String get _fileBase => '${name.text.trim().isEmpty ? 'CV' : name.text.trim().replaceAll(RegExp(r'\s+'), '_')}_CV';

  // Download = save the file on the phone (Downloads folder).
  Future<void> _download() async {
    try {
      final bytes = await _pdfBytes();
      await FileSaver.instance.saveFile(name: _fileBase, bytes: bytes, ext: 'pdf', mimeType: MimeType.pdf);
      if (mounted) toast(context, tr(context, 'Saved to your phone: $_fileBase.pdf', 'ফোনে সংরক্ষিত: $_fileBase.pdf'));
    } catch (e) { if (mounted) toast(context, errorText(e)); }
  }

  // ---- small widgets ----
  Widget _tf(TextEditingController c, String en, String bn, {int lines = 1, String? hint}) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: TextField(controller: c, minLines: lines, maxLines: lines + 2, decoration: InputDecoration(labelText: tr(context, en, bn), hintText: hint)),
      );

  Widget _handle(int i) => ReorderableDragStartListener(index: i, child: const Padding(padding: EdgeInsets.all(8), child: Icon(Icons.drag_indicator, color: Brand.muted)));

  // A drag-to-reorder list of rows. `row` builds the inside of each card.
  Widget _reorder<T>(List<T> items, Key Function(T) keyOf, Widget Function(T, int) row) => ReorderableListView(
        shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), buildDefaultDragHandles: false,
        onReorder: (a, b) => setState(() { if (b > a) b -= 1; items.insert(b, items.removeAt(a)); }),
        children: [for (var i = 0; i < items.length; i++) KeyedSubtree(key: keyOf(items[i]), child: row(items[i], i))],
      );

  Widget _itemCard(List<_Item> list, _Item it, int i, List<Widget> children) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFD9E0DB))),
        child: Padding(padding: const EdgeInsets.fromLTRB(4, 6, 8, 6), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _handle(i),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const SizedBox(height: 6), ...children])),
          IconButton(tooltip: tr(context, 'Remove', 'মুছুন'), icon: const Icon(Icons.close, size: 20), onPressed: () => setState(() { list.remove(it); it.dispose(); })),
        ])),
      );

  Widget _lines(String en, String bn, List<_Line> ls) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(tr(context, en, bn), style: body(13, color: Brand.muted, w: FontWeight.w700)),
        const SizedBox(height: 6),
        _reorder<_Line>(ls, (l) => ValueKey(l.key), (l, i) => Row(children: [
          _handle(i),
          Expanded(child: Padding(padding: const EdgeInsets.only(bottom: 6), child: TextField(controller: l.c, minLines: 1, maxLines: 4, decoration: const InputDecoration(isDense: true)))),
          IconButton(icon: const Icon(Icons.close, size: 18), onPressed: () => setState(() { ls.remove(l); l.c.dispose(); })),
        ])),
        Align(alignment: Alignment.centerLeft, child: TextButton.icon(onPressed: () => setState(() => ls.add(_Line(''))), icon: const Icon(Icons.add, size: 18), label: Text(tr(context, 'Add point', 'পয়েন্ট যোগ')))),
      ]);

  Widget _linkRows(List<_Item> ls) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        for (final l in ls) Row(children: [
          Expanded(flex: 2, child: Padding(padding: const EdgeInsets.only(bottom: 6, right: 6), child: TextField(controller: l.fields['label'], decoration: InputDecoration(isDense: true, labelText: tr(context, 'Label', 'লেবেল'))))),
          Expanded(flex: 4, child: Padding(padding: const EdgeInsets.only(bottom: 6), child: TextField(controller: l.fields['url'], keyboardType: TextInputType.url, decoration: const InputDecoration(isDense: true, labelText: 'https://...')))),
          IconButton(icon: const Icon(Icons.close, size: 18), onPressed: () => setState(() { ls.remove(l); l.dispose(); })),
        ]),
        Align(alignment: Alignment.centerLeft, child: TextButton.icon(onPressed: () => setState(() => ls.add(_mk(['label', 'url'], const {}))), icon: const Icon(Icons.add, size: 18), label: Text(tr(context, 'Add link', 'লিংক যোগ')))),
      ]);

  Widget _addBtn(String en, String bn, VoidCallback f) => Align(alignment: Alignment.centerLeft, child: OutlinedButton.icon(onPressed: () => setState(f), icon: const Icon(Icons.add), label: Text(tr(context, en, bn))));

  Widget _sectionBody(String k) {
    switch (k) {
      case 'summary':
        return _tf(summary, 'Short summary (2-3 lines)', 'সংক্ষিপ্ত পরিচিতি (২-৩ লাইন)', lines: 4);
      case 'skills':
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _reorder<_Item>(skills, (x) => ValueKey(x.key), (g, i) => _itemCard(skills, g, i, [
            _tf(g.fields['label']!, 'Group (e.g. Languages)', 'গ্রুপ (যেমন Languages)'),
            _tf(g.fields['items']!, 'Skills, comma separated', 'দক্ষতা, কমা দিয়ে', hint: 'Python, SQL, Flutter'),
          ])),
          _addBtn('Add skill group', 'স্কিল গ্রুপ যোগ', () => skills.add(_mk(['label', 'items'], const {}))),
        ]);
      case 'projects':
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _reorder<_Item>(projects, (x) => ValueKey(x.key), (p, i) => _itemCard(projects, p, i, [
            _tf(p.fields['title']!, 'Project title', 'প্রজেক্টের নাম'),
            _lines('What you built (use numbers)', 'কী বানিয়েছেন (সংখ্যা দিন)', p.bullets),
            _tf(p.fields['tech']!, 'Tech used', 'ব্যবহৃত প্রযুক্তি'),
            _linkRows(p.links),
          ])),
          _addBtn('Add project', 'প্রজেক্ট যোগ', () => projects.add(_mk(['title', 'tech'], const {}, bullets: true, links: true))),
        ]);
      case 'experience':
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _reorder<_Item>(experience, (x) => ValueKey(x.key), (x, i) => _itemCard(experience, x, i, [
            _tf(x.fields['role']!, 'Role', 'ভূমিকা'),
            _tf(x.fields['organization']!, 'Organization', 'প্রতিষ্ঠান'),
            _tf(x.fields['period']!, 'Period (e.g. Jan 2025 - Present)', 'সময় (যেমন Jan 2025 - Present)'),
            _lines('What you did', 'কী করেছেন', x.bullets),
          ])),
          _addBtn('Add experience', 'অভিজ্ঞতা যোগ', () => experience.add(_mk(['role', 'organization', 'period'], const {}, bullets: true))),
        ]);
      case 'education':
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _reorder<_Item>(education, (x) => ValueKey(x.key), (e, i) => _itemCard(education, e, i, [
            _tf(e.fields['degree']!, 'Degree', 'ডিগ্রি'),
            _tf(e.fields['institution']!, 'Institution', 'প্রতিষ্ঠান'),
            _tf(e.fields['period']!, 'Period', 'সময়'),
            _tf(e.fields['note']!, 'Note (CGPA, result)', 'নোট (সিজিপিএ, ফলাফল)'),
          ])),
          _addBtn('Add education', 'শিক্ষা যোগ', () => education.add(_mk(['degree', 'institution', 'period', 'note'], const {}))),
        ]);
      case 'achievements':
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _reorder<_Item>(achievements, (x) => ValueKey(x.key), (a, i) => _itemCard(achievements, a, i, [
            _tf(a.fields['lead']!, 'Title (bold)', 'শিরোনাম (বোল্ড)'),
            _tf(a.fields['text']!, 'Details', 'বিস্তারিত', lines: 2),
          ])),
          _addBtn('Add achievement', 'অর্জন যোগ', () => achievements.add(_mk(['lead', 'text'], const {}))),
        ]);
      case 'languages':
        return _tf(languages, 'Languages, comma separated', 'ভাষা, কমা দিয়ে', hint: 'Bangla (native), English (fluent)');
    }
    return const SizedBox.shrink();
  }

  Widget _sectionCard(String k, int i) {
    final isHidden = hidden.contains(k), isOpen = open.contains(k);
    final t = _sectionTitles[k]!;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(color: isHidden ? Brand.paper : Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFD9E0DB))),
      child: Column(children: [
        Row(children: [
          _handle(i),
          Expanded(child: InkWell(onTap: () => setState(() { isOpen ? open.remove(k) : open.add(k); }), child: Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: Text(tr(context, t[0], t[1]), style: display(17, color: isHidden ? Brand.muted : Brand.ink))))),
          IconButton(tooltip: tr(context, 'Show or hide in the PDF', 'পিডিএফে দেখান/লুকান'), icon: Icon(isHidden ? Icons.visibility_off : Icons.visibility, size: 20, color: isHidden ? Brand.muted : Brand.forest), onPressed: () => setState(() { isHidden ? hidden.remove(k) : hidden.add(k); })),
          IconButton(icon: Icon(isOpen ? Icons.expand_less : Icons.expand_more), onPressed: () => setState(() { isOpen ? open.remove(k) : open.add(k); })),
        ]),
        if (isOpen) Padding(padding: const EdgeInsets.fromLTRB(14, 0, 14, 12), child: _sectionBody(k)),
      ]),
    );
  }

  Widget _editor() => ListView(padding: const EdgeInsets.all(20), children: [
        Text(tr(context, 'Your details', 'আপনার তথ্য'), style: display(19, color: Brand.ink)),
        const SizedBox(height: 8),
        _tf(name, 'Full name', 'পুরো নাম'),
        _tf(headline, 'Headline (e.g. CSE student | Flutter developer)', 'শিরোনাম (যেমন CSE student | Flutter developer)'),
        _tf(city, 'City', 'শহর'),
        _tf(email, 'Email', 'ইমেইল'),
        _tf(phone, 'Phone', 'ফোন'),
        Text(tr(context, 'Employers see phone and email only if you tick "Contact" when applying.', 'আবেদনের সময় "যোগাযোগ" টিক দিলে তবেই কোম্পানি ফোন ও ইমেইল দেখবে।'), style: body(13, color: Brand.muted)),
        const SizedBox(height: 10),
        Text(tr(context, 'Links (GitHub, LinkedIn, portfolio)', 'লিংক (GitHub, LinkedIn, পোর্টফোলিও)'), style: body(14, w: FontWeight.w700)),
        _linkRows(contactLinks),
        const Divider(height: 28),
        Text(tr(context, 'Sections', 'সেকশন'), style: display(19, color: Brand.ink)),
        Text(tr(context, 'Hold the handle and drag to change the order. The eye hides a section from the PDF.', 'হ্যান্ডেল ধরে টেনে ক্রম বদলান। চোখের আইকন পিডিএফ থেকে সেকশন লুকায়।'), style: body(13, color: Brand.muted)),
        const SizedBox(height: 10),
        _reorder<String>(order, (k) => ValueKey('sec$k'), (k, i) => _sectionCard(k, i)),
        const Divider(height: 28),
        Text(tr(context, 'Look', 'ডিজাইন'), style: display(19, color: Brand.ink)),
        const SizedBox(height: 8),
        SegmentedButton<String>(
          segments: [ButtonSegment(value: 'classic', label: Text(tr(context, 'Classic', 'ক্লাসিক'))), ButtonSegment(value: 'compact', label: Text(tr(context, 'Compact (fits more)', 'কমপ্যাক্ট (বেশি ধরে)')))],
          selected: {template}, onSelectionChanged: (s) => setState(() => template = s.first),
        ),
        const SizedBox(height: 12),
        Row(children: [for (final a in _accents) Padding(padding: const EdgeInsets.only(right: 12), child: GestureDetector(
          onTap: () => setState(() => accent = a),
          child: Container(width: 34, height: 34, decoration: BoxDecoration(shape: BoxShape.circle, color: Color(int.parse('FF${a.substring(1)}', radix: 16)), border: Border.all(color: accent == a ? Brand.ink : Colors.transparent, width: 3))),
        ))]),
        const Divider(height: 28),
        Row(children: [
          Expanded(child: Text(tr(context, 'CV check', 'সিভি চেক'), style: display(19, color: Brand.ink))),
          if (score != null) Pill('$score/100', tone: score! >= 70 ? Tone.green : Tone.saffron),
        ]),
        const SizedBox(height: 8),
        for (final tp in tips) Padding(padding: const EdgeInsets.only(bottom: 6), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Icon(Icons.lightbulb_outline, size: 18, color: Brand.saffron), const SizedBox(width: 8),
          Expanded(child: Text(_t(Localizations.localeOf(context).languageCode == 'bn' ? (tp['bn'] ?? tp['en']) : tp['en']), style: body(14))),
        ])),
        BigButton(tr(context, 'Check my CV', 'আমার সিভি চেক করুন'), outlined: true, onPressed: busy ? null : _check),
        const SizedBox(height: 10),
        BigButton(tr(context, 'Save as new version', 'নতুন সংস্করণ হিসেবে সংরক্ষণ'), onPressed: busy ? null : _save),
        _versions(),
        const SizedBox(height: 30),
      ]);

  Widget _versions() {
    final vs = _lst(ref.watch(cvProvider).valueOrNull?['versions']);
    if (vs.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Divider(height: 28),
      Text(tr(context, 'Saved versions', 'সংরক্ষিত সংস্করণ'), style: display(19, color: Brand.ink)),
      const SizedBox(height: 8),
      for (final v in vs) AppCard(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text('v${v['version']} · ${_t(v['createdAt']).split('T').first}', style: display(16, color: Brand.ink))),
          TextButton(onPressed: () => setState(() { _load(_mp(v['data'])); previewRev++; toast(context, tr(context, 'Version loaded. Edit and save as new.', 'সংস্করণ লোড হয়েছে। এডিট করে নতুন হিসেবে সংরক্ষণ করুন।')); }), child: Text(tr(context, 'Edit this', 'এটি এডিট'))),
        ]),
        Text(_t(_mp(v['data'])['summary']), maxLines: 2, overflow: TextOverflow.ellipsis, style: body(14, color: Brand.muted)),
        for (final c in _lst(v['reviewComments'])) Padding(padding: const EdgeInsets.only(top: 6), child: Pill('${tr(context, 'Mentor', 'মেন্টর')}: ${_t(_mp(c)['text'])}', tone: Tone.saffron)),
      ])),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(cvProvider);
    final versions = _lst(async.valueOrNull?['versions']);
    if (!loaded && async.hasValue) {
      if (versions.isNotEmpty) { _load(_mp(versions.first['data'])); } else { loaded = true; }
    }
    return Scaffold(
      body: Column(children: [
        GreenHeader(radius: 36, bottomPad: 20, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [BackCircle(dark: true, onTap: () => context.pop()), const Spacer(), if (preview) ...[
            TextButton.icon(onPressed: _download, icon: const Icon(Icons.download, color: Colors.white, size: 20), label: Text(tr(context, 'Download', 'ডাউনলোড'), style: const TextStyle(color: Colors.white))),
          ]]),
          const SizedBox(height: 8),
          Text(tr(context, 'CV builder', 'সিভি বিল্ডার'), style: display(28, color: Colors.white)),
          const SizedBox(height: 10),
          SegmentedButton<bool>(
            style: SegmentedButton.styleFrom(backgroundColor: Colors.white24, foregroundColor: Colors.white, selectedBackgroundColor: Colors.white, selectedForegroundColor: Brand.forest),
            segments: [ButtonSegment(value: false, icon: const Icon(Icons.edit_outlined), label: Text(tr(context, 'Edit', 'এডিট'))), ButtonSegment(value: true, icon: const Icon(Icons.picture_as_pdf_outlined), label: Text(tr(context, 'Preview', 'প্রিভিউ')))],
            selected: {preview}, onSelectionChanged: (s) => setState(() { preview = s.first; previewRev++; }),
          ),
        ])),
        Expanded(child: !loaded ? const Center(child: CircularProgressIndicator()) : preview
            ? PdfPreview(key: ValueKey(previewRev), build: (_) => buildCvPdf(_json()), canChangePageFormat: false, canChangeOrientation: false, canDebug: false, allowPrinting: true, allowSharing: false, pdfFileName: 'CV.pdf')
            : _editor()),
      ]),
    );
  }
}

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
        final vs = _lst(d['versions']).whereType<Map>().toList();
        if (vs.isEmpty) return Center(child: Text(tr(context, 'No CV yet.', 'এখনও কোনো সিভি নেই।'), style: body(16, color: Brand.muted)));
        final v = vs.first; final c = _mp(v['data']);
        return Column(children: [
          Expanded(child: PdfPreview(build: (_) => buildCvPdf(c), canChangePageFormat: false, canChangeOrientation: false, canDebug: false, allowPrinting: false, allowSharing: false, pdfFileName: 'Mentee_CV.pdf')),
          Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('v${v['version']}', style: display(16, color: Brand.ink)),
            for (final r in _lst(v['reviewComments'])) Padding(padding: const EdgeInsets.only(top: 6), child: Pill(_t(_mp(r)['text']), tone: Tone.saffron)),
            const SizedBox(height: 8),
            TextField(controller: text, minLines: 1, maxLines: 3, decoration: InputDecoration(labelText: tr(context, 'Your comment', 'আপনার মন্তব্য'))),
            const SizedBox(height: 8),
            BigButton(tr(context, 'Send comment', 'মন্তব্য পাঠান'), onPressed: () => _send(_t(v['_id']))),
          ])),
        ]);
      }),
    );
  }
}
