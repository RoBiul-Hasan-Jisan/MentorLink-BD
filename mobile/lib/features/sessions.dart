import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';
import 'progress.dart';
import 'community.dart';
import 'resources.dart';
import 'privacy.dart';

// Routes for the student-side extra screens (sessions, progress, community, resources, privacy). The lead spreads this list into the router.
final List<GoRoute> studentExtraRoutes = [
  GoRoute(path: '/sessions', builder: (_, __) => const SessionsScreen()),
  GoRoute(path: '/session-notes/:id', builder: (_, s) => SessionNotesScreen(sessionId: s.pathParameters['id'] ?? '')),
  GoRoute(path: '/progress', builder: (_, __) => const ProgressScreen()),
  GoRoute(path: '/mock-interviews', builder: (_, __) => const MockInterviewsScreen()),
  GoRoute(path: '/how-matching', builder: (_, __) => const HowMatchingScreen()),
  GoRoute(path: '/pathways', builder: (_, __) => const PathwaysScreen()),
  GoRoute(path: '/qa', builder: (_, __) => const QaListScreen()),
  GoRoute(path: '/qa/:id', builder: (_, s) => QaDetailScreen(id: s.pathParameters['id'] ?? '')),
  GoRoute(path: '/resources', builder: (_, __) => const ResourcesScreen()),
  GoRoute(path: '/privacy', builder: (_, __) => const PrivacyScreen()),
  GoRoute(path: '/report-user', builder: (_, s) => ReportUserScreen(target: s.extra is Map ? Map<String, dynamic>.from(s.extra as Map) : <String, dynamic>{})),
  GoRoute(path: '/roles', builder: (_, __) => const RolesScreen()),
];

final sessExtraRequestsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/requests'));
final sessExtraSessionsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/sessions'));

const _wdEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const _wdBn = ['সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি', 'রবি'];
const _moEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const _moBn = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

DateTime? _parseDate(dynamic v) {
  if (v == null) return null;
  try { return DateTime.parse(v.toString()).toLocal(); } catch (_) { return null; }
}

String _timeText(DateTime d) {
  final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
  final m = d.minute.toString().padLeft(2, '0');
  return '$h:$m ${d.hour >= 12 ? 'PM' : 'AM'}';
}

String _dateTimeText(BuildContext c, DateTime d) =>
    '${tr(c, _wdEn[d.weekday - 1], _wdBn[d.weekday - 1])} ${d.day} ${tr(c, _moEn[d.month - 1], _moBn[d.month - 1])} · ${_timeText(d)}';

String _dateText(BuildContext c, DateTime d) =>
    '${tr(c, _wdEn[d.weekday - 1], _wdBn[d.weekday - 1])} ${d.day} ${tr(c, _moEn[d.month - 1], _moBn[d.month - 1])}';

bool _looksLikeUrl(String s) {
  final t = s.trim();
  if (t.isEmpty || t.contains(' ')) return false;
  return t.startsWith('http://') || t.startsWith('https://') || t.contains('.');
}

Future<void> _openLink(BuildContext context, String raw) async {
  var t = raw.trim();
  if (!t.startsWith('http://') && !t.startsWith('https://')) t = 'https://$t';
  bool ok = false;
  try { ok = await launchUrl(Uri.parse(t), mode: LaunchMode.externalApplication); } catch (_) { ok = false; }
  if (!ok && context.mounted) toast(context, tr(context, 'Could not open the link', 'লিংক খোলা যায়নি'));
}

class SessionsScreen extends ConsumerStatefulWidget {
  const SessionsScreen({super.key});
  @override
  ConsumerState<SessionsScreen> createState() => _SessionsScreenState();
}

class _SessionsScreenState extends ConsumerState<SessionsScreen> {
  DateTime? _picked; // selected day in the strip (null = show all)

  void _refresh() { ref.invalidate(sessExtraSessionsProvider); ref.invalidate(sessExtraRequestsProvider); }

  Future<void> _cancel(Map s) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(tr(c, 'Cancel this session?', 'সেশন বাতিল করবেন?')),
        content: Text(tr(c, 'You can cancel up to 2 hours before the session starts.', 'সেশন শুরুর ২ ঘণ্টা আগ পর্যন্ত বাতিল করা যায়।')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(c, 'Keep it', 'রেখে দিন'))),
          TextButton(onPressed: () => Navigator.pop(c, true), child: Text(tr(c, 'Cancel session', 'বাতিল করুন'))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(dioProvider).post('/sessions/${s['_id']}/cancel');
      if (mounted) toast(context, tr(context, 'Session cancelled', 'সেশন বাতিল হয়েছে'));
      _refresh();
    } catch (e) { if (mounted) toast(context, errorText(e)); }
  }

  Future<void> _cancelRequest(Map r) async {
    try {
      await ref.read(dioProvider).post('/requests/${r['_id']}/cancel');
      if (mounted) toast(context, tr(context, 'Request cancelled', 'অনুরোধ বাতিল হয়েছে'));
      _refresh();
    } catch (e) { if (mounted) toast(context, errorText(e)); }
  }

  Future<void> _noShow(Map s) async {
    try {
      await ref.read(dioProvider).post('/sessions/${s['_id']}/mentor-no-show');
      if (mounted) toast(context, tr(context, 'Reported. Thank you.', 'জানানো হয়েছে। ধন্যবাদ।'));
      _refresh();
    } catch (e) { if (mounted) toast(context, errorText(e)); }
  }

  Future<void> _rate(Map s) async {
    int stars = 0;
    final comment = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (c) => StatefulBuilder(builder: (c, setSt) => AlertDialog(
        title: Text(tr(c, 'Rate this session', 'সেশনটি রেট করুন')),
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            for (int i = 1; i <= 5; i++) IconButton(
              iconSize: 36,
              onPressed: () => setSt(() => stars = i),
              icon: Icon(i <= stars ? Icons.star : Icons.star_border, color: Brand.saffron),
            ),
          ]),
          TextField(controller: comment, maxLength: 300, maxLines: 3, decoration: InputDecoration(hintText: tr(c, 'Optional comment', 'ঐচ্ছিক মন্তব্য'))),
          const SizedBox(height: 4),
          TextButton(onPressed: () => Navigator.pop(c, 'noshow'), child: Text(tr(c, 'Mentor did not show up', 'মেন্টর আসেননি'), style: body(14, color: const Color(0xFF9B2C1F), w: FontWeight.w700))),
        ])),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, null), child: Text(tr(c, 'Close', 'বন্ধ'))),
          TextButton(onPressed: stars == 0 ? null : () => Navigator.pop(c, 'send'), child: Text(tr(c, 'Send rating', 'পাঠান'))),
        ],
      )),
    );
    final text = comment.text.trim();
    comment.dispose();
    if (result == 'noshow') { await _noShow(s); return; }
    if (result != 'send' || stars == 0) return;
    try {
      final data = <String, dynamic>{'stars': stars};
      if (text.isNotEmpty) data['comment'] = text;
      await ref.read(dioProvider).post('/sessions/${s['_id']}/rate', data: data);
      if (mounted) toast(context, tr(context, 'Thanks for rating', 'রেটিংয়ের জন্য ধন্যবাদ'));
      _refresh();
    } catch (e) { if (mounted) toast(context, errorText(e)); }
  }

  Widget _dayStrip(BuildContext context, List<Map> sessions) {
    final now = DateTime.now();
    final monday = DateTime(now.year, now.month, now.day).subtract(Duration(days: now.weekday - 1));
    final days = [for (int i = 0; i < 7; i++) monday.add(Duration(days: i))];
    bool hasSession(DateTime d) => sessions.any((s) {
          final t = _parseDate(s['startsAt']);
          return t != null && t.year == d.year && t.month == d.month && t.day == d.day && s['status'] == 'scheduled';
        });
    return Row(children: [
      for (final d in days) Expanded(child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => setState(() => _picked = (_picked != null && _picked!.day == d.day && _picked!.month == d.month) ? null : d),
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 2),
          padding: const EdgeInsets.symmetric(vertical: 8),
          constraints: const BoxConstraints(minHeight: 64),
          decoration: BoxDecoration(
            color: (_picked != null && _picked!.day == d.day && _picked!.month == d.month) ? Brand.saffron : (d.day == now.day && d.month == now.month ? Colors.white24 : Colors.white10),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(tr(context, _wdEn[d.weekday - 1], _wdBn[d.weekday - 1]), style: body(12, color: Colors.white70)),
            const SizedBox(height: 2),
            Text('${d.day}', style: display(18, color: Colors.white)),
            const SizedBox(height: 3),
            Container(width: 6, height: 6, decoration: BoxDecoration(shape: BoxShape.circle, color: hasSession(d) ? Brand.saffron : Colors.transparent)),
          ]),
        ),
      )),
    ]);
  }

  Widget _sessionCard(BuildContext context, Map s) {
    final t = _parseDate(s['startsAt']);
    final link = (s['meetingLink'] ?? '').toString();
    final started = t != null && t.isBefore(DateTime.now());
    final withName = (s['withName'] ?? '').toString();
    final title = (s['withTitle'] ?? '').toString();
    return AppCard(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Avatar(withName.isEmpty ? '?' : withName, size: 46),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(withName, style: display(18, color: Brand.ink)),
          if (title.isNotEmpty) Text(title, style: body(14, color: Brand.muted)),
          if (t != null) Text(_dateTimeText(context, t), style: body(14, color: Brand.delta, w: FontWeight.w700)),
        ])),
      ]),
      const SizedBox(height: 10),
      if (link.isNotEmpty) Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: Brand.lightGreen, borderRadius: BorderRadius.circular(14)),
        child: InkWell(
          onTap: _looksLikeUrl(link) ? () => _openLink(context, link) : null,
          child: Row(children: [
            const Icon(Icons.videocam_outlined, color: Brand.forest),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr(context, 'Meeting link (pasted by mentor)', 'মিটিং লিংক (মেন্টরের দেওয়া)'), style: body(12, color: Brand.muted)),
              Text(link, style: body(15, color: Brand.forest, w: FontWeight.w700)),
            ])),
            if (_looksLikeUrl(link)) const Icon(Icons.open_in_new, size: 18, color: Brand.forest),
          ]),
        ),
      ) else Text(tr(context, 'No meeting link yet. Your mentor will paste it in the chat.', 'এখনও মিটিং লিংক নেই। মেন্টর চ্যাটে দেবেন।'), style: body(14, color: Brand.muted)),
      const SizedBox(height: 12),
      Row(children: [
        Expanded(child: SizedBox(height: 48, child: FilledButton(
          onPressed: () => context.push('/chat/${s['requestId']}'),
          child: Text(tr(context, 'Open chat', 'চ্যাট খুলুন'), style: body(15, color: Colors.white, w: FontWeight.w700)),
        ))),
        const SizedBox(width: 10),
        Expanded(child: SizedBox(height: 48, child: OutlinedButton(
          onPressed: () => context.push('/session-notes/${s['_id']}'),
          child: Text(tr(context, 'Session notes', 'সেশন নোট'), style: body(15, color: Brand.delta, w: FontWeight.w700)),
        ))),
      ]),
      const SizedBox(height: 6),
      Row(children: [
        TextButton(onPressed: () => _cancel(s), child: Text(tr(context, 'Cancel session', 'সেশন বাতিল'), style: body(14, color: const Color(0xFF9B2C1F), w: FontWeight.w700))),
        if (started) TextButton(onPressed: () => _noShow(s), child: Text(tr(context, 'Mentor did not show up', 'মেন্টর আসেননি'), style: body(14, color: Brand.muted, w: FontWeight.w700))),
      ]),
    ]));
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final remindersOn = ref.watch(meProvider).valueOrNull?['remindersOn'];
    final sessionsAsync = ref.watch(sessExtraSessionsProvider);
    final reqAsync = ref.watch(sessExtraRequestsProvider);
    return Scaffold(
      body: AsyncBody(
        value: sessionsAsync,
        onRetry: _refresh,
        builder: (d) {
          final all = ((d['sessions'] ?? []) as List).cast<Map>();
          var confirmed = all.where((s) => s['status'] == 'scheduled').toList();
          final completed = all.where((s) => s['status'] == 'completed').toList().reversed.toList();
          if (_picked != null) {
            confirmed = confirmed.where((s) {
              final t = _parseDate(s['startsAt']);
              return t != null && t.day == _picked!.day && t.month == _picked!.month && t.year == _picked!.year;
            }).toList();
          }
          final pending = reqAsync.maybeWhen(
            data: (rd) => ((rd['requests'] ?? []) as List).cast<Map>().where((r) => r['status'] == 'pending').toList(),
            orElse: () => <Map>[],
          );
          return ListView(padding: EdgeInsets.zero, children: [
            GreenHeader(radius: 36, bottomPad: 20, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                BackCircle(dark: true, onTap: () => context.pop()),
                const Spacer(),
                if (remindersOn == true) Pill(tr(context, 'Reminders on', 'রিমাইন্ডার চালু'), tone: Tone.saffron),
              ]),
              const SizedBox(height: 12),
              Text(tr(context, 'Sessions', 'সেশন'), style: display(30, color: Colors.white)),
              Text('${tr(context, _moEn[now.month - 1], _moBn[now.month - 1])} ${now.year}', style: body(15, color: Colors.white70)),
              const SizedBox(height: 14),
              _dayStrip(context, all),
            ])),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Expanded(child: Text(tr(context, 'Confirmed', 'নিশ্চিত'), style: display(20, color: Brand.ink))),
                if (_picked != null) TextButton(onPressed: () => setState(() => _picked = null), child: Text(tr(context, 'Show all', 'সব দেখুন'))),
              ]),
              const SizedBox(height: 6),
              if (confirmed.isEmpty) AppCard(child: Text(_picked != null ? tr(context, 'No session on this day.', 'এই দিনে কোনো সেশন নেই।') : tr(context, 'No confirmed sessions yet. Send a request to a mentor to get started.', 'এখনও কোনো নিশ্চিত সেশন নেই। শুরু করতে একজন মেন্টরকে অনুরোধ পাঠান।'), style: body(15, color: Brand.muted))),
              for (final s in confirmed) _sessionCard(context, s),
              const SizedBox(height: 8),
              Text(tr(context, 'Waiting for reply', 'উত্তরের অপেক্ষায়'), style: display(20, color: Brand.ink)),
              const SizedBox(height: 6),
              if (pending.isEmpty) AppCard(child: Text(tr(context, 'No pending requests.', 'কোনো অপেক্ষমাণ অনুরোধ নেই।'), style: body(15, color: Brand.muted))),
              for (final r in pending) AppCard(padding: const EdgeInsets.all(14), child: Row(children: [
                Avatar(((r['withName'] ?? '') as String).isEmpty ? '?' : r['withName'] as String, size: 44, bg: Brand.saffron, fg: Brand.ink),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${r['withName'] ?? ''}', style: display(17, color: Brand.ink)),
                  Text('${r['goalText'] ?? ''}', maxLines: 2, overflow: TextOverflow.ellipsis, style: body(14, color: Brand.muted)),
                ])),
                TextButton(onPressed: () => _cancelRequest(r), child: Text(tr(context, 'Cancel', 'বাতিল'))),
              ])),
              const SizedBox(height: 8),
              Text(tr(context, 'Completed', 'সম্পন্ন'), style: display(20, color: Brand.ink)),
              const SizedBox(height: 6),
              if (completed.isEmpty) AppCard(child: Text(tr(context, 'Completed sessions will appear here.', 'সম্পন্ন সেশন এখানে দেখা যাবে।'), style: body(15, color: Brand.muted))),
              for (final s in completed) _completedCard(context, s),
              const SizedBox(height: 8),
              Text(
                tr(context, 'If you cannot attend, cancel 2 hours before. No-shows only change reminder order, never block you.', 'আসতে না পারলে ২ ঘণ্টা আগে বাতিল করুন। না আসলে শুধু রিমাইন্ডারের ক্রম বদলায়, আপনাকে কখনও আটকানো হয় না।'),
                textAlign: TextAlign.center, style: body(13, color: Brand.muted),
              ),
              const SizedBox(height: 20),
            ])),
          ]);
        },
      ),
    );
  }

  Widget _completedCard(BuildContext context, Map s) {
    final t = _parseDate(s['startsAt']);
    final rating = s['rating'];
    final stars = rating is Map && rating['stars'] is num ? (rating['stars'] as num).toInt() : 0;
    final name = (s['withName'] ?? '').toString();
    return AppCard(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Expanded(child: Text(tr(context, 'Session with $name', '$name-এর সাথে সেশন'), style: display(17, color: Brand.ink))),
        if (t != null) Text(_dateText(context, t), style: body(13, color: Brand.muted)),
      ]),
      const SizedBox(height: 8),
      if (stars > 0) Row(children: [
        for (int i = 1; i <= 5; i++) Icon(i <= stars ? Icons.star : Icons.star_border, color: Brand.saffron, size: 22),
        const SizedBox(width: 8),
        Text(tr(context, 'You rated this', 'আপনি রেট করেছেন'), style: body(13, color: Brand.muted)),
      ]) else Text(tr(context, 'Rate this session to help future matches', 'ভবিষ্যৎ ম্যাচে সাহায্য করতে সেশনটি রেট করুন'), style: body(14, color: Brand.muted)),
      const SizedBox(height: 10),
      Row(children: [
        if (stars == 0) Expanded(child: SizedBox(height: 48, child: FilledButton(onPressed: () => _rate(s), child: Text(tr(context, 'Rate this session', 'সেশন রেট করুন'), style: body(15, color: Colors.white, w: FontWeight.w700))))),
        if (stars == 0) const SizedBox(width: 10),
        Expanded(child: SizedBox(height: 48, child: OutlinedButton(onPressed: () => context.push('/session-notes/${s['_id']}'), child: Text(tr(context, 'Session notes', 'সেশন নোট'), style: body(15, color: Brand.delta, w: FontWeight.w700))))),
      ]),
    ]));
  }
}

class SessionNotesScreen extends ConsumerWidget {
  const SessionNotesScreen({super.key, required this.sessionId});
  final String sessionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
        body: AsyncBody(
          value: ref.watch(sessExtraSessionsProvider),
          onRetry: () => ref.invalidate(sessExtraSessionsProvider),
          builder: (d) {
            final all = ((d['sessions'] ?? []) as List).cast<Map>();
            Map? s;
            for (final x in all) { if ('${x['_id']}' == sessionId) { s = x; break; } }
            final t = s == null ? null : _parseDate(s['startsAt']);
            final notes = s == null ? '' : (s['notes'] ?? '').toString();
            final steps = s == null ? <Map>[] : ((s['nextSteps'] ?? []) as List).cast<Map>();
            return ListView(padding: EdgeInsets.zero, children: [
              GreenHeader(radius: 36, bottomPad: 28, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                BackCircle(dark: true, onTap: () => context.pop()),
                const SizedBox(height: 12),
                Text(tr(context, 'Session notes', 'সেশন নোট'), style: display(30, color: Colors.white)),
                if (s != null) Text('${t != null ? _dateText(context, t) : ''} · ${s['withName'] ?? ''}', style: body(15, color: Colors.white70)),
              ])),
              Padding(padding: const EdgeInsets.all(16), child: s == null
                  ? AppCard(child: Text(tr(context, 'Session not found.', 'সেশন পাওয়া যায়নি।'), style: body(15, color: Brand.muted)))
                  : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      Text(tr(context, 'Summary', 'সারসংক্ষেপ'), style: display(20, color: Brand.ink)),
                      const SizedBox(height: 6),
                      AppCard(child: Text(notes.isEmpty ? tr(context, 'Your mentor has not added notes yet.', 'মেন্টর এখনও নোট যোগ করেননি।') : notes, style: body(16))),
                      const SizedBox(height: 4),
                      Text(tr(context, 'Next steps', 'পরের ধাপ'), style: display(20, color: Brand.ink)),
                      const SizedBox(height: 6),
                      if (steps.isEmpty) AppCard(child: Text(tr(context, 'No next steps for this session.', 'এই সেশনের জন্য কোনো পরের ধাপ নেই।'), style: body(15, color: Brand.muted))),
                      for (final st in steps) AppCard(padding: const EdgeInsets.all(14), child: Row(children: [
                        const Icon(Icons.check_circle_outline, color: Brand.delta),
                        const SizedBox(width: 10),
                        Expanded(child: Text('${st['text'] ?? ''}', style: body(16, w: FontWeight.w600))),
                        const SizedBox(width: 8),
                        Pill(st['taskId'] != null ? tr(context, 'Added', 'যোগ হয়েছে') : tr(context, 'Not added', 'যোগ হয়নি'), tone: st['taskId'] != null ? Tone.green : Tone.grey),
                      ])),
                      const SizedBox(height: 4),
                      Text(tr(context, 'Next steps are added to your four-week plan, in the week your mentor chose.', 'পরের ধাপগুলো মেন্টরের বেছে নেওয়া সপ্তাহে আপনার চার সপ্তাহের পরিকল্পনায় যোগ হয়।'), style: body(13, color: Brand.muted)),
                      const SizedBox(height: 12),
                      BigButton(tr(context, 'View my action plan', 'আমার অ্যাকশন প্ল্যান দেখুন'), onPressed: () => context.pop()),
                      const SizedBox(height: 20),
                    ])),
            ]);
          },
        ),
      );
}
