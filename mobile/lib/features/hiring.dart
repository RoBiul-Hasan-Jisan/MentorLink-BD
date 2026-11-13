import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/links.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// The hiring process after "Apply", the way it happens in real life:
//   post a job -> applicants -> shortlist -> interviews -> papers (documents) -> offer -> hired, with chat all the way.
// One screen (ApplicationWorkspaceScreen) serves both sides: the applicant and whoever posted the job (a company recruiter,
// a student, an alumnus). The server decides what each side may do (backend/src/routes/hiring.js); buttons here only follow it.
// The admin sees the whole process, read-only, in AdminHiringScreen.

final workspaceProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) => getJson(ref, '/applications/$id/workspace'));
final hiringInboxProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/hiring/inbox'));
final myJobsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/jobs'));
final pipelineProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) => getJson(ref, '/jobs/$id/pipeline'));
final adminHiringOverviewProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/admin/hiring/overview'));
final adminHiringActivityProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/admin/hiring/activity'));
final adminHiringJobProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) => getJson(ref, '/admin/hiring/jobs/$id'));
final adminHiringAppProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) => getJson(ref, '/admin/hiring/applications/$id'));

final List<RouteBase> hiringRoutes = [
  GoRoute(path: '/application/:id', builder: (_, s) => ApplicationWorkspaceScreen(id: s.pathParameters['id']!)),
  GoRoute(path: '/my-jobs', builder: (_, __) => const MyPostedJobsScreen()),
  GoRoute(path: '/job/:id/pipeline', builder: (_, s) => JobPipelineScreen(jobId: s.pathParameters['id']!)),
  GoRoute(path: '/hiring', builder: (_, __) => const HiringInboxScreen()),
  GoRoute(path: '/admin/hiring', builder: (_, __) => const AdminHiringScreen()),
  GoRoute(path: '/admin/hiring/job/:id', builder: (_, s) => AdminHiringJobScreen(id: s.pathParameters['id']!)),
  GoRoute(path: '/admin/hiring/app/:id', builder: (_, s) => AdminHiringAppScreen(id: s.pathParameters['id']!)),
];

// ---------------------------------------------------------------- small helpers ----
const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
String fmtWhen(dynamic iso) {
  final d = DateTime.tryParse('${iso ?? ''}')?.toLocal();
  if (d == null) return '';
  final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
  final m = d.minute.toString().padLeft(2, '0');
  return '${d.day} ${_months[d.month - 1]}, $h:$m ${d.hour >= 12 ? 'PM' : 'AM'}';
}

String fmtDay(dynamic iso) {
  final d = DateTime.tryParse('${iso ?? ''}')?.toLocal();
  return d == null ? '' : '${d.day} ${_months[d.month - 1]} ${d.year}';
}

Tone stageTone(String s) {
  switch (s) {
    case 'Hired':
    case 'Offer':
    case 'Selected':
      return Tone.green;
    case 'Rejected':
    case 'Not selected':
      return Tone.red;
    case 'Withdrawn':
      return Tone.grey;
    case 'Interview':
    case 'Shortlisted':
      return Tone.saffron;
    default:
      return Tone.blue;
  }
}

String kindLabel(BuildContext c, String k) {
  switch (k) {
    case 'phone':
      return tr(c, 'Phone call', 'ফোন কল');
    case 'video':
      return tr(c, 'Video call', 'ভিডিও কল');
    case 'onsite':
      return tr(c, 'On site', 'সরাসরি অফিসে');
    case 'written_test':
      return tr(c, 'Written test', 'লিখিত পরীক্ষা');
    case 'assignment':
      return tr(c, 'Assignment', 'অ্যাসাইনমেন্ট');
  }
  return k;
}

String statusLabel(BuildContext c, String s) {
  switch (s) {
    case 'scheduled':
      return tr(c, 'Waiting for confirmation', 'নিশ্চিতকরণের অপেক্ষায়');
    case 'confirmed':
      return tr(c, 'Confirmed', 'নিশ্চিত');
    case 'reschedule_requested':
      return tr(c, 'Asked to move', 'সময় বদলের অনুরোধ');
    case 'declined':
      return tr(c, 'Declined', 'অসম্মতি');
    case 'completed':
      return tr(c, 'Done', 'সম্পন্ন');
    case 'cancelled':
      return tr(c, 'Cancelled', 'বাতিল');
    case 'no_show':
      return tr(c, 'No-show', 'অনুপস্থিত');
    case 'requested':
      return tr(c, 'Please send', 'পাঠান');
    case 'submitted':
      return tr(c, 'Sent', 'পাঠানো হয়েছে');
    case 'accepted':
      return tr(c, 'Accepted', 'গৃহীত');
    case 'needs_fix':
      return tr(c, 'Needs a fix', 'সংশোধন দরকার');
    case 'sent':
      return tr(c, 'Waiting for answer', 'উত্তরের অপেক্ষায়');
    case 'withdrawn':
      return tr(c, 'Withdrawn', 'প্রত্যাহার');
    case 'expired':
      return tr(c, 'Expired', 'মেয়াদ শেষ');
  }
  return s;
}

Tone statusTone(String s) {
  switch (s) {
    case 'confirmed':
    case 'completed':
    case 'accepted':
      return Tone.green;
    case 'declined':
    case 'cancelled':
    case 'no_show':
    case 'needs_fix':
    case 'expired':
    case 'withdrawn':
      return Tone.red;
    case 'reschedule_requested':
    case 'scheduled':
    case 'requested':
    case 'sent':
      return Tone.saffron;
    default:
      return Tone.blue;
  }
}

Future<DateTime?> pickDateTime(BuildContext context, {DateTime? initial}) async {
  final now = DateTime.now();
  final start = initial ?? now.add(const Duration(days: 2));
  final day = await showDatePicker(context: context, initialDate: start, firstDate: now, lastDate: now.add(const Duration(days: 180)));
  if (day == null || !context.mounted) return null;
  final t = await showTimePicker(context: context, initialTime: TimeOfDay(hour: start.hour, minute: 0));
  if (t == null) return null;
  return DateTime(day.year, day.month, day.day, t.hour, t.minute);
}

String _iso(DateTime d) => d.toUtc().toIso8601String();

// A small reusable form: returns the typed values by key, or null when cancelled.
class _Field {
  const _Field(this.key, this.label, {this.lines = 1, this.hint, this.required = false});
  final String key, label; final int lines; final String? hint; final bool required;
}

Future<Map<String, String>?> _ask(BuildContext context, String title, List<_Field> fields, {String confirm = 'OK', String? intro}) {
  final ctl = {for (final f in fields) f.key: TextEditingController()};
  return showDialog<Map<String, String>>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text(title, style: display(20)),
      content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (intro != null) Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(intro, style: body(14, color: Brand.muted))),
        for (final f in fields) Padding(padding: const EdgeInsets.only(bottom: 8), child: TextField(controller: ctl[f.key], maxLines: f.lines, decoration: InputDecoration(labelText: f.label, hintText: f.hint))),
      ])),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c), child: Text(tr(context, 'Cancel', 'বাতিল'))),
        FilledButton(
          onPressed: () {
            for (final f in fields) {
              if (f.required && ctl[f.key]!.text.trim().isEmpty) return;
            }
            Navigator.pop(c, {for (final f in fields) f.key: ctl[f.key]!.text.trim()});
          },
          child: Text(confirm),
        ),
      ],
    ),
  );
}

Future<bool> _call(BuildContext context, WidgetRef ref, Future<dynamic> Function() f, {List<ProviderOrFamily> refresh = const []}) async {
  try {
    await f();
    for (final p in refresh) {
      ref.invalidate(p);
    }
    ref.invalidate(hiringInboxProvider);
    return true;
  } catch (e) {
    if (context.mounted) toast(context, errorText(e));
    return false;
  }
}

Widget _header(BuildContext context, String title, {String? sub, List<Widget> trailing = const []}) => GreenHeader(radius: 28, bottomPad: 18, child: Row(children: [
      BackCircle(dark: true, onTap: () => context.pop()),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, maxLines: 2, overflow: TextOverflow.ellipsis, style: display(22, color: Colors.white)),
        if (sub != null) Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, color: Colors.white70)),
      ])),
      ...trailing,
    ]));

Widget _section(BuildContext context, String title, List<Widget> children, {Widget? action}) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(padding: const EdgeInsets.fromLTRB(4, 8, 4, 8), child: Row(children: [Expanded(child: Text(title, style: display(19, color: Brand.ink))), if (action != null) action])),
      ...children,
    ]);

// ===================================================================== WORKSPACE ====
class ApplicationWorkspaceScreen extends ConsumerWidget {
  const ApplicationWorkspaceScreen({super.key, required this.id});
  final String id;

  void _refresh(WidgetRef ref) => ref.invalidate(workspaceProvider(id));

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final w = ref.watch(workspaceProvider(id));
    return Scaffold(body: Column(children: [
      _header(context, w.valueOrNull?['job']?['title'] ?? tr(context, 'Application', 'আবেদন'), sub: w.valueOrNull?['job']?['organization']),
      Expanded(child: AsyncBody(value: w, onRetry: () => _refresh(ref), builder: (d) => _body(context, ref, d as Map))),
    ]));
  }

  Widget _body(BuildContext context, WidgetRef ref, Map d) {
    final side = '${d['side']}';
    final poster = side == 'poster';
    final student = side == 'student';
    final app = d['application'] as Map;
    final rules = (d['rules'] ?? {}) as Map;
    final ints = (d['interviews'] as List).cast<Map>();
    final docs = (d['documents'] as List).cast<Map>();
    final offer = d['offer'] as Map?;
    final hist = (app['history'] as List).cast<Map>();
    final applicant = d['applicant'] as Map?;
    return RefreshIndicator(
      onRefresh: () async => _refresh(ref),
      child: ListView(padding: const EdgeInsets.all(16), children: [
        AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(student ? tr(context, 'Where you are', 'আপনি এখন কোথায়') : tr(context, 'Applicant', 'আবেদনকারী'), style: body(14, color: Brand.muted))),
            Pill('${app['studentSees']}', tone: stageTone('${app['studentSees']}')),
          ]),
          if (!student && applicant != null) ...[
            Text('${applicant['name'] ?? tr(context, 'Name not shared', 'নাম শেয়ার করা হয়নি')}', style: display(22, color: Brand.ink)),
            if ('${applicant['department'] ?? ''}'.isNotEmpty) Text('${applicant['department']}', style: body(15, color: Brand.muted)),
            if ('${applicant['note'] ?? ''}'.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text('“${applicant['note']}”', style: body(15))),
            if (applicant['cv'] is Map) ...[
              const SizedBox(height: 6),
              if ('${(applicant['cv'] as Map)['headline'] ?? ''}'.isNotEmpty) Text('${(applicant['cv'] as Map)['headline']}', style: body(15, w: FontWeight.w700)),
              Text('${(applicant['cv'] as Map)['summary'] ?? ''}', maxLines: 5, overflow: TextOverflow.ellipsis, style: body(14, color: Brand.muted)),
            ],
            Text(tr(context, 'Shared with you: ${(applicant['sharedFields'] as List).join(', ')}', 'আপনার সাথে শেয়ার: ${(applicant['sharedFields'] as List).join(', ')}'), style: body(13, color: Brand.muted)),
          ],
          if ('${app['statusMessage'] ?? ''}'.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text('${app['statusMessage']}', style: body(15))),
          if (d['canWrite'] == false) Padding(padding: const EdgeInsets.only(top: 8), child: Pill(tr(context, 'Read only (admin)', 'শুধু দেখা (অ্যাডমিন)'), tone: Tone.grey)),
        ])),

        if (poster) _posterActions(context, ref, d, rules),

        if (offer != null) _section(context, tr(context, 'Offer', 'অফার'), [_offerCard(context, ref, offer, student, poster)]),

        _section(context, tr(context, 'Interviews', 'ইন্টারভিউ'), [
          if (ints.isEmpty) Padding(padding: const EdgeInsets.only(left: 4, bottom: 8), child: Text(student ? tr(context, 'No interview yet. You will be told here when one is scheduled.', 'এখনও ইন্টারভিউ নেই। ঠিক হলে এখানে জানানো হবে।') : tr(context, 'No interview scheduled yet.', 'এখনও ইন্টারভিউ ঠিক হয়নি।'), style: body(15, color: Brand.muted))),
          for (final i in ints) _interviewCard(context, ref, i, student, poster),
        ]),

        _section(context, tr(context, 'Papers (documents)', 'কাগজপত্র'), [
          if (docs.isEmpty) Padding(padding: const EdgeInsets.only(left: 4, bottom: 8), child: Text(tr(context, 'No document requested.', 'কোনো কাগজ চাওয়া হয়নি।'), style: body(15, color: Brand.muted))),
          for (final x in docs) _docCard(context, ref, x, student, poster),
        ]),

        _section(context, tr(context, 'Messages', 'বার্তা'), [_Thread(id: id, messages: (d['messages'] as List).cast<Map>(), canWrite: d['canWrite'] == true && rules['canMessage'] == true, onSent: () => _refresh(ref))]),

        _section(context, tr(context, 'History', 'ইতিহাস'), [
          AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            for (final h in hist) Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(Icons.circle, size: 10, color: Brand.delta), const SizedBox(width: 10),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${h['stage']}  ·  ${fmtWhen(h['at'])}', style: body(15, w: FontWeight.w700)),
                if ('${h['message'] ?? ''}'.isNotEmpty) Text('${h['message']}', style: body(14, color: Brand.muted)),
              ])),
            ])),
          ])),
        ]),

        if (student && app['stage'] != 'Withdrawn' && app['stage'] != 'Rejected' && app['stage'] != 'Hired')
          TextButton(
            onPressed: () async {
              final ok = await _call(context, ref, () => ref.read(dioProvider).post('/applications/$id/withdraw'), refresh: [workspaceProvider(id), applicationsProvider]);
              if (ok && context.mounted) toast(context, tr(context, 'Application withdrawn', 'আবেদন প্রত্যাহার করা হয়েছে'));
            },
            child: Text(tr(context, 'Withdraw application', 'আবেদন প্রত্যাহার'), style: body(15, color: const Color(0xFF9B2C1F), w: FontWeight.w700)),
          ),
      ]),
    );
  }

  // ---- poster: what can I do now ----
  Widget _posterActions(BuildContext context, WidgetRef ref, Map d, Map rules) {
    final next = (rules['nextStages'] as List? ?? []).cast<String>();
    final dio = ref.read(dioProvider);
    return _section(context, tr(context, 'Your next step', 'আপনার পরের ধাপ'), [
      AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (next.isNotEmpty) Wrap(spacing: 8, runSpacing: 4, children: [
          for (final s in next)
            ActionChip(
              label: Text(s == 'Rejected' ? tr(context, 'Reject', 'বাতিল করুন') : tr(context, 'Move to $s', '$s-এ নিন')),
              onPressed: () async {
                String? message;
                if (s == 'Rejected') {
                  final r = await _ask(context, tr(context, 'Reject this applicant?', 'আবেদন বাতিল করবেন?'), [_Field('m', tr(context, 'Message to the applicant (kind and short)', 'আবেদনকারীর জন্য বার্তা'), lines: 2)], confirm: tr(context, 'Reject', 'বাতিল'));
                  if (r == null) return;
                  message = r['m'];
                }
                if (!context.mounted) return;
                await _call(context, ref, () => dio.patch('/applications/$id/stage', data: {'stage': s, if (message != null && message.isNotEmpty) 'message': message}), refresh: [workspaceProvider(id)]);
              },
            ),
        ]),
        const SizedBox(height: 6),
        Wrap(spacing: 8, runSpacing: 4, children: [
          if (rules['canSchedule'] == true) OutlinedButton.icon(onPressed: () => _schedule(context, ref), icon: const Icon(Icons.event_outlined, size: 18), label: Text(tr(context, 'Schedule interview', 'ইন্টারভিউ ঠিক করুন'))),
          if (rules['canRequestDocs'] == true) OutlinedButton.icon(onPressed: () => _requestDoc(context, ref), icon: const Icon(Icons.description_outlined, size: 18), label: Text(tr(context, 'Ask for a paper', 'কাগজ চান'))),
          if (rules['canOffer'] == true) FilledButton.icon(onPressed: () => _sendOffer(context, ref), icon: const Icon(Icons.local_offer_outlined, size: 18), label: Text(tr(context, 'Send offer', 'অফার পাঠান'))),
        ]),
        if (next.isEmpty && rules['canSchedule'] != true && rules['canRequestDocs'] != true && rules['canOffer'] != true) Text(tr(context, 'This application is finished.', 'এই আবেদন শেষ হয়েছে।'), style: body(15, color: Brand.muted)),
      ])),
    ]);
  }

  Future<void> _schedule(BuildContext context, WidgetRef ref) async {
    final r = await showDialog<Map<String, dynamic>>(context: context, builder: (_) => const _ScheduleDialog());
    if (r == null || !context.mounted) return;
    final ok = await _call(context, ref, () => ref.read(dioProvider).post('/applications/$id/interviews', data: r), refresh: [workspaceProvider(id)]);
    if (ok && context.mounted) toast(context, tr(context, 'Interview scheduled. The applicant was told.', 'ইন্টারভিউ ঠিক হয়েছে। আবেদনকারীকে জানানো হয়েছে।'));
  }

  Future<void> _requestDoc(BuildContext context, WidgetRef ref) async {
    final r = await showDialog<Map<String, dynamic>>(context: context, builder: (_) => const _DocRequestDialog());
    if (r == null || !context.mounted) return;
    await _call(context, ref, () => ref.read(dioProvider).post('/applications/$id/documents', data: r), refresh: [workspaceProvider(id)]);
  }

  Future<void> _sendOffer(BuildContext context, WidgetRef ref) async {
    final r = await showDialog<Map<String, dynamic>>(context: context, builder: (_) => const _OfferDialog());
    if (r == null || !context.mounted) return;
    await _call(context, ref, () => ref.read(dioProvider).post('/applications/$id/offer', data: r), refresh: [workspaceProvider(id)]);
  }

  // ---- cards ----
  Widget _interviewCard(BuildContext context, WidgetRef ref, Map i, bool student, bool poster) {
    final st = '${i['status']}';
    final dio = ref.read(dioProvider);
    final live = st == 'scheduled' || st == 'confirmed' || st == 'reschedule_requested';
    return AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Expanded(child: Text('${tr(context, 'Round', 'রাউন্ড')} ${i['round']}: ${i['title']}', style: display(18, color: Brand.ink))),
        Pill(statusLabel(context, st), tone: statusTone(st)),
      ]),
      const SizedBox(height: 4),
      Text('${fmtWhen(i['startsAt'])}  ·  ${i['durationMin']} min  ·  ${kindLabel(context, '${i['kind']}')}', style: body(15)),
      if ('${i['placeText'] ?? ''}'.isNotEmpty) Text('📍 ${i['placeText']}', style: body(14, color: Brand.muted)),
      if ('${i['notes'] ?? ''}'.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text(i['notes'], style: body(14, color: Brand.muted))),
      if (st == 'reschedule_requested') Padding(padding: const EdgeInsets.only(top: 6), child: Text(tr(context, 'Applicant suggests ${fmtWhen(i['proposedStartsAt'])}. ${i['studentNote'] ?? ''}', 'আবেদনকারীর প্রস্তাব: ${fmtWhen(i['proposedStartsAt'])}। ${i['studentNote'] ?? ''}'), style: body(14, color: const Color(0xFF7A4A00), w: FontWeight.w700))),
      if (st == 'declined' && '${i['studentNote'] ?? ''}'.isNotEmpty) Text('${i['studentNote']}', style: body(14, color: Brand.muted)),
      if (st == 'completed') Padding(padding: const EdgeInsets.only(top: 6), child: Text(
          '${i['result'] == 'passed' ? tr(context, 'Result: passed', 'ফলাফল: উত্তীর্ণ') : tr(context, 'Result: not passed', 'ফলাফল: উত্তীর্ণ নয়')}${'${i['feedback'] ?? ''}'.isNotEmpty ? '\n${i['feedback']}' : ''}', style: body(14, color: Brand.muted))),
      if ('${i['meetingLink'] ?? ''}'.isNotEmpty && live) TextButton.icon(onPressed: () => openMeetingLink(context, '${i['meetingLink']}'), icon: const Icon(Icons.videocam_outlined, size: 18), label: Text(tr(context, 'Open meeting link', 'মিটিং লিংক খুলুন'))),
      if (student && st == 'scheduled') Wrap(spacing: 8, children: [
        FilledButton(onPressed: () => _call(context, ref, () => dio.post('/interviews/${i['id']}/respond', data: {'response': 'accept'}), refresh: [workspaceProvider(id)]), child: Text(tr(context, 'Confirm', 'নিশ্চিত করুন'))),
        OutlinedButton(onPressed: () => _studentMove(context, ref, i), child: Text(tr(context, 'Ask to move', 'সময় বদলান'))),
        TextButton(onPressed: () => _studentDecline(context, ref, i), child: Text(tr(context, 'Cannot attend', 'যেতে পারব না'))),
      ]),
      if (student && st == 'confirmed') Wrap(spacing: 8, children: [
        OutlinedButton(onPressed: () => _studentMove(context, ref, i), child: Text(tr(context, 'Ask to move', 'সময় বদলান'))),
        TextButton(onPressed: () => _studentDecline(context, ref, i), child: Text(tr(context, 'Cannot attend', 'যেতে পারব না'))),
      ]),
      if (poster && (live || st == 'declined')) Wrap(spacing: 8, children: [
        OutlinedButton(onPressed: () => _posterMove(context, ref, i), child: Text(tr(context, 'Change time', 'সময় বদলান'))),
        if (st == 'scheduled' || st == 'confirmed') FilledButton(onPressed: () => _posterDone(context, ref, i), child: Text(tr(context, 'Mark as done', 'শেষ হয়েছে'))),
        if (live) TextButton(onPressed: () => _call(context, ref, () => dio.patch('/interviews/${i['id']}', data: {'action': 'cancel'}), refresh: [workspaceProvider(id)]), child: Text(tr(context, 'Cancel', 'বাতিল'), style: const TextStyle(color: Color(0xFF9B2C1F)))),
      ]),
    ]));
  }

  Future<void> _studentMove(BuildContext context, WidgetRef ref, Map i) async {
    final when = await pickDateTime(context);
    if (when == null || !context.mounted) return;
    final r = await _ask(context, tr(context, 'Why do you need another time?', 'কেন অন্য সময় দরকার?'), [_Field('n', tr(context, 'Short reason', 'সংক্ষিপ্ত কারণ'), lines: 2)], confirm: tr(context, 'Send', 'পাঠান'), intro: tr(context, 'Suggested time: ${fmtWhen(_iso(when))}', 'প্রস্তাবিত সময়: ${fmtWhen(_iso(when))}'));
    if (r == null || !context.mounted) return;
    await _call(context, ref, () => ref.read(dioProvider).post('/interviews/${i['id']}/respond', data: {'response': 'reschedule', 'proposedStartsAt': _iso(when), if (r['n']!.isNotEmpty) 'note': r['n']}), refresh: [workspaceProvider(id)]);
  }

  Future<void> _studentDecline(BuildContext context, WidgetRef ref, Map i) async {
    final r = await _ask(context, tr(context, 'Cannot attend this interview?', 'এই ইন্টারভিউতে যেতে পারবেন না?'), [_Field('n', tr(context, 'Short reason', 'সংক্ষিপ্ত কারণ'), lines: 2)], confirm: tr(context, 'Decline', 'অস্বীকার'));
    if (r == null || !context.mounted) return;
    await _call(context, ref, () => ref.read(dioProvider).post('/interviews/${i['id']}/respond', data: {'response': 'decline', if (r['n']!.isNotEmpty) 'note': r['n']}), refresh: [workspaceProvider(id)]);
  }

  Future<void> _posterMove(BuildContext context, WidgetRef ref, Map i) async {
    final when = await pickDateTime(context, initial: DateTime.tryParse('${i['proposedStartsAt'] ?? ''}')?.toLocal());
    if (when == null || !context.mounted) return;
    await _call(context, ref, () => ref.read(dioProvider).patch('/interviews/${i['id']}', data: {'action': 'reschedule', 'startsAt': _iso(when)}), refresh: [workspaceProvider(id)]);
  }

  Future<void> _posterDone(BuildContext context, WidgetRef ref, Map i) async {
    String result = 'passed';
    bool share = false;
    final fb = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => StatefulBuilder(builder: (c, set) => AlertDialog(
        title: Text(tr(context, 'How did it go?', 'কেমন হলো?'), style: display(20)),
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
          Row(children: [
            Expanded(child: ChoiceChip(label: Text(tr(context, 'Passed', 'উত্তীর্ণ')), selected: result == 'passed', onSelected: (_) => set(() => result = 'passed'))),
            const SizedBox(width: 8),
            Expanded(child: ChoiceChip(label: Text(tr(context, 'Not passed', 'উত্তীর্ণ নয়')), selected: result == 'not_passed', onSelected: (_) => set(() => result = 'not_passed'))),
          ]),
          const SizedBox(height: 8),
          TextField(controller: fb, maxLines: 3, decoration: InputDecoration(labelText: tr(context, 'Feedback (private by default)', 'মন্তব্য (ডিফল্টে গোপন)'))),
          CheckboxListTile(contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.leading, value: share, onChanged: (v) => set(() => share = v == true), title: Text(tr(context, 'Share this feedback with the applicant', 'এই মন্তব্য আবেদনকারীর সাথে শেয়ার করুন'), style: body(14))),
        ])),
        actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(context, 'Cancel', 'বাতিল'))), FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(tr(context, 'Save', 'সংরক্ষণ')))],
      )),
    );
    if (ok != true || !context.mounted) return;
    await _call(context, ref, () => ref.read(dioProvider).patch('/interviews/${i['id']}', data: {'action': 'complete', 'result': result, if (fb.text.trim().isNotEmpty) 'feedback': fb.text.trim(), 'feedbackShared': share}), refresh: [workspaceProvider(id)]);
  }

  Widget _docCard(BuildContext context, WidgetRef ref, Map x, bool student, bool poster) {
    final st = '${x['status']}';
    final sub = x['submission'] as Map?;
    final dio = ref.read(dioProvider);
    return AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [Expanded(child: Text('${x['label']}', style: display(17, color: Brand.ink))), Pill(statusLabel(context, st), tone: statusTone(st))]),
      if ('${x['note'] ?? ''}'.isNotEmpty) Text('${x['note']}', style: body(14, color: Brand.muted)),
      if (x['dueAt'] != null) Text(tr(context, 'Due ${fmtDay(x['dueAt'])}', 'শেষ তারিখ ${fmtDay(x['dueAt'])}'), style: body(13, color: Brand.muted)),
      if (sub != null) Padding(padding: const EdgeInsets.only(top: 6), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if ('${sub['link'] ?? ''}'.isNotEmpty) InkWell(onTap: () => openMeetingLink(context, '${sub['link']}'), child: Text('🔗 ${sub['link']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, color: Brand.delta, w: FontWeight.w700))),
        if ('${sub['text'] ?? ''}'.isNotEmpty) Text('${sub['text']}', style: body(14)),
      ])),
      if ('${x['reviewNote'] ?? ''}'.isNotEmpty) Text(tr(context, 'Reviewer: ${x['reviewNote']}', 'পর্যালোচক: ${x['reviewNote']}'), style: body(14, color: const Color(0xFF9B2C1F))),
      if (student && (st == 'requested' || st == 'needs_fix')) Align(alignment: Alignment.centerLeft, child: FilledButton(onPressed: () async {
        final r = await _ask(context, '${x['label']}', [_Field('link', tr(context, 'Share link (https://…)', 'শেয়ার লিংক (https://…)'), hint: 'Google Drive, GitHub…'), _Field('text', tr(context, 'Or a short text', 'অথবা সংক্ষিপ্ত লেখা'), lines: 3)], confirm: tr(context, 'Send', 'পাঠান'), intro: tr(context, 'Never send money. Send only what this job needs.', 'কখনও টাকা পাঠাবেন না। শুধু প্রয়োজনীয় কাগজ পাঠান।'));
        if (r == null || !context.mounted) return;
        await _call(context, ref, () => dio.post('/documents/${x['id']}/submit', data: {if (r['link']!.isNotEmpty) 'link': r['link'], if (r['text']!.isNotEmpty) 'text': r['text']}), refresh: [workspaceProvider(id)]);
      }, child: Text(tr(context, 'Send this paper', 'কাগজ পাঠান')))),
      if (poster && st == 'submitted') Wrap(spacing: 8, children: [
        FilledButton(onPressed: () => _call(context, ref, () => dio.post('/documents/${x['id']}/review', data: {'decision': 'accepted'}), refresh: [workspaceProvider(id)]), child: Text(tr(context, 'Accept', 'গ্রহণ'))),
        OutlinedButton(onPressed: () async {
          final r = await _ask(context, tr(context, 'What needs a fix?', 'কী সংশোধন করতে হবে?'), [_Field('n', tr(context, 'Tell the applicant', 'আবেদনকারীকে জানান'), lines: 2, required: true)], confirm: tr(context, 'Send', 'পাঠান'));
          if (r == null || !context.mounted) return;
          await _call(context, ref, () => dio.post('/documents/${x['id']}/review', data: {'decision': 'needs_fix', 'note': r['n']}), refresh: [workspaceProvider(id)]);
        }, child: Text(tr(context, 'Needs a fix', 'সংশোধন দরকার'))),
      ]),
    ]));
  }

  Widget _offerCard(BuildContext context, WidgetRef ref, Map o, bool student, bool poster) {
    final st = '${o['status']}';
    final dio = ref.read(dioProvider);
    return AppCard(border: st == 'sent' ? Brand.delta : null, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [Expanded(child: Text('${o['positionTitle']}', style: display(19, color: Brand.ink))), Pill(statusLabel(context, st), tone: statusTone(st))]),
      if ('${o['salaryText'] ?? ''}'.isNotEmpty) Text('💰 ${o['salaryText']}', style: body(15)),
      if (o['startDate'] != null) Text(tr(context, 'Start: ${fmtDay(o['startDate'])}', 'শুরু: ${fmtDay(o['startDate'])}'), style: body(15)),
      if ('${o['workPlaceText'] ?? ''}'.isNotEmpty) Text('📍 ${o['workPlaceText']}', style: body(14, color: Brand.muted)),
      if ('${o['terms'] ?? ''}'.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 4), child: Text('${o['terms']}', style: body(14, color: Brand.muted))),
      if (o['expiresAt'] != null && st == 'sent') Text(tr(context, 'Please answer by ${fmtDay(o['expiresAt'])}', 'উত্তর দিন ${fmtDay(o['expiresAt'])}-এর মধ্যে'), style: body(14, color: const Color(0xFF7A4A00), w: FontWeight.w700)),
      if ('${o['declineReason'] ?? ''}'.isNotEmpty) Text('${o['declineReason']}', style: body(14, color: Brand.muted)),
      if (student && st == 'sent') Wrap(spacing: 8, children: [
        FilledButton(onPressed: () async {
          final ok = await _call(context, ref, () => dio.post('/offers/${o['id']}/respond', data: {'decision': 'accept'}), refresh: [workspaceProvider(id), applicationsProvider]);
          if (ok && context.mounted) toast(context, tr(context, 'Congratulations! You accepted the offer.', 'অভিনন্দন! আপনি অফার গ্রহণ করেছেন।'));
        }, child: Text(tr(context, 'Accept offer', 'অফার গ্রহণ'))),
        OutlinedButton(onPressed: () async {
          final r = await _ask(context, tr(context, 'Decline this offer?', 'অফার ফিরিয়ে দেবেন?'), [_Field('n', tr(context, 'Reason (optional)', 'কারণ (ঐচ্ছিক)'), lines: 2)], confirm: tr(context, 'Decline', 'ফিরিয়ে দিন'));
          if (r == null || !context.mounted) return;
          await _call(context, ref, () => dio.post('/offers/${o['id']}/respond', data: {'decision': 'decline', if (r['n']!.isNotEmpty) 'reason': r['n']}), refresh: [workspaceProvider(id), applicationsProvider]);
        }, child: Text(tr(context, 'Decline', 'ফিরিয়ে দিন'))),
      ]),
      if (poster && st == 'sent') TextButton(onPressed: () => _call(context, ref, () => dio.post('/offers/${o['id']}/withdraw'), refresh: [workspaceProvider(id)]), child: Text(tr(context, 'Withdraw offer', 'অফার প্রত্যাহার'), style: const TextStyle(color: Color(0xFF9B2C1F)))),
    ]));
  }
}

// ---- chat thread (both sides) ----
class _Thread extends ConsumerStatefulWidget {
  const _Thread({required this.id, required this.messages, required this.canWrite, required this.onSent});
  final String id; final List<Map> messages; final bool canWrite; final VoidCallback onSent;
  @override
  ConsumerState<_Thread> createState() => _ThreadState();
}

class _ThreadState extends ConsumerState<_Thread> {
  final _text = TextEditingController();
  bool sending = false;
  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final t = _text.text.trim();
    if (t.isEmpty || sending) return;
    setState(() => sending = true);
    try {
      await ref.read(dioProvider).post('/applications/${widget.id}/messages', data: {'body': t});
      _text.clear();
      widget.onSent();
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
    if (mounted) setState(() => sending = false);
  }

  @override
  Widget build(BuildContext context) {
    return AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (widget.messages.isEmpty) Text(tr(context, 'No messages yet. Say hello.', 'এখনও বার্তা নেই। শুরু করুন।'), style: body(15, color: Brand.muted)),
      for (final m in widget.messages) Align(
        alignment: m['mine'] == true ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 4),
          constraints: const BoxConstraints(maxWidth: 300),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: m['mine'] == true ? Brand.lightGreen : const Color(0xFFF1F1F4), borderRadius: BorderRadius.circular(16)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${m['body']}', style: body(15)),
            if ((m['flags'] as List? ?? []).isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(tr(context, '⚠ This message mentions money or contact outside MentorLink. Never pay to get a job. Report it if unsure.', '⚠ এই বার্তায় টাকা বা অ্যাপের বাইরে যোগাযোগের কথা আছে। চাকরির জন্য কখনও টাকা দেবেন না। সন্দেহ হলে রিপোর্ট করুন।'), style: body(12, color: const Color(0xFF9B2C1F), w: FontWeight.w700))),
            Text(fmtWhen(m['at']), style: body(11, color: Brand.muted)),
          ]),
        ),
      ),
      if (widget.canWrite) Row(children: [
        Expanded(child: TextField(controller: _text, maxLength: 1000, minLines: 1, maxLines: 4, decoration: InputDecoration(counterText: '', hintText: tr(context, 'Write a message', 'বার্তা লিখুন')))),
        const SizedBox(width: 8),
        IconButton.filled(onPressed: sending ? null : _send, icon: const Icon(Icons.send)),
      ])
      else Padding(padding: const EdgeInsets.only(top: 6), child: Text(tr(context, 'The conversation is closed or read-only.', 'কথোপকথন বন্ধ বা শুধু দেখার জন্য।'), style: body(13, color: Brand.muted))),
    ]));
  }
}

// ---- dialogs ----
class _ScheduleDialog extends StatefulWidget {
  const _ScheduleDialog();
  @override
  State<_ScheduleDialog> createState() => _ScheduleDialogState();
}

class _ScheduleDialogState extends State<_ScheduleDialog> {
  final title = TextEditingController(text: 'Interview');
  final link = TextEditingController(), place = TextEditingController(), notes = TextEditingController();
  String kind = 'video';
  int minutes = 30;
  DateTime? when;
  String? err;
  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(tr(context, 'Schedule interview', 'ইন্টারভিউ ঠিক করুন'), style: display(20)),
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          TextField(controller: title, decoration: InputDecoration(labelText: tr(context, 'Round name', 'রাউন্ডের নাম'), hintText: 'HR screening, Technical round…')),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            value: kind,
            decoration: InputDecoration(labelText: tr(context, 'Type', 'ধরন')),
            items: [for (final k in ['phone', 'video', 'onsite', 'written_test', 'assignment']) DropdownMenuItem(value: k, child: Text(kindLabel(context, k)))],
            onChanged: (v) => setState(() => kind = v ?? 'video'),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () async {
              final d = await pickDateTime(context, initial: when);
              if (d != null) setState(() => when = d);
            },
            icon: const Icon(Icons.schedule),
            label: Text(when == null ? tr(context, 'Pick date and time', 'তারিখ ও সময় বাছুন') : fmtWhen(_iso(when!))),
          ),
          const SizedBox(height: 8),
          Wrap(spacing: 8, children: [for (final m in [15, 30, 45, 60]) ChoiceChip(label: Text('$m min'), selected: minutes == m, onSelected: (_) => setState(() => minutes = m))]),
          if (kind == 'video') TextField(controller: link, decoration: const InputDecoration(labelText: 'Meeting link (https://…)')),
          if (kind == 'onsite') TextField(controller: place, decoration: InputDecoration(labelText: tr(context, 'Office or room', 'অফিস বা রুম'))),
          TextField(controller: notes, maxLines: 2, decoration: InputDecoration(labelText: tr(context, 'What to prepare or bring', 'কী প্রস্তুত করবেন বা আনবেন'))),
          if (err != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(err!, style: body(14, color: const Color(0xFF9B2C1F)))),
        ])),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: Text(tr(context, 'Cancel', 'বাতিল'))),
          FilledButton(
            onPressed: () {
              if (title.text.trim().length < 2 || when == null) {
                setState(() => err = tr(context, 'Add a name and a time.', 'নাম ও সময় দিন।'));
                return;
              }
              Navigator.pop(context, <String, dynamic>{
                'title': title.text.trim(), 'kind': kind, 'startsAt': _iso(when!), 'durationMin': minutes,
                if (kind == 'video' && link.text.trim().isNotEmpty) 'meetingLink': link.text.trim(),
                if (kind == 'onsite' && place.text.trim().isNotEmpty) 'placeText': place.text.trim(),
                if (notes.text.trim().isNotEmpty) 'notes': notes.text.trim(),
              });
            },
            child: Text(tr(context, 'Schedule', 'ঠিক করুন')),
          ),
        ],
      );
}

class _DocRequestDialog extends StatefulWidget {
  const _DocRequestDialog();
  @override
  State<_DocRequestDialog> createState() => _DocRequestDialogState();
}

class _DocRequestDialogState extends State<_DocRequestDialog> {
  static const types = ['transcript', 'certificate', 'national_id', 'reference_letter', 'portfolio', 'cover_letter', 'work_sample', 'cv_update', 'other'];
  final note = TextEditingController(), label = TextEditingController();
  String type = 'transcript';
  DateTime? due;
  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(tr(context, 'Ask for a paper', 'কাগজ চান'), style: display(20)),
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
          DropdownButtonFormField<String>(
            value: type,
            isExpanded: true,
            decoration: InputDecoration(labelText: tr(context, 'Which paper', 'কোন কাগজ')),
            items: [for (final t in types) DropdownMenuItem(value: t, child: Text(t.replaceAll('_', ' ')))],
            onChanged: (v) => setState(() => type = v ?? 'transcript'),
          ),
          const SizedBox(height: 8),
          if (type == 'other') TextField(controller: label, decoration: InputDecoration(labelText: tr(context, 'Name of the paper', 'কাগজের নাম'))),
          TextField(controller: note, maxLines: 2, decoration: InputDecoration(labelText: tr(context, 'Note (optional)', 'নোট (ঐচ্ছিক)'))),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () async {
              final d = await showDatePicker(context: context, initialDate: DateTime.now().add(const Duration(days: 3)), firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 120)));
              if (d != null) setState(() => due = d);
            },
            icon: const Icon(Icons.event),
            label: Text(due == null ? tr(context, 'Due date (optional)', 'শেষ তারিখ (ঐচ্ছিক)') : fmtDay(due!.toUtc().toIso8601String())),
          ),
          Padding(padding: const EdgeInsets.only(top: 8), child: Text(tr(context, 'Never ask for money.', 'কখনও টাকা চাইবেন না।'), style: body(13, color: Brand.muted))),
        ])),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: Text(tr(context, 'Cancel', 'বাতিল'))),
          FilledButton(
            onPressed: () => Navigator.pop(context, <String, dynamic>{
              'docType': type,
              if (type == 'other' && label.text.trim().length >= 2) 'label': label.text.trim(),
              if (note.text.trim().isNotEmpty) 'note': note.text.trim(),
              if (due != null) 'dueAt': DateTime(due!.year, due!.month, due!.day, 23, 59).toUtc().toIso8601String(),
            }),
            child: Text(tr(context, 'Send request', 'অনুরোধ পাঠান')),
          ),
        ],
      );
}

class _OfferDialog extends StatefulWidget {
  const _OfferDialog();
  @override
  State<_OfferDialog> createState() => _OfferDialogState();
}

class _OfferDialogState extends State<_OfferDialog> {
  final salary = TextEditingController(), terms = TextEditingController(), place = TextEditingController();
  DateTime? start, until;
  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(tr(context, 'Send an offer', 'অফার পাঠান'), style: display(20)),
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: salary, decoration: InputDecoration(labelText: tr(context, 'Pay (text)', 'বেতন (লেখা)'), hintText: 'BDT 25,000 per month')),
          TextField(controller: place, decoration: InputDecoration(labelText: tr(context, 'Work place', 'কাজের জায়গা'))),
          TextField(controller: terms, maxLines: 3, decoration: InputDecoration(labelText: tr(context, 'Terms', 'শর্ত'))),
          const SizedBox(height: 8),
          OutlinedButton(onPressed: () async {
            final d = await showDatePicker(context: context, initialDate: DateTime.now().add(const Duration(days: 14)), firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)));
            if (d != null) setState(() => start = d);
          }, child: Text(start == null ? tr(context, 'Start date', 'শুরুর তারিখ') : fmtDay(start!.toUtc().toIso8601String()))),
          OutlinedButton(onPressed: () async {
            final d = await showDatePicker(context: context, initialDate: DateTime.now().add(const Duration(days: 5)), firstDate: DateTime.now().add(const Duration(days: 1)), lastDate: DateTime.now().add(const Duration(days: 60)));
            if (d != null) setState(() => until = d);
          }, child: Text(until == null ? tr(context, 'Answer by (date)', 'উত্তরের শেষ তারিখ') : fmtDay(until!.toUtc().toIso8601String()))),
        ])),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: Text(tr(context, 'Cancel', 'বাতিল'))),
          FilledButton(
            onPressed: () => Navigator.pop(context, <String, dynamic>{
              if (salary.text.trim().isNotEmpty) 'salaryText': salary.text.trim(),
              if (place.text.trim().isNotEmpty) 'workPlaceText': place.text.trim(),
              if (terms.text.trim().isNotEmpty) 'terms': terms.text.trim(),
              if (start != null) 'startDate': DateTime(start!.year, start!.month, start!.day, 9).toUtc().toIso8601String(),
              if (until != null) 'expiresAt': DateTime(until!.year, until!.month, until!.day, 23, 59).toUtc().toIso8601String(),
            }),
            child: Text(tr(context, 'Send offer', 'অফার পাঠান')),
          ),
        ],
      );
}

// ============================================================= MY POSTED JOBS + PIPELINE ====
class MyPostedJobsScreen extends ConsumerWidget {
  const MyPostedJobsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(body: Column(children: [
        _header(context, tr(context, 'My posted jobs', 'আমার পোস্ট করা চাকরি'), sub: tr(context, 'Applicants, interviews and offers', 'আবেদনকারী, ইন্টারভিউ ও অফার')),
        Expanded(child: AsyncBody(value: ref.watch(myJobsProvider), onRetry: () => ref.invalidate(myJobsProvider), builder: (d) {
          final jobs = ((d as Map)['jobs'] as List).cast<Map>();
          return RefreshIndicator(onRefresh: () async => ref.invalidate(myJobsProvider), child: ListView(padding: const EdgeInsets.all(16), children: [
            if (jobs.isEmpty) AppCard(child: Text(tr(context, 'You have not posted anything yet.', 'আপনি এখনও কিছু পোস্ট করেননি।'), style: body(16))),
            for (final j in jobs) AppCard(onTap: () => context.push('/job/${j['id']}/pipeline'), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text('${j['title']}', style: display(18, color: Brand.ink))),
                Pill(j['closed'] == true ? tr(context, 'Closed', 'বন্ধ') : '${j['status']}', tone: j['status'] == 'approved' && j['closed'] != true ? Tone.green : Tone.saffron),
              ]),
              Text('${j['organization']}', style: body(14, color: Brand.muted)),
              const SizedBox(height: 6),
              Text(tr(context, '${j['applicants']} applicants', '${j['applicants']} জন আবেদনকারী'), style: body(15, w: FontWeight.w700)),
              Wrap(spacing: 6, runSpacing: 4, children: [for (final e in ((j['byStage'] ?? {}) as Map).entries) if (e.key != 'Withdrawn') Pill('${e.key} ${e.value}', tone: stageTone('${e.key}'))]),
              if (j['status'] == 'pending') Padding(padding: const EdgeInsets.only(top: 6), child: Text(tr(context, 'Waiting for an admin to review it.', 'অ্যাডমিনের পর্যালোচনার অপেক্ষায়।'), style: body(14, color: const Color(0xFF7A4A00)))),
            ])),
          ]));
        })),
      ]));
}

class JobPipelineScreen extends ConsumerWidget {
  const JobPipelineScreen({super.key, required this.jobId});
  final String jobId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = ref.watch(pipelineProvider(jobId));
    return Scaffold(body: Column(children: [
      _header(context, p.valueOrNull?['job']?['title'] ?? tr(context, 'Applicants', 'আবেদনকারী'), sub: p.valueOrNull?['job']?['organization']),
      Expanded(child: AsyncBody(value: p, onRetry: () => ref.invalidate(pipelineProvider(jobId)), builder: (d) {
        final list = ((d as Map)['applicants'] as List).cast<Map>();
        if (list.isEmpty) return Center(child: Text(tr(context, 'No applicants yet.', 'এখনও কোনো আবেদনকারী নেই।'), style: body(17, color: Brand.muted)));
        return RefreshIndicator(onRefresh: () async => ref.invalidate(pipelineProvider(jobId)), child: ListView(padding: const EdgeInsets.all(16), children: [
          for (final a in list) AppCard(onTap: () async { await context.push('/application/${a['id']}'); ref.invalidate(pipelineProvider(jobId)); }, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text('${a['name'] ?? tr(context, 'Name not shared', 'নাম শেয়ার করা হয়নি')}', style: display(19, color: Brand.ink))),
              Pill('${a['stage']}', tone: stageTone('${a['stage']}')),
            ]),
            if ('${a['department'] ?? ''}'.isNotEmpty) Text('${a['department']}', style: body(14, color: Brand.muted)),
            Text(tr(context, 'Applied ${fmtDay(a['appliedAt'])}', 'আবেদন ${fmtDay(a['appliedAt'])}'), style: body(13, color: Brand.muted)),
            const SizedBox(height: 6),
            Wrap(spacing: 6, runSpacing: 4, children: [
              if ((a['interviews'] as num? ?? 0) > 0) Pill('${a['interviews']} ${tr(context, 'interview(s)', 'ইন্টারভিউ')}', tone: Tone.saffron),
              if (a['nextInterview'] != null) Pill('${tr(context, 'Next', 'পরের')}: ${fmtWhen(a['nextInterview'])}', tone: Tone.blue),
              if (((a['documents'] as Map)['toReview'] as num? ?? 0) > 0) Pill('${(a['documents'] as Map)['toReview']} ${tr(context, 'paper(s) to review', 'কাগজ দেখার বাকি')}', tone: Tone.red),
              if (a['offer'] != null) Pill('${tr(context, 'Offer', 'অফার')}: ${statusLabel(context, '${a['offer']}')}', tone: statusTone('${a['offer']}')),
              if ((a['unread'] as num? ?? 0) > 0) Pill('${a['unread']} ${tr(context, 'new message(s)', 'নতুন বার্তা')}', tone: Tone.red),
            ]),
          ])),
        ]));
      })),
    ]));
  }
}

// ================================================================== INBOX ====
// "What needs my attention", for either side. Shown on the student home and the recruiter home, and as its own screen.
class HiringInboxCard extends ConsumerWidget {
  const HiringInboxCard({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final d = ref.watch(hiringInboxProvider).valueOrNull;
    if (d == null) return const SizedBox.shrink();
    final a = d['applicant'] as Map?;
    final p = d['poster'] as Map?;
    final na = (a?['total'] as num?)?.toInt() ?? 0;
    final np = (p?['total'] as num?)?.toInt() ?? 0;
    if (na + np == 0 && a == null && p == null) return const SizedBox.shrink();
    return AppCard(onTap: () => context.push('/hiring'), padding: const EdgeInsets.all(16), border: na + np > 0 ? Brand.delta : null, child: Row(children: [
      Icon(Icons.notifications_active_outlined, color: Brand.delta),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(na + np > 0 ? tr(context, '${na + np} things need you', '${na + np}টি কাজ আপনার অপেক্ষায়') : tr(context, 'Jobs: all caught up', 'চাকরি: সব ঠিক আছে'), style: display(17, color: Brand.ink)),
        Text([
          if (a != null && (a['interviews'] as List).isNotEmpty) tr(context, '${(a['interviews'] as List).length} interview(s)', '${(a['interviews'] as List).length}টি ইন্টারভিউ'),
          if (a != null && (a['documents'] as List).isNotEmpty) tr(context, '${(a['documents'] as List).length} paper(s) to send', '${(a['documents'] as List).length}টি কাগজ পাঠাতে হবে'),
          if (a != null && (a['offers'] as List).isNotEmpty) tr(context, '${(a['offers'] as List).length} offer(s)', '${(a['offers'] as List).length}টি অফার'),
          if (p != null && (p['newApplicants'] as num) > 0) tr(context, '${p['newApplicants']} new applicant(s)', '${p['newApplicants']} জন নতুন আবেদনকারী'),
          if (p != null && (p['documentsToReview'] as List).isNotEmpty) tr(context, '${(p['documentsToReview'] as List).length} paper(s) to review', '${(p['documentsToReview'] as List).length}টি কাগজ দেখার বাকি'),
          if (p != null && (p['rescheduleRequests'] as List).isNotEmpty) tr(context, '${(p['rescheduleRequests'] as List).length} time change request(s)', '${(p['rescheduleRequests'] as List).length}টি সময় বদলের অনুরোধ'),
          if (((a?['unreadMessages'] as num?) ?? 0) + ((p?['unreadMessages'] as num?) ?? 0) > 0) tr(context, 'new messages', 'নতুন বার্তা'),
        ].join(' · '), maxLines: 2, overflow: TextOverflow.ellipsis, style: body(14, color: Brand.muted)),
      ])),
      const Icon(Icons.chevron_right),
    ]));
  }
}

class HiringInboxScreen extends ConsumerWidget {
  const HiringInboxScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(body: Column(children: [
        _header(context, tr(context, 'Jobs: needs your attention', 'চাকরি: আপনার অপেক্ষায়')),
        Expanded(child: AsyncBody(value: ref.watch(hiringInboxProvider), onRetry: () => ref.invalidate(hiringInboxProvider), builder: (d) {
          final a = (d as Map)['applicant'] as Map?;
          final p = d['poster'] as Map?;
          Widget row(String title, String sub, String appId, {Tone tone = Tone.saffron, String? pill}) => AppCard(onTap: () => context.push('/application/$appId'), padding: const EdgeInsets.all(14), child: Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: display(16, color: Brand.ink)), Text(sub, style: body(14, color: Brand.muted))])),
                if (pill != null) Pill(pill, tone: tone),
              ]));
          final rows = <Widget>[];
          if (a != null) {
            rows.add(Padding(padding: const EdgeInsets.fromLTRB(4, 4, 4, 8), child: Text(tr(context, 'As an applicant', 'আবেদনকারী হিসেবে'), style: display(19, color: Brand.ink))));
            for (final o in (a['offers'] as List).cast<Map>()) rows.add(row('${tr(context, 'Offer', 'অফার')}: ${o['jobTitle']}', '${o['organization'] ?? ''}  ·  ${o['salaryText'] ?? ''}', '${o['applicationId']}', tone: Tone.green, pill: tr(context, 'Answer', 'উত্তর দিন')));
            for (final i in (a['interviews'] as List).cast<Map>()) rows.add(row('${i['title']} · ${i['jobTitle']}', fmtWhen(i['startsAt']), '${i['applicationId']}', tone: statusTone('${i['status']}'), pill: statusLabel(context, '${i['status']}')));
            for (final x in (a['documents'] as List).cast<Map>()) rows.add(row('${x['label']}', '${x['jobTitle']}', '${x['applicationId']}', tone: statusTone('${x['status']}'), pill: statusLabel(context, '${x['status']}')));
            if (rows.length == 1) rows.add(Padding(padding: const EdgeInsets.all(8), child: Text(tr(context, 'Nothing waiting for you.', 'আপনার জন্য কিছু অপেক্ষায় নেই।'), style: body(15, color: Brand.muted))));
          }
          if (p != null) {
            rows.add(Padding(padding: const EdgeInsets.fromLTRB(4, 12, 4, 8), child: Row(children: [Expanded(child: Text(tr(context, 'As a poster', 'পোস্টদাতা হিসেবে'), style: display(19, color: Brand.ink))), TextButton(onPressed: () => context.push('/my-jobs'), child: Text(tr(context, 'My posted jobs', 'আমার পোস্ট')))])));
            rows.add(AppCard(child: Text(tr(context, '${p['newApplicants']} new applicant(s) · ${p['offersWaiting']} offer(s) waiting for an answer', '${p['newApplicants']} জন নতুন আবেদনকারী · ${p['offersWaiting']}টি অফার উত্তরের অপেক্ষায়'), style: body(15))));
            for (final i in (p['rescheduleRequests'] as List).cast<Map>()) rows.add(row('${i['title']} · ${i['jobTitle']}', tr(context, 'Applicant suggests ${fmtWhen(i['proposedStartsAt'])}', 'প্রস্তাব: ${fmtWhen(i['proposedStartsAt'])}'), '${i['applicationId']}', tone: Tone.red, pill: tr(context, 'Reply', 'উত্তর দিন')));
            for (final x in (p['documentsToReview'] as List).cast<Map>()) rows.add(row('${x['label']}', '${x['jobTitle']}', '${x['applicationId']}', tone: Tone.red, pill: tr(context, 'Review', 'দেখুন')));
            for (final i in (p['upcomingInterviews'] as List).cast<Map>()) rows.add(row('${i['title']} · ${i['jobTitle']}', fmtWhen(i['startsAt']), '${i['applicationId']}', tone: statusTone('${i['status']}'), pill: statusLabel(context, '${i['status']}')));
          }
          if (a == null && p == null) rows.add(EmptyState(icon: Icons.work_outline, title: tr(context, 'Nothing here yet', 'এখনও কিছু নেই'), subtitle: tr(context, 'Apply to a job to start.', 'শুরু করতে একটি চাকরিতে আবেদন করুন।')));
          return RefreshIndicator(onRefresh: () async => ref.invalidate(hiringInboxProvider), child: ListView(padding: const EdgeInsets.all(16), children: rows));
        })),
      ]));
}

// ===================================================================== ADMIN ====
class AdminHiringScreen extends ConsumerWidget {
  const AdminHiringScreen({super.key});
  Widget _stat(String label, Object? v, {Tone? tone}) => Expanded(child: AppCard(margin: const EdgeInsets.only(right: 8, bottom: 8), padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${v ?? 0}', style: display(24, color: Brand.ink)), Text(label, style: body(12, color: Brand.muted))])));

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(body: Column(children: [
        _header(context, tr(context, 'The whole hiring process', 'পুরো নিয়োগ প্রক্রিয়া'), sub: tr(context, 'Read only · opening a conversation is logged', 'শুধু দেখা · কথোপকথন খুললে লগ হয়')),
        Expanded(child: AsyncBody(value: ref.watch(adminHiringOverviewProvider), onRetry: () => ref.invalidate(adminHiringOverviewProvider), builder: (d) {
          final o = d as Map;
          final jobs = o['jobs'] as Map, apps = o['applications'] as Map, ints = o['interviews'] as Map, offers = o['offers'] as Map, att = o['attention'] as Map, docs = o['documents'] as Map, msgs = o['messages'] as Map;
          final src = (jobs['bySource'] ?? {}) as Map;
          final funnel = (apps['funnel'] as List).cast<Map>();
          final posters = (o['topPosters'] as List).cast<Map>();
          return RefreshIndicator(onRefresh: () async { ref.invalidate(adminHiringOverviewProvider); ref.invalidate(adminHiringActivityProvider); }, child: ListView(padding: const EdgeInsets.all(16), children: [
            Row(children: [_stat(tr(context, 'Jobs', 'চাকরি'), jobs['total']), _stat(tr(context, 'Open now', 'খোলা'), jobs['open']), _stat(tr(context, 'Posters', 'পোস্টদাতা'), jobs['posters'])]),
            Row(children: [_stat(tr(context, 'Applications', 'আবেদন'), apps['total']), _stat(tr(context, 'Interviews', 'ইন্টারভিউ'), ints['total']), _stat(tr(context, 'Offers', 'অফার'), offers['total'])]),
            AppCard(color: Brand.lightSaffron, border: Colors.transparent, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr(context, 'Needs the admin', 'অ্যাডমিনের কাজ'), style: display(17, color: Brand.ink)),
              Text(tr(context, '${att['jobsToReview']} job(s) to review · ${att['hiddenJobs']} hidden · ${att['openReports']} open report(s) · ${att['flaggedMessages']} flagged message(s)', '${att['jobsToReview']}টি পোস্ট দেখার বাকি · ${att['hiddenJobs']}টি লুকানো · ${att['openReports']}টি রিপোর্ট · ${att['flaggedMessages']}টি সন্দেহজনক বার্তা'), style: body(14, color: const Color(0xFF5A3600))),
            ])),
            _section(context, tr(context, 'Who posts jobs', 'কারা চাকরি দেয়'), [
              Wrap(spacing: 6, runSpacing: 6, children: [for (final e in src.entries) Pill('${_sourceName(context, '${e.key}')}: ${e.value}', tone: Tone.blue)]),
              const SizedBox(height: 8),
              for (final p in posters) AppCard(padding: const EdgeInsets.all(12), child: Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${p['name']}', style: display(16, color: Brand.ink)), Text('${p['role']} · ${p['organization']}', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(13, color: Brand.muted))])),
                Text('${p['jobs']} ${tr(context, 'jobs', 'পোস্ট')} · ${p['applicants']} ${tr(context, 'applied', 'আবেদন')} · ${p['hired']} ${tr(context, 'hired', 'নিয়োগ')}', style: body(12, color: Brand.muted)),
              ])),
            ]),
            _section(context, tr(context, 'From applying to hired', 'আবেদন থেকে নিয়োগ'), [
              AppCard(child: Column(children: [for (final f in funnel) Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(children: [
                SizedBox(width: 92, child: Text('${f['step']}', style: body(14, w: FontWeight.w700))),
                Expanded(child: ProgressBar(((f['percent'] as num) / 100).toDouble())),
                SizedBox(width: 74, child: Text('  ${f['count']} (${f['percent']}%)', style: body(13, color: Brand.muted))),
              ]))])),
              Wrap(spacing: 6, runSpacing: 6, children: [
                for (final e in ((ints['byStatus'] ?? {}) as Map).entries) Pill('${tr(context, 'Interview', 'ইন্টারভিউ')} ${statusLabel(context, '${e.key}')}: ${e.value}', tone: statusTone('${e.key}')),
                for (final e in ((docs['byStatus'] ?? {}) as Map).entries) Pill('${tr(context, 'Paper', 'কাগজ')} ${statusLabel(context, '${e.key}')}: ${e.value}', tone: statusTone('${e.key}')),
                for (final e in ((offers['byStatus'] ?? {}) as Map).entries) Pill('${tr(context, 'Offer', 'অফার')} ${statusLabel(context, '${e.key}')}: ${e.value}', tone: statusTone('${e.key}')),
                Pill('${tr(context, 'Messages', 'বার্তা')}: ${msgs['total']}', tone: Tone.grey),
              ]),
            ]),
            _section(context, tr(context, 'Live activity', 'সাম্প্রতিক কার্যক্রম'), [
              AsyncBody(value: ref.watch(adminHiringActivityProvider), onRetry: () => ref.invalidate(adminHiringActivityProvider), builder: (a) {
                final ev = ((a as Map)['events'] as List).cast<Map>();
                return Column(children: [for (final e in ev.take(25)) AppCard(
                  padding: const EdgeInsets.all(12),
                  onTap: e['jobId'] == null ? null : () => context.push('/admin/hiring/job/${e['jobId']}'),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Icon(_icon('${e['kind']}'), size: 20, color: Brand.delta), const SizedBox(width: 10),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${e['who']} ${e['text']}', style: body(14)), Text(fmtWhen(e['at']), style: body(12, color: Brand.muted))])),
                  ]),
                )]);
              }),
            ]),
          ]));
        })),
      ]));

  static IconData _icon(String k) => switch (k) { 'job' => Icons.post_add, 'interview' => Icons.event_outlined, 'document' => Icons.description_outlined, 'offer' => Icons.local_offer_outlined, _ => Icons.swap_horiz };
  static String _sourceName(BuildContext c, String s) => switch (s) { 'student' => tr(c, 'Students', 'শিক্ষার্থী'), 'employer' => tr(c, 'Companies', 'কোম্পানি'), 'verified_alumni' => tr(c, 'Alumni', 'অ্যালামনাই'), 'admin' => 'Admin', _ => s };
}

class AdminHiringJobScreen extends ConsumerWidget {
  const AdminHiringJobScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = ref.watch(adminHiringJobProvider(id));
    return Scaffold(body: Column(children: [
      _header(context, p.valueOrNull?['job']?['title'] ?? tr(context, 'Job', 'চাকরি'), sub: p.valueOrNull?['job']?['organization']),
      Expanded(child: AsyncBody(value: p, onRetry: () => ref.invalidate(adminHiringJobProvider(id)), builder: (d) {
        final m = d as Map;
        final job = m['job'] as Map, poster = m['poster'] as Map;
        final apps = (m['applications'] as List).cast<Map>();
        final company = poster['company'] as Map?;
        final team = (poster['team'] as List).cast<Map>();
        return ListView(padding: const EdgeInsets.all(16), children: [
          AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Wrap(spacing: 6, runSpacing: 4, children: [Pill('${job['status']}', tone: job['status'] == 'approved' ? Tone.green : Tone.saffron), Pill(AdminHiringScreen._sourceName(context, '${job['sourceLabel']}'), tone: Tone.blue), if (job['closed'] == true) Pill(tr(context, 'Closed', 'বন্ধ'), tone: Tone.grey), for (final f in (job['suspiciousFlags'] as List)) Pill('⚠ $f', tone: Tone.red)]),
            const SizedBox(height: 8),
            Text('${tr(context, 'Posted by', 'পোস্টদাতা')}: ${poster['name']} (${poster['role']})', style: body(15, w: FontWeight.w700)),
            if (company != null) Text('${company['name']} · ${company['verificationStatus']}', style: body(14, color: Brand.muted)),
            if (team.length > 1) Text('${tr(context, 'Team', 'দল')}: ${team.map((t) => t['name']).join(', ')}', style: body(14, color: Brand.muted)),
            const SizedBox(height: 8),
            Text('${job['description']}', maxLines: 6, overflow: TextOverflow.ellipsis, style: body(14)),
            Text('${job['saved']} ${tr(context, 'saved', 'সংরক্ষিত')} · ${job['reportCount']} ${tr(context, 'report(s)', 'রিপোর্ট')}', style: body(13, color: Brand.muted)),
          ])),
          _section(context, '${tr(context, 'Applicants', 'আবেদনকারী')} (${apps.length})', [
            for (final a in apps) AppCard(onTap: () => context.push('/admin/hiring/app/${a['id']}'), padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [Expanded(child: Text('${a['name']}', style: display(17, color: Brand.ink))), Pill('${a['stage']}', tone: stageTone('${a['stage']}'))]),
              Text('${a['department']}  ·  ${tr(context, 'applied', 'আবেদন')} ${fmtDay(a['appliedAt'])}', style: body(13, color: Brand.muted)),
              const SizedBox(height: 4),
              Wrap(spacing: 6, runSpacing: 4, children: [
                for (final i in (a['interviews'] as List).cast<Map>()) Pill('${i['title']}: ${statusLabel(context, '${i['status']}')}', tone: statusTone('${i['status']}')),
                for (final x in (a['documents'] as List).cast<Map>()) Pill('${x['label']}: ${statusLabel(context, '${x['status']}')}', tone: statusTone('${x['status']}')),
                if (a['offer'] != null) Pill('${tr(context, 'Offer', 'অফার')}: ${statusLabel(context, '${(a['offer'] as Map)['status']}')}', tone: statusTone('${(a['offer'] as Map)['status']}')),
                if (((a['messages'] as Map)['total'] as num) > 0) Pill('${(a['messages'] as Map)['total']} ${tr(context, 'messages', 'বার্তা')}${((a['messages'] as Map)['flagged'] as num) > 0 ? ' ⚠' : ''}', tone: ((a['messages'] as Map)['flagged'] as num) > 0 ? Tone.red : Tone.grey),
              ]),
            ])),
          ]),
        ]);
      })),
    ]));
  }
}

class AdminHiringAppScreen extends ConsumerWidget {
  const AdminHiringAppScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = ref.watch(adminHiringAppProvider(id));
    return Scaffold(body: Column(children: [
      _header(context, p.valueOrNull?['applicant']?['name'] ?? tr(context, 'Application', 'আবেদন'), sub: p.valueOrNull?['job']?['title']),
      Expanded(child: AsyncBody(value: p, onRetry: () => ref.invalidate(adminHiringAppProvider(id)), builder: (d) {
        final m = d as Map;
        final tl = (m['timeline'] as List).cast<Map>();
        return ListView(padding: const EdgeInsets.all(16), children: [
          AppCard(color: Brand.lightSaffron, border: Colors.transparent, child: Text('${m['notice']}', style: body(14, color: const Color(0xFF5A3600)))),
          for (final e in tl) Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(_icon('${e['type']}'), size: 20, color: e['actor'] == 'student' ? Brand.delta : Brand.forest), const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${e['title']}', style: body(15, w: e['type'] == 'message' ? FontWeight.w500 : FontWeight.w700)),
              if ('${e['detail'] ?? ''}'.isNotEmpty) Text('${e['detail']}', style: body(14, color: Brand.muted)),
              Text('${fmtWhen(e['at'])}  ·  ${e['actor']}', style: body(12, color: Brand.muted)),
            ])),
          ])),
        ]);
      })),
    ]));
  }

  static IconData _icon(String t) => switch (t) { 'applied' => Icons.send_outlined, 'interview' => Icons.event_outlined, 'document' => Icons.description_outlined, 'offer' => Icons.local_offer_outlined, 'message' => Icons.chat_bubble_outline, _ => Icons.swap_horiz };
}
