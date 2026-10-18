import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/providers.dart';
import '../l10n/app_localizations.dart';
import 'admin.dart';
import 'mentor.dart';
import 'student.dart';
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
    final t = AppLocalizations.of(context);
    final me = ref.watch(meProvider);
    return AsyncBody(value: me, onRetry: () => ref.invalidate(meProvider), builder: (u) {
      if (u == null || u['needsProfile'] == true) return const Scaffold(body: Center(child: CircularProgressIndicator()));
      final role = u['role'] as String;
      final tabs = _tabs(role, t);
      i = i.clamp(0, tabs.length - 1);
      return Scaffold(
        appBar: AppBar(title: Text(tabs[i].label), actions: [
          IconButton(icon: const Icon(Icons.map_outlined), tooltip: t.campusMap, onPressed: role == 'employer' ? null : () => context.push('/university-map')),
          IconButton(icon: const Icon(Icons.logout), tooltip: t.signOut, onPressed: () => FirebaseAuth.instance.signOut()),
        ]),
        body: tabs[i].body,
        bottomNavigationBar: tabs.length < 2 ? null : NavigationBar(selectedIndex: i, onDestinationSelected: (v) => setState(() => i = v), destinations: [for (final x in tabs) NavigationDestination(icon: Icon(x.icon), label: x.label)]),
      );
    });
  }

  List<_Tab> _tabs(String role, AppLocalizations t) {
    switch (role) {
      case 'student':
        return [_Tab(t.home, Icons.home_outlined, const StudentHome()), _Tab(t.mentors, Icons.groups_outlined, const MentorMatches()), _Tab(t.plan, Icons.checklist, const PlanScreen()), _Tab(t.jobs, Icons.work_outline, const OpportunitiesScreen()), _Tab(t.more, Icons.more_horiz, const MoreScreen())];
      case 'mentor':
        return [_Tab(t.requests, Icons.inbox_outlined, const MentorRequests()), _Tab(t.more, Icons.more_horiz, const MoreScreen())];
      case 'admin':
        return [_Tab(t.queue, Icons.verified_outlined, const AdminQueue()), _Tab(t.more, Icons.more_horiz, const MoreScreen())];
      case 'department':
        return [_Tab(t.overview, Icons.insights_outlined, const DeptOverview()), _Tab(t.more, Icons.more_horiz, const MoreScreen())];
      default:
        return [_Tab(t.more, Icons.more_horiz, const MoreScreen())]; // employer: Phase 2 portal
    }
  }
}
class _Tab { _Tab(this.label, this.icon, this.body); final String label; final IconData icon; final Widget body; }

class MoreScreen extends ConsumerWidget {
  const MoreScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context);
    final u = ref.watch(meProvider).valueOrNull ?? {};
    return ListView(padding: const EdgeInsets.all(16), children: [
      Card(child: ListTile(title: Text(u['displayName'] ?? ''), subtitle: Text('${u['role']} · ${(u['university'] ?? {})['name'] ?? ''}'))),
      if (u['role'] != 'employer') ListTile(leading: const Icon(Icons.map_outlined), title: Text(t.campusMap), onTap: () => context.push('/university-map')),
      SwitchListTile(title: Text(t.showInDirectory), value: u['showInDirectory'] == true, onChanged: (v) async {
        await ref.read(dioProvider).patch('/me/privacy', data: {'showInDirectory': v});
        ref.invalidate(meProvider);
      }),
      ListTile(leading: const Icon(Icons.language), title: Text(t.language), trailing: SegmentedButton<String>(
        segments: const [ButtonSegment(value: 'bn', label: Text('বাং')), ButtonSegment(value: 'en', label: Text('EN'))],
        selected: {ref.watch(localeProvider)}, onSelectionChanged: (s) => ref.read(localeProvider.notifier).state = s.first)),
      Padding(padding: const EdgeInsets.all(8), child: Text(t.privacyNote, style: const TextStyle(fontSize: 12))),
    ]);
  }
}
