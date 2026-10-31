import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'decision_lab_logic.dart';
import 'widgets.dart';

// Career Decision Lab, the "decision cockpit": where do I stand, how do my alternative careers compare, what do I do next.
// Every number comes from GET /me/decision-lab or POST /me/decision-lab/simulate. Nothing is invented here:
// no fit score, no hiring chance, no salaries. A simulation is hypothetical and never becomes evidence.

const _accents = [Brand.delta, Color(0xFF9A6200), Color(0xFF1F4A8F)]; // one stable colour per compared role (all pass 4.5:1 with white text)
const _line = Color(0xFFE2E8E3);
const _track = Color(0xFFE3E9E5);
const _saffronText = Color(0xFF7A4A00);

/// Comma separated role keys the user asked to compare. Empty = the server default (my goal + the closest roles).
final labRolesProvider = StateProvider.autoDispose<String>((_) => '');
final labProvider = FutureProvider.autoDispose((ref) {
  final roles = ref.watch(labRolesProvider);
  return getJson(ref, '/me/decision-lab', q: roles.isEmpty ? null : {'roles': roles});
});

/// Restrained motion that is switched off when the device asks for reduced motion.
Duration _dur(BuildContext c, int ms) => MediaQuery.of(c).disableAnimations ? Duration.zero : Duration(milliseconds: ms);

bool _isBn(BuildContext c) => Localizations.localeOf(c).languageCode == 'bn';

String _lensName(BuildContext c, Lens l) => switch (l) {
      Lens.ready => tr(c, 'Ready Today', 'আজই প্রস্তুত'),
      Lens.fastest => tr(c, 'Fastest Learning Path', 'দ্রুততম শেখার পথ'),
      Lens.proven => tr(c, 'Strongest Demonstrated Readiness', 'সবচেয়ে শক্তিশালী প্রমাণিত প্রস্তুতি'),
    };

String _lensMeaning(BuildContext c, Lens l) => switch (l) {
      Lens.ready => tr(c, 'Ranks roles by your readiness score today: how much of each role\'s weighted skill requirements you already meet. Self-ratings count.',
          'আজকের প্রস্তুতি স্কোর অনুযায়ী সাজানো: প্রতিটি রোলের ভারযুক্ত দক্ষতার চাহিদার কতটা আপনি এখনই পূরণ করেন। নিজের দেওয়া রেটিংও গণ্য।'),
      Lens.fastest => tr(c, 'Ranks roles by the estimated learning hours still needed, fewest first. Weeks appear only when your weekly study hours are saved. It does not judge how hard the remaining skills are.',
          'বাকি আনুমানিক শেখার ঘণ্টা অনুযায়ী সাজানো, কম ঘণ্টা আগে। সাপ্তাহিক পড়ার ঘণ্টা সংরক্ষিত থাকলেই সপ্তাহ দেখানো হয়। বাকি দক্ষতাগুলো কতটা কঠিন তা এখানে ধরা হয়নি।'),
      Lens.proven => tr(c, 'Ranks roles by readiness backed only by quiz, project or endorsement evidence. Self-ratings count as zero.',
          'শুধু কুইজ, প্রজেক্ট বা এন্ডোর্সমেন্টে প্রমাণিত প্রস্তুতি অনুযায়ী সাজানো। নিজের দেওয়া রেটিং শূন্য ধরা হয়।'),
    };

String _evLabel(BuildContext c, String e) => e == 'verified' ? tr(c, 'proven', 'প্রমাণিত') : e == 'self' ? tr(c, 'self-rated only', 'শুধু নিজে দেওয়া') : tr(c, 'no evidence', 'প্রমাণ নেই');

String _skillName(BuildContext c, Map? s, String fallback) {
  if (s == null) return fallback;
  final v = nm(c, s, 'nameEn', 'nameBn');
  return v.isEmpty ? fallback : v;
}

class DecisionLabScreen extends ConsumerStatefulWidget {
  const DecisionLabScreen({super.key});
  @override
  ConsumerState<DecisionLabScreen> createState() => _DecisionLabState();
}

class _DecisionLabState extends ConsumerState<DecisionLabScreen> {
  Lens _lens = Lens.ready;
  String? _selectedKey; // the selected role, by KEY (list positions change whenever the ranking changes)
  final Map<String, int> _slots = {}; // role key -> colour slot, so a role keeps its colour when others change
  // Scenario state. It belongs to ONE role (_learnRole); changing the selected role discards it, adding a role does not.
  String? _learnRole;
  final Set<String> _learn = {};
  Map<String, dynamic>? _sim;
  int? _hoursChoice; // hypothetical study pace chosen on this screen; never saved to the profile
  bool _busy = false;
  int _simSeq = 0;

  void _syncSlots(List<String> keys) {
    _slots.removeWhere((k, _) => !keys.contains(k));
    for (final k in keys) {
      if (_slots.containsKey(k)) continue;
      final used = _slots.values.toSet();
      var s = 0;
      while (used.contains(s)) {
        s++;
      }
      _slots[k] = s;
    }
  }

  Color _color(String key) => _accents[(_slots[key] ?? 0) % _accents.length];

  String? _effectiveKey; // the key currently shown as selected (set in build)

  void _select(String key) {
    if (key == _effectiveKey) return; // tapping the selected role again must not throw away a scenario
    setState(() {
      _selectedKey = key;
      _learnRole = null;
      _learn.clear();
      _sim = null;
    });
  }

  void _setRoles(List<String> keys) => ref.read(labRolesProvider.notifier).state = keys.join(',');

  Future<void> _simulate(Map role) async {
    final roleKey = roleKeyOf(role);
    final skills = ((role['skills'] ?? []) as List).cast<Map>().where((s) => _learn.contains(s['skillKey'])).toList();
    if (skills.isEmpty) return;
    final seq = ++_simSeq;
    setState(() => _busy = true);
    try {
      final res = await ref.read(dioProvider).post('/me/decision-lab/simulate', data: {
        'roleKey': roleKey,
        'learn': [for (final s in skills) {'skillKey': s['skillKey'], 'level': s['required']}],
        if (_hoursChoice != null) 'weeklyHours': _hoursChoice, // scenario only; the saved profile is never touched
      });
      if (!mounted || seq != _simSeq) return;
      setState(() {
        _sim = Map<String, dynamic>.from(res.data as Map);
        _learnRole = roleKey;
      });
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    } finally {
      if (mounted && seq == _simSeq) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final value = ref.watch(labProvider);
    final data = value.valueOrNull; // while roles reload, the previous result stays on screen
    final failed = value.hasError && !value.isLoading;
    Widget content;
    if (failed) {
      content = _errorView(context, value.error ?? 'error');
    } else if (data == null) {
      content = Semantics(label: tr(context, 'Loading your career comparison', 'আপনার ক্যারিয়ার তুলনা লোড হচ্ছে'), child: const Center(child: CircularProgressIndicator()));
    } else {
      content = _content(context, data, value.isLoading);
    }
    return Scaffold(backgroundColor: Brand.paper, body: content);
  }

  Widget _header(BuildContext context) => GreenHeader(
        radius: 32,
        bottomPad: 22,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Semantics(button: true, label: tr(context, 'Back', 'পেছনে'), child: BackCircle(dark: true, onTap: () => context.pop())),
            const SizedBox(width: 12),
            Expanded(child: Semantics(header: true, child: Text(tr(context, 'Career Decision Lab', 'ক্যারিয়ার ডিসিশন ল্যাব'), style: display(24, color: Colors.white)))),
          ]),
          const SizedBox(height: 10),
          Text(tr(context, 'Where you stand, how your paths compare, and the one thing to do next.', 'আপনি কোথায় আছেন, পথগুলো কেমন তুলনীয়, আর এখন কোন একটি কাজ করবেন।'), style: body(14, color: Colors.white.withValues(alpha: .88))),
        ]),
      );

  Widget _errorView(BuildContext context, Object error) {
    final custom = ref.read(labRolesProvider).isNotEmpty;
    return ListView(children: [
      _header(context),
      Padding(
        padding: const EdgeInsets.all(24),
        child: Column(children: [
          const Icon(Icons.cloud_off_outlined, size: 40, color: Brand.muted),
          const SizedBox(height: 10),
          Text(errorText(error), textAlign: TextAlign.center, style: body(15, color: Brand.ink)),
          const SizedBox(height: 14),
          Wrap(alignment: WrapAlignment.center, spacing: 10, runSpacing: 8, children: [
            FilledButton(onPressed: () => ref.invalidate(labProvider), child: Text(tr(context, 'Try again', 'আবার চেষ্টা করুন'))),
            if (custom)
              OutlinedButton(onPressed: () => ref.read(labRolesProvider.notifier).state = '', child: Text(tr(context, 'Use the default roles', 'ডিফল্ট রোল ব্যবহার করুন'))),
          ]),
        ]),
      ),
    ]);
  }

  Widget _emptyView(BuildContext context) => ListView(children: [
        _header(context),
        Padding(
          padding: const EdgeInsets.all(24),
          child: Column(children: [
            const Icon(Icons.explore_outlined, size: 40, color: Brand.muted),
            const SizedBox(height: 10),
            Text(tr(context, 'Choose a career goal first.', 'আগে ক্যারিয়ার লক্ষ্য বেছে নিন।'), textAlign: TextAlign.center, style: body(16, color: Brand.ink, w: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(tr(context, 'Once you have a goal, this screen compares it with the careers you are closest to.', 'লক্ষ্য ঠিক করলে এই পর্দা আপনার লক্ষ্যের সাথে সবচেয়ে কাছের ক্যারিয়ারগুলোর তুলনা দেখাবে।'), textAlign: TextAlign.center, style: body(14, color: Brand.muted)),
            const SizedBox(height: 14),
            OutlinedButton(onPressed: () => context.pop(), child: Text(tr(context, 'Go back', 'পেছনে যান'))),
          ]),
        ),
      ]);

  Widget _content(BuildContext context, Map d, bool reloading) {
    final bn = _isBn(context);
    final raw = ((d['roles'] ?? []) as List).cast<Map>();
    if (raw.isEmpty) return _emptyView(context);
    final available = ((d['available'] ?? []) as List).cast<Map>();
    final goalKey = d['goalRoleKey'] as String?;
    final saved = d['weeklyHours'] is num ? (d['weeklyHours'] as num).round() : null;
    final keys = [for (final r in raw) roleKeyOf(r)];
    _syncSlots(keys);
    final selKey = pickSelected(keys, _selectedKey, goalKey);
    _effectiveKey = selKey;
    final role = raw.firstWhere((r) => roleKeyOf(r) == selKey);
    final ranked = rankRoles(raw, _lens);
    String? goalTitle;
    for (final a in available) {
      if (a['key'] == goalKey) goalTitle = nm(context, a, 'titleEn', 'titleBn');
    }
    final summary = buildSummary(roles: raw, goalKey: goalKey, goalTitle: goalTitle, lens: _lens, weeklyHours: saved, bn: bn);
    final ownsScenario = _learnRole == null || _learnRole == selKey;
    final learn = ownsScenario ? _learn : <String>{};
    final sim = ownsScenario ? _sim : null;

    return ListView(padding: const EdgeInsets.only(bottom: 40), children: [
      _header(context),
      if (reloading) const LinearProgressIndicator(minHeight: 3, color: Brand.saffron, backgroundColor: Brand.lightSaffron),
      Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 960),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _SectionTitle('1', tr(context, 'Where you stand', 'আপনি কোথায় আছেন')),
              _lensBar(context),
              _summaryCard(context, summary),
              const SizedBox(height: 8),
              _SectionTitle('2', tr(context, 'How your paths compare', 'আপনার পথগুলো কেমন তুলনীয়')),
              _compareSection(context, ranked, goalKey, selKey, saved),
              _roleControls(context, role, keys, available, selKey, goalKey),
              _Graph(roles: ranked, colors: [for (final r in ranked) _color(roleKeyOf(r))], selectedKey: selKey, goalKey: goalKey, onSelect: _select),
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 8, 4, 0),
                child: Text(tr(context, 'Circles show your level against the required level for each role\'s two highest-priority skills. Tap a role to select it.', 'বৃত্তগুলো প্রতিটি রোলের সর্বোচ্চ অগ্রাধিকারের দুটি দক্ষতায় আপনার লেভেল বনাম প্রয়োজনীয় লেভেল দেখায়। রোল বাছতে ট্যাপ করুন।'), style: body(12, color: Brand.muted)),
              ),
              const SizedBox(height: 18),
              _SectionTitle('3', tr(context, 'Your next step', 'আপনার পরের ধাপ')),
              _nextCard(context, role),
              _skillsCard(context, role, selKey, learn),
              _simCard(context, role, saved, learn, sim),
              const SizedBox(height: 6),
              _howItWorks(context, d, role),
              const SizedBox(height: 8),
              Text('${d['note'] ?? ''}', textAlign: TextAlign.center, style: body(12, color: Brand.muted)),
            ]),
          ),
        ),
      ),
    ]);
  }

  // ------------------------------------------------------------------ lenses + summary
  Widget _lensBar(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Semantics(
        container: true,
        label: tr(context, 'Comparison lens', 'তুলনার দৃষ্টিকোণ'),
        child: Wrap(spacing: 8, runSpacing: 8, children: [
          for (final l in Lens.values)
            ChoiceChip(
              label: Text(_lensName(context, l), style: body(13, color: _lens == l ? Colors.white : Brand.ink, w: FontWeight.w700)),
              selected: _lens == l,
              showCheckmark: false,
              selectedColor: Brand.forest,
              backgroundColor: Colors.white,
              side: const BorderSide(color: _line),
              materialTapTargetSize: MaterialTapTargetSize.padded,
              onSelected: (_) => setState(() => _lens = l),
            ),
        ]),
      ),
      const SizedBox(height: 8),
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: Brand.lightGreen, borderRadius: BorderRadius.circular(16)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${tr(context, 'Active lens', 'চলমান দৃষ্টিকোণ')}: ${_lensName(context, _lens)}', style: body(13, color: Brand.forest, w: FontWeight.w800)),
          const SizedBox(height: 2),
          Text(_lensMeaning(context, _lens), style: body(13, color: Brand.ink)),
          const SizedBox(height: 4),
          Text(tr(context, 'A ranking describes your preparation under this model. It is not a guarantee of career fit or of getting a job.', 'র‍্যাঙ্কিং এই মডেলে আপনার প্রস্তুতি বোঝায়। এটি ক্যারিয়ারে মানানসই হওয়া বা চাকরি পাওয়ার নিশ্চয়তা নয়।'), style: body(12, color: Brand.muted)),
        ]),
      ),
      const SizedBox(height: 10),
    ]);
  }

  Widget _summaryCard(BuildContext context, LabSummary s) {
    return AppCard(
      margin: const EdgeInsets.only(bottom: 4),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(tr(context, 'WHAT THE NUMBERS SAY', 'সংখ্যাগুলো কী বলছে'), style: body(11, color: Brand.muted, w: FontWeight.w800)),
        const SizedBox(height: 8),
        for (final line in s.lines)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Padding(padding: EdgeInsets.only(top: 6, right: 10), child: Icon(Icons.circle, size: 7, color: Brand.delta)),
              Expanded(child: Text(line, style: body(14.5, color: Brand.ink))),
            ]),
          ),
        for (final c in s.cautions)
          Container(
            width: double.infinity,
            margin: const EdgeInsets.only(top: 2, bottom: 6),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: Brand.lightSaffron, borderRadius: BorderRadius.circular(12)),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Icon(Icons.info_outline, size: 16, color: _saffronText),
              const SizedBox(width: 8),
              Expanded(child: Text(c, style: body(12.5, color: _saffronText))),
            ]),
          ),
      ]),
    );
  }

  // ------------------------------------------------------------------ comparison cards
  Widget _compareSection(BuildContext context, List<Map> ranked, String? goalKey, String selKey, int? saved) {
    return LayoutBuilder(builder: (context, box) {
      final wide = box.maxWidth >= 720 && ranked.length > 1;
      final cards = [
        for (var i = 0; i < ranked.length; i++)
          _RoleCard(
            role: ranked[i],
            rank: i + 1,
            lens: _lens,
            isGoal: roleKeyOf(ranked[i]) == goalKey,
            selected: roleKeyOf(ranked[i]) == selKey,
            accent: _color(roleKeyOf(ranked[i])),
            weeklyHours: saved,
            onTap: () => _select(roleKeyOf(ranked[i])),
          ),
      ];
      if (!wide) return Column(children: cards);
      return IntrinsicHeight(
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          for (var i = 0; i < cards.length; i++) ...[
            if (i > 0) const SizedBox(width: 12),
            Expanded(child: cards[i]),
          ],
        ]),
      );
    });
  }

  // Add / replace / remove a compared role. Everything is by role key, so the right role changes whatever the ranking is.
  Widget _roleControls(BuildContext context, Map role, List<String> keys, List<Map> available, String selKey, String? goalKey) {
    final title = roleTitle(role, _isBn(context));
    final inUse = keys.toSet();
    final canAdd = keys.length < labMaxRoles;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
        if (canAdd)
          OutlinedButton.icon(
            icon: const Icon(Icons.add, size: 18),
            label: Text(tr(context, 'Add a role', 'রোল যোগ করুন')),
            onPressed: () async {
              final k = await _pickRole(context, available, inUse, tr(context, 'Add a role to compare', 'তুলনায় রোল যোগ করুন'));
              if (k != null) _setRoles(addKey(keys, k)); // the current selection stays where it is
            },
          ),
        OutlinedButton.icon(
          icon: const Icon(Icons.swap_horiz, size: 18),
          label: Text(tr(context, 'Replace $title', '$title বদলান')),
          onPressed: () async {
            final k = await _pickRole(context, available, inUse, tr(context, 'Replace $title with…', '$title এর জায়গায়…'));
            if (k != null) {
              _setRoles(replaceKey(keys, selKey, k));
              _select(k);
            }
          },
        ),
        if (keys.length > 1)
          TextButton.icon(
            icon: const Icon(Icons.remove_circle_outline, size: 18),
            label: Text(tr(context, 'Remove', 'সরান')),
            onPressed: () {
              final rest = removeKey(keys, selKey);
              _setRoles(rest);
              _select(pickSelected(rest, null, goalKey));
            },
          ),
        if (!canAdd) Text(tr(context, 'Up to 3 roles.', 'সর্বোচ্চ ৩টি রোল।'), style: body(12, color: Brand.muted)),
      ]),
    );
  }

  Future<String?> _pickRole(BuildContext context, List<Map> available, Set<String> inUse, String title) {
    final options = available.where((a) => !inUse.contains(a['key'])).toList();
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: Colors.white,
      builder: (ctx) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * .7),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 8), child: Text(title, style: display(18))),
            Flexible(
              child: options.isEmpty
                  ? Padding(padding: const EdgeInsets.all(20), child: Text(tr(ctx, 'No other roles are available.', 'আর কোনো রোল নেই।'), style: body(14, color: Brand.muted)))
                  : ListView(shrinkWrap: true, children: [
                      for (final a in options)
                        ListTile(
                          title: Text(nm(ctx, a, 'titleEn', 'titleBn'), style: body(16, w: FontWeight.w700)),
                          onTap: () => Navigator.of(ctx).pop(a['key'] as String),
                        ),
                    ]),
            ),
          ]),
        ),
      ),
    );
  }

  // ------------------------------------------------------------------ next step
  Widget _nextCard(BuildContext context, Map role) {
    final roleName = roleTitle(role, _isBn(context));
    final n = role['next'] as Map?;
    final skills = ((role['skills'] ?? []) as List).cast<Map>();
    if (n == null) {
      if (skills.isEmpty) {
        return AppCard(child: Text(tr(context, 'No open gaps for $roleName. Keep your evidence up to date.', '$roleName রোলে কোনো ঘাটতি নেই। প্রমাণ হালনাগাদ রাখুন।'), style: body(14.5)));
      }
      // Every open gap is waiting on a prerequisite.
      final first = skills.first;
      final pre = ((first['learnFirst'] ?? []) as List).cast<Map>();
      return AppCard(
        border: Brand.saffron,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(tr(context, 'YOUR NEXT STEP · $roleName', 'আপনার পরের ধাপ · $roleName'), style: body(11, color: _saffronText, w: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(tr(context, 'Start with a prerequisite', 'একটি পূর্বশর্ত দিয়ে শুরু করুন'), style: display(20)),
          const SizedBox(height: 6),
          Text(tr(context, '${_skillName(context, first, '')} needs these first:', '${_skillName(context, first, '')} এর আগে এগুলো দরকার:'), style: body(14)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final l in pre)
              OutlinedButton(onPressed: () => context.push('/roadmap/${l['skillKey']}'), child: Text('${_skillName(context, l, '${l['skillKey']}')} (L${l['level']})')),
          ]),
        ]),
      );
    }

    final key = n['skillKey'] as String;
    final isQuiz = n['action'] == 'quiz';
    final mentors = iv(n['mentorsAvailable']);
    final cur = iv(n['current']), req = iv(n['required']);
    final basisPostings = (role['postings'] as Map?)?['basis'] == 'postings';
    final prio = nv(n['priority']);
    // Higher-priority skills that were skipped because a prerequisite is missing: this is WHY the recommendation is not the top row.
    final skipped = skills.where((s) => s['startable'] == false && nv(s['priority']) > prio).take(2).toList();
    final name = _skillName(context, n, key);
    final row = skills.cast<Map?>().firstWhere((s) => s!['skillKey'] == key, orElse: () => null);
    final evidence = _evLabel(context, (row?['evidence'] ?? 'none') as String);

    return AppCard(
      border: Brand.saffron,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(tr(context, 'YOUR NEXT STEP · $roleName', 'আপনার পরের ধাপ · $roleName'), style: body(11, color: _saffronText, w: FontWeight.w800)),
        const SizedBox(height: 6),
        Text(name, style: display(24)),
        const SizedBox(height: 10),
        _LevelBar(current: cur, target: req),
        const SizedBox(height: 4),
        Text(tr(context, 'Level $cur now, level $req required · $evidence', 'এখন লেভেল $cur, দরকার লেভেল $req · $evidence'), style: body(13, color: Brand.muted)),
        const SizedBox(height: 12),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: Brand.paper, borderRadius: BorderRadius.circular(14)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr(context, 'Why this one', 'কেন এটি'), style: body(12, color: Brand.muted, w: FontWeight.w800)),
            const SizedBox(height: 4),
            Text(tr(context, 'Priority ${n['priority']} = demand ${n['D']} × importance ${n['W']} × gap ${n['G']}.', 'অগ্রাধিকার ${n['priority']} = চাহিদা ${n['D']} × গুরুত্ব ${n['W']} × ঘাটতি ${n['G']}।'), style: body(13.5)),
            const SizedBox(height: 2),
            Text(
              basisPostings
                  ? tr(context, 'Demand: ${iv(n['postings'])} of ${iv((role['postings'] as Map)['used'])} approved postings in this app ask for it.', 'চাহিদা: এই অ্যাপের ${iv((role['postings'] as Map)['used'])}টি অনুমোদিত পোস্টিংয়ের মধ্যে ${iv(n['postings'])}টিতে এটি চাওয়া হয়েছে।')
                  : tr(context, 'Demand is not used here (fewer than 3 matching approved postings), so the role requirements decide.', 'এখানে চাহিদা ধরা হয়নি (মিলে যাওয়া অনুমোদিত পোস্টিং ৩টির কম), তাই রোলের নির্ধারিত চাহিদা ধরা হয়েছে।'),
              style: body(12.5, color: Brand.muted),
            ),
            const SizedBox(height: 6),
            if (skipped.isEmpty)
              Text(tr(context, 'No prerequisite is blocking this step.', 'কোনো পূর্বশর্ত এই ধাপ আটকে রাখছে না।'), style: body(13))
            else
              for (final s in skipped)
                Padding(
                  padding: const EdgeInsets.only(bottom: 2),
                  child: Text(
                    tr(context,
                        '${_skillName(context, s, '${s['skillKey']}')} ranks higher but first needs ${((s['learnFirst'] ?? []) as List).cast<Map>().map((l) => '${_skillName(context, l, '${l['skillKey']}')} (L${l['level']})').join(', ')}, so we start here.',
                        '${_skillName(context, s, '${s['skillKey']}')} অগ্রাধিকারে ওপরে, কিন্তু আগে ${((s['learnFirst'] ?? []) as List).cast<Map>().map((l) => '${_skillName(context, l, '${l['skillKey']}')} (L${l['level']})').join(', ')} দরকার, তাই এখান থেকে শুরু।'),
                    style: body(13),
                  ),
                ),
          ]),
        ),
        const SizedBox(height: 14),
        Wrap(spacing: 8, runSpacing: 8, children: [
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: Brand.saffron, foregroundColor: Brand.ink),
            icon: Icon(isQuiz ? Icons.quiz_outlined : Icons.assignment_outlined, size: 20),
            label: Text(isQuiz ? tr(context, 'Take the $name quiz', '$name কুইজ দিন') : tr(context, 'Open roadmap & submit a project', 'রোডম্যাপ খুলুন ও প্রজেক্ট দিন')),
            onPressed: () => context.push(isQuiz ? '/quiz/$key' : '/roadmap/$key'),
          ),
          if (isQuiz) OutlinedButton(onPressed: () => context.push('/roadmap/$key'), child: Text(tr(context, 'Roadmap', 'রোডম্যাপ'))),
          OutlinedButton(
            onPressed: () => context.push('/gap/$key/mentors'),
            child: Text(mentors > 0 ? tr(context, 'Mentors ($mentors with open spots)', 'মেন্টর (${mentors}জন খালি আছে)') : tr(context, 'Mentors (no open spots now)', 'মেন্টর (এখন খালি নেই)')),
          ),
        ]),
        const SizedBox(height: 8),
        Text(tr(context, 'A quiz or a mentor-reviewed project counts as proof and changes what comes next.', 'কুইজ বা মেন্টর-রিভিউ করা প্রজেক্ট প্রমাণ হিসেবে গণ্য হয় এবং পরের ধাপ বদলে দেয়।'), style: body(12, color: Brand.muted)),
      ]),
    );
  }

  // ------------------------------------------------------------------ skill order (also the what-if picker)
  Widget _skillsCard(BuildContext context, Map role, String selKey, Set<String> learn) {
    final skills = ((role['skills'] ?? []) as List).cast<Map>();
    if (skills.isEmpty) return const SizedBox();
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(tr(context, 'WHY THIS ORDER', 'কেন এই ক্রম'), style: body(11, color: Brand.muted, w: FontWeight.w800)),
        Text(tr(context, 'Priority = demand × importance × gap. Tick skills to test them in the what-if below.', 'অগ্রাধিকার = চাহিদা × গুরুত্ব × ঘাটতি। নিচের হোয়াট-ইফে পরীক্ষা করতে দক্ষতা টিক দিন।'), style: body(12.5, color: Brand.muted)),
        const SizedBox(height: 4),
        for (final s in skills)
          CheckboxListTile(
            value: learn.contains(s['skillKey']),
            dense: true,
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            activeColor: Brand.delta,
            onChanged: (v) => setState(() {
              if (_learnRole != selKey) {
                _learn.clear();
                _learnRole = selKey;
              }
              v == true ? _learn.add(s['skillKey'] as String) : _learn.remove(s['skillKey']);
              _sim = null;
            }),
            secondary: Text('${s['priority']}', style: body(15, color: _saffronText, w: FontWeight.w800)),
            title: Text(_skillName(context, s, '${s['skillKey']}'), style: body(15, w: FontWeight.w700)),
            subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('D ${s['D']} × W ${s['W']} × G ${s['G']} · ${tr(context, 'level', 'লেভেল')} ${s['current']}/${s['required']} · ${_evLabel(context, s['evidence'] as String)}', style: body(11.5, color: Brand.muted)),
              if (s['startable'] == false)
                Text('${tr(context, 'Learn first', 'আগে শিখুন')}: ${((s['learnFirst'] ?? []) as List).cast<Map>().map((l) => '${_skillName(context, l, '${l['skillKey']}')} (L${l['level']})').join(', ')}', style: body(11.5, color: _saffronText, w: FontWeight.w700)),
            ]),
          ),
      ]),
    );
  }

  // ------------------------------------------------------------------ what-if
  Widget _simCard(BuildContext context, Map role, int? saved, Set<String> learn, Map<String, dynamic>? sim) {
    final effective = _hoursChoice ?? saved;
    final options = <int>{3, 5, 8, 10, 15, 20, if (saved != null) saved}.toList()..sort();
    return AppCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(tr(context, 'WHAT IF I LEARN…', 'যদি আমি শিখি…'), style: body(11, color: Brand.muted, w: FontWeight.w800))),
          Pill(tr(context, 'HYPOTHETICAL', 'অনুমানভিত্তিক'), tone: Tone.saffron),
        ]),
        const SizedBox(height: 10),
        Text(tr(context, 'Study pace for this scenario', 'এই পরিস্থিতির জন্য পড়ার গতি'), style: body(13, w: FontWeight.w800)),
        const SizedBox(height: 6),
        Wrap(spacing: 8, runSpacing: 6, children: [
          for (final h in options)
            ChoiceChip(
              label: Text(tr(context, '$h h/week', 'সপ্তাহে $h ঘণ্টা'), style: body(13, color: effective == h ? Colors.white : Brand.ink, w: FontWeight.w700)),
              selected: effective == h,
              showCheckmark: false,
              selectedColor: Brand.forest,
              backgroundColor: Colors.white,
              side: const BorderSide(color: _line),
              onSelected: (on) {
                setState(() => _hoursChoice = (on && h != saved) ? h : null);
                if (_sim != null && learn.isNotEmpty) _simulate(role); // refresh the estimate for the new pace
              },
            ),
        ]),
        const SizedBox(height: 6),
        Text(
          saved != null
              ? tr(context, 'Your saved commitment is $saved h/week. Changing the pace here only affects this scenario; your profile is not changed.', 'আপনার সংরক্ষিত প্রতিশ্রুতি সপ্তাহে $saved ঘণ্টা। এখানে গতি বদলালে শুধু এই পরিস্থিতি বদলায়; আপনার প্রোফাইল বদলায় না।')
              : tr(context, 'No weekly study hours are saved. Pick a pace to estimate weeks; it is only a scenario and is not saved.', 'সাপ্তাহিক পড়ার ঘণ্টা সংরক্ষিত নেই। সপ্তাহ অনুমান করতে একটি গতি বাছুন; এটি শুধু পরিস্থিতি, সংরক্ষিত হবে না।'),
          style: body(12.5, color: Brand.muted),
        ),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: Text(learn.isEmpty ? tr(context, 'Tick skills above to reach their required level, then simulate.', 'উপরে দক্ষতা টিক দিন, তারপর সিমুলেট করুন।') : tr(context, '${learn.length} skill(s) selected', '${learn.length}টি দক্ষতা বাছাই'), style: body(13.5))),
          if (learn.isNotEmpty) TextButton(onPressed: () => setState(() { _learn.clear(); _sim = null; }), child: Text(tr(context, 'Clear', 'মুছুন'))),
        ]),
        const SizedBox(height: 6),
        FilledButton(
          onPressed: learn.isEmpty || _busy ? null : () => _simulate(role),
          child: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : Text(tr(context, 'Run simulation', 'সিমুলেশন চালান')),
        ),
        if (sim != null) _simResult(context, role, sim),
      ]),
    );
  }

  Widget _simResult(BuildContext context, Map role, Map<String, dynamic> sim) {
    final before = sim['before'] as Map, after = sim['after'] as Map;
    final proven = (sim['provenReadiness'] ?? {}) as Map;
    final assume = (sim['assumption'] ?? {}) as Map;
    final hrs = assume['weeklyHours'];
    final src = assume['source'];
    final steps = ((sim['steps'] ?? []) as List).cast<Map>();
    final byKey = {for (final s in ((role['skills'] ?? []) as List).cast<Map>()) '${s['skillKey']}': s};
    final delta = iv(sim['delta']);
    final studyWeeks = sim['studyWeeksNeeded'];
    String weeks(dynamic w) => w is num ? '${w.round()}' : '–';

    return Semantics(
      liveRegion: true,
      child: Container(
        margin: const EdgeInsets.only(top: 14),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: Brand.paper, borderRadius: BorderRadius.circular(18), border: Border.all(color: _line)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(tr(context, 'Hypothetical result', 'অনুমানভিত্তিক ফলাফল'), style: display(16))),
            Pill(delta == 0 ? tr(context, 'no change', 'কোনো বদল নেই') : tr(context, '+$delta percentage points', '+$delta শতাংশ পয়েন্ট'), tone: delta == 0 ? Tone.grey : Tone.green),
          ]),
          const SizedBox(height: 12),
          _ReadinessPair(label: tr(context, 'Readiness now', 'এখনকার প্রস্তুতি'), value: iv(before['readiness']), color: Brand.muted),
          const SizedBox(height: 8),
          _ReadinessPair(label: tr(context, 'Readiness if you get there (hypothetical)', 'পৌঁছালে প্রস্তুতি (অনুমান)'), value: iv(after['readiness']), color: Brand.delta, dashed: true),
          const SizedBox(height: 12),
          Wrap(spacing: 10, runSpacing: 10, children: [
            _Tile(label: tr(context, 'Extra study hours', 'অতিরিক্ত পড়ার ঘণ্টা'), value: '${sim['studyHoursNeeded']}'),
            _Tile(label: tr(context, 'Weeks for these steps', 'এই ধাপগুলোর সপ্তাহ'), value: weeks(studyWeeks)),
            _Tile(label: tr(context, 'Weeks to full readiness', 'পূর্ণ প্রস্তুতির সপ্তাহ'), value: '${weeks(before['weeksLeft'])} → ${weeks(after['weeksLeft'])}'),
          ]),
          const SizedBox(height: 8),
          Text(
            hrs != null
                ? tr(context, 'Assumes $hrs h/week (${src == 'scenario' ? 'a scenario you chose' : 'your saved commitment'}). Weeks are model estimates.', 'সপ্তাহে $hrs ঘণ্টা ধরা হয়েছে (${src == 'scenario' ? 'আপনার বাছাই করা পরিস্থিতি' : 'আপনার সংরক্ষিত প্রতিশ্রুতি'})। সপ্তাহগুলো মডেলের অনুমান।')
                : tr(context, 'No weekly pace was set, so weeks cannot be estimated. Choose hours per week above.', 'সাপ্তাহিক গতি ঠিক করা নেই, তাই সপ্তাহ অনুমান করা যায়নি। ওপরে সপ্তাহে কত ঘণ্টা তা বাছুন।'),
            style: body(12.5, color: Brand.muted),
          ),
          const SizedBox(height: 10),
          Text(tr(context, 'Breakdown', 'ধাপভিত্তিক হিসাব'), style: body(12, color: Brand.muted, w: FontWeight.w800)),
          for (final st in steps)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(children: [
                Expanded(child: Text(_skillName(context, byKey['${st['skillKey']}'], '${st['skillKey']}'), style: body(14, w: FontWeight.w700))),
                Text(st['note'] == 'already_there' ? tr(context, 'already there', 'আগেই আছে') : 'L${st['from']} → L${st['to']} · ${st['hours']} ${tr(context, 'h', 'ঘ')}', style: body(13, color: Brand.muted)),
              ]),
            ),
          const Divider(height: 20),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Icon(Icons.verified_outlined, size: 18, color: Brand.delta),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                tr(context, 'Demonstrated readiness stays at ${iv(proven['after'])}%. A simulation never creates evidence; only a quiz, a project or a mentor review can raise it.',
                    'প্রমাণিত প্রস্তুতি ${iv(proven['after'])}% ই থাকে। সিমুলেশন কখনো প্রমাণ তৈরি করে না; কুইজ, প্রজেক্ট বা মেন্টর রিভিউই তা বাড়াতে পারে।'),
                style: body(13, color: Brand.ink, w: FontWeight.w600),
              ),
            ),
          ]),
        ]),
      ),
    );
  }

  // ------------------------------------------------------------------ how this decision works
  Widget _howItWorks(BuildContext context, Map d, Map role) {
    final p = (role['postings'] ?? {}) as Map;
    final small = p['small'] == true;
    final used = iv(p['used']);
    final title = roleTitle(role, _isBn(context));
    Widget item(String head, String text) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(head, style: body(13.5, color: Brand.forest, w: FontWeight.w800)),
            const SizedBox(height: 2),
            Text(text, style: body(13.5)),
          ]),
        );
    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: _line)),
      clipBehavior: Clip.antiAlias,
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 18),
          childrenPadding: const EdgeInsets.fromLTRB(18, 0, 18, 6),
          expandedCrossAxisAlignment: CrossAxisAlignment.start,
          leading: const Icon(Icons.help_outline, color: Brand.delta),
          title: Text(tr(context, 'How this decision works', 'এই সিদ্ধান্ত কীভাবে কাজ করে'), style: body(15, w: FontWeight.w800)),
          children: [
            item(tr(context, 'Readiness', 'প্রস্তুতি'),
                tr(context, 'For each skill the role requires, we take your level divided by the required level (capped at 1), weight it by how important the skill is for the role, and average. Your own ratings count here. $title: ${role['readiness']}%.',
                    'রোলের প্রতিটি দক্ষতায় আপনার লেভেলকে প্রয়োজনীয় লেভেল দিয়ে ভাগ করা হয় (সর্বোচ্চ ১), দক্ষতার গুরুত্ব দিয়ে ভার দেওয়া হয়, তারপর গড় নেওয়া হয়। নিজের দেওয়া রেটিংও এখানে গণ্য। $title: ${role['readiness']}%।')),
            item(tr(context, 'Why demonstrated readiness can be lower', 'প্রমাণিত প্রস্তুতি কেন কম হতে পারে'),
                tr(context, 'Demonstrated readiness uses the same formula but counts only quiz, project and endorsement evidence; self-ratings count as zero. The gap between the two shows how much of your readiness is self-reported. $title: ${role['provenReadiness']}% demonstrated, ${role['confidence']}% of its required skills have any proof.',
                    'প্রমাণিত প্রস্তুতিতে একই সূত্র, কিন্তু শুধু কুইজ, প্রজেক্ট ও এন্ডোর্সমেন্ট গণ্য; নিজের রেটিং শূন্য। দুটির ফারাক বলে প্রস্তুতির কতটা নিজের দেওয়া। $title: প্রমাণিত ${role['provenReadiness']}%, এর প্রয়োজনীয় দক্ষতার ${role['confidence']}%-এ কোনো প্রমাণ আছে।')),
            item(tr(context, 'How skill gaps are prioritized', 'দক্ষতার ঘাটতি কীভাবে অগ্রাধিকার পায়'), '${d['formula'] ?? ''}'),
            item(tr(context, 'Why this next skill', 'কেন এই পরের দক্ষতা'),
                tr(context, 'The next skill is the highest-priority gap that has no unmet prerequisite. Prerequisites come from the app\'s topic graph. A higher-ranked skill that is blocked waits until its prerequisites are proven.',
                    'পরের দক্ষতা হলো সর্বোচ্চ অগ্রাধিকারের সেই ঘাটতি যার কোনো পূর্বশর্ত বাকি নেই। পূর্বশর্ত আসে অ্যাপের টপিক গ্রাফ থেকে। ওপরের ক্রমের কোনো দক্ষতা আটকে থাকলে তার পূর্বশর্ত প্রমাণিত না হওয়া পর্যন্ত অপেক্ষা করে।')),
            item(tr(context, 'Time estimates', 'সময়ের হিসাব'),
                tr(context, 'Hours are the missing levels times each skill\'s estimated learning hours. Weeks are hours divided by your weekly study hours, so no weeks are shown if none are set.',
                    'ঘণ্টা মানে বাকি লেভেল গুণ প্রতিটি দক্ষতার আনুমানিক শেখার ঘণ্টা। সপ্তাহ মানে ঘণ্টাকে আপনার সাপ্তাহিক পড়ার ঘণ্টা দিয়ে ভাগ; তাই ঘণ্টা ঠিক না থাকলে সপ্তাহ দেখানো হয় না।')),
            item(tr(context, 'What data supports this', 'কোন তথ্যের ওপর ভিত্তি'),
                small
                    ? tr(context, 'Your recorded skill evidence and the role requirements. Only $used approved posting(s) in this app match $title, which is too few to measure employer demand, so the role requirements are used instead.',
                        'আপনার রেকর্ড করা দক্ষতার প্রমাণ ও রোলের চাহিদা। এই অ্যাপে $title এর সাথে মিলে যাওয়া অনুমোদিত পোস্টিং মাত্র $usedটি, যা নিয়োগকর্তার চাহিদা মাপতে যথেষ্ট নয়, তাই রোলের নির্ধারিত চাহিদা ব্যবহার হয়েছে।')
                    : tr(context, 'Your recorded skill evidence, the role requirements, and $used approved postings in this app that match $title.',
                        'আপনার রেকর্ড করা দক্ষতার প্রমাণ, রোলের চাহিদা, এবং এই অ্যাপে $title এর সাথে মিলে যাওয়া $usedটি অনুমোদিত পোস্টিং।')),
            item(tr(context, 'What this is not', 'এটি কী নয়'),
                tr(context, 'Approved postings in this app are not the whole job market. Nothing here is a chance of being hired, a salary figure or a guarantee of fit.',
                    'এই অ্যাপের অনুমোদিত পোস্টিং পুরো চাকরির বাজার নয়। এখানকার কিছুই চাকরি পাওয়ার সম্ভাবনা, বেতনের হিসাব বা মানানসই হওয়ার নিশ্চয়তা নয়।')),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------- small widgets
class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.n, this.text);
  final String n, text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Semantics(
          header: true,
          child: Row(children: [
            Container(width: 26, height: 26, alignment: Alignment.center, decoration: const BoxDecoration(color: Brand.forest, shape: BoxShape.circle), child: Text(n, style: display(13, color: Colors.white))),
            const SizedBox(width: 10),
            Expanded(child: Text(text, style: display(19))),
          ]),
        ),
      );
}

class _Bar extends StatelessWidget {
  const _Bar({required this.value, required this.color, this.height = 10});
  final double value;
  final Color color;
  final double height;
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween<double>(begin: 0, end: value.clamp(0, 1).toDouble()),
        duration: _dur(context, 600),
        curve: Curves.easeOutCubic,
        builder: (_, v, __) => ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: LinearProgressIndicator(value: v, minHeight: height, color: color, backgroundColor: _track),
        ),
      );
}

/// One labelled value with a bar. [highlight] marks the metric the active lens ranks by.
class _MetricBar extends StatelessWidget {
  const _MetricBar({required this.label, required this.value, required this.color, this.highlight = false});
  final String label;
  final int value;
  final Color color;
  final bool highlight;
  @override
  Widget build(BuildContext context) => AnimatedContainer(
        duration: _dur(context, 200),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        margin: const EdgeInsets.only(bottom: 4),
        decoration: BoxDecoration(color: highlight ? Brand.lightSaffron : Colors.transparent, borderRadius: BorderRadius.circular(12)),
        child: Column(children: [
          Row(children: [
            Expanded(child: Text(label, style: body(12.5, color: Brand.ink, w: highlight ? FontWeight.w800 : FontWeight.w600))),
            Text('$value%', style: display(16, color: color)),
          ]),
          const SizedBox(height: 4),
          _Bar(value: value / 100, color: color),
        ]),
      );
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, this.highlight = false});
  final String label, value;
  final bool highlight;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(color: highlight ? Brand.lightSaffron : Brand.paper, borderRadius: BorderRadius.circular(12)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(value, style: display(15)),
          Text(label, style: body(11.5, color: Brand.muted, w: highlight ? FontWeight.w800 : FontWeight.w600)),
        ]),
      );
}

class _Tile extends StatelessWidget {
  const _Tile({required this.label, required this.value});
  final String label, value;
  @override
  Widget build(BuildContext context) => Container(
        constraints: const BoxConstraints(minWidth: 104),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: _line)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(value, style: display(18)),
          Text(label, style: body(12, color: Brand.muted)),
        ]),
      );
}

class _ReadinessPair extends StatelessWidget {
  const _ReadinessPair({required this.label, required this.value, required this.color, this.dashed = false});
  final String label;
  final int value;
  final Color color;
  final bool dashed;
  @override
  Widget build(BuildContext context) => Column(children: [
        Row(children: [
          Expanded(child: Text(label, style: body(13, w: FontWeight.w700))),
          Text('$value%', style: display(17, color: color)),
        ]),
        const SizedBox(height: 4),
        Opacity(opacity: dashed ? .75 : 1, child: _Bar(value: value / 100, color: color, height: 12)),
      ]);
}

/// Current vs required level (levels run 1 to 3): filled = reached, outlined saffron = still to reach.
class _LevelBar extends StatelessWidget {
  const _LevelBar({required this.current, required this.target});
  final int current, target;
  @override
  Widget build(BuildContext context) {
    final max = math.max(3, target);
    return Semantics(
      label: tr(context, 'Level $current of $target required', 'প্রয়োজনীয় $target এর মধ্যে লেভেল $current'),
      child: ExcludeSemantics(
        child: Row(children: [
          for (var i = 1; i <= max; i++)
            Expanded(
              child: Container(
                height: 14,
                margin: EdgeInsets.only(right: i == max ? 0 : 6),
                decoration: BoxDecoration(
                  color: i <= current ? Brand.delta : Colors.transparent,
                  borderRadius: BorderRadius.circular(7),
                  border: Border.all(color: i <= current ? Brand.delta : (i <= target ? Brand.saffron : _track), width: 2),
                ),
              ),
            ),
        ]),
      ),
    );
  }
}

// ---------------------------------------------------------------- comparison card
class _RoleCard extends StatelessWidget {
  const _RoleCard({required this.role, required this.rank, required this.lens, required this.isGoal, required this.selected, required this.accent, required this.weeklyHours, required this.onTap});
  final Map role;
  final int rank;
  final Lens lens;
  final bool isGoal, selected;
  final Color accent;
  final int? weeklyHours;
  final VoidCallback onTap;

  String _next(BuildContext c) {
    final n = role['next'] as Map?;
    if (n == null) {
      final sk = (role['skills'] as List?) ?? const [];
      return sk.isEmpty ? tr(c, 'No open gaps. Keep your evidence up to date.', 'কোনো ঘাটতি নেই। প্রমাণ হালনাগাদ রাখুন।') : tr(c, 'Learn a prerequisite first', 'আগে একটি পূর্বশর্ত শিখুন');
    }
    final verb = n['action'] == 'quiz' ? tr(c, 'Take the quiz', 'কুইজ দিন') : tr(c, 'Submit a project', 'প্রজেক্ট দিন');
    return '${_skillName(c, n, '${n['skillKey']}')} · $verb';
  }

  @override
  Widget build(BuildContext context) {
    final bn = _isBn(context);
    final title = roleTitle(role, bn);
    final p = (role['postings'] ?? {}) as Map;
    final small = p['small'] == true;
    final used = iv(p['used']);
    final weeks = role['timeToReadyWeeks'];
    final hours = iv(role['totalHours']);
    final weeksText = weeks is num && weeklyHours != null ? tr(context, '≈ ${weeks.round()} wk at $weeklyHours h/wk', 'প্রায় ${weeks.round()} সপ্তাহ (সপ্তাহে $weeklyHours ঘণ্টা)') : tr(context, 'set weekly hours for weeks', 'সপ্তাহ জানতে সাপ্তাহিক ঘণ্টা দিন');
    final semantic = '$title. ${tr(context, 'Rank $rank by ${_lensName(context, lens)}', '${_lensName(context, lens)} অনুযায়ী $rank নম্বর')}. '
        '${isGoal ? '${tr(context, 'My current goal', 'আমার বর্তমান লক্ষ্য')}. ' : ''}'
        '${tr(context, 'Readiness ${role['readiness']} percent. Demonstrated ${role['provenReadiness']} percent. Evidence coverage ${role['confidence']} percent. $hours hours left.', 'প্রস্তুতি ${role['readiness']} শতাংশ। প্রমাণিত ${role['provenReadiness']} শতাংশ। প্রমাণের আওতা ${role['confidence']} শতাংশ। বাকি $hours ঘণ্টা।')} '
        '${selected ? tr(context, 'Selected.', 'নির্বাচিত।') : ''}';

    return Semantics(
      button: true,
      selected: selected,
      label: semantic,
      onTap: onTap,
      excludeSemantics: true,
      child: AppCard(
        onTap: onTap,
        border: selected ? accent : null,
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 30,
              height: 30,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: rank == 1 ? Brand.saffron : Brand.paper, shape: BoxShape.circle, border: Border.all(color: rank == 1 ? Brand.saffron : _line)),
              child: Text('$rank', style: display(14, color: Brand.ink)),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: display(17, color: accent)),
                if (isGoal) ...[
                  const SizedBox(height: 4),
                  Wrap(children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(color: Brand.lightSaffron, borderRadius: BorderRadius.circular(20)),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.flag_rounded, size: 13, color: _saffronText),
                        const SizedBox(width: 4),
                        Text(tr(context, 'My Current Goal', 'আমার বর্তমান লক্ষ্য'), style: body(11.5, color: _saffronText, w: FontWeight.w800)),
                      ]),
                    ),
                  ]),
                ],
              ]),
            ),
            if (selected) Icon(Icons.check_circle, size: 20, color: accent),
          ]),
          const SizedBox(height: 10),
          _MetricBar(label: tr(context, 'Readiness today', 'আজকের প্রস্তুতি'), value: iv(role['readiness']), color: accent, highlight: lens == Lens.ready),
          _MetricBar(label: tr(context, 'Demonstrated (proven by evidence)', 'প্রমাণিত (প্রমাণ দিয়ে)'), value: iv(role['provenReadiness']), color: Brand.forest, highlight: lens == Lens.proven),
          const SizedBox(height: 4),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: _Stat(label: tr(context, 'of required skills have proof', 'প্রয়োজনীয় দক্ষতার প্রমাণ'), value: '${iv(role['confidence'])}%')),
            const SizedBox(width: 8),
            Expanded(child: _Stat(label: tr(context, 'hours left · $weeksText', 'ঘণ্টা বাকি · $weeksText'), value: '$hours', highlight: lens == Lens.fastest)),
          ]),
          const SizedBox(height: 10),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(small ? Icons.warning_amber_rounded : Icons.info_outline, size: 16, color: small ? _saffronText : Brand.muted),
            const SizedBox(width: 6),
            Expanded(
              child: Text(
                small
                    ? tr(context, 'Only $used approved posting(s) used; skills ranked from role requirements.', 'মাত্র $usedটি অনুমোদিত পোস্টিং ব্যবহৃত; দক্ষতা রোলের চাহিদা থেকে সাজানো।')
                    : tr(context, '$used approved postings used (this app only).', '$usedটি অনুমোদিত পোস্টিং ব্যবহৃত (শুধু এই অ্যাপের)।'),
                style: body(12, color: small ? _saffronText : Brand.muted, w: small ? FontWeight.w700 : FontWeight.w500),
              ),
            ),
          ]),
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: Brand.lightGreen, borderRadius: BorderRadius.circular(12)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr(context, 'NEXT ACTION', 'পরের কাজ'), style: body(10.5, color: Brand.forest, w: FontWeight.w800)),
              Text(_next(context), style: body(13.5, color: Brand.ink, w: FontWeight.w700)),
            ]),
          ),
        ]),
      ),
    );
  }
}

// ---------------------------------------------------------------- exploration graph
class _Graph extends StatelessWidget {
  const _Graph({required this.roles, required this.colors, required this.selectedKey, required this.goalKey, required this.onSelect});
  final List<Map> roles;
  final List<Color> colors;
  final String selectedKey;
  final String? goalKey;
  final ValueChanged<String> onSelect;

  static const _rowH = 118.0;

  @override
  Widget build(BuildContext context) {
    final n = roles.length;
    final h = n * _rowH + 16;
    final selIdx = roles.indexWhere((r) => roleKeyOf(r) == selectedKey);
    return Semantics(
      container: true,
      label: tr(context, 'Career exploration graph', 'ক্যারিয়ার অন্বেষণ গ্রাফ'),
      child: Container(
        height: h,
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: _line)),
        clipBehavior: Clip.antiAlias,
        child: LayoutBuilder(builder: (context, box) {
          final w = box.maxWidth;
          final meX = w * .10, roleX = w * .40, skillX = w * .66;
          double rowY(int i) => 8 + _rowH * (i + .5);
          final me = Offset(meX, h / 2);
          final roleXY = [for (var i = 0; i < n; i++) Offset(roleX, rowY(i))];
          final skillXY = [
            for (var i = 0; i < n; i++) [Offset(skillX, rowY(i) - 20), Offset(skillX, rowY(i) + 20)],
          ];
          return Stack(children: [
            for (var i = 0; i < n; i++)
              Positioned(
                left: 6,
                right: 6,
                top: rowY(i) - _rowH / 2 + 4,
                height: _rowH - 8,
                child: AnimatedContainer(
                  duration: _dur(context, 250),
                  decoration: BoxDecoration(
                    color: i == selIdx ? colors[i].withValues(alpha: .07) : Colors.transparent,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: i == selIdx ? colors[i].withValues(alpha: .35) : Colors.transparent),
                  ),
                ),
              ),
            Positioned.fill(child: CustomPaint(painter: _GraphPainter(roles: roles, colors: colors, selected: selIdx, me: me, roleXY: roleXY, skillXY: skillXY))),
            Positioned(left: meX - 28, top: me.dy + 28, width: 56, child: Text(tr(context, 'YOU', 'আপনি'), textAlign: TextAlign.center, style: body(11, w: FontWeight.w800))),
            for (var i = 0; i < n; i++) ...[
              Positioned(
                left: roleX - 26,
                top: roleXY[i].dy - 12,
                width: 52,
                height: 24,
                child: IgnorePointer(child: Center(child: Text('${iv(roles[i]['readiness'])}%', style: display(13, color: i == selIdx ? Colors.white : Brand.ink)))),
              ),
              Positioned(
                left: roleX - 52,
                top: roleXY[i].dy + 28,
                width: 104,
                child: IgnorePointer(child: Text(roleTitle(roles[i], _isBn(context)), maxLines: 2, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis, style: body(11.5, color: colors[i], w: i == selIdx ? FontWeight.w800 : FontWeight.w600))),
              ),
              if (roleKeyOf(roles[i]) == goalKey)
                Positioned(
                  left: roleX - 36,
                  top: roleXY[i].dy - 48,
                  width: 72,
                  child: IgnorePointer(
                    child: Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(color: Brand.saffron, borderRadius: BorderRadius.circular(20)),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          const Icon(Icons.flag_rounded, size: 11, color: Brand.ink),
                          const SizedBox(width: 3),
                          Text(tr(context, 'GOAL', 'লক্ষ্য'), style: body(10, color: Brand.ink, w: FontWeight.w800)),
                        ]),
                      ),
                    ),
                  ),
                ),
              for (var j = 0; j < math.min(2, ((roles[i]['skills'] ?? []) as List).length); j++)
                Positioned(
                  left: skillXY[i][j].dx + 14,
                  top: skillXY[i][j].dy - 15,
                  width: math.max(40, w - skillXY[i][j].dx - 20),
                  height: 30,
                  child: IgnorePointer(
                    child: Text(
                      '${_skillName(context, ((roles[i]['skills'] as List)[j]) as Map, '')}\nL${(((roles[i]['skills'] as List)[j]) as Map)['current']}→L${(((roles[i]['skills'] as List)[j]) as Map)['required']}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: body(10.5, color: Brand.muted, w: FontWeight.w600),
                    ),
                  ),
                ),
              Positioned(
                left: roleX - 54,
                top: roleXY[i].dy - 50,
                width: 108,
                height: 112,
                child: Semantics(
                  button: true,
                  selected: i == selIdx,
                  label: '${roleTitle(roles[i], _isBn(context))}, ${tr(context, 'readiness', 'প্রস্তুতি')} ${iv(roles[i]['readiness'])}%${roleKeyOf(roles[i]) == goalKey ? ', ${tr(context, 'my current goal', 'আমার বর্তমান লক্ষ্য')}' : ''}',
                  excludeSemantics: true,
                  onTap: () => onSelect(roleKeyOf(roles[i])),
                  child: GestureDetector(behavior: HitTestBehavior.opaque, onTap: () => onSelect(roleKeyOf(roles[i]))),
                ),
              ),
            ],
          ]);
        }),
      ),
    );
  }
}

class _GraphPainter extends CustomPainter {
  _GraphPainter({required this.roles, required this.colors, required this.selected, required this.me, required this.roleXY, required this.skillXY});
  final List<Map> roles;
  final List<Color> colors;
  final int selected;
  final Offset me;
  final List<Offset> roleXY;
  final List<List<Offset>> skillXY;

  Path _hex(Offset c, double r) {
    final p = Path();
    for (var k = 0; k < 6; k++) {
      final a = math.pi / 3 * k - math.pi / 2;
      final pt = Offset(c.dx + r * math.cos(a), c.dy + r * math.sin(a));
      if (k == 0) {
        p.moveTo(pt.dx, pt.dy);
      } else {
        p.lineTo(pt.dx, pt.dy);
      }
    }
    return p..close();
  }

  void _curve(Canvas canvas, Offset a, Offset b, Color col, bool on) {
    final mid = (b.dx - a.dx) * .5;
    final path = Path()
      ..moveTo(a.dx, a.dy)
      ..cubicTo(a.dx + mid, a.dy, b.dx - mid, b.dy, b.dx, b.dy);
    canvas.drawPath(path, Paint()..color = col.withValues(alpha: on ? .85 : .3)..style = PaintingStyle.stroke..strokeWidth = on ? 2.4 : 1.4);
  }

  void _drawRole(Canvas canvas, int i) {
    final col = colors[i];
    final on = i == selected;
    _curve(canvas, me, roleXY[i], col, on);
    final sk = ((roles[i]['skills'] ?? []) as List).cast<Map>();
    for (var j = 0; j < math.min(2, sk.length); j++) {
      _curve(canvas, roleXY[i], skillXY[i][j], col, on);
      final cur = nv(sk[j]['current']).toDouble(), req = nv(sk[j]['required']).toDouble();
      final c = skillXY[i][j];
      canvas.drawCircle(c, 8, Paint()..color = Colors.white);
      canvas.drawCircle(c, 8, Paint()..color = _track..style = PaintingStyle.stroke..strokeWidth = 3);
      final frac = req <= 0 ? 0.0 : (cur / req).clamp(0.0, 1.0).toDouble();
      if (frac > 0) {
        canvas.drawArc(Rect.fromCircle(center: c, radius: 8), -math.pi / 2, 2 * math.pi * frac, false, Paint()..color = col..style = PaintingStyle.stroke..strokeWidth = 3..strokeCap = StrokeCap.round);
      }
    }
    final hex = _hex(roleXY[i], 26);
    canvas.drawPath(hex, Paint()..color = on ? col : Colors.white);
    canvas.drawPath(hex, Paint()..color = col..style = PaintingStyle.stroke..strokeWidth = on ? 2.6 : 1.8);
  }

  @override
  void paint(Canvas canvas, Size size) {
    for (var i = 0; i < roles.length; i++) {
      if (i != selected) _drawRole(canvas, i);
    }
    if (selected >= 0 && selected < roles.length) _drawRole(canvas, selected); // selected role on top
    final hex = _hex(me, 24);
    canvas.drawPath(hex, Paint()..color = Brand.forest);
    canvas.drawPath(hex, Paint()..color = Brand.saffron..style = PaintingStyle.stroke..strokeWidth = 2.2);
  }

  @override
  bool shouldRepaint(covariant _GraphPainter old) => old.selected != selected || old.roles != roles || old.colors != colors || old.me != me;
}

final decisionLabRoutes = <RouteBase>[
  GoRoute(path: '/decision-lab', builder: (_, __) => const DecisionLabScreen()),
];
