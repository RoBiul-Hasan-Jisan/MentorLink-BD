import 'dart:convert';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// Privacy and data screens: settings toggles, consent record, export or delete my data, report/block a user, roles and permissions.
// All settings are saved on the server with PATCH /me/privacy (fields: remindersOn, quietHours, shareProgressWithDept, shareProgressWithMentors).
final privacyConsentsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/consents'));
final privacyUsersProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/admin/users'));

class PrivacyScreen extends ConsumerStatefulWidget {
  const PrivacyScreen({super.key});
  @override
  ConsumerState<PrivacyScreen> createState() => _PrivacyScreenState();
}

class _PrivacyScreenState extends ConsumerState<PrivacyScreen> {
  Future<void> _save(Map<String, dynamic> data) async {
    try {
      await ref.read(dioProvider).patch('/me/privacy', data: data);
      ref.invalidate(meProvider);
      ref.invalidate(privacyConsentsProvider);
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  Future<void> _export() async {
    try {
      final res = await ref.read(dioProvider).get('/me/export');
      final data = res.data;
      final text = const JsonEncoder.withIndent('  ').convert(data);
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (d) => AlertDialog(
          title: Text(tr(context, 'Your data', 'আপনার ডেটা')),
          content: SizedBox(
            width: 320,
            height: 320,
            child: SingleChildScrollView(child: SelectableText(text, style: const TextStyle(fontSize: 11, fontFamily: 'monospace'))),
          ),
          actions: [
            TextButton(
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: text));
                if (d.mounted) toast(d, tr(d, 'Copied', 'কপি হয়েছে'));
              },
              child: Text(tr(context, 'Copy', 'কপি')),
            ),
            FilledButton(onPressed: () => Navigator.pop(d), child: Text(tr(context, 'Close', 'বন্ধ'))),
          ],
        ),
      );
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  Future<void> _delete() async {
    final c = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text(tr(context, 'Delete my account', 'আমার অ্যাকাউন্ট মুছুন')),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(tr(context, 'This removes your profile, plan, CV, chats and applications and cannot be undone. Type DELETE to confirm.',
              'এতে আপনার প্রোফাইল, প্ল্যান, সিভি, চ্যাট ও আবেদন মুছে যাবে এবং ফেরানো যাবে না। নিশ্চিত করতে DELETE লিখুন।')),
          const SizedBox(height: 8),
          TextField(controller: c, decoration: const InputDecoration(labelText: 'DELETE')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(d, false), child: Text(tr(context, 'Cancel', 'বাতিল'))),
          FilledButton(onPressed: () => Navigator.pop(d, c.text.trim() == 'DELETE'), child: Text(tr(context, 'Delete', 'মুছুন'))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(dioProvider).delete('/me', data: {'confirm': 'DELETE'});
      await FirebaseAuth.instance.signOut();
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(meProvider).valueOrNull;
    final role = me == null ? '' : '${me['role'] ?? ''}';
    final isStudent = role == 'student';
    final quiet = (me != null && me['quietHours'] is Map) ? Map<String, dynamic>.from(me['quietHours'] as Map) : <String, dynamic>{};
    final qFrom = (quiet['from'] is num) ? (quiet['from'] as num).toInt() : 22;
    final qTo = (quiet['to'] is num) ? (quiet['to'] as num).toInt() : 7;
    return Scaffold(
      body: ListView(padding: EdgeInsets.zero, children: [
        GreenHeader(
          radius: 36,
          bottomPad: 26,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            BackCircle(dark: true, onTap: () => context.pop()),
            const SizedBox(height: 12),
            Text(tr(context, 'Privacy and my data', 'গোপনীয়তা ও আমার ডেটা'), style: display(28, color: Colors.white)),
            Text(tr(context, 'You decide what is shared.', 'কী শেয়ার হবে আপনি ঠিক করেন।'), style: body(15, color: Colors.white70)),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            AppCard(
              padding: const EdgeInsets.all(8),
              child: Column(children: [
                SwitchListTile(
                  activeColor: Brand.delta,
                  title: Text(tr(context, 'Session reminders', 'সেশন রিমাইন্ডার'), style: body(16, w: FontWeight.w600)),
                  subtitle: Text(tr(context, 'On-device alerts', 'ডিভাইসে অ্যালার্ট')),
                  value: me != null && me['remindersOn'] != false,
                  onChanged: (v) => _save({'remindersOn': v}),
                ),
                ListTile(
                  title: Text(tr(context, 'Quiet hours', 'শান্ত সময়'), style: body(16, w: FontWeight.w600)),
                  subtitle: Text('${qFrom.toString().padLeft(2, '0')}:00 – ${qTo.toString().padLeft(2, '0')}:00'),
                  trailing: const Icon(Icons.schedule),
                  onTap: () async {
                    final from = await showTimePicker(context: context, initialTime: TimeOfDay(hour: qFrom, minute: 0), helpText: tr(context, 'Quiet from', 'শান্ত শুরু'));
                    if (from == null || !mounted) return;
                    final to = await showTimePicker(context: context, initialTime: TimeOfDay(hour: qTo, minute: 0), helpText: tr(context, 'Quiet until', 'শান্ত শেষ'));
                    if (to == null) return;
                    await _save({'quietHours': {'from': from.hour, 'to': to.hour}});
                  },
                ),
                if (isStudent)
                  SwitchListTile(
                    activeColor: Brand.delta,
                    title: Text(tr(context, 'Share my progress with department', 'বিভাগের সাথে আমার অগ্রগতি শেয়ার'), style: body(16, w: FontWeight.w600)),
                    subtitle: Text(tr(context, 'Anonymous counts only. Your name is never shown.', 'শুধু নামহীন সংখ্যা। আপনার নাম দেখানো হয় না।')),
                    value: me != null && me['shareProgressWithDept'] == true,
                    onChanged: (v) => _save({'shareProgressWithDept': v}),
                  ),
                if (isStudent)
                  SwitchListTile(
                    activeColor: Brand.delta,
                    title: Text(tr(context, 'Share my progress with my mentors', 'মেন্টরদের সাথে অগ্রগতি শেয়ার'), style: body(16, w: FontWeight.w600)),
                    subtitle: Text(tr(context, 'Mentors you worked with can see your readiness change.', 'আপনার মেন্টররা আপনার প্রস্তুতির পরিবর্তন দেখতে পারবেন।')),
                    value: me != null && me['shareProgressWithMentors'] == true,
                    onChanged: (v) => _save({'shareProgressWithMentors': v}),
                  ),
              ]),
            ),
            AsyncBody(
              value: ref.watch(privacyConsentsProvider),
              onRetry: () => ref.invalidate(privacyConsentsProvider),
              builder: (d) {
                final apps = ((d['applications'] ?? []) as List).cast<Map>();
                final sc = d['signupConsent'];
                return AppCard(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(tr(context, 'Consent and data record', 'সম্মতি ও ডেটা রেকর্ড'), style: display(18, color: Brand.ink)),
                    const SizedBox(height: 6),
                    if (sc is Map) Text('${sc['text'] ?? ''}', style: body(14, color: Brand.muted)),
                    const SizedBox(height: 8),
                    if (apps.isEmpty) Text(tr(context, 'You have not shared a CV with any employer yet.', 'এখনও কোনো নিয়োগকারীর সাথে সিভি শেয়ার করেননি।'), style: body(14)),
                    for (final a in apps)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Text('• ${a['opportunity'] ?? ''} · ${a['organization'] ?? ''}: ${(a['sharedFields'] is List) ? (a['sharedFields'] as List).join(', ') : ''}', style: body(14)),
                      ),
                  ]),
                );
              },
            ),
            AppCard(
              padding: const EdgeInsets.all(6),
              child: Column(children: [
                ListTile(
                  leading: const Icon(Icons.download_outlined, color: Brand.delta),
                  title: Text(tr(context, 'Export my data', 'আমার ডেটা এক্সপোর্ট'), style: body(16, w: FontWeight.w600)),
                  subtitle: Text(tr(context, 'A copy of everything we hold about you', 'আপনার সম্পর্কে আমাদের কাছে থাকা সব তথ্যের কপি')),
                  onTap: _export,
                ),
                if (role != 'admin')
                  ListTile(
                    leading: const Icon(Icons.delete_outline, color: Color(0xFF9B2C1F)),
                    title: Text(tr(context, 'Delete my account and data', 'আমার অ্যাকাউন্ট ও ডেটা মুছুন'), style: body(16, w: FontWeight.w600, color: const Color(0xFF9B2C1F))),
                    onTap: _delete,
                  ),
              ]),
            ),
            AppCard(
              color: Brand.lightGreen,
              border: Colors.transparent,
              child: Row(children: [
                const Icon(Icons.lock_outline, color: Brand.forest),
                const SizedBox(width: 12),
                Expanded(child: Text(tr(context, 'We never collect your GPS or home location. Phone and email stay hidden unless you share them.', 'আমরা আপনার জিপিএস বা বাসার অবস্থান নিই না। ফোন ও ইমেইল আপনি না চাইলে গোপন থাকে।'), style: body(14))),
              ]),
            ),
          ]),
        ),
      ]),
    );
  }
}

// ---------------- Report this user ----------------
class ReportUserScreen extends ConsumerStatefulWidget {
  const ReportUserScreen({super.key, required this.target});
  final Map<String, dynamic> target; // keys: id, name
  @override
  ConsumerState<ReportUserScreen> createState() => _ReportUserScreenState();
}

class _ReportUserScreenState extends ConsumerState<ReportUserScreen> {
  int? picked;
  bool alsoBlock = false;
  bool busy = false;

  // The target comes from the link (/report-user?id=...&name=...). Only a well-formed user id is accepted.
  static final _idPattern = RegExp(r'^[a-fA-F0-9]{24}$');

  Future<void> _send(List<String> reasons) async {
    final id = '${widget.target['id'] ?? ''}';
    if (picked == null || !_idPattern.hasMatch(id)) return;
    setState(() => busy = true);
    try {
      final dio = ref.read(dioProvider);
      await dio.post('/reports', data: {'targetType': 'user', 'targetId': id, 'reason': reasons[picked!]});
      if (alsoBlock) await dio.post('/users/$id/block');
      if (!mounted) return;
      toast(context, tr(context, 'Report sent. Thank you.', 'রিপোর্ট পাঠানো হয়েছে। ধন্যবাদ।'));
      context.pop();
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final reasons = <String>[
      tr(context, 'Asked me for money or a fee', 'টাকা বা ফি চেয়েছে'),
      tr(context, 'Inappropriate or harassing messages', 'অনুপযুক্ত বা হয়রানিমূলক বার্তা'),
      tr(context, 'Fake profile or false credentials', 'ভুয়া প্রোফাইল বা মিথ্যা পরিচয়'),
      tr(context, 'Pressured me to leave the app', 'অ্যাপের বাইরে যেতে চাপ দিয়েছে'),
      tr(context, 'Something else', 'অন্য কিছু'),
    ];
    final targetId = '${widget.target['id'] ?? ''}';
    final targetName = '${widget.target['name'] ?? ''}'.trim();
    final validTarget = _idPattern.hasMatch(targetId);
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'Report this user', 'এই ব্যবহারকারীকে রিপোর্ট করুন'))),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        if (!validTarget) AppCard(color: const Color(0xFFFDEDEA), child: Text(tr(context, 'This report link is not valid. Open the report option from the person\'s profile or request instead.', 'এই রিপোর্ট লিংকটি সঠিক নয়। ব্যক্তির প্রোফাইল বা অনুরোধ থেকে রিপোর্ট অপশন খুলুন।'), style: body(15, color: const Color(0xFF9B2C1F), w: FontWeight.w700))),
        if (validTarget && targetName.isNotEmpty) Text(tr(context, 'Reporting: $targetName', 'রিপোর্ট করা হচ্ছে: $targetName'), style: body(17, w: FontWeight.w800)),
        Text(tr(context, 'Only the safety team sees your report.', 'শুধু নিরাপত্তা দল আপনার রিপোর্ট দেখে।'), style: body(15, color: Brand.muted)),
        const SizedBox(height: 8),
        for (int i = 0; i < reasons.length; i++)
          AppCard(
            padding: const EdgeInsets.all(4),
            border: picked == i ? Brand.delta : null,
            onTap: () => setState(() => picked = i),
            child: ListTile(
              leading: Icon(picked == i ? Icons.radio_button_checked : Icons.radio_button_unchecked, color: Brand.delta),
              title: Text(reasons[i], style: body(16, w: FontWeight.w600)),
            ),
          ),
        SwitchListTile(
          activeColor: Brand.delta,
          title: Text(tr(context, 'Also block this user', 'এই ব্যবহারকারীকে ব্লকও করুন')),
          value: alsoBlock,
          onChanged: (v) => setState(() => alsoBlock = v),
        ),
        const SizedBox(height: 8),
        BigButton(tr(context, 'Send report', 'রিপোর্ট পাঠান'), onPressed: (picked == null || busy || !validTarget) ? null : () => _send(reasons)),
        const SizedBox(height: 10),
        Text(tr(context, 'Serious reports are reviewed within 24 hours and logged in the audit trail.', 'গুরুতর রিপোর্ট ২৪ ঘণ্টার মধ্যে দেখা হয় এবং অডিট লগে থাকে।'), textAlign: TextAlign.center, style: body(13, color: Brand.muted)),
      ]),
    );
  }
}

// ---------------- Roles and permissions (+ admin preview and role list) ----------------
class RolesScreen extends ConsumerStatefulWidget {
  const RolesScreen({super.key});
  @override
  ConsumerState<RolesScreen> createState() => _RolesScreenState();
}

class _RolesScreenState extends ConsumerState<RolesScreen> {
  Future<void> _preview(String role) async {
    try {
      final res = await ref.read(dioProvider).post('/admin/preview', data: {'role': role});
      final d = Map<String, dynamic>.from(res.data as Map);
      final screens = ((d['screens'] ?? []) as List).map((x) => '$x').toList();
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (c) => AlertDialog(
          title: Text('${tr(context, 'Preview', 'প্রিভিউ')}: $role'),
          content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Wrap(spacing: 6, runSpacing: 6, children: [for (final s in screens) Pill(s)]),
            const SizedBox(height: 10),
            Text('${d['note'] ?? ''}', style: body(13, color: Brand.muted)),
          ]),
          actions: [FilledButton(onPressed: () => Navigator.pop(c), child: Text(tr(context, 'Close', 'বন্ধ')))],
        ),
      );
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  // Admin: set a new email and/or password for a user. Passwords are write-only: they can be set but never shown.
  Future<void> _changeAccount(Map u) async {
    final email = TextEditingController(text: '${u['email'] ?? ''}');
    final pass = TextEditingController();
    final go = await showDialog<bool>(context: context, builder: (c) => AlertDialog(
      title: Text('${u['displayName'] ?? ''}', style: display(19)),
      content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: InputDecoration(labelText: tr(context, 'Sign-in email', 'সাইন-ইন ইমেইল'))),
        const SizedBox(height: 10),
        TextField(controller: pass, decoration: InputDecoration(labelText: tr(context, 'New password (min 8, leave empty to keep)', 'নতুন পাসওয়ার্ড (কমপক্ষে ৮, না বদলাতে খালি রাখুন)'))),
        const SizedBox(height: 8),
        Text(tr(context, 'Existing passwords cannot be shown: they are stored as a one-way hash. The user is signed out everywhere and told about the change. This is logged.', 'বর্তমান পাসওয়ার্ড দেখা যায় না: এটি এক-মুখী হ্যাশ হিসেবে সংরক্ষিত। ব্যবহারকারী সব জায়গা থেকে সাইন আউট হবেন ও জানতে পারবেন। এটি লগ হয়।'), style: body(12, color: Brand.muted)),
      ]),
      actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(context, 'Cancel', 'বাতিল'))), FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(tr(context, 'Save', 'সেভ')))],
    ));
    if (go != true) return;
    final data = <String, dynamic>{
      if (email.text.trim().isNotEmpty && email.text.trim().toLowerCase() != '${u['email'] ?? ''}'.toLowerCase()) 'email': email.text.trim(),
      if (pass.text.isNotEmpty) 'newPassword': pass.text,
    };
    if (data.isEmpty) { if (mounted) toast(context, tr(context, 'Nothing to change.', 'বদলানোর কিছু নেই।')); return; }
    try {
      await ref.read(dioProvider).post('/admin/users/${u['_id']}/account', data: data);
      ref.invalidate(privacyUsersProvider);
      if (mounted) toast(context, tr(context, 'Account updated (logged)', 'অ্যাকাউন্ট আপডেট হয়েছে (লগ হয়েছে)'));
    } catch (e) { if (mounted) toast(context, errorText(e)); }
  }

  Future<void> _setRole(String id, String role) async {
    try {
      await ref.read(dioProvider).patch('/admin/users/$id/role', data: {'role': role});
      ref.invalidate(privacyUsersProvider);
      if (mounted) toast(context, tr(context, 'Role updated (logged)', 'রোল আপডেট হয়েছে (লগ হয়েছে)'));
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  TableRow _row(String label, List<String> cells, {bool head = false}) => TableRow(
        decoration: head ? const BoxDecoration(color: Brand.lightGreen) : null,
        children: [
          Padding(padding: const EdgeInsets.all(8), child: Text(label, style: body(13, w: head ? FontWeight.w800 : FontWeight.w600))),
          for (final c in cells) Padding(padding: const EdgeInsets.all(8), child: Text(c, textAlign: TextAlign.center, style: body(13, w: head ? FontWeight.w800 : FontWeight.w500))),
        ],
      );

  @override
  Widget build(BuildContext context) {
    final role = '${ref.watch(meProvider).valueOrNull?['role'] ?? ''}';
    final isAdmin = role == 'admin';
    const yes = '✓';
    const no = '–';
    return Scaffold(
      appBar: AppBar(title: Text(tr(context, 'Roles and permissions', 'রোল ও অনুমতি'))),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Text(tr(context, 'Least privilege, enforced on the server.', 'সর্বনিম্ন অনুমতি, সার্ভারে প্রয়োগ করা।'), style: body(15, color: Brand.muted)),
        const SizedBox(height: 8),
        AppCard(
          padding: const EdgeInsets.all(8),
          child: Table(columnWidths: const {0: FlexColumnWidth(2.4)}, children: [
            _row(tr(context, 'Can the role...', 'রোল কি পারে...'), [tr(context, 'Student', 'ছাত্র'), tr(context, 'Mentor', 'মেন্টর'), tr(context, 'Dept.', 'বিভাগ'), tr(context, 'Admin', 'অ্যাডমিন')], head: true),
            _row(tr(context, 'Use skill-gap, plan, CV', 'স্কিল-গ্যাপ, প্ল্যান, সিভি'), [yes, no, no, no]),
            _row(tr(context, 'Request mentors, apply to jobs', 'মেন্টর অনুরোধ, চাকরিতে আবেদন'), [yes, no, no, no]),
            _row(tr(context, 'Accept requests, write notes', 'অনুরোধ গ্রহণ, নোট লেখা'), [no, yes, no, no]),
            _row(tr(context, 'Post opportunities', 'সুযোগ পোস্ট'), [no, tr(context, 'after review', 'রিভিউয়ের পর'), no, yes]),
            _row(tr(context, "See a student's private data", 'ছাত্রের ব্যক্তিগত ডেটা দেখা'), [tr(context, 'own', 'নিজের'), tr(context, 'consent', 'সম্মতিতে'), tr(context, 'anon only', 'শুধু নামহীন'), tr(context, 'logged', 'লগসহ')]),
            _row(tr(context, 'Approve student affiliation', 'ছাত্রের অধিভুক্তি অনুমোদন'), [no, no, yes, yes]),
            _row(tr(context, 'Verify alumni, review scams', 'অ্যালামনাই যাচাই, স্ক্যাম রিভিউ'), [no, no, no, yes]),
            _row(tr(context, 'Audit logs, taxonomy, roles', 'অডিট লগ, ট্যাক্সোনমি, রোল'), [no, no, no, yes]),
          ]),
        ),
        const SizedBox(height: 8),
        AppCard(
          color: Brand.lightGreen,
          border: Colors.transparent,
          child: Text(
            tr(context, 'Only administrators can preview every role, to support users and check quality. Every preview is recorded in the audit log. Students and mentors can never open admin or other-role screens.',
                'শুধু অ্যাডমিন সব রোলের প্রিভিউ দেখতে পারেন। প্রতিটি প্রিভিউ অডিট লগে থাকে। ছাত্র ও মেন্টর কখনও অ্যাডমিন বা অন্য রোলের স্ক্রিন খুলতে পারেন না।'),
            style: body(14),
          ),
        ),
        if (isAdmin) ...[
          const SizedBox(height: 8),
          Text(tr(context, 'Admin preview (read-only)', 'অ্যাডমিন প্রিভিউ (শুধু দেখা)'), style: display(18, color: Brand.ink)),
          const SizedBox(height: 6),
          Wrap(spacing: 8, runSpacing: 8, children: [
            OutlinedButton(onPressed: () => _preview('student'), child: Text(tr(context, 'Student view', 'ছাত্র ভিউ'))),
            OutlinedButton(onPressed: () => _preview('mentor'), child: Text(tr(context, 'Mentor view', 'মেন্টর ভিউ'))),
            OutlinedButton(onPressed: () => _preview('department'), child: Text(tr(context, 'Dept. view', 'বিভাগ ভিউ'))),
          ]),
          const SizedBox(height: 16),
          Text(tr(context, 'Manage roles', 'রোল পরিচালনা'), style: display(18, color: Brand.ink)),
          const SizedBox(height: 6),
          AsyncBody(
            value: ref.watch(privacyUsersProvider),
            onRetry: () => ref.invalidate(privacyUsersProvider),
            builder: (d) {
              final users = ((d['users'] ?? []) as List).cast<Map>();
              return Column(children: [
                for (final u in users)
                  AppCard(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    child: Row(children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${u['displayName'] ?? ''}', style: body(15, w: FontWeight.w700)),
                          Text('${u['role'] ?? ''} · ${u['email'] ?? ''}', style: body(12, color: Brand.muted)),
                        ]),
                      ),
                      if (u['role'] != 'admin') IconButton(
                        tooltip: tr(context, 'Change email or password', 'ইমেইল বা পাসওয়ার্ড বদলান'),
                        icon: const Icon(Icons.key_outlined, color: Brand.delta),
                        onPressed: () => _changeAccount(u),
                      ),
                      if (u['role'] == 'student' || u['role'] == 'mentor' || u['role'] == 'department')
                        DropdownButton<String>(
                          value: '${u['role']}',
                          items: const [
                            DropdownMenuItem<String>(value: 'student', child: Text('student')),
                            DropdownMenuItem<String>(value: 'mentor', child: Text('mentor')),
                            DropdownMenuItem<String>(value: 'department', child: Text('department')),
                          ],
                          onChanged: (v) {
                            if (v != null && v != u['role']) _setRole('${u['_id']}', v);
                          },
                        ),
                    ]),
                  ),
              ]);
            },
          ),
        ],
      ]),
    );
  }
}
