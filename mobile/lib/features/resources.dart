import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// "Free resources": chosen for the student's gaps. Every link is free; the server only returns approved resources.
// Saving or completing a resource is private and never raises a skill level (levels come from a quiz, project or mentor).
final resourcesScreenListProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/resources'));
final resourcesScreenGapsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/readiness'));

class ResourcesScreen extends ConsumerStatefulWidget {
  const ResourcesScreen({super.key});
  @override
  ConsumerState<ResourcesScreen> createState() => _ResourcesScreenState();
}

class _ResourcesScreenState extends ConsumerState<ResourcesScreen> {
  String filter = 'all'; // all | bn | en | saved

  void _refresh() {
    ref.invalidate(resourcesScreenListProvider);
  }

  Future<void> _open(String url) async {
    bool ok = false;
    try {
      ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (_) {
      ok = false;
    }
    if (!ok && mounted) toast(context, tr(context, 'Could not open the link', 'লিংক খোলা যায়নি'));
  }

  Future<void> _setStatus(Map r, String? status) async {
    try {
      final dio = ref.read(dioProvider);
      if (status == null) {
        await dio.delete('/resources/${r['id']}/progress');
      } else {
        await dio.put('/resources/${r['id']}/progress', data: {'status': status});
      }
      _refresh();
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  Future<void> _report(Map r) async {
    final c = TextEditingController(text: tr(context, 'Link does not work', 'লিংক কাজ করছে না'));
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text(tr(context, 'Report this resource', 'রিসোর্সটি রিপোর্ট করুন')),
        content: TextField(controller: c, maxLength: 300, decoration: InputDecoration(labelText: tr(context, 'What is wrong?', 'সমস্যা কী?'))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(d, false), child: Text(tr(context, 'Cancel', 'বাতিল'))),
          FilledButton(onPressed: () => Navigator.pop(d, true), child: Text(tr(context, 'Send', 'পাঠান'))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(dioProvider).post('/resources/${r['id']}/report', data: {'reason': c.text.trim()});
      if (mounted) toast(context, tr(context, 'Thanks. We will check it.', 'ধন্যবাদ। আমরা দেখব।'));
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  Widget _row(Map r) {
    final status = r['status'] as String?;
    final lang = '${r['language'] ?? 'en'}';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        InkWell(
          onTap: () => _setStatus(r, status == 'completed' ? null : 'completed'),
          child: Padding(
            padding: const EdgeInsets.only(right: 10, top: 2),
            child: Icon(status == 'completed' ? Icons.check_circle : Icons.radio_button_unchecked, color: status == 'completed' ? Brand.delta : Brand.muted, size: 26),
          ),
        ),
        Expanded(
          child: InkWell(
            onTap: () => _open('${r['url']}'),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${r['title']}', style: body(16, w: FontWeight.w700)),
              const SizedBox(height: 4),
              Wrap(spacing: 6, runSpacing: 4, children: [
                Pill(lang == 'bn' ? 'বাংলা' : 'English', tone: lang == 'bn' ? Tone.green : Tone.blue),
                Pill('${r['kind'] ?? 'course'}', tone: Tone.grey),
                if (r['free'] == true) Pill(tr(context, 'Free', 'বিনামূল্যে'), tone: Tone.saffron),
                if (r['linkStatus'] == 'broken') Pill(tr(context, 'Link may be broken', 'লিংক নষ্ট হতে পারে'), tone: Tone.red),
                if (status == 'in_progress') Pill(tr(context, 'In progress', 'চলছে'), tone: Tone.saffron),
              ]),
            ]),
          ),
        ),
        PopupMenuButton<String>(
          icon: Icon(Icons.more_vert, color: Brand.muted),
          onSelected: (v) {
            if (v == 'save') _setStatus(r, status == 'saved' ? null : 'saved');
            if (v == 'progress') _setStatus(r, 'in_progress');
            if (v == 'report') _report(r);
          },
          itemBuilder: (_) => [
            PopupMenuItem<String>(value: 'save', child: Text(status == 'saved' ? tr(context, 'Remove from saved', 'সংরক্ষিত থেকে সরান') : tr(context, 'Save', 'সংরক্ষণ করুন'))),
            PopupMenuItem<String>(value: 'progress', child: Text(tr(context, 'Mark in progress', 'চলছে হিসেবে চিহ্নিত'))),
            PopupMenuItem<String>(value: 'report', child: Text(tr(context, 'Report a problem', 'সমস্যা জানান'))),
          ],
        ),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final gapsAsync = ref.watch(resourcesScreenGapsProvider);
    final gapMaps = <Map>[];
    final gv = gapsAsync.valueOrNull;
    if (gv != null && gv['gaps'] is List) gapMaps.addAll((gv['gaps'] as List).cast<Map>());
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(resourcesScreenListProvider),
        onRetry: _refresh,
        builder: (d) {
          final all = ((d['resources'] ?? []) as List).cast<Map>();
          final shown = all.where((r) {
            if (filter == 'bn') return r['language'] == 'bn';
            if (filter == 'en') return r['language'] == 'en';
            if (filter == 'saved') return r['status'] == 'saved' || r['status'] == 'in_progress';
            return true;
          }).toList();
          // Group by skill. Skills that are the student's gaps come first, in gap order, labelled "GAP n".
          final bySkill = <String, List<Map>>{};
          for (final r in shown) {
            bySkill.putIfAbsent('${r['skillKey']}', () => <Map>[]).add(r);
          }
          final order = <String>[];
          for (final g in gapMaps) {
            final k = '${g['skillKey']}';
            if (bySkill.containsKey(k)) order.add(k);
          }
          for (final k in bySkill.keys) {
            if (!order.contains(k)) order.add(k);
          }
          Map? gapOf(String k) {
            for (final g in gapMaps) {
              if ('${g['skillKey']}' == k) return g;
            }
            return null;
          }

          Widget chip(String key, String label) => Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(label: Text(label), selected: filter == key, onSelected: (_) => setState(() => filter = key)),
              );

          return ListView(padding: EdgeInsets.zero, children: [
            GreenHeader(
              radius: 36,
              bottomPad: 26,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                BackCircle(dark: true, onTap: () => context.pop()),
                const SizedBox(height: 12),
                Text(tr(context, 'Free resources', 'বিনামূল্যে রিসোর্স'), style: display(30, color: Colors.white)),
                Text(tr(context, 'Chosen for your gaps. Learn for free.', 'আপনার ঘাটতির জন্য বাছাই। বিনামূল্যে শিখুন।'), style: body(15, color: Colors.white70)),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(children: [
                  chip('all', tr(context, 'All', 'সব')),
                  chip('bn', 'বাংলা'),
                  chip('en', 'English'),
                  chip('saved', tr(context, 'Saved', 'সংরক্ষিত')),
                ]),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                if (order.isEmpty) AppCard(child: Text(tr(context, 'Nothing here yet.', 'এখানে এখনও কিছু নেই।'), style: body(16))),
                for (final k in order)
                  AppCard(
                    padding: const EdgeInsets.all(16),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(
                        gapOf(k) != null
                            ? '${tr(context, 'GAP', 'ঘাটতি')} ${gapMaps.indexOf(gapOf(k)!) + 1} · ${nm(context, gapOf(k)!, 'nameEn', 'nameBn').toUpperCase()}'
                            : k.toUpperCase(),
                        style: body(13, color: Brand.muted, w: FontWeight.w800),
                      ),
                      for (final r in bySkill[k]!) _row(r),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton(onPressed: () => context.push('/roadmap/$k'), child: Text(tr(context, 'Open roadmap', 'রোডম্যাপ খুলুন'))),
                      ),
                    ]),
                  ),
                Text(
                  tr(context, 'Every link is free. Marking a resource complete does not change your skill level: only a quiz, a project or a mentor can do that.',
                      'প্রতিটি লিংক বিনামূল্যে। রিসোর্স শেষ করলে স্কিল লেভেল বদলায় না: শুধু কুইজ, প্রজেক্ট বা মেন্টর তা করতে পারেন।'),
                  textAlign: TextAlign.center,
                  style: body(13, color: Brand.muted),
                ),
                const SizedBox(height: 20),
              ]),
            ),
          ]);
        },
      ),
    );
  }
}
