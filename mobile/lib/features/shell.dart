import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'admin.dart';
import 'home.dart';
import 'jobs.dart';
import 'mentor.dart';
import 'mentors.dart';
import 'plan.dart';
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
        return [
          (Icons.home_outlined, tr(context, 'Home', 'হোম'), StudentHome(onTab: (v) => setState(() => i = v))),
          (Icons.groups_outlined, tr(context, 'Mentors', 'মেন্টর'), const MentorMatches()),
          (Icons.checklist, tr(context, 'Plan', 'পরিকল্পনা'), const PlanScreen()),
          (Icons.work_outline, tr(context, 'Jobs', 'চাকরি'), const OpportunitiesScreen()),
          profile,
        ];
      case 'mentor':
        return [(Icons.inbox_outlined, tr(context, 'Requests', 'অনুরোধ'), const MentorRequests()), profile];
      case 'admin':
        return [(Icons.verified_outlined, tr(context, 'Queue', 'তালিকা'), const AdminQueue()), profile];
      case 'department':
        return [(Icons.insights_outlined, tr(context, 'Overview', 'সারসংক্ষেপ'), const DeptOverview()), profile];
      default:
        return [profile]; // employer: Phase 2 portal
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
          SwitchListTile(activeColor: Brand.delta, title: Text(tr(context, 'Show me in my university directory', 'আমার বিশ্ববিদ্যালয়ের ডিরেক্টরিতে দেখান'), style: body(16, w: FontWeight.w600)), value: u['showInDirectory'] == true, onChanged: (v) async { await ref.read(dioProvider).patch('/me/privacy', data: {'showInDirectory': v}); ref.invalidate(meProvider); }),
          ListTile(leading: const Icon(Icons.language, color: Brand.delta), title: Text(tr(context, 'Language', 'ভাষা'), style: body(16, w: FontWeight.w600)), trailing: SegmentedButton<String>(showSelectedIcon: false, segments: const [ButtonSegment(value: 'bn', label: Text('বাং')), ButtonSegment(value: 'en', label: Text('EN'))], selected: {ref.watch(localeProvider)}, onSelectionChanged: (s) => ref.read(localeProvider.notifier).state = s.first)),
        ])),
        if (isStudent) AppCard(padding: const EdgeInsets.all(6), child: ListTile(leading: const Icon(Icons.workspace_premium_outlined, color: Brand.delta), title: Text(pending ? tr(context, 'Mentor application pending', 'মেন্টর আবেদন অপেক্ষমাণ') : tr(context, 'Become a mentor', 'মেন্টর হন'), style: body(17, w: FontWeight.w700)), trailing: pending ? null : const Icon(Icons.chevron_right), onTap: pending ? null : () => _apply(context, ref))),
        AppCard(color: Brand.lightGreen, border: Colors.transparent, child: Row(children: [const Icon(Icons.lock_outline, color: Brand.forest), const SizedBox(width: 12), Expanded(child: Text(tr(context, 'People appear at their university campus. We never track personal location.', 'সবাইকে তার বিশ্ববিদ্যালয়ের ক্যাম্পাসে দেখানো হয়। আমরা ব্যক্তিগত অবস্থান ট্র্যাক করি না।'), style: body(15, color: Brand.forest)))])),
        BigButton(tr(context, 'Sign out', 'সাইন আউট'), outlined: true, onPressed: () => FirebaseAuth.instance.signOut()),
      ])),
    ]);
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
