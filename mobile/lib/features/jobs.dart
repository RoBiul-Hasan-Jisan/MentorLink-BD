import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// Jobs tab. Search, filters, sort and "show more" are answered by the server (GET /opportunities, rules in backend/src/services/jobsearch.js).
// The list lives in this State, not in a provider: it grows as the student taps "Show more" and a new search starts it again.
class OpportunitiesScreen extends ConsumerStatefulWidget {
  const OpportunitiesScreen({super.key});
  @override
  ConsumerState<OpportunitiesScreen> createState() => _OppState();
}

class _OppState extends ConsumerState<OpportunitiesScreen> {
  static const _pageSize = 20;
  final _search = TextEditingController();
  Timer? _debounce;
  String type = 'all';
  String sort = 'newest';
  bool remote = false, closingSoon = false, hideApplied = false, savedOnly = false, salary20k = false, fresher = false, myCity = false;
  List<Map> items = [];
  int total = 0, page = 0;
  bool hasMore = false, loading = false;
  Object? error;
  int _gen = 0; // answers that belong to an older search are ignored

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load(reset: true));
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _load({bool reset = false}) async {
    if (loading && !reset) return;
    final gen = ++_gen;
    final next = reset ? 1 : page + 1;
    final text = _search.text.trim();
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final r = await ref.read(dioProvider).get('/opportunities', queryParameters: {
        'page': next,
        'limit': _pageSize,
        'sort': sort,
        if (text.isNotEmpty) 'q': text,
        if (type != 'all') 'type': type,
        if (remote) 'mode': 'remote',
        if (closingSoon) 'closingSoon': true,
        if (hideApplied) 'hideApplied': true,
        if (savedOnly) 'savedOnly': true,
        if (salary20k) 'minSalary': 20000,
        if (fresher) 'experience': 'fresher',
        if (myCity) 'city': 'chattogram',
      });
      if (!mounted || gen != _gen) return;
      final d = r.data as Map;
      final got = (d['opportunities'] as List).cast<Map>();
      setState(() {
        items = reset ? got : [...items, ...got];
        total = (d['total'] as num).toInt();
        page = next;
        hasMore = d['hasMore'] == true;
        loading = false;
      });
    } catch (e) {
      if (!mounted || gen != _gen) return;
      setState(() {
        error = e;
        loading = false;
      });
    }
  }

  void _change(VoidCallback f) {
    setState(f);
    _load(reset: true);
  }

  void _onSearch(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () => _load(reset: true));
  }

  // Saved jobs: the heart flips at once and goes back if the server says no.
  Future<void> _toggleSave(Map o) async {
    final was = o['saved'] == true;
    setState(() => o['saved'] = !was);
    try {
      final dio = ref.read(dioProvider);
      if (was) {
        await dio.delete('/opportunities/${o['id']}/save');
      } else {
        await dio.post('/opportunities/${o['id']}/save');
      }
      if (savedOnly && was && mounted) {
        setState(() {
          items = items.where((x) => x['id'] != o['id']).toList();
          total = total > 0 ? total - 1 : 0;
        });
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => o['saved'] = was);
      toast(context, errorText(e));
    }
  }

  Widget _chip(String label, bool on, VoidCallback onTap, {IconData? icon}) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: InkWell(
          borderRadius: BorderRadius.circular(30),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
            decoration: BoxDecoration(color: on ? Brand.delta : Colors.white, borderRadius: BorderRadius.circular(30), border: Border.all(color: const Color(0xFFD5DDD7))),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              if (icon != null) ...[Icon(icon, size: 18, color: on ? Colors.white : Brand.ink), const SizedBox(width: 6)],
              Text(label, style: display(15, color: on ? Colors.white : Brand.ink, w: FontWeight.w700)),
            ]),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final types = {'all': tr(context, 'All', 'সব'), 'internship': tr(context, 'Internship', 'ইন্টার্নশিপ'), 'job': tr(context, 'Full time', 'ফুল টাইম'), 'other': tr(context, 'Freelance', 'ফ্রিল্যান্স')};
    final sorts = {'newest': tr(context, 'Newest', 'নতুন আগে'), 'deadline': tr(context, 'Closing soonest', 'শেষ তারিখ আগে'), 'fit': tr(context, 'Best fit', 'সেরা মিল')};
    final filtered = _search.text.trim().isNotEmpty || type != 'all' || remote || closingSoon || hideApplied || savedOnly || salary20k || fresher || myCity;
    return RefreshIndicator(
      onRefresh: () => _load(reset: true),
      child: ListView(padding: const EdgeInsets.fromLTRB(16, 0, 16, 24), children: [
        SafeArea(bottom: false, child: Padding(padding: const EdgeInsets.only(top: 12, bottom: 12), child: Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(tr(context, 'Opportunities', 'সুযোগ'), style: display(32, color: Brand.ink)), Text(tr(context, 'Vetted by admins · no fee, ever', 'অ্যাডমিন যাচাইকৃত · কখনও ফি নয়'), style: body(15, color: Brand.muted))])),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            InkWell(borderRadius: BorderRadius.circular(24), onTap: () => context.push('/applications'), child: Pill(tr(context, 'My applications', 'আমার আবেদন'), tone: Tone.blue)),
          ]),
        ]))),
        AppCard(color: Brand.lightSaffron, border: Colors.transparent, padding: const EdgeInsets.all(16), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Icon(Icons.shield_outlined, color: Color(0xFF7A4A00)), const SizedBox(width: 12),
          Expanded(child: Text.rich(TextSpan(children: [TextSpan(text: tr(context, 'Scam tip: ', 'স্ক্যাম টিপ: '), style: body(16, color: const Color(0xFF5A3600), w: FontWeight.w800)), TextSpan(text: tr(context, 'Real internships never ask for registration fees or money for a "security deposit". Tap Report if unsure.', 'আসল ইন্টার্নশিপে কখনও রেজিস্ট্রেশন ফি বা সিকিউরিটি ডিপোজিট চায় না। সন্দেহ হলে রিপোর্ট করুন।'), style: body(16, color: const Color(0xFF5A3600))) ]))),
        ])),
        TextField(
          controller: _search,
          onChanged: _onSearch,
          textInputAction: TextInputAction.search,
          onSubmitted: (_) => _load(reset: true),
          maxLength: 80,
          decoration: InputDecoration(
            counterText: '',
            hintText: tr(context, 'Search title, company or place', 'পদ, কোম্পানি বা জায়গা খুঁজুন'),
            prefixIcon: const Icon(Icons.search),
            suffixIcon: _search.text.isEmpty ? null : IconButton(icon: const Icon(Icons.close), onPressed: () { _search.clear(); _load(reset: true); }),
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(30), borderSide: const BorderSide(color: Color(0xFFD5DDD7))),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(30), borderSide: const BorderSide(color: Color(0xFFD5DDD7))),
          ),
        ),
        const SizedBox(height: 12),
        SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [for (final e in types.entries) _chip(e.value, type == e.key, () => _change(() => type = e.key))])),
        const SizedBox(height: 8),
        SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
          _chip(tr(context, 'Saved', 'সংরক্ষিত'), savedOnly, () => _change(() => savedOnly = !savedOnly), icon: savedOnly ? Icons.favorite : Icons.favorite_border),
          _chip(tr(context, 'Remote', 'রিমোট'), remote, () => _change(() => remote = !remote)),
          _chip(tr(context, 'Closing in 7 days', '৭ দিনের মধ্যে শেষ'), closingSoon, () => _change(() => closingSoon = !closingSoon)),
          _chip(tr(context, 'Hide applied', 'আবেদন করাগুলো লুকান'), hideApplied, () => _change(() => hideApplied = !hideApplied)),
          _chip(tr(context, 'Salary 20k+', 'বেতন ২০ হাজার+'), salary20k, () => _change(() => salary20k = !salary20k)),
          _chip(tr(context, 'Fresher', 'ফ্রেশার'), fresher, () => _change(() => fresher = !fresher)),
          _chip(tr(context, 'Chattogram', 'চট্টগ্রাম'), myCity, () => _change(() => myCity = !myCity)),
        ])),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: Text(loading && items.isEmpty ? '' : tr(context, '${items.length} of $total shown', '$total টির মধ্যে ${items.length}টি'), style: body(14, color: Brand.muted))),
          PopupMenuButton<String>(
            tooltip: tr(context, 'Sort', 'সাজান'),
            initialValue: sort,
            onSelected: (v) => _change(() => sort = v),
            itemBuilder: (_) => [for (final e in sorts.entries) PopupMenuItem(value: e.key, child: Text(e.value))],
            child: Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Row(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.sort, size: 20), const SizedBox(width: 6), Text(sorts[sort]!, style: body(15, w: FontWeight.w700))])),
          ),
        ]),
        const SizedBox(height: 4),
        if (error != null && items.isEmpty)
          AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(errorText(error!), style: body(16)), const SizedBox(height: 8), TextButton(onPressed: () => _load(reset: true), child: Text(tr(context, 'Try again', 'আবার চেষ্টা করুন')))]))
        else if (loading && items.isEmpty)
          const Padding(padding: EdgeInsets.symmetric(vertical: 48), child: Center(child: CircularProgressIndicator()))
        else if (items.isEmpty)
          AppCard(child: Text(
            savedOnly ? tr(context, 'You have not saved any job yet. Tap the heart on a job to keep it here.', 'এখনও কোনো চাকরি সংরক্ষণ করেননি। চাকরির হার্টে ট্যাপ করলে এখানে থাকবে।')
                : filtered ? tr(context, 'No jobs match these filters. Try fewer filters or other words.', 'এই ফিল্টারে কোনো সুযোগ মেলেনি। ফিল্টার কমান বা অন্য শব্দ লিখুন।')
                : tr(context, 'No approved listings yet.', 'এখনও কোনো অনুমোদিত সুযোগ নেই।'),
            style: body(16),
          ))
        else ...[
          for (int i = 0; i < items.length; i++) _card(context, items[i], i == 0 && !filtered && sort == 'newest'),
          if (hasMore)
            Padding(padding: const EdgeInsets.only(top: 4), child: loading ? const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator())) : BigButton(tr(context, 'Show more', 'আরও দেখুন'), outlined: true, onPressed: () => _load())),
        ],
      ]),
    );
  }

  Widget _card(BuildContext context, Map o, bool first) {
    final fit = o['fit'] as num?;
    final labels = o['labels'] as Map;
    final days = (o['daysLeft'] as num?)?.toInt();
    final src = labels['source'] == 'verified_alumni' ? tr(context, 'Verified alumni post', 'যাচাইকৃত অ্যালামনাই পোস্ট') : labels['source'] == 'student' ? tr(context, 'Student post (reviewed by admin)', 'শিক্ষার্থীর পোস্ট (অ্যাডমিন দেখেছেন)') : labels['source'] == 'employer' ? tr(context, 'Company post', 'কোম্পানির পোস্ট') : tr(context, 'Admin post', 'অ্যাডমিন পোস্ট');
    final saved = o['saved'] == true;
    return AppCard(border: first ? Brand.delta : null, padding: const EdgeInsets.all(18), onTap: () => context.push('/opportunity/${o['id']}'), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(o['title'], style: display(21, color: Brand.ink)), Text('${o['organization']}${o['locationText'] != null ? ' · ${o['locationText']}' : ''}', style: body(15, color: Brand.muted))])),
        if (fit != null) Padding(padding: const EdgeInsets.only(right: 4), child: Column(children: [Text('$fit%', style: display(24, color: fit >= 60 ? Brand.forest : const Color(0xFF9A5B00))), Text(tr(context, 'your fit', 'আপনার মিল'), style: body(14, color: Brand.muted))])),
        IconButton(
          tooltip: saved ? tr(context, 'Remove from saved', 'সংরক্ষণ থেকে সরান') : tr(context, 'Save this job', 'চাকরিটি সংরক্ষণ করুন'),
          visualDensity: VisualDensity.compact,
          icon: Icon(saved ? Icons.favorite : Icons.favorite_border, color: saved ? const Color(0xFF9B2C1F) : Brand.muted),
          onPressed: () => _toggleSave(o),
        ),
      ]),
      if (fit != null) ...[const SizedBox(height: 10), ProgressBar(fit / 100, color: fit >= 60 ? Brand.delta : Brand.saffron, height: 8)],
      const SizedBox(height: 12),
      Wrap(spacing: 8, runSpacing: 8, children: [
        if (o['applied'] == true) Pill(tr(context, 'You applied', 'আবেদন করেছেন'), tone: Tone.blue),
        Pill(src),
        if (labels['noFeeDeclared'] == true) Pill(tr(context, 'No fee confirmed', 'কোনো ফি নেই')),
        if (labels['listingReviewed'] == true) Pill(tr(context, 'Listing reviewed', 'তালিকা পর্যালোচিত')),
        if (days != null) Pill(days <= 0 ? tr(context, 'Closes today', 'আজ শেষ') : tr(context, '$days days left', '$days দিন বাকি'), tone: days <= 7 ? Tone.red : Tone.saffron),
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
    return AppCard(border: first ? Brand.delta : null, padding: const EdgeInsets.all(18), onTap: () => context.push('/application/${a['id']}'), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
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
      // What to do next at this stage (the server decides the advice; the tap goes to the matching screen).
      if (a['nextStep'] is Map) Padding(padding: const EdgeInsets.only(top: 10), child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => context.push((a['nextStep']['route'] ?? '/ready') as String),
        child: Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: Brand.lightSaffron, borderRadius: BorderRadius.circular(14)), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(Icons.lightbulb_outline, size: 20, color: Brand.deep), const SizedBox(width: 8),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr(context, 'What to do next', 'এরপর কী করবেন'), style: body(12, color: Brand.deep, w: FontWeight.w800)),
            Text(nm(context, a['nextStep'] as Map, 'en', 'bn'), style: body(14)),
          ])),
        ])),
      )),
      if (!withdrawn) Padding(padding: const EdgeInsets.only(top: 8), child: BigButton(tr(context, 'Interviews, papers and messages', 'ইন্টারভিউ, কাগজ ও বার্তা'), outlined: true, onPressed: () => context.push('/application/${a['id']}'))),
      if (stage == 'Interview' && !withdrawn) Padding(padding: const EdgeInsets.only(top: 8), child: BigButton(tr(context, 'Practise with a mock interview', 'মক ইন্টারভিউ অনুশীলন করুন'), outlined: true, onPressed: () => context.push('/mock-interviews'))),
      if (!withdrawn && !notSel && stage != 'Selected') TextButton(onPressed: () async { await ref.read(dioProvider).post('/applications/${a['id']}/withdraw'); ref.invalidate(applicationsProvider); }, child: Text(tr(context, 'Withdraw application', 'আবেদন প্রত্যাহার'), style: body(15, color: const Color(0xFF9B2C1F), w: FontWeight.w700))),
    ]));
  }
}
