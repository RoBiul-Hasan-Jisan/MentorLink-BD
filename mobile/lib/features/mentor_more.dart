import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import '../core/upload.dart';
import 'mentor.dart';
import 'widgets.dart';
import 'slot_grid.dart';

final mentorMoreSkillsProvider = FutureProvider.autoDispose<List<Map>>((ref) async => ((await getJson(ref, '/skills'))['skills'] as List).whereType<Map>().toList());
final mentorMoreOppsProvider = FutureProvider.autoDispose<List<Map>>((ref) async => ((await getJson(ref, '/opportunities'))['opportunities'] as List).whereType<Map>().toList());

String _dateText(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

InputDecoration _dec(String label) => InputDecoration(
      labelText: label,
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
    );

Widget _header(BuildContext context, String title, String sub, {bool back = true}) => GreenHeader(radius: 36, bottomPad: 26, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (back) ...[BackCircle(dark: true, onTap: () => context.pop()), const SizedBox(height: 12)],
      Text(title, style: display(28, color: Colors.white)),
      if (sub.isNotEmpty) Text(sub, style: body(15, color: Colors.white70)),
    ]));

// ---------------- tab body: live jobs (read only) ----------------
// Mentors cannot post jobs. Only company recruiters (employer accounts) can; mentors can see what is live to guide their mentees.
class MentorOpportunities extends ConsumerWidget {
  const MentorOpportunities({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AsyncBody(
      value: ref.watch(mentorMoreOppsProvider),
      onRetry: () => ref.invalidate(mentorMoreOppsProvider),
      builder: (d) {
        final all = (d as List).cast<Map>();
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(mentorMoreOppsProvider),
          child: ListView(padding: EdgeInsets.zero, children: [
            _header(context, tr(context, 'Opportunities', 'সুযোগ'), tr(context, 'Live jobs from verified companies', 'যাচাই করা কোম্পানির চলমান চাকরি'), back: false),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              AppCard(color: Brand.lightSaffron, child: Text(
                tr(context, 'Only company recruiters can post jobs. You can read the live jobs below to guide your mentees.', 'শুধু কোম্পানির রিক্রুটাররা চাকরি পোস্ট করতে পারেন। মেন্টিদের গাইড করতে নিচের চলমান চাকরিগুলো দেখুন।'),
                style: body(14),
              )),
              const SizedBox(height: 12),
              if (all.isEmpty) Text(tr(context, 'No live jobs right now.', 'এখন কোনো চলমান চাকরি নেই।'), style: body(16, color: Brand.muted)),
              for (final o in all) AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text('${o['title'] ?? ''}', style: display(18, color: Brand.ink))),
                  Pill(tr(context, 'Live', 'চলমান'), tone: Tone.green),
                ]),
                const SizedBox(height: 4),
                Text('${o['organization'] ?? ''} · ${o['type'] ?? ''}', style: body(15, color: Brand.muted)),
              ])),
              const SizedBox(height: 24),
            ])),
          ]),
        );
      },
    );
  }
}

// ---------------- tab body: your impact ----------------
class MentorImpactScreen extends ConsumerWidget {
  const MentorImpactScreen({super.key});

  Future<void> _certificate(BuildContext context, WidgetRef ref) async {
    try {
      final res = await ref.read(dioProvider).get('/me/impact/certificate');
      final data = res.data;
      final c = (data is Map && data['certificate'] is Map) ? data['certificate'] as Map : <dynamic, dynamic>{};
      final text = 'MentorLink BD\n${c['name'] ?? ''}\n${c['sessions'] ?? 0} sessions\nID: ${c['id'] ?? ''}\n${c['text'] ?? ''}';
      if (!context.mounted) return;
      await showDialog<void>(context: context, builder: (ctx) => AlertDialog(
        title: Text(tr(ctx, 'Certificate', 'সনদ')),
        content: SingleChildScrollView(child: SelectableText(text, style: body(16))),
        actions: [
          TextButton(onPressed: () async {
            await Clipboard.setData(ClipboardData(text: text));
            if (ctx.mounted) toast(ctx, tr(ctx, 'Copied.', 'কপি হয়েছে।'));
          }, child: Text(tr(ctx, 'Copy', 'কপি'))),
          TextButton(onPressed: () => Navigator.of(ctx).pop(), child: Text(tr(ctx, 'Close', 'বন্ধ'))),
        ],
      ));
    } catch (e) {
      if (context.mounted) toast(context, errorText(e));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AsyncBody(
      value: ref.watch(mentorImpactProvider),
      onRetry: () => ref.invalidate(mentorImpactProvider),
      builder: (v) {
        final sessions = ((v['sessionsHeld'] as num?) ?? 0).toInt();
        final students = ((v['studentsHelped'] as num?) ?? 0).toInt();
        final hours = (v['hoursGiven'] as num?) ?? 0;
        final rating = ((v['avgRating'] as num?) ?? 0).toDouble();
        final ratingCount = ((v['ratingCount'] as num?) ?? 0).toInt();
        final trusted = v['trustedMentor'] == true;
        final progress = (v['progress'] is List) ? (v['progress'] as List).whereType<Map>().toList() : <Map>[];
        final outcomes = v['outcomes'] is Map ? v['outcomes'] as Map : <dynamic, dynamic>{};
        Widget stat(String n, String label) => Expanded(child: Column(children: [Text(n, style: display(28, color: Brand.forest)), Text(label, style: body(13, color: Brand.muted), textAlign: TextAlign.center)]));
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(mentorImpactProvider),
          child: ListView(padding: EdgeInsets.zero, children: [
            _header(context, tr(context, 'Your impact', 'আপনার প্রভাব'), '', back: false),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (trusted) Padding(padding: const EdgeInsets.only(bottom: 12), child: Align(alignment: Alignment.centerLeft, child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(color: Brand.saffron, borderRadius: BorderRadius.circular(20)),
                child: Text(tr(context, 'Trusted Mentor', 'বিশ্বস্ত মেন্টর'), style: body(14, color: Brand.ink, w: FontWeight.w800)),
              ))),
              AppCard(child: Column(children: [
                Row(children: [
                  stat('$sessions', tr(context, 'sessions held', 'সেশন সম্পন্ন')),
                  stat('$students', tr(context, 'students helped', 'শিক্ষার্থী সহায়তা')),
                ]),
                const SizedBox(height: 14),
                Row(children: [
                  stat('$hours', tr(context, 'hours given', 'ঘণ্টা দিয়েছেন')),
                  stat(ratingCount == 0 ? '—' : rating.toStringAsFixed(1), tr(context, 'average rating', 'গড় রেটিং')),
                ]),
              ])),
              Text(tr(context, 'Student progress (shared with consent)', 'শিক্ষার্থীর অগ্রগতি (সম্মতিতে শেয়ার করা)'), style: display(19, color: Brand.ink)),
              const SizedBox(height: 8),
              if (progress.isEmpty) Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(tr(context, 'No student has shared progress yet.', 'এখনো কেউ অগ্রগতি শেয়ার করেননি।'), style: body(15, color: Brand.muted))),
              for (final p in progress) AppCard(padding: const EdgeInsets.all(14), child: Row(children: [
                Avatar('${p['name'] ?? ''}', size: 40),
                const SizedBox(width: 12),
                Expanded(child: Text('${p['name'] ?? ''}', style: body(16, w: FontWeight.w700))),
                Text(p['gain'] is num ? '${(p['gain'] as num) >= 0 ? '+' : ''}${(p['gain'] as num).round()}%' : '—', style: display(20, color: Brand.forest)),
              ])),
              AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(tr(context, 'Outcomes', 'ফলাফল'), style: display(19, color: Brand.ink)),
                const SizedBox(height: 8),
                Row(children: [
                  stat('${(outcomes['interviews'] as num?) ?? 0}', tr(context, 'interviews', 'ইন্টারভিউ')),
                  stat('${(outcomes['shortlisted'] as num?) ?? 0}', tr(context, 'shortlisted', 'শর্টলিস্ট')),
                  stat('${(outcomes['offers'] as num?) ?? 0}', tr(context, 'offers', 'অফার')),
                ]),
                const SizedBox(height: 8),
                Text(tr(context, 'Outcomes are self-reported by students who agreed to share. They do not prove that mentoring caused them.', 'ফলাফল শিক্ষার্থীরা নিজে জানিয়েছেন, যাঁরা শেয়ার করতে রাজি। এটি প্রমাণ করে না যে মেন্টরিংই কারণ।'), style: body(13, color: Brand.muted)),
              ])),
              const SizedBox(height: 4),
              BigButton(tr(context, 'Download certificate', 'সনদ ডাউনলোড'), onPressed: () => _certificate(context, ref)),
              const SizedBox(height: 24),
            ])),
          ]),
        );
      },
    );
  }
}

// ---------------- set up your mentoring ----------------
class MentorSetupScreen extends ConsumerStatefulWidget {
  const MentorSetupScreen({super.key});
  @override
  ConsumerState<MentorSetupScreen> createState() => _MentorSetupScreenState();
}

class _MentorSetupScreenState extends ConsumerState<MentorSetupScreen> {
  final Map<String, int> _levels = <String, int>{};
  final Set<String> _langs = <String>{'bn', 'en'};
  final Set<String> _slots = <String>{};
  final TextEditingController _role = TextEditingController();
  final TextEditingController _industry = TextEditingController();
  final TextEditingController _years = TextEditingController();
  int _capacity = 3;
  bool _loading = true;
  bool _busy = false;
  bool _proofSent = false;


  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _role.dispose();
    _industry.dispose();
    _years.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final dio = ref.read(dioProvider);
    try {
      final me = ref.read(meProvider).valueOrNull;
      if (me != null && me['role'] == 'mentor') {
        final res = await dio.get('/me/mentor-profile');
        final data = res.data;
        final p = (data is Map && data['profile'] is Map) ? data['profile'] as Map : null;
        if (p != null) {
          _role.text = '${p['roleTitle'] ?? ''}';
          _industry.text = '${p['industry'] ?? ''}';
          _years.text = p['yearsExperience'] is num ? '${(p['yearsExperience'] as num).round()}' : '';
          _capacity = ((p['weeklyCapacity'] as num?) ?? 3).toInt();
          if (p['expertiseSkills'] is List) {
            for (final e in (p['expertiseSkills'] as List).whereType<Map>()) {
              final lv = (e['level'] as num?)?.toInt();
              if (lv != null) _levels['${e['skillKey']}'] = lv;
            }
          }
          if (p['languages'] is List) {
            _langs
              ..clear()
              ..addAll((p['languages'] as List).map((x) => '$x'));
          }
          if (p['availableSlots'] is List) _slots.addAll((p['availableSlots'] as List).map((x) => '$x'));
        }
      }
      final docs = await dio.get('/me/verification-docs');
      final dd = docs.data;
      if (dd is Map && dd['docs'] is List) {
        _proofSent = (dd['docs'] as List).whereType<Map>().any((x) => x['kind'] == 'graduation_proof');
      }
    } catch (_) {
      // The form still works with defaults.
    }
    if (mounted) setState(() => _loading = false);
  }

  String _levelName(BuildContext context, int l) => l == 1 ? tr(context, 'Beginner', 'শিক্ষানবিশ') : l == 2 ? tr(context, 'Working', 'কাজ চালানোর মতো') : tr(context, 'Strong', 'দক্ষ');

  Future<void> _submit(bool isMentor) async {
    final role = _role.text.trim();
    final industry = _industry.text.trim();
    final years = double.tryParse(_years.text.trim());
    if (role.length < 2 || industry.length < 2 || years == null || years < 0) {
      toast(context, tr(context, 'Fill your role, industry and years of experience.', 'আপনার পদ, ইন্ডাস্ট্রি ও অভিজ্ঞতার বছর দিন।'));
      return;
    }
    setState(() => _busy = true);
    try {
      if (isMentor) {
        await ref.read(dioProvider).put('/me/mentor-profile', data: {
          'roleTitle': role,
          'industry': industry,
          'yearsExperience': years,
          'expertiseSkills': [for (final e in _levels.entries) {'skillKey': e.key, 'level': e.value}],
          'languages': _langs.toList(),
          'weeklyCapacity': _capacity,
          'availableSlots': _slots.toList(),
        });
        ref.invalidate(mentorHomeProfileProvider);
        if (!mounted) return;
        toast(context, tr(context, 'Saved.', 'সংরক্ষিত হয়েছে।'));
      } else {
        await ref.read(dioProvider).post('/me/mentor-application', data: {
          'roleTitle': role,
          'industry': industry,
          'yearsExperience': years,
        });
        if (!mounted) return;
        toast(context, tr(context, 'Sent for verification. An admin reviews it, usually within 48 hours.', 'যাচাইয়ের জন্য পাঠানো হয়েছে। অ্যাডমিন সাধারণত ৪৮ ঘণ্টার মধ্যে দেখবেন।'));
      }
      context.pop();
    } catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        toast(context, errorText(e));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isMentor = ref.watch(meProvider).valueOrNull?['role'] == 'mentor';
    final skills = ref.watch(mentorMoreSkillsProvider).valueOrNull ?? <Map>[];
    return Scaffold(
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(padding: EdgeInsets.zero, children: [
              _header(context, tr(context, 'Set up your mentoring', 'আপনার মেন্টরিং সেটআপ'), tr(context, 'Students are matched to your real strengths and time.', 'আপনার প্রকৃত দক্ষতা ও সময় অনুযায়ী শিক্ষার্থী মেলানো হয়।')),
              Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                TextField(controller: _role, decoration: _dec(tr(context, 'Your role title', 'আপনার পদবি')), maxLength: 80),
                const SizedBox(height: 8),
                TextField(controller: _industry, decoration: _dec(tr(context, 'Industry', 'ইন্ডাস্ট্রি')), maxLength: 80),
                const SizedBox(height: 8),
                TextField(controller: _years, decoration: _dec(tr(context, 'Years of experience', 'অভিজ্ঞতার বছর')), keyboardType: TextInputType.number),
                const SizedBox(height: 18),
                if (isMentor) ...[
                  Text(tr(context, 'Your strengths', 'আপনার দক্ষতা'), style: display(19, color: Brand.ink)),
                  const SizedBox(height: 8),
                  for (final s in skills) _skillLevelRow(context, s),
                  const SizedBox(height: 14),
                  AppCard(child: Row(children: [
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(tr(context, 'Mentees per week', 'সপ্তাহে মেন্টি'), style: display(18, color: Brand.ink)),
                      Text(tr(context, 'Pauses automatically at your limit', 'সীমায় পৌঁছালে নিজে থেকেই বন্ধ হয়'), style: body(13, color: Brand.muted)),
                    ])),
                    IconButton(constraints: const BoxConstraints(minWidth: 48, minHeight: 48), onPressed: _capacity > 0 ? () => setState(() => _capacity--) : null, icon: const Icon(Icons.remove_circle_outline)),
                    Text('$_capacity', style: display(24, color: Brand.forest)),
                    IconButton(constraints: const BoxConstraints(minWidth: 48, minHeight: 48), onPressed: _capacity < 20 ? () => setState(() => _capacity++) : null, icon: const Icon(Icons.add_circle_outline)),
                  ])),
                  Text(tr(context, 'Languages and weekly slots', 'ভাষা ও সাপ্তাহিক সময়'), style: display(19, color: Brand.ink)),
                  const SizedBox(height: 8),
                  Wrap(spacing: 8, runSpacing: 8, children: [
                    FilterChip(label: const Text('বাংলা'), selected: _langs.contains('bn'), onSelected: (v) => setState(() => v ? _langs.add('bn') : _langs.remove('bn'))),
                    FilterChip(label: const Text('English'), selected: _langs.contains('en'), onSelected: (v) => setState(() => v ? _langs.add('en') : _langs.remove('en'))),
                  ]),
                  const SizedBox(height: 10),
                  SlotGrid(selected: _slots, onChanged: (v) => setState(() { _slots..clear()..addAll(v); }), max: 14),
                  const SizedBox(height: 18),
                ],
                AppCard(child: Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(tr(context, 'Graduation proof', 'স্নাতকের প্রমাণ'), style: display(18, color: Brand.ink)),
                    Text(_proofSent ? tr(context, 'A file is uploaded.', 'ফাইল আপলোড হয়েছে।') : tr(context, 'Certificate or transcript photo.', 'সনদ বা ট্রান্সক্রিপ্টের ছবি।'), style: body(14, color: Brand.muted)),
                  ])),
                  if (_proofSent) Padding(padding: const EdgeInsets.only(right: 8), child: Pill(tr(context, 'Sent', 'পাঠানো'), tone: Tone.green)),
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(minimumSize: const Size(0, 48)),
                    onPressed: () async {
                      final ok = await pickAndUploadDoc(context, ref, 'graduation_proof');
                      if (ok && mounted) setState(() => _proofSent = true);
                    },
                    child: Text(_proofSent ? tr(context, 'Replace', 'বদলান') : tr(context, 'Upload', 'আপলোড')),
                  ),
                ])),
                Text(tr(context, 'Company email is optional. An admin reviews your proof, usually within 48 hours. Rejected files are deleted automatically.', 'কোম্পানির ইমেইল ঐচ্ছিক। অ্যাডমিন সাধারণত ৪৮ ঘণ্টার মধ্যে আপনার প্রমাণ দেখেন। বাতিল হলে ফাইল নিজে থেকেই মুছে যায়।'), style: body(14, color: Brand.muted)),
                const SizedBox(height: 16),
                BigButton(
                  _busy ? tr(context, 'Sending...', 'পাঠানো হচ্ছে...') : isMentor ? tr(context, 'Save setup', 'সেটআপ সংরক্ষণ') : tr(context, 'Submit for verification', 'যাচাইয়ের জন্য জমা দিন'),
                  onPressed: _busy ? null : () => _submit(isMentor),
                ),
                const SizedBox(height: 24),
              ])),
            ]),
    );
  }

  Widget _skillLevelRow(BuildContext context, Map s) {
    final key = '${s['key']}';
    final cur = _levels[key];
    return Padding(padding: const EdgeInsets.only(bottom: 8), child: AppCard(margin: EdgeInsets.zero, padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(nm(context, s, 'nameEn', 'nameBn'), style: body(16, w: FontWeight.w700)),
      const SizedBox(height: 6),
      Wrap(spacing: 8, runSpacing: 4, children: [
        for (int l = 1; l <= 3; l++) ChoiceChip(
          label: Text(_levelName(context, l)),
          selected: cur == l,
          onSelected: (sel) {
            if (sel && cur == null && _levels.length >= 15) {
              toast(context, tr(context, 'You can pick up to 15 skills.', 'সর্বোচ্চ ১৫টি দক্ষতা বাছতে পারবেন।'));
              return;
            }
            setState(() {
              if (sel) {
                _levels[key] = l;
              } else {
                _levels.remove(key);
              }
            });
          },
        ),
      ]),
    ])));
  }
}

// ---------------- request detail route (loads the request when no extra is passed) ----------------
class _MentorRequestLoader extends ConsumerWidget {
  const _MentorRequestLoader({required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final v = ref.watch(requestsProvider);
    return v.when(
      data: (d) {
        final list = (d['requests'] as List).whereType<Map>().toList();
        final found = list.where((r) => '${r['_id']}' == id).toList();
        if (found.isEmpty) {
          return Scaffold(body: Center(child: Text(tr(context, 'Request not found.', 'অনুরোধ পাওয়া যায়নি।'))));
        }
        return MentorRequestDetail(request: found.first);
      },
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(body: Center(child: Text(errorText(e)))),
    );
  }
}

final List<GoRoute> mentorMoreRoutes = [
  GoRoute(path: '/mentor/setup', builder: (context, state) => const MentorSetupScreen()),
  GoRoute(path: '/mentor/request/:id', builder: (context, state) {
    final extra = state.extra;
    if (extra is Map) return MentorRequestDetail(request: extra);
    return _MentorRequestLoader(id: state.pathParameters['id'] ?? '');
  }),
];
