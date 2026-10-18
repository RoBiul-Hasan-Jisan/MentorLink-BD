import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../l10n/app_localizations.dart';
import 'widgets.dart';

// PRIVACY: this screen never asks for device location and has no location permission.
// Each pin is a university CAMPUS. People are listed under their campus, not at a personal position.
class UniversityMapScreen extends ConsumerWidget {
  const UniversityMapScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context);
    return Scaffold(appBar: AppBar(title: Text(t.campusMap)), body: AsyncBody(value: ref.watch(dirUniversitiesProvider), onRetry: () => ref.invalidate(dirUniversitiesProvider), builder: (d) {
      final unis = (d['universities'] as List).cast<Map<String, dynamic>>();
      return Column(children: [
        Expanded(flex: 3, child: FlutterMap(
          options: const MapOptions(initialCenter: LatLng(23.6850, 90.3563), initialZoom: 6.5),
          children: [
            TileLayer(urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', userAgentPackageName: 'bd.mentorlink.app'),
            MarkerLayer(markers: [for (final u in unis) Marker(
              point: LatLng((u['campus']['lat'] as num).toDouble(), (u['campus']['lng'] as num).toDouble()), width: 48, height: 48,
              child: GestureDetector(onTap: () => context.push('/university/${u['id']}'), child: const Icon(Icons.location_on, color: Brand.delta, size: 40)))]),
          ],
        )),
        Expanded(flex: 2, child: ListView(padding: const EdgeInsets.all(12), children: [
          Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(t.privacyNote, style: const TextStyle(fontSize: 12, color: Brand.muted))),
          for (final u in unis) Card(child: ListTile(title: Text(u['name']), subtitle: Text('${u['city']} · ${u['students']} students · ${u['mentors']} mentors'), trailing: const Icon(Icons.chevron_right), onTap: () => context.push('/university/${u['id']}'))),
        ])),
      ]);
    }));
  }
}

class UniversityMembersScreen extends ConsumerWidget {
  const UniversityMembersScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = AppLocalizations.of(context);
    return Scaffold(appBar: AppBar(title: Text(t.directory)), body: AsyncBody(value: ref.watch(membersProvider(id)), builder: (d) => ListView(padding: const EdgeInsets.all(16), children: [
      Text(d['university']['name'], style: Theme.of(context).textTheme.titleLarge),
      Text(t.privacyNote, style: const TextStyle(fontSize: 12, color: Brand.muted)),
      for (final m in d['members'] as List) Card(child: ListTile(leading: CircleAvatar(child: Text((m['name'] as String).isEmpty ? '?' : (m['name'] as String)[0])), title: Text(m['name']), subtitle: Text('${m['role']} · ${m['department'] ?? ''} ${m['batchYear'] ?? ''}'))),
    ])));
  }
}
