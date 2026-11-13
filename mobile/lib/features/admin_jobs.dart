import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'package:go_router/go_router.dart';
import 'widgets.dart';

// Admin > Jobs: every job post in any status, how many people applied (by stage) and saved it, and who applied.
// Server: GET /admin/jobs and GET /admin/jobs/:id/applications. Admins see names, department, stage and date only (never CV or contact).
class AdminJobs extends ConsumerStatefulWidget {
  const AdminJobs({super.key});
  @override
  ConsumerState<AdminJobs> createState() => _AdminJobsState();
}

class _AdminJobsState extends ConsumerState<AdminJobs> {
  static const _pageSize = 30;
  final _search = TextEditingController();
  Timer? _debounce;
  String status = 'all';
  List<Map> jobs = [];
  Map totals = {};
  int total = 0, page = 0;
  bool hasMore = false, loading = false;
  Object? error;
  int _gen = 0;

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
      final r = await ref.read(dioProvider).get('/admin/jobs', queryParameters: {
        'page': next,
        'limit': _pageSize,
        if (status != 'all') 'status': status,
        if (text.isNotEmpty) 'q': text,
      });
      if (!mounted || gen != _gen) return;
      final d = r.data as Map;
      final got = (d['jobs'] as List).cast<Map>();
      setState(() {
        jobs = reset ? got : [...jobs, ...got];
        totals = (d['totals'] ?? {}) as Map;
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

  Future<void> _review(Map j, String decision) async {
    try {
      await ref.read(dioProvider).post('/admin/opportunities/${j['id']}/review', data: {'decision': decision});
      if (mounted) _load(reset: true);
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  Future<void> _applicants(Map j) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (c) => _ApplicantsSheet(jobId: '${j['id']}'),
    );
  }

  Tone _tone(String s) => switch (s) { 'approved' => Tone.green, 'pending' => Tone.saffron, 'hidden' => Tone.red, _ => Tone.grey };

  Widget _stat(String label, Object? value) => Expanded(
        child: AppCard(
          margin: const EdgeInsets.only(right: 8),
          padding: const EdgeInsets.all(12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${value ?? 0}', style: display(24, color: Brand.ink)),
            Text(label, style: body(13, color: Brand.muted)),
          ]),
        ),
      );

  Widget _chip(String value, String label) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: InkWell(
          borderRadius: BorderRadius.circular(30),
          onTap: () {
            setState(() => status = value);
            _load(reset: true);
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(color: status == value ? Brand.delta : Colors.white, borderRadius: BorderRadius.circular(30), border: Border.all(color: const Color(0xFFD5DDD7))),
            child: Text(label, style: display(14, color: status == value ? Colors.white : Brand.ink, w: FontWeight.w700)),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final by = (totals['byStatus'] ?? {}) as Map;
    final statuses = {
      'all': tr(context, 'All', 'সব'),
      'pending': tr(context, 'Pending', 'অপেক্ষমাণ'),
      'approved': tr(context, 'Approved', 'অনুমোদিত'),
      'hidden': tr(context, 'Hidden', 'লুকানো'),
      'removed': tr(context, 'Removed', 'সরানো'),
    };
    return RefreshIndicator(
      onRefresh: () => _load(reset: true),
      child: ListView(padding: const EdgeInsets.all(16), children: [
        SafeArea(bottom: false, child: Text(tr(context, 'All jobs', 'সব চাকরি'), style: display(28, color: Brand.ink))),
        const SizedBox(height: 10),
        AppCard(color: Brand.lightGreen, border: Colors.transparent, onTap: () => context.push('/admin/hiring'), child: Row(children: [
          Icon(Icons.account_tree_outlined, color: Brand.forest), const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr(context, 'See the whole hiring process', 'পুরো নিয়োগ প্রক্রিয়া দেখুন'), style: display(17, color: Brand.ink)),
            Text(tr(context, 'Who posts, who applies, interviews, papers, offers, messages', 'কে পোস্ট করে, কে আবেদন করে, ইন্টারভিউ, কাগজ, অফার, বার্তা'), style: body(13, color: Brand.muted)),
          ])),
          const Icon(Icons.chevron_right),
        ])),
        Row(children: [
          _stat(tr(context, 'Jobs', 'চাকরি'), totals['jobs']),
          _stat(tr(context, 'Applications', 'আবেদন'), totals['applications']),
          _stat(tr(context, 'Pending', 'অপেক্ষমাণ'), by['pending']),
        ]),
        const SizedBox(height: 4),
        TextField(
          controller: _search,
          maxLength: 80,
          textInputAction: TextInputAction.search,
          onChanged: (_) {
            _debounce?.cancel();
            _debounce = Timer(const Duration(milliseconds: 400), () => _load(reset: true));
          },
          decoration: InputDecoration(
            counterText: '',
            hintText: tr(context, 'Search title or company', 'পদ বা কোম্পানি খুঁজুন'),
            prefixIcon: const Icon(Icons.search),
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(30), borderSide: const BorderSide(color: Color(0xFFD5DDD7))),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(30), borderSide: const BorderSide(color: Color(0xFFD5DDD7))),
          ),
        ),
        const SizedBox(height: 10),
        SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [for (final e in statuses.entries) _chip(e.key, e.value)])),
        const SizedBox(height: 8),
        Text(loading && jobs.isEmpty ? '' : tr(context, '${jobs.length} of $total shown', '$total টির মধ্যে ${jobs.length}টি'), style: body(14, color: Brand.muted)),
        const SizedBox(height: 6),
        if (error != null && jobs.isEmpty)
          AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(errorText(error!), style: body(16)), TextButton(onPressed: () => _load(reset: true), child: Text(tr(context, 'Try again', 'আবার চেষ্টা করুন')))]))
        else if (loading && jobs.isEmpty)
          const Padding(padding: EdgeInsets.symmetric(vertical: 48), child: Center(child: CircularProgressIndicator()))
        else if (jobs.isEmpty)
          AppCard(child: Text(tr(context, 'No jobs match.', 'কোনো চাকরি মেলেনি।'), style: body(16)))
        else ...[
          for (final j in jobs) _card(context, j),
          if (hasMore) loading ? const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator())) : BigButton(tr(context, 'Show more', 'আরও দেখুন'), outlined: true, onPressed: () => _load()),
        ],
      ]),
    );
  }

  Widget _card(BuildContext context, Map j) {
    final apps = (j['applications'] ?? {}) as Map;
    final byStage = (apps['byStage'] ?? {}) as Map;
    final flags = ((j['suspiciousFlags'] ?? []) as List);
    final st = '${j['status']}';
    final n = (apps['total'] as num?)?.toInt() ?? 0;
    return AppCard(
      padding: const EdgeInsets.all(14),
      onTap: () => context.push('/admin/hiring/job/${j['id']}'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${j['title']}', style: display(18, color: Brand.ink)),
            Text('${j['organization']} · ${tr(context, 'by', 'পোস্টদাতা')} ${j['postedByName'] ?? ''}', style: body(14, color: Brand.muted)),
          ])),
          Pill(st, tone: _tone(st)),
        ]),
        const SizedBox(height: 10),
        Wrap(spacing: 8, runSpacing: 6, children: [
          Pill(tr(context, '$n applied', '$n জন আবেদন'), tone: n > 0 ? Tone.blue : Tone.grey),
          for (final e in byStage.entries) if (e.key != 'Applied') Pill('${e.key}: ${e.value}', tone: Tone.grey),
          Pill(tr(context, '${j['saved'] ?? 0} saved', '${j['saved'] ?? 0} সংরক্ষিত'), tone: Tone.grey),
          if ((j['reportCount'] ?? 0) != 0) Pill(tr(context, '${j['reportCount']} reports', '${j['reportCount']} রিপোর্ট'), tone: Tone.red),
          if (j['closed'] == true) Pill(tr(context, 'closed', 'বন্ধ'), tone: Tone.grey),
          for (final f in flags) Pill('$f', tone: Tone.red),
        ]),
        Row(children: [
          TextButton.icon(onPressed: () => _applicants(j), icon: const Icon(Icons.people_outline, size: 18), label: Text(tr(context, 'Who applied', 'কারা আবেদন করেছে'))),
          const Spacer(),
          if (st == 'pending') TextButton(onPressed: () => _review(j, 'approve'), child: Text(tr(context, 'Approve', 'অনুমোদন'))),
          if (st == 'hidden') TextButton(onPressed: () => _review(j, 'restore'), child: Text(tr(context, 'Restore', 'ফিরিয়ে দিন'))),
          if (st != 'removed') TextButton(onPressed: () => _review(j, 'remove'), child: Text(tr(context, 'Remove', 'মুছুন'), style: const TextStyle(color: Color(0xFF9B2C1F)))),
        ]),
      ]),
    );
  }
}

class _ApplicantsSheet extends ConsumerWidget {
  const _ApplicantsSheet({required this.jobId});
  final String jobId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SizedBox(
      height: MediaQuery.of(context).size.height * 0.7,
      child: FutureBuilder<Map>(
        future: ref.read(dioProvider).get('/admin/jobs/$jobId/applications').then((r) => r.data as Map),
        builder: (c, snap) {
          if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator());
          if (snap.hasError) return Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(errorText(snap.error!), style: body(16))));
          final d = snap.data!;
          final job = (d['job'] ?? {}) as Map;
          final list = ((d['applications'] ?? []) as List).cast<Map>();
          return ListView(padding: const EdgeInsets.all(20), children: [
            Text('${job['title']}', style: display(22, color: Brand.ink)),
            Text('${job['organization']}', style: body(15, color: Brand.muted)),
            const SizedBox(height: 6),
            Text(tr(context, '${list.length} applications. Names, department, stage and date only: CVs and contact details are not shown here.', '${list.length}টি আবেদন। শুধু নাম, বিভাগ, ধাপ ও তারিখ: সিভি ও যোগাযোগের তথ্য এখানে দেখানো হয় না।'), style: body(13, color: Brand.muted)),
            const SizedBox(height: 12),
            if (list.isEmpty) Text(tr(context, 'Nobody has applied yet.', 'এখনও কেউ আবেদন করেনি।'), style: body(16)),
            for (final a in list)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('${a['name']}', style: body(16, w: FontWeight.w700)),
                subtitle: Text('${a['department'] ?? ''}${a['appliedAt'] != null ? ' · ${'${a['appliedAt']}'.substring(0, 10)}' : ''}'),
                trailing: Pill(a['withdrawn'] == true ? tr(context, 'Withdrawn', 'প্রত্যাহার') : '${a['stage']}', tone: a['withdrawn'] == true ? Tone.grey : Tone.blue),
              ),
          ]);
        },
      ),
    );
  }
}
