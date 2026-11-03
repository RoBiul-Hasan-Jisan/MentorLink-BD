import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'admin.dart';
import 'admin_more.dart';
import 'employer.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'home.dart';
import 'jobs.dart';
import 'dept.dart';
import 'mentor.dart';
import 'mentor_more.dart';
import 'mentors.dart';
import 'analytics.dart';
import 'career.dart';
import 'launch.dart';
import 'widgets.dart';

// Which tabs you see depends on your role (the server enforces the same rule).
class Shell extends ConsumerStatefulWidget {
  const Shell({super.key});
  @override
  ConsumerState<Shell> createState() => _ShellState();
}
class _ShellState extends ConsumerState<Shell> {
  int i = 0;
  @override
  void initState() { super.initState(); _registerPush(); }
  // Push notifications (Firebase Cloud Messaging). Mobile only; failures are ignored.
  Future<void> _registerPush() async {
    if (kIsWeb) return;
    try {
      final m = FirebaseMessaging.instance;
      await m.requestPermission();
      final t = await m.getToken();
      if (t != null) await ref.read(dioProvider).post('/me/device-token', data: {'token': t});
    } catch (_) {}
  }
  @override
  Widget build(BuildContext context) {
    final me = ref.watch(meProvider);
    return AsyncBody(value: me, onRetry: () => ref.invalidate(meProvider), builder: (u) {
      if (u == null || u['needsProfile'] == true) return const Scaffold(body: Center(child: CircularProgressIndicator()));
      final role = u['role'] as String;
      final tabs = _tabs(role);
      i = i.clamp(0, tabs.length - 1);
      final isProfile = i == tabs.length - 1;
      return Scaffold(
        appBar: (role == 'student' || isProfile) ? null : AppBar(title: Text(tabs[i].$2, style: display(24, color: Brand.ink)), centerTitle: false),
        body: tabs[i].$3,
        bottomNavigationBar: PillNav(items: [for (final t in tabs) (t.$1, t.$2)], index: i, onTap: (v) => setState(() => i = v)),
      );
    });
  }

  List<(IconData, String, Widget)> _tabs(String role) {
    final profile = (Icons.person_outline, tr(context, 'Profile', 'প্রোফাইল'), const ProfileScreen());
    switch (role) {
      case 'student':
        // Home, Career (decisions, gaps, plan, proof), Mentors, Jobs, Profile. The 4-week plan now lives inside Career.
        return [
          (Icons.home_outlined, tr(context, 'Home', 'হোম'), StudentHome(onTab: (v) => setState(() => i = v))),
          (Icons.explore_outlined, tr(context, 'Career', 'ক্যারিয়ার'), const CareerHub()),
          (Icons.groups_outlined, tr(context, 'Mentors', 'মেন্টর'), const MentorMatches()),
          (Icons.work_outline, tr(context, 'Jobs', 'চাকরি'), const OpportunitiesScreen()),
          profile,
        ];
      case 'mentor':
        return [
          (Icons.inbox_outlined, tr(context, 'Requests', 'অনুরোধ'), const MentorRequests()),
          (Icons.work_outline, tr(context, 'Opportunities', 'সুযোগ'), const MentorOpportunities()),
          (Icons.insights_outlined, tr(context, 'Impact', 'প্রভাব'), const MentorImpactScreen()),
          profile,
        ];
      case 'admin':
        return [
          (Icons.verified_outlined, tr(context, 'Queue', 'তালিকা'), const AdminQueue()),
          (Icons.business_outlined, tr(context, 'Companies', 'কোম্পানি'), const AdminCompanies()),
          (Icons.menu_book_outlined, tr(context, 'Resources', 'রিসোর্স'), const AdminResources()),
          (Icons.fact_check_outlined, tr(context, 'Insights', 'তথ্য'), const AdminInsights()),
          profile,
        ];
      case 'department':
        return [
          (Icons.insights_outlined, tr(context, 'Overview', 'সারসংক্ষেপ'), const DeptHome()),
          (Icons.how_to_reg_outlined, tr(context, 'Approvals', 'অনুমোদন'), const DeptApprovals()),
          (Icons.bar_chart, tr(context, 'Analytics', 'বিশ্লেষণ'), const DeptAnalytics()),
          (Icons.event_outlined, tr(context, 'Workshops', 'ওয়ার্কশপ'), const DeptWorkshops()),
          profile,
        ];
      case 'employer':
        return [(Icons.business_center_outlined, tr(context, 'Jobs', 'চাকরি'), const EmployerHome()), (Icons.person_search_outlined, tr(context, 'Talent', 'ট্যালেন্ট'), const TalentScreen()), profile];
      default:
        return [profile];
    }
  }
}

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final u = ref.watch(meProvider).valueOrNull ?? {};
    final isStudent = u['role'] == 'student';
    final pending = (u['mentorApplication'] ?? {})['status'] == 'pending';
    return ListView(padding: EdgeInsets.zero, children: [
      GreenHeader(radius: 36, bottomPad: 30, child: Row(children: [
        Avatar(u['displayName'] ?? '', size: 64, bg: Brand.saffron, fg: Brand.ink), const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(u['displayName'] ?? '', style: display(24, color: Colors.white)),
          Text('${u['role']} · ${(u['university'] ?? {})['shortName'] ?? ''}', style: body(15, color: Colors.white70)),
          if (u['verificationStatus'] == 'verified') Padding(padding: const EdgeInsets.only(top: 6), child: Pill(tr(context, 'Verified', 'যাচাইকৃত'), tone: Tone.saffron)),
        ])),
      ])),
      Padding(padding: const EdgeInsets.all(16), child: Column(children: [
        if (u['role'] != 'employer') AppCard(padding: const EdgeInsets.all(6), child: ListTile(leading: const Icon(Icons.map_outlined, color: Brand.delta), title: Text(tr(context, 'University map & directory', 'বিশ্ববিদ্যালয় মানচিত্র ও ডিরেক্টরি'), style: body(17, w: FontWeight.w700)), trailing: const Icon(Icons.chevron_right), onTap: () => context.push('/university-map'))),
        AppCard(padding: const EdgeInsets.all(6), child: Column(children: [
          for (final e in _entries(context, u['role'] as String?))
            ListTile(leading: Icon(e.$1, color: Brand.delta), title: Text(e.$2, style: body(16, w: FontWeight.w600)), trailing: const Icon(Icons.chevron_right), onTap: () => context.push(e.$3)),
        ])),
        AppCard(padding: const EdgeInsets.all(6), child: Column(children: [
          SwitchListTile(activeColor: Brand.delta, title: Text(tr(context, 'Show me in my university directory', 'আমার বিশ্ববিদ্যালয়ের ডিরেক্টরিতে দেখান'), style: body(16, w: FontWeight.w600)), value: u['showInDirectory'] == true, onChanged: (v) => savePrivacySetting(context, ref, {'showInDirectory': v})),
          ListTile(leading: const Icon(Icons.language, color: Brand.delta), title: Text(tr(context, 'Language', 'ভাষা'), style: body(16, w: FontWeight.w600)), trailing: SegmentedButton<String>(showSelectedIcon: false, segments: const [ButtonSegment(value: 'bn', label: Text('বাং')), ButtonSegment(value: 'en', label: Text('EN'))], selected: {ref.watch(localeProvider)}, onSelectionChanged: (s) => ref.read(localeProvider.notifier).state = s.first)),
        ])),
        if (isStudent) AppCard(padding: const EdgeInsets.all(6), child: ListTile(leading: const Icon(Icons.workspace_premium_outlined, color: Brand.delta), title: Text(pending ? tr(context, 'Mentor application pending', 'মেন্টর আবেদন অপেক্ষমাণ') : tr(context, 'Become a mentor', 'মেন্টর হন'), style: body(17, w: FontWeight.w700)), trailing: pending ? null : const Icon(Icons.chevron_right), onTap: pending ? null : () => _apply(context, ref))),
        AppCard(padding: const EdgeInsets.all(6), child: SwitchListTile(activeColor: Brand.delta, title: Text(tr(context, 'Low-data mode', 'লো-ডেটা মোড'), style: body(16, w: FontWeight.w600)), subtitle: Text(tr(context, 'Fewer images, map replaced by the directory list', 'কম ছবি, মানচিত্রের বদলে তালিকা'), style: body(13, color: Brand.muted)), value: u['lowDataMode'] == true, onChanged: (v) => savePrivacySetting(context, ref, {'lowDataMode': v}))),
        if (isStudent) _CompanyTile(),
        AppCard(color: Brand.lightGreen, border: Colors.transparent, child: Row(children: [const Icon(Icons.lock_outline, color: Brand.forest), const SizedBox(width: 12), Expanded(child: Text(tr(context, 'People appear at their university campus. We never track personal location.', 'সবাইকে তার বিশ্ববিদ্যালয়ের ক্যাম্পাসে দেখানো হয়। আমরা ব্যক্তিগত অবস্থান ট্র্যাক করি না।'), style: body(15, color: Brand.forest)))])),
        BigButton(tr(context, 'Sign out', 'সাইন আউট'), outlined: true, onPressed: () => FirebaseAuth.instance.signOut()),
      ])),
    ]);
  }

  List<(IconData, String, String)> _entries(BuildContext context, String? role) {
    if (role == 'student') {
      // Career tools live in the Career tab. Profile keeps account, CV, sessions and privacy. The community feed now lives on Home.
      return [
        (Icons.badge_outlined, tr(context, 'My Career Passport', 'আমার ক্যারিয়ার পাসপোর্ট'), '/passport'),
        (Icons.mail_outline, tr(context, 'Company invitations', 'কোম্পানির আমন্ত্রণ'), '/invites'),
        (Icons.description_outlined, tr(context, 'My CV', 'আমার সিভি'), '/cv'),
        (Icons.event_note_outlined, tr(context, 'My sessions', 'আমার সেশন'), '/sessions'),
        (Icons.forum_outlined, tr(context, 'Pathways & Q&A', 'পথ ও প্রশ্নোত্তর'), '/pathways'),
        (Icons.tune, tr(context, 'How matching works', 'ম্যাচিং কীভাবে কাজ করে'), '/how-matching'),
        (Icons.flag_outlined, tr(context, 'Change career goal', 'ক্যারিয়ার লক্ষ্য বদলান'), '/goal'),
        (Icons.verified_user_outlined, tr(context, 'Verify account', 'অ্যাকাউন্ট যাচাই'), '/verify'),
        (Icons.privacy_tip_outlined, tr(context, 'Privacy & data', 'গোপনীয়তা ও ডেটা'), '/privacy'),
      ];
    }
    return [
      if (role == 'mentor') (Icons.fact_check_outlined, tr(context, 'Review mentees’ work', 'মেন্টিদের কাজ রিভিউ'), '/mentor/reviews'),
      if (role == 'mentor') (Icons.event_note_outlined, tr(context, 'My sessions', 'আমার সেশন'), '/sessions'),
      if (role == 'mentor') (Icons.checklist, tr(context, 'Plan reviews', 'পরিকল্পনা রিভিউ'), '/mentor/plan-reviews'),
      if (role == 'mentor') (Icons.bolt_outlined, tr(context, 'Sprint reviews', 'স্প্রিন্ট রিভিউ'), '/mentor/sprint-reviews'),
      if (role == 'admin') (Icons.query_stats, tr(context, 'Does mentoring help? (impact)', 'মেন্টরিং কি কাজে লাগছে?'), '/admin-impact'),
      if (role == 'mentor') (Icons.edit_note, tr(context, 'Mentor setup', 'মেন্টর সেটআপ'), '/mentor/setup'),
      if (role == 'mentor') (Icons.timeline, tr(context, 'My journey (Path Twin)', 'আমার যাত্রা (পাথ টুইন)'), '/mentor/journey'),
      if (role == 'admin') (Icons.admin_panel_settings_outlined, tr(context, 'Roles', 'রোল'), '/roles'),
      if (role == 'mentor' || role == 'department' || role == 'admin') (Icons.groups_outlined, tr(context, 'Community feed', 'কমিউনিটি ফিড'), '/feed'),
      (Icons.privacy_tip_outlined, tr(context, 'Privacy & data', 'গোপনীয়তা ও ডেটা'), '/privacy'),
    ];
  }

  Future<void> _apply(BuildContext context, WidgetRef ref) async {
    final title = TextEditingController(), industry = TextEditingController(), years = TextEditingController(text: '3');
    final ok = await showDialog<bool>(context: context, builder: (c) => AlertDialog(
      title: Text(tr(context, 'Apply to be a mentor', 'মেন্টর হওয়ার আবেদন'), style: display(20)),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: title, decoration: InputDecoration(labelText: tr(context, 'Job title', 'পদবি'))), const SizedBox(height: 8),
        TextField(controller: industry, decoration: InputDecoration(labelText: tr(context, 'Industry', 'শিল্প'))), const SizedBox(height: 8),
        TextField(controller: years, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: tr(context, 'Years of experience', 'অভিজ্ঞতার বছর'))),
      ]),
      actions: [TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(context, 'Cancel', 'বাতিল'))), FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(tr(context, 'Send', 'পাঠান')))]));
    if (ok != true) return;
    try {
      await ref.read(dioProvider).post('/me/mentor-application', data: {'roleTitle': title.text, 'industry': industry.text, 'yearsExperience': double.tryParse(years.text) ?? 0});
      ref.invalidate(meProvider);
      if (context.mounted) toast(context, tr(context, 'Sent to admin for review', 'অ্যাডমিনের কাছে পাঠানো হয়েছে'));
    } catch (e) { if (context.mounted) toast(context, errorText(e)); }
  }
}

class _CompanyTile extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final org = ref.watch(myOrgProvider).valueOrNull?['organization'] as Map?;
    return AppCard(padding: const EdgeInsets.all(6), child: ListTile(
      leading: const Icon(Icons.business_outlined, color: Brand.delta),
      title: Text(org == null ? tr(context, 'Register your company (recruiters)', 'কোম্পানি নিবন্ধন করুন (রিক্রুটার)') : '${org['name']} · ${org['verificationStatus']}', style: body(17, w: FontWeight.w700)),
      trailing: org == null ? const Icon(Icons.chevron_right) : null,
      onTap: org == null ? () => registerCompany(context, ref) : null,
    ));
  }
}
