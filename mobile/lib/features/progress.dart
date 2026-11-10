import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// My progress, mock interviews and "How matching works".

final progressScreenProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/progress'));
// Time to ready comes from /me/readiness. It answers 400 when no career goal is chosen, so a failure means "no value".
final progressReadinessProvider = FutureProvider.autoDispose<Map<String, dynamic>?>((ref) async {
  try {
    return await getJson(ref, '/me/readiness');
  } catch (_) {
    return null;
  }
});
final progressMockListProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/mock-interviews'));
final progressMockRequestsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/requests'));
final progressMatchingInfoProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/matching/info'));

const List<String> _moEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const List<String> _moBn = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];

String _dateTime(BuildContext c, dynamic raw) {
  DateTime? d;
  try {
    d = DateTime.parse('$raw').toLocal();
  } catch (_) {
    d = null;
  }
  if (d == null) return '';
  final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
  final m = d.minute.toString().padLeft(2, '0');
  return '${d.day} ${tr(c, _moEn[d.month - 1], _moBn[d.month - 1])} · $h:$m ${d.hour >= 12 ? 'PM' : 'AM'}';
}

Widget _head(BuildContext context, String title, String sub) => GreenHeader(
      radius: 36,
      bottomPad: 30,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        BackCircle(dark: true, onTap: () => context.pop()),
        const SizedBox(height: 12),
        Text(title, style: display(30, color: Colors.white)),
        const SizedBox(height: 4),
        Text(sub, style: body(15, color: Colors.white70)),
      ]),
    );

// ---------------------------------------------------------------- My progress

class ProgressScreen extends ConsumerWidget {
  const ProgressScreen({super.key});

  static IconData _badgeIcon(String id) {
    switch (id) {
      case 'first_session':
        return Icons.event_available;
      case 'quiz':
        return Icons.quiz;
      case 'streak3':
        return Icons.local_fire_department;
      case 'first_application':
        return Icons.send;
      case 'first_project':
        return Icons.folder_special;
      case 'cv_reviewed':
        return Icons.description;
      case 'mock':
        return Icons.record_voice_over;
      case 'interview_ready':
        return Icons.workspace_premium;
      default:
        return Icons.emoji_events;
    }
  }

  Widget _stat(String big, String small) => Expanded(
        child: Column(children: [
          Text(big, style: display(34, color: Colors.white)),
          const SizedBox(height: 2),
          Text(small, textAlign: TextAlign.center, style: body(13, color: Colors.white70)),
        ]),
      );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final readiness = ref.watch(progressReadinessProvider).valueOrNull;
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(progressScreenProvider),
        onRetry: () => ref.invalidate(progressScreenProvider),
        builder: (d) {
          final Map data = d as Map;
          final history = ((data['history'] ?? []) as List).cast<Map>();
          final values = history.map((h) => ((h['percent'] ?? 0) as num).toDouble()).toList();
          final badges = ((data['badges'] ?? []) as List).cast<Map>();
          final points = ((data['points'] ?? 0) as num).toInt();
          final streak = ((data['streakWeeks'] ?? 0) as num).toInt();
          final apps = ((data['applications'] ?? 0) as num).toInt();
          final current = data['readiness'];
          final Map? next = data['nextTarget'] is Map ? data['nextTarget'] as Map : null;
          final weeks = readiness == null ? null : readiness['timeToReadyWeeks'];
          final earned = ((data['badgesEarned'] ?? 0) as num).toInt();
          return ListView(padding: EdgeInsets.zero, children: [
            GreenHeader(
              radius: 36,
              bottomPad: 26,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                BackCircle(dark: true, onTap: () => context.pop()),
                const SizedBox(height: 12),
                Text(tr(context, 'My progress', 'আমার অগ্রগতি'), style: display(30, color: Colors.white)),
                const SizedBox(height: 4),
                Text(tr(context, 'Private to you · no leaderboard', 'শুধু আপনার জন্য · কোনো লিডারবোর্ড নেই'), style: body(15, color: Colors.white70)),
                const SizedBox(height: 18),
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  _stat(points >= 0 ? '+$points' : '$points', tr(context, 'readiness\npoints', 'প্রস্তুতির\nপয়েন্ট')),
                  _stat('$streak', tr(context, 'week streak', 'সপ্তাহের ধারা')),
                  _stat('$apps', tr(context, 'applications', 'আবেদন')),
                ]),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                AppCard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(child: Text(tr(context, 'Readiness trend', 'প্রস্তুতির ধারা'), style: display(19, color: Brand.ink))),
                      if (current != null) Pill('${current as num}%', tone: Tone.green),
                    ]),
                    const SizedBox(height: 10),
                    if (values.length < 2)
                      Text(
                        current == null
                            ? tr(context, 'Choose a career goal to start tracking your readiness.', 'প্রস্তুতি দেখতে একটি ক্যারিয়ার লক্ষ্য বেছে নিন।')
                            : tr(context, 'Your history starts today. Come back after a few days to see the line.', 'আপনার ইতিহাস আজ থেকে শুরু। কয়েক দিন পর এসে রেখাটি দেখুন।'),
                        style: body(15, color: Brand.muted),
                      )
                    else ...[
                      SizedBox(height: 150, width: double.infinity, child: CustomPaint(painter: _TrendPainter(values))),
                      const SizedBox(height: 6),
                      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                        Text('W1 · ${values.first.round()}%', style: body(13, color: Brand.muted)),
                        Text('${tr(context, 'Now', 'এখন')} · ${values.last.round()}%', style: body(13, color: Brand.muted, w: FontWeight.w700)),
                      ]),
                    ],
                  ]),
                ),
                if (next != null)
                  AppCard(
                    color: Brand.lightSaffron,
                    border: Colors.transparent,
                    child: Row(children: [
                      Icon(Icons.flag, color: Brand.forest),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          tr(context, 'Next target: ${next['percent']}% by completing ${next['nameEn'] ?? ''}.', 'পরের লক্ষ্য: ${next['nameBn'] ?? next['nameEn'] ?? ''} শেষ করে ${next['percent']}%।'),
                          style: body(16, w: FontWeight.w700),
                        ),
                      ),
                    ]),
                  ),
                AppCard(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(child: Text(tr(context, 'Milestone badges', 'মাইলস্টোন ব্যাজ'), style: display(19, color: Brand.ink))),
                      Pill(tr(context, '$earned of ${badges.length}', '${badges.length}টির মধ্যে $earned'), tone: Tone.saffron),
                    ]),
                    const SizedBox(height: 12),
                    GridView.count(
                      crossAxisCount: 4,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 8,
                      childAspectRatio: 0.72,
                      children: [
                        for (final b in badges)
                          Opacity(
                            opacity: b['earned'] == true ? 1 : 0.45,
                            child: Column(children: [
                              Container(
                                width: 56,
                                height: 56,
                                decoration: BoxDecoration(shape: BoxShape.circle, color: b['earned'] == true ? Brand.saffron : const Color(0xFFE9EEEA)),
                                child: Icon(b['earned'] == true ? _badgeIcon('${b['id']}') : Icons.lock_outline, color: b['earned'] == true ? Brand.ink : Brand.muted),
                              ),
                              const SizedBox(height: 6),
                              Text(nm(context, b, 'titleEn', 'titleBn'), textAlign: TextAlign.center, maxLines: 3, overflow: TextOverflow.ellipsis, style: body(12, w: FontWeight.w600)),
                            ]),
                          ),
                      ],
                    ),
                  ]),
                ),
                AppCard(
                  child: Row(children: [
                    Icon(Icons.schedule, color: Brand.delta),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(
                          weeks == null
                              ? tr(context, 'Time to ready: not available yet.', 'প্রস্তুত হতে সময়: এখনও জানা নেই।')
                              : tr(context, 'Time to ready: about $weeks weeks.', 'প্রস্তুত হতে সময়: প্রায় $weeks সপ্তাহ।'),
                          style: body(16, w: FontWeight.w700),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          tr(context, 'Calculated from remaining gap hours and your weekly study hours.', 'বাকি ঘাটতির ঘণ্টা ও আপনার সাপ্তাহিক পড়ার সময় থেকে হিসাব করা।'),
                          style: body(13, color: Brand.muted),
                        ),
                      ]),
                    ),
                  ]),
                ),
                const SizedBox(height: 4),
                BigButton(tr(context, 'Open plan', 'প্ল্যান খুলুন'), onPressed: () => context.go('/')),
                const SizedBox(height: 10),
                Text('${data['note'] ?? ''}', textAlign: TextAlign.center, style: body(13, color: Brand.muted)),
                const SizedBox(height: 20),
              ]),
            ),
          ]);
        },
      ),
    );
  }
}

class _TrendPainter extends CustomPainter {
  _TrendPainter(this.values);
  final List<double> values;
  @override
  void paint(Canvas canvas, Size size) {
    final grid = Paint()
      ..color = Brand.line
      ..strokeWidth = 1;
    for (int i = 0; i <= 4; i++) {
      final y = size.height * i / 4;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }
    if (values.length < 2) return;
    double lo = values.reduce((a, b) => a < b ? a : b);
    double hi = values.reduce((a, b) => a > b ? a : b);
    lo = (lo - 5).clamp(0, 100).toDouble();
    hi = (hi + 5).clamp(0, 100).toDouble();
    if (hi - lo < 10) hi = lo + 10;
    Offset pt(int i) => Offset(size.width * i / (values.length - 1), size.height - (values[i] - lo) / (hi - lo) * size.height);
    final path = Path()..moveTo(pt(0).dx, pt(0).dy);
    for (int i = 1; i < values.length; i++) {
      path.lineTo(pt(i).dx, pt(i).dy);
    }
    final fill = Path.from(path)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();
    canvas.drawPath(fill, Paint()..color = Brand.delta.withValues(alpha: 0.10));
    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 4
        ..strokeJoin = StrokeJoin.round
        ..strokeCap = StrokeCap.round
        ..color = Brand.delta,
    );
    canvas.drawCircle(pt(values.length - 1), 7, Paint()..color = Brand.saffron);
    canvas.drawCircle(pt(0), 5, Paint()..color = Brand.delta);
  }

  @override
  bool shouldRepaint(_TrendPainter old) => old.values != values;
}

// ---------------------------------------------------------------- Mock interviews

class MockInterviewsScreen extends ConsumerStatefulWidget {
  const MockInterviewsScreen({super.key});
  @override
  ConsumerState<MockInterviewsScreen> createState() => _MockInterviewsScreenState();
}

class _MockInterviewsScreenState extends ConsumerState<MockInterviewsScreen> {
  String? _mentorId;
  DateTime? _date;
  TimeOfDay? _time;
  bool _busy = false;

  void _refresh() {
    ref.invalidate(progressMockListProvider);
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final d = await showDatePicker(context: context, initialDate: _date ?? now.add(const Duration(days: 1)), firstDate: now, lastDate: now.add(const Duration(days: 120)));
    if (d != null) setState(() => _date = d);
  }

  Future<void> _pickTime() async {
    final t = await showTimePicker(context: context, initialTime: _time ?? const TimeOfDay(hour: 18, minute: 0));
    if (t != null) setState(() => _time = t);
  }

  Future<void> _book() async {
    if (_mentorId == null || _date == null || _time == null) {
      toast(context, tr(context, 'Choose a mentor, a date and a time.', 'মেন্টর, তারিখ ও সময় বেছে নিন।'));
      return;
    }
    final at = DateTime(_date!.year, _date!.month, _date!.day, _time!.hour, _time!.minute);
    setState(() => _busy = true);
    try {
      await ref.read(dioProvider).post('/mock-interviews', data: {'mentorId': _mentorId, 'startsAt': at.toUtc().toIso8601String()});
      if (mounted) {
        toast(context, tr(context, 'Mock interview booked', 'মক ইন্টারভিউ বুক হয়েছে'));
        setState(() {
          _date = null;
          _time = null;
        });
      }
      _refresh();
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _cancel(Map m) async {
    try {
      await ref.read(dioProvider).post('/mock-interviews/${m['_id']}/cancel');
      if (mounted) toast(context, tr(context, 'Cancelled', 'বাতিল হয়েছে'));
      _refresh();
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  Future<void> _feedback(Map m) async {
    final Map<String, int> scores = {'communication': 3, 'technical': 3, 'problemSolving': 3, 'confidence': 3};
    final note = TextEditingController();
    final labels = <String, List<String>>{
      'communication': ['Communication', 'যোগাযোগ'],
      'technical': ['Technical', 'টেকনিক্যাল'],
      'problemSolving': ['Problem solving', 'সমস্যা সমাধান'],
      'confidence': ['Confidence', 'আত্মবিশ্বাস'],
    };
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      builder: (c) => StatefulBuilder(
        builder: (c2, setSheet) => Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(c2).viewInsets.bottom + 20),
          child: SingleChildScrollView(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
              Text(tr(c2, 'Feedback for ${m['withName'] ?? ''}', '${m['withName'] ?? ''}-এর জন্য মতামত'), style: display(20, color: Brand.ink)),
              const SizedBox(height: 12),
              for (final k in scores.keys) ...[
                Text(tr(c2, labels[k]![0], labels[k]![1]), style: body(15, w: FontWeight.w700)),
                const SizedBox(height: 4),
                Wrap(spacing: 8, children: [
                  for (int v = 1; v <= 5; v++)
                    ChoiceChip(
                      label: SizedBox(width: 24, child: Center(child: Text('$v'))),
                      selected: scores[k] == v,
                      onSelected: (_) => setSheet(() => scores[k] = v),
                    ),
                ]),
                const SizedBox(height: 8),
              ],
              TextField(controller: note, maxLines: 3, maxLength: 1000, decoration: InputDecoration(hintText: tr(c2, 'Written note (optional)', 'লিখিত মন্তব্য (ঐচ্ছিক)'))),
              const SizedBox(height: 8),
              BigButton(tr(c2, 'Send feedback', 'মতামত পাঠান'), onPressed: () => Navigator.pop(c2, true)),
            ]),
          ),
        ),
      ),
    );
    if (ok != true) return;
    final Map<String, dynamic> body0 = {...scores};
    if (note.text.trim().isNotEmpty) body0['note'] = note.text.trim();
    try {
      await ref.read(dioProvider).post('/mock-interviews/${m['_id']}/feedback', data: body0);
      if (mounted) toast(context, tr(context, 'Feedback sent', 'মতামত পাঠানো হয়েছে'));
      _refresh();
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  Widget _rubricBar(String en, String bn, dynamic v) {
    final n = v is num ? v.toDouble() : 0.0;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(children: [
        SizedBox(width: 120, child: Text(tr(context, en, bn), style: body(14, color: Brand.muted))),
        Expanded(child: ProgressBar(n / 5, color: Brand.delta, height: 8)),
        const SizedBox(width: 8),
        Text('${n.round()}/5', style: body(14, w: FontWeight.w700)),
      ]),
    );
  }

  Widget _card(Map m, bool isStudent) {
    final status = '${m['status'] ?? ''}';
    final Map rub = m['rubric'] is Map ? m['rubric'] as Map : <String, dynamic>{};
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Avatar('${m['withName'] ?? '?'}', size: 44),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${m['withName'] ?? ''}', style: display(17, color: Brand.ink)),
              Text(_dateTime(context, m['startsAt']), style: body(14, color: Brand.muted)),
            ]),
          ),
          Pill(
            status == 'done' ? tr(context, 'Done', 'সম্পন্ন') : status == 'cancelled' ? tr(context, 'Cancelled', 'বাতিল') : tr(context, 'Booked', 'বুকড'),
            tone: status == 'done' ? Tone.green : status == 'cancelled' ? Tone.grey : Tone.saffron,
          ),
        ]),
        if (status == 'done') ...[
          const SizedBox(height: 10),
          _rubricBar('Communication', 'যোগাযোগ', rub['communication']),
          _rubricBar('Technical', 'টেকনিক্যাল', rub['technical']),
          _rubricBar('Problem solving', 'সমস্যা সমাধান', rub['problemSolving']),
          _rubricBar('Confidence', 'আত্মবিশ্বাস', rub['confidence']),
          const SizedBox(height: 6),
          Text(tr(context, 'Overall ${m['overall'] ?? '-'} / 5', 'সার্বিক ${m['overall'] ?? '-'} / ৫'), style: display(18, color: Brand.forest)),
          if ('${m['note'] ?? ''}'.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text('${m['note']}', style: body(15)),
          ],
        ],
        if (status == 'booked') ...[
          const SizedBox(height: 10),
          Row(children: [
            if (!isStudent)
              Expanded(child: SizedBox(height: 48, child: FilledButton(onPressed: () => _feedback(m), child: Text(tr(context, 'Give feedback', 'মতামত দিন'))))),
            if (!isStudent) const SizedBox(width: 10),
            Expanded(child: SizedBox(height: 48, child: OutlinedButton(onPressed: () => _cancel(m), child: Text(tr(context, 'Cancel', 'বাতিল করুন'))))),
          ]),
        ],
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final role = ref.watch(meProvider).valueOrNull?['role'];
    final isStudent = role != 'mentor';
    return Scaffold(
      body: ListView(padding: EdgeInsets.zero, children: [
        _head(context, tr(context, 'Mock interviews', 'মক ইন্টারভিউ'), tr(context, 'Practice with a mentor and get a rubric', 'মেন্টরের সাথে অনুশীলন করুন, রুব্রিক সহ মতামত পান')),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (isStudent) _bookForm(),
            AsyncBody(
              value: ref.watch(progressMockListProvider),
              onRetry: _refresh,
              builder: (d) {
                final list = ((d['mockInterviews'] ?? []) as List).cast<Map>();
                final upcoming = list.where((m) => m['status'] == 'booked').toList().reversed.toList();
                final past = list.where((m) => m['status'] != 'booked').toList();
                if (list.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.all(20),
                    child: Text(tr(context, 'No mock interviews yet.', 'এখনও কোনো মক ইন্টারভিউ নেই।'), textAlign: TextAlign.center, style: body(15, color: Brand.muted)),
                  );
                }
                return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  if (upcoming.isNotEmpty) ...[
                    Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(tr(context, 'Booked', 'বুক করা'), style: display(20, color: Brand.ink))),
                    for (final m in upcoming) _card(m, isStudent),
                  ],
                  if (past.isNotEmpty) ...[
                    Padding(padding: const EdgeInsets.only(bottom: 8, top: 6), child: Text(tr(context, 'Past', 'আগের'), style: display(20, color: Brand.ink))),
                    for (final m in past) _card(m, isStudent),
                  ],
                ]);
              },
            ),
          ]),
        ),
      ]),
    );
  }

  Widget _bookForm() {
    final req = ref.watch(progressMockRequestsProvider);
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(tr(context, 'Book a mock interview', 'মক ইন্টারভিউ বুক করুন'), style: display(19, color: Brand.ink)),
        const SizedBox(height: 4),
        Text(tr(context, 'Only with a mentor who accepted your request.', 'শুধু যে মেন্টর আপনার অনুরোধ গ্রহণ করেছেন তার সাথে।'), style: body(13, color: Brand.muted)),
        const SizedBox(height: 12),
        req.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Text(errorText(e)),
          data: (d) {
            final all = ((d['requests'] ?? []) as List).cast<Map>().where((r) => r['status'] == 'accepted').toList();
            final seen = <String>{};
            final mentors = <Map>[];
            for (final r in all) {
              final id = '${r['mentorId']}';
              if (seen.add(id)) mentors.add(r);
            }
            if (mentors.isEmpty) {
              return Text(tr(context, 'No accepted mentor yet. Send a request first.', 'এখনও কোনো মেন্টর গ্রহণ করেননি। আগে অনুরোধ পাঠান।'), style: body(15, color: Brand.muted));
            }
            return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              DropdownButtonFormField<String>(
                value: _mentorId,
                isExpanded: true,
                decoration: InputDecoration(hintText: tr(context, 'Choose a mentor', 'মেন্টর বেছে নিন')),
                items: [for (final m in mentors) DropdownMenuItem<String>(value: '${m['mentorId']}', child: Text('${m['withName'] ?? ''}'))],
                onChanged: (v) => setState(() => _mentorId = v),
              ),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(
                  child: SizedBox(
                    height: 48,
                    child: OutlinedButton.icon(
                      onPressed: _pickDate,
                      icon: const Icon(Icons.calendar_today, size: 18),
                      label: Text(_date == null ? tr(context, 'Date', 'তারিখ') : '${_date!.day} ${tr(context, _moEn[_date!.month - 1], _moBn[_date!.month - 1])}'),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: SizedBox(
                    height: 48,
                    child: OutlinedButton.icon(
                      onPressed: _pickTime,
                      icon: const Icon(Icons.access_time, size: 18),
                      label: Text(_time == null ? tr(context, 'Time', 'সময়') : _time!.format(context)),
                    ),
                  ),
                ),
              ]),
              const SizedBox(height: 12),
              BigButton(_busy ? tr(context, 'Booking...', 'বুক হচ্ছে...') : tr(context, 'Book', 'বুক করুন'), onPressed: _busy ? null : _book),
            ]);
          },
        ),
      ]),
    );
  }
}

// ---------------------------------------------------------------- How matching works

class HowMatchingScreen extends ConsumerWidget {
  const HowMatchingScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
        body: AsyncBody(
          value: ref.watch(progressMatchingInfoProvider),
          onRetry: () => ref.invalidate(progressMatchingInfoProvider),
          builder: (d) {
            final steps = ((d['steps'] ?? []) as List).cast<Map>();
            final factors = ((d['factors'] ?? []) as List).cast<Map>();
            final Map promises = d['promises'] is Map ? d['promises'] as Map : <String, dynamic>{};
            final Map quality = d['quality'] is Map ? d['quality'] as Map : <String, dynamic>{};
            return ListView(padding: EdgeInsets.zero, children: [
              _head(context, tr(context, 'How matching works', 'ম্যাচিং কীভাবে কাজ করে'), tr(context, 'Simple formulas, no hidden AI', 'সহজ সূত্র, কোনো লুকানো এআই নেই')),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  for (int i = 0; i < steps.length; i++)
                    AppCard(
                      padding: const EdgeInsets.all(14),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Container(width: 32, height: 32, alignment: Alignment.center, decoration: BoxDecoration(color: Brand.saffron, shape: BoxShape.circle), child: Text('${i + 1}', style: display(15, color: Brand.ink))),
                        const SizedBox(width: 12),
                        Expanded(child: Text(nm(context, steps[i], 'en', 'bn'), style: body(16))),
                      ]),
                    ),
                  const SizedBox(height: 6),
                  Text(tr(context, 'What counts, and how much', 'কী গণনা হয়, কতটা'), style: display(20, color: Brand.ink)),
                  const SizedBox(height: 8),
                  AppCard(
                    child: Table(
                      columnWidths: const <int, TableColumnWidth>{0: FlexColumnWidth(), 1: IntrinsicColumnWidth()},
                      defaultVerticalAlignment: TableCellVerticalAlignment.middle,
                      children: [
                        for (final f in factors)
                          TableRow(children: [
                            Padding(padding: const EdgeInsets.symmetric(vertical: 10), child: Text(nm(context, f, 'en', 'bn'), style: body(16))),
                            Padding(padding: const EdgeInsets.only(left: 12), child: Text('${(((f['weight'] ?? 0) as num) * 100).round()}%', style: display(18, color: Brand.forest))),
                          ]),
                      ],
                    ),
                  ),
                  AppCard(
                    color: Brand.lightGreen,
                    border: Colors.transparent,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(tr(context, 'Fairness promises', 'ন্যায্যতার প্রতিশ্রুতি'), style: display(18, color: Brand.forest)),
                      const SizedBox(height: 6),
                      Text(nm(context, promises, 'en', 'bn'), style: body(15)),
                    ]),
                  ),
                  AppCard(
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Expanded(
                        child: Text.rich(TextSpan(children: [
                          TextSpan(text: tr(context, 'How we check quality: ', 'মান কীভাবে যাচাই: '), style: body(15, w: FontWeight.w800)),
                          TextSpan(text: nm(context, quality, 'en', 'bn'), style: body(15)),
                        ])),
                      ),
                      const SizedBox(width: 8),
                      Pill(tr(context, 'Pilot target', 'পাইলট লক্ষ্য'), tone: Tone.saffron),
                    ]),
                  ),
                ]),
              ),
            ]);
          },
        ),
      );
}
