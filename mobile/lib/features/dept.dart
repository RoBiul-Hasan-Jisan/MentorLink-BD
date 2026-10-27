import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// Department screens. Everything here is anonymized or limited to name + batch + department. Groups smaller than 3 are hidden by the server.
final deptHomeOverviewProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/department/overview'));
final deptHomeWeeklyProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/department/weekly'));
final deptApprovalsListProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/department/approvals'));
final deptWorkshopsListProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/workshops'));

Widget _deptHeader(BuildContext context, String title, String sub) => GreenHeader(
      radius: 36,
      bottomPad: 26,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: display(28, color: Colors.white)),
        const SizedBox(height: 4),
        Text(sub, style: body(15, color: Colors.white70)),
      ]),
    );

String _fmtDate(BuildContext context, dynamic iso) {
  DateTime? d;
  try {
    d = DateTime.parse('$iso').toLocal();
  } catch (_) {
    d = null;
  }
  if (d == null) return '';
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  final h12 = d.hour % 12 == 0 ? 12 : d.hour % 12;
  return '${d.day} ${mon[d.month - 1]} · $h12:${d.minute.toString().padLeft(2, '0')} ${d.hour >= 12 ? 'PM' : 'AM'}';
}

// ---------------- Overview ----------------
class DeptHome extends ConsumerWidget {
  const DeptHome({super.key});

  Future<void> _export(BuildContext context, WidgetRef ref) async {
    try {
      final res = await ref.read(dioProvider).get('/department/report.csv');
      final text = '${res.data}';
      if (!context.mounted) return;
      await showDialog<void>(
        context: context,
        builder: (d) => AlertDialog(
          title: Text(tr(context, 'Career-office report', 'ক্যারিয়ার অফিস রিপোর্ট')),
          content: SingleChildScrollView(child: SelectableText(text, style: const TextStyle(fontFamily: 'monospace', fontSize: 12))),
          actions: [
            TextButton(
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: text));
                if (d.mounted) toast(d, tr(d, 'Copied. Paste it into a spreadsheet and save as CSV.', 'কপি হয়েছে। স্প্রেডশিটে পেস্ট করে CSV হিসেবে সংরক্ষণ করুন।'));
              },
              child: Text(tr(context, 'Copy', 'কপি')),
            ),
            FilledButton(onPressed: () => Navigator.pop(d), child: Text(tr(context, 'Close', 'বন্ধ'))),
          ],
        ),
      );
    } catch (e) {
      if (context.mounted) toast(context, errorText(e));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).valueOrNull;
    final name = me == null ? '' : '${me['displayName'] ?? ''}';
    final dept = me == null ? '' : '${me['department'] ?? ''}';
    return ListView(padding: EdgeInsets.zero, children: [
      _deptHeader(context, '${tr(context, 'Department view', 'বিভাগ ভিউ')}${name.isEmpty ? '' : ' · $name'}', '${dept.isEmpty ? '' : '$dept · '}${tr(context, 'Anonymized counts only', 'শুধু নামহীন সংখ্যা')}'),
      Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          AsyncBody(
            value: ref.watch(deptHomeOverviewProvider),
            onRetry: () => ref.invalidate(deptHomeOverviewProvider),
            builder: (d) {
              final goals = ((d['careerGoals'] ?? []) as List).cast<Map>();
              Widget stat(String v, String label) => Expanded(
                    child: AppCard(
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      padding: const EdgeInsets.all(12),
                      child: Column(children: [
                        Text(v, style: display(26, color: Brand.ink)),
                        const SizedBox(height: 4),
                        Text(label, textAlign: TextAlign.center, style: body(12, color: Brand.muted)),
                      ]),
                    ),
                  );
              return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Row(children: [
                  stat('${d['students'] ?? '—'}', tr(context, 'active students', 'সক্রিয় শিক্ষার্থী')),
                  stat('${d['applications'] ?? '—'}', tr(context, 'applications', 'আবেদন')),
                ]),
                if (goals.isNotEmpty)
                  AppCard(
                    padding: const EdgeInsets.all(16),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(tr(context, 'Career goals (groups of 3 or more)', 'ক্যারিয়ার লক্ষ্য (৩ বা তার বেশি)'), style: display(17, color: Brand.ink)),
                      const SizedBox(height: 6),
                      for (final g in goals)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 3),
                          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text('${g['role']}', style: body(15, w: FontWeight.w600)), Text('${g['count']}', style: display(16, color: Brand.ink))]),
                        ),
                    ]),
                  ),
                Text('${d['note'] ?? ''}', style: body(12, color: Brand.muted)),
              ]);
            },
          ),
          AsyncBody(
            value: ref.watch(deptHomeWeeklyProvider),
            onRetry: () => ref.invalidate(deptHomeWeeklyProvider),
            builder: (d) {
              final weeks = d['weeks'];
              if (weeks is! List) {
                return AppCard(child: Text('${d['note'] ?? tr(context, 'Not enough students to show this safely.', 'নিরাপদে দেখানোর মতো শিক্ষার্থী নেই।')}', style: body(14, color: Brand.muted)));
              }
              final list = weeks.cast<Map>();
              int maxV = 1;
              for (final w in list) {
                final v = (w['sessions'] as num).toInt();
                if (v > maxV) maxV = v;
              }
              return AppCard(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(tr(context, 'Completed sessions per week', 'সাপ্তাহিক সম্পন্ন সেশন'), style: display(17, color: Brand.ink)),
                  const SizedBox(height: 10),
                  SizedBox(
                    height: 120,
                    child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      for (final w in list)
                        Expanded(
                          child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                            Text('${w['sessions']}', style: body(12, w: FontWeight.w700)),
                            const SizedBox(height: 4),
                            Container(
                              height: 4 + 80.0 * ((w['sessions'] as num).toInt() / maxV),
                              margin: const EdgeInsets.symmetric(horizontal: 6),
                              decoration: BoxDecoration(color: Brand.delta, borderRadius: BorderRadius.circular(6)),
                            ),
                            const SizedBox(height: 4),
                            Text('W${w['week']}', style: body(12, color: Brand.muted)),
                          ]),
                        ),
                    ]),
                  ),
                  const SizedBox(height: 8),
                  Text('${tr(context, 'Sessions done', 'সম্পন্ন সেশন')}: ${d['sessionsDone'] ?? '—'}', style: body(14, color: Brand.muted)),
                ]),
              );
            },
          ),
          const SizedBox(height: 8),
          BigButton(tr(context, 'Export career-office report', 'ক্যারিয়ার অফিস রিপোর্ট এক্সপোর্ট'), onPressed: () => _export(context, ref)),
          const SizedBox(height: 20),
        ]),
      ),
    ]);
  }
}

// ---------------- Affiliation approvals ----------------
class DeptApprovals extends ConsumerStatefulWidget {
  const DeptApprovals({super.key});
  @override
  ConsumerState<DeptApprovals> createState() => _DeptApprovalsState();
}

class _DeptApprovalsState extends ConsumerState<DeptApprovals> {
  final csv = TextEditingController();
  bool busy = false;

  @override
  void dispose() {
    csv.dispose();
    super.dispose();
  }

  Future<void> _decide(String id, String decision) async {
    try {
      await ref.read(dioProvider).post('/department/approvals/$id', data: {'decision': decision});
      ref.invalidate(deptApprovalsListProvider);
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  Future<void> _bulk() async {
    final emails = csv.text.split(RegExp(r'[\s,;]+')).map((e) => e.trim()).where((e) => e.contains('@')).toList();
    if (emails.isEmpty) {
      toast(context, tr(context, 'Paste the roll-list emails first.', 'আগে রোল-লিস্টের ইমেইল পেস্ট করুন।'));
      return;
    }
    setState(() => busy = true);
    try {
      final res = await ref.read(dioProvider).post('/department/bulk-approve', data: {'emails': emails});
      final d = Map<String, dynamic>.from(res.data as Map);
      if (mounted) toast(context, '${tr(context, 'Listed', 'তালিকায়')} ${d['listed']} · ${tr(context, 'approved', 'অনুমোদিত')} ${d['approved']}');
      csv.clear();
      ref.invalidate(deptApprovalsListProvider);
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    return ListView(padding: EdgeInsets.zero, children: [
      _deptHeader(context, tr(context, 'Affiliation approvals', 'অধিভুক্তি অনুমোদন'), tr(context, 'Confirm that students belong to your department.', 'শিক্ষার্থীরা আপনার বিভাগের কি না নিশ্চিত করুন।')),
      Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          AsyncBody(
            value: ref.watch(deptApprovalsListProvider),
            onRetry: () => ref.invalidate(deptApprovalsListProvider),
            builder: (d) {
              final list = ((d['pending'] ?? []) as List).cast<Map>();
              return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Text('${list.length} ${tr(context, 'waiting', 'অপেক্ষায়')}', style: display(18, color: Brand.ink)),
                const SizedBox(height: 6),
                if (list.isEmpty) AppCard(child: Text(tr(context, 'No pending approvals.', 'কোনো অনুমোদন অপেক্ষায় নেই।'), style: body(15))),
                for (final u in list)
                  AppCard(
                    padding: const EdgeInsets.all(14),
                    child: Row(children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${u['name'] ?? ''}', style: body(16, w: FontWeight.w700)),
                          Text('${u['department'] ?? ''}${u['batchYear'] != null ? ' · ${u['batchYear']}' : ''}', style: body(13, color: Brand.muted)),
                          if (u['emailDomainMatch'] == true) Padding(padding: const EdgeInsets.only(top: 4), child: Pill(tr(context, 'University email matches', 'বিশ্ববিদ্যালয়ের ইমেইল মিলেছে'))),
                        ]),
                      ),
                      IconButton(tooltip: tr(context, 'Approve', 'অনুমোদন'), icon: const Icon(Icons.check_circle, color: Brand.delta, size: 30), onPressed: () => _decide('${u['id']}', 'approved')),
                      IconButton(tooltip: tr(context, 'Reject', 'বাতিল'), icon: const Icon(Icons.cancel_outlined, color: Color(0xFF9B2C1F), size: 30), onPressed: () => _decide('${u['id']}', 'rejected')),
                    ]),
                  ),
                Text('${d['note'] ?? ''}', style: body(12, color: Brand.muted)),
              ]);
            },
          ),
          const SizedBox(height: 12),
          AppCard(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr(context, 'Bulk onboarding by CSV', 'CSV দিয়ে বাল্ক অনবোর্ডিং'), style: display(17, color: Brand.ink)),
              Text(tr(context, 'Paste the roll-list emails (one per line or separated by commas). Matching pending students are approved.', 'রোল-লিস্টের ইমেইল পেস্ট করুন (প্রতি লাইনে একটি বা কমা দিয়ে)। মিলে যাওয়া অপেক্ষমাণ শিক্ষার্থী অনুমোদিত হবে।'), style: body(13, color: Brand.muted)),
              const SizedBox(height: 8),
              TextField(controller: csv, minLines: 4, maxLines: 8, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'name@university.edu')),
              const SizedBox(height: 10),
              BigButton(tr(context, 'Approve listed students', 'তালিকার শিক্ষার্থীদের অনুমোদন'), onPressed: busy ? null : _bulk),
            ]),
          ),
          const SizedBox(height: 20),
        ]),
      ),
    ]);
  }
}

// ---------------- Workshops ----------------
class DeptWorkshops extends ConsumerStatefulWidget {
  const DeptWorkshops({super.key});
  @override
  ConsumerState<DeptWorkshops> createState() => _DeptWorkshopsState();
}

class _DeptWorkshopsState extends ConsumerState<DeptWorkshops> {
  Future<void> _host() async {
    final title = TextEditingController();
    final desc = TextEditingController();
    final seats = TextEditingController(text: '10');
    DateTime? when;
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => StatefulBuilder(
        builder: (d2, set) => AlertDialog(
          title: Text(tr(context, 'Host a workshop', 'ওয়ার্কশপ আয়োজন')),
          content: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextField(controller: title, decoration: InputDecoration(labelText: tr(context, 'Title', 'শিরোনাম'))),
              TextField(controller: desc, maxLines: 2, decoration: InputDecoration(labelText: tr(context, 'Description (optional)', 'বিবরণ (ঐচ্ছিক)'))),
              TextField(controller: seats, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: tr(context, 'Seats (2 to 200)', 'আসন (২ থেকে ২০০)'))),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: () async {
                  final day = await showDatePicker(context: context, initialDate: DateTime.now().add(const Duration(days: 3)), firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 365)));
                  if (day == null || !context.mounted) return;
                  final t = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 18, minute: 0));
                  if (t == null) return;
                  set(() => when = DateTime(day.year, day.month, day.day, t.hour, t.minute));
                },
                child: Text(when == null ? tr(context, 'Pick date and time', 'তারিখ ও সময় বাছুন') : _fmtDate(context, when!.toIso8601String())),
              ),
            ]),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(d, false), child: Text(tr(context, 'Cancel', 'বাতিল'))),
            FilledButton(onPressed: () => Navigator.pop(d, true), child: Text(tr(context, 'Create', 'তৈরি করুন'))),
          ],
        ),
      ),
    );
    if (ok != true) return;
    final n = int.tryParse(seats.text.trim()) ?? 10;
    if (when == null || title.text.trim().length < 4) {
      if (mounted) toast(context, tr(context, 'Add a title (4+ letters) and a date.', 'শিরোনাম (৪+ অক্ষর) ও তারিখ দিন।'));
      return;
    }
    try {
      final payload = <String, dynamic>{'title': title.text.trim(), 'startsAt': when!.toUtc().toIso8601String(), 'seats': n};
      if (desc.text.trim().isNotEmpty) payload['description'] = desc.text.trim();
      await ref.read(dioProvider).post('/workshops', data: payload);
      ref.invalidate(deptWorkshopsListProvider);
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  Future<void> _cancel(String id) async {
    try {
      await ref.read(dioProvider).post('/workshops/$id/cancel');
      ref.invalidate(deptWorkshopsListProvider);
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final myName = '${ref.watch(meProvider).valueOrNull?['displayName'] ?? ''}';
    return ListView(padding: EdgeInsets.zero, children: [
      _deptHeader(context, tr(context, 'Workshops', 'ওয়ার্কশপ'), tr(context, 'Group sessions for your students.', 'আপনার শিক্ষার্থীদের জন্য গ্রুপ সেশন।')),
      Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          BigButton(tr(context, 'Host a workshop', 'ওয়ার্কশপ আয়োজন করুন'), onPressed: _host),
          const SizedBox(height: 8),
          AsyncBody(
            value: ref.watch(deptWorkshopsListProvider),
            onRetry: () => ref.invalidate(deptWorkshopsListProvider),
            builder: (d) {
              final list = ((d['workshops'] ?? []) as List).cast<Map>();
              if (list.isEmpty) return AppCard(child: Text(tr(context, 'No upcoming workshops.', 'কোনো আসন্ন ওয়ার্কশপ নেই।'), style: body(15)));
              return Column(children: [
                for (final w in list)
                  AppCard(
                    padding: const EdgeInsets.all(14),
                    child: Row(children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${w['title'] ?? ''}', style: body(16, w: FontWeight.w700)),
                          Text('${_fmtDate(context, w['startsAt'])} · ${w['taken'] ?? 0} ${tr(context, 'of', '/')} ${w['seats'] ?? 0} ${tr(context, 'seats', 'আসন')}', style: body(13, color: Brand.muted)),
                          Text('${tr(context, 'Host', 'আয়োজক')}: ${w['host'] ?? ''}', style: body(13, color: Brand.muted)),
                        ]),
                      ),
                      if ('${w['host'] ?? ''}' == myName) TextButton(onPressed: () => _cancel('${w['id']}'), child: Text(tr(context, 'Cancel', 'বাতিল'))),
                    ]),
                  ),
              ]);
            },
          ),
          const SizedBox(height: 20),
        ]),
      ),
    ]);
  }
}
