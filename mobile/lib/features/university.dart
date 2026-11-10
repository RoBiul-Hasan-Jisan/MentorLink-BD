import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// PRIVACY: this screen never asks for device location and has no location permission.
// Each pin is a university CAMPUS. People are listed under their campus, not at a personal position.
class UniversityMapScreen extends ConsumerStatefulWidget {
  const UniversityMapScreen({super.key});
  @override
  ConsumerState<UniversityMapScreen> createState() => _UniversityMapScreenState();
}

class _UniversityMapScreenState extends ConsumerState<UniversityMapScreen> {
  String _q = '';
  @override
  Widget build(BuildContext context) {
    // Low-data mode (saved on the server, read from /me): no map and no map-tile downloads, just the searchable directory list.
    final low = ref.watch(meProvider).valueOrNull?['lowDataMode'] == true;
    return Scaffold(body: AsyncBody(value: ref.watch(dirUniversitiesProvider), onRetry: () => ref.invalidate(dirUniversitiesProvider), builder: (d) {
      final all = (d['universities'] as List).cast<Map>();
      final needle = _q.trim().toLowerCase();
      final unis = needle.isEmpty ? all : all.where((u) => '${u['name']} ${u['shortName'] ?? ''} ${u['city']}'.toLowerCase().contains(needle)).toList();
      return Column(children: [
        GreenHeader(radius: 32, bottomPad: 22, child: Row(children: [
          BackCircle(dark: true, onTap: () => context.pop()), const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(tr(context, 'University map', 'বিশ্ববিদ্যালয় মানচিত্র'), style: display(24, color: Colors.white)), Text(tr(context, 'Campuses, not people', 'ক্যাম্পাস, মানুষ নয়'), style: body(14, color: Colors.white70))])),
        ])),
        if (low) Padding(padding: const EdgeInsets.fromLTRB(12, 12, 12, 0), child: Text(tr(context, 'Low-data mode is on: the map is hidden to save data. Turn it off in Profile to see the map.', 'লো-ডেটা মোড চালু: ডেটা বাঁচাতে মানচিত্র লুকানো আছে। মানচিত্র দেখতে প্রোফাইল থেকে বন্ধ করুন।'), style: body(14, color: Brand.muted))),
        Padding(padding: const EdgeInsets.fromLTRB(12, 10, 12, 0), child: TextField(
          onChanged: (v) => setState(() => _q = v),
          decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: tr(context, 'Search university or city', 'বিশ্ববিদ্যালয় বা শহর খুঁজুন'), isDense: true),
        )),
        if (!low) Expanded(flex: 3, child: FlutterMap(
          options: const MapOptions(initialCenter: LatLng(23.6850, 90.3563), initialZoom: 6.5),
          children: [
            TileLayer(urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', userAgentPackageName: 'bd.mentorlink.app'),
            // Required by the OpenStreetMap tile licence (ODbL): visible credit for the map data.
            const RichAttributionWidget(attributions: [TextSourceAttribution('© OpenStreetMap contributors')]),
            MarkerLayer(markers: [for (final u in unis) Marker(
              point: LatLng((u['campus']['lat'] as num).toDouble(), (u['campus']['lng'] as num).toDouble()), width: 48, height: 48,
              child: GestureDetector(onTap: () => context.push('/university/${u['id']}'), child: Icon(Icons.location_on, color: Brand.delta, size: 40)))]),
          ],
        )),
        Expanded(flex: low ? 1 : 2, child: ListView(padding: const EdgeInsets.all(12), children: [
          if (unis.isEmpty) AppCard(child: Text(tr(context, 'No university matches your search.', 'আপনার খোঁজের সাথে কোনো বিশ্ববিদ্যালয় মেলেনি।'), style: body(15, color: Brand.muted))),
          AppCard(color: Brand.lightGreen, border: Colors.transparent, padding: const EdgeInsets.all(12), child: Row(children: [Icon(Icons.lock_outline, color: Brand.forest, size: 20), const SizedBox(width: 10), Expanded(child: Text(tr(context, 'People appear at their university campus. We never track personal location.', 'সবাইকে তার বিশ্ববিদ্যালয়ের ক্যাম্পাসে দেখানো হয়। আমরা ব্যক্তিগত অবস্থান ট্র্যাক করি না।'), style: body(14, color: Brand.forest)))])),
          for (final u in unis) AppCard(padding: const EdgeInsets.all(14), onTap: () => context.push('/university/${u['id']}'), child: Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(u['name'], style: display(17, color: Brand.ink)), Text('${u['city']} · ${u['students']} ${tr(context, 'students', 'শিক্ষার্থী')} · ${u['mentors']} ${tr(context, 'mentors', 'মেন্টর')}', style: body(14, color: Brand.muted))])),
            const Icon(Icons.chevron_right),
          ])),
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
    return Scaffold(body: AsyncBody(value: ref.watch(membersProvider(id)), builder: (d) => ListView(padding: EdgeInsets.zero, children: [
      GreenHeader(radius: 32, bottomPad: 24, child: Row(children: [
        BackCircle(dark: true, onTap: () => context.pop()), const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(d['university']['name'], style: display(22, color: Colors.white)), Text(tr(context, 'Verified members who opted in', 'যাচাইকৃত ও সম্মতিদাতা সদস্য'), style: body(14, color: Colors.white70))])),
      ])),
      Padding(padding: const EdgeInsets.all(16), child: Column(children: [
        if ((d['members'] as List).isEmpty) AppCard(child: Text(tr(context, 'No members to show yet.', 'এখনও কোনো সদস্য নেই।'), style: body(16))),
        for (final m in d['members'] as List) AppCard(padding: const EdgeInsets.all(14), child: Row(children: [
          Avatar(m['name'], size: 46, bg: m['role'] == 'mentor' ? Brand.lightSaffron : Brand.lightGreen, fg: Brand.forest), const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(m['name'], style: display(18, color: Brand.ink)), Text('${m['department'] ?? ''} ${m['batchYear'] ?? ''}', style: body(14, color: Brand.muted))])),
          Pill(m['role'], tone: m['role'] == 'mentor' ? Tone.saffron : Tone.green),
        ])),
      ])),
    ])));
  }
}
