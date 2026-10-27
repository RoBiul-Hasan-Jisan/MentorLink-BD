import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/ui.dart';
import 'widgets.dart';

// Career Decision Lab: compare up to 3 roles on an exploration graph, see what to learn next (with the numbers
// behind it), run a what-if, then jump to the quiz / roadmap / mentors for that gap.
// Style: dark canvas with glowing nodes. Every number comes from GET /me/decision-lab (nothing is invented here).
const _bg = Color(0xFF0B1020);
const _panel = Color(0xFF131A33);
const _roleColors = [Color(0xFF22D3EE), Color(0xFFA855F7), Color(0xFFFB923C)];
const _good = Color(0xFF34D399);
const _warn = Color(0xFFFBBF24);

final labRolesProvider = StateProvider.autoDispose<String>((_) => '');
final labProvider = FutureProvider.autoDispose((ref) {
  final roles = ref.watch(labRolesProvider);
  return getJson(ref, '/me/decision-lab', q: roles.isEmpty ? null : {'roles': roles});
});

Color _lab(Color c, double a) => c.withValues(alpha: a);

class DecisionLabScreen extends ConsumerStatefulWidget {
  const DecisionLabScreen({super.key});
  @override
  ConsumerState<DecisionLabScreen> createState() => _DecisionLabState();
}

class _DecisionLabState extends ConsumerState<DecisionLabScreen> {
  int _selected = 0;
  final Set<String> _learn = {};
  Map<String, dynamic>? _sim;
  bool _busy = false;

  Future<void> _simulate(Map role) async {
    final skills = ((role['skills'] ?? []) as List).cast<Map>().where((s) => _learn.contains(s['skillKey'])).toList();
    if (skills.isEmpty) return;
    setState(() => _busy = true);
    try {
      final res = await ref.read(dioProvider).post('/me/decision-lab/simulate', data: {
        'roleKey': (role['role'] as Map)['key'],
        'learn': [for (final s in skills) {'skillKey': s['skillKey'], 'level': s['required']}],
      });
      setState(() => _sim = Map<String, dynamic>.from(res.data as Map));
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final value = ref.watch(labProvider);
    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: AsyncBody(
          value: value,
          onRetry: () => ref.invalidate(labProvider),
          builder: (d) {
            final roles = ((d['roles'] ?? []) as List).cast<Map>();
            if (roles.isEmpty) return Center(child: Text(tr(context, 'Choose a career goal first.', 'আগে ক্যারিয়ার লক্ষ্য বেছে নিন।'), style: body(16, color: Colors.white)));
            final sel = _selected.clamp(0, roles.length - 1);
            final role = roles[sel];
            return ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 32), children: [
              Row(children: [
                BackCircle(dark: true, onTap: () => context.pop()),
                const SizedBox(width: 12),
                Expanded(child: Text(tr(context, 'Career Decision Lab', 'ক্যারিয়ার ডিসিশন ল্যাব'), style: display(24, color: Colors.white))),
              ]),
              const SizedBox(height: 4),
              Text(tr(context, 'Compare careers, test scenarios, find your next best step.', 'ক্যারিয়ার তুলনা করুন, পরিস্থিতি পরীক্ষা করুন, পরের সেরা ধাপ জানুন।'), style: body(14, color: Colors.white70)),
              const SizedBox(height: 12),
              _Graph(roles: roles, selected: sel, onSelect: (i) => setState(() { _selected = i; _learn.clear(); _sim = null; })),
              const SizedBox(height: 8),
              _addRole(context, d, roles),
              const SizedBox(height: 8),
              _roleCard(context, role, _roleColors[sel % 3]),
              _nextCard(context, role),
              _skillsCard(context, role),
              _simCard(context, role),
              const SizedBox(height: 8),
              Text('${d['formula'] ?? ''}\n${d['note'] ?? ''}', textAlign: TextAlign.center, style: body(12, color: Colors.white54)),
            ]);
          },
        ),
      ),
    );
  }

  Widget _addRole(BuildContext context, Map d, List<Map> roles) {
    final avail = ((d['available'] ?? []) as List).cast<Map>();
    final cur = roles.map((r) => (r['role'] as Map)['key'] as String).toList();
    final inUse = cur.toSet();
    return Wrap(spacing: 8, runSpacing: 4, children: [
      for (final a in avail.where((a) => !inUse.contains(a['key'])).take(6))
        ActionChip(
          backgroundColor: _panel,
          side: BorderSide(color: _lab(Colors.white, .15)),
          label: Text('+ ${nm(context, a, 'titleEn', 'titleBn')}', style: body(12, color: Colors.white70)),
          onPressed: () {
            final next = [...cur];
            if (next.length >= 3) { next[_selected.clamp(0, next.length - 1)] = a['key'] as String; } else { next.add(a['key'] as String); }
            ref.read(labRolesProvider.notifier).state = next.join(',');
            setState(() { _learn.clear(); _sim = null; });
          },
        ),
      if (roles.length >= 3) Text(tr(context, 'Up to 3 roles. Select one, then pick another to swap it.', 'সর্বোচ্চ ৩টি রোল। একটি বেছে অন্যটি ট্যাপ করলে বদলে যাবে।'), style: body(12, color: Colors.white54)),
    ]);
  }

  Widget _box(Widget child, {Color? border}) => Container(
        margin: const EdgeInsets.only(top: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: _panel, borderRadius: BorderRadius.circular(18), border: Border.all(color: border ?? _lab(Colors.white, .08))),
        child: child,
      );

  Widget _stat(String label, String v, Color c) => Expanded(
        child: Column(children: [
          Text(v, style: display(22, color: c)),
          Text(label, textAlign: TextAlign.center, style: body(11, color: Colors.white60)),
        ]),
      );

  Widget _roleCard(BuildContext context, Map role, Color accent) {
    final p = (role['postings'] ?? {}) as Map;
    final weeks = role['timeToReadyWeeks'];
    return _box(
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(nm(context, role['role'] as Map, 'titleEn', 'titleBn'), style: display(18, color: accent)),
        const SizedBox(height: 10),
        Row(children: [
          _stat(tr(context, 'Readiness', 'প্রস্তুতি'), '${role['readiness']}%', accent),
          _stat(tr(context, 'Proven by evidence', 'প্রমাণিত'), '${role['provenReadiness']}%', _good),
          _stat(tr(context, 'Hours left', 'বাকি ঘণ্টা'), '${role['totalHours']}', Colors.white),
          _stat(tr(context, 'Weeks left', 'বাকি সপ্তাহ'), weeks == null ? '–' : '$weeks', Colors.white),
        ]),
        const SizedBox(height: 10),
        Row(children: [
          Icon(p['small'] == true ? Icons.warning_amber_rounded : Icons.info_outline, size: 16, color: p['small'] == true ? _warn : Colors.white54),
          const SizedBox(width: 6),
          Expanded(child: Text('${role['postingNote'] ?? ''}', style: body(12, color: p['small'] == true ? _warn : Colors.white60))),
        ]),
      ]),
      border: _lab(accent, .5),
    );
  }

  Widget _nextCard(BuildContext context, Map role) {
    final n = role['next'] as Map?;
    if (n == null) {
      return _box(Text(tr(context, 'No open gaps for this role. Keep your evidence up to date.', 'এই রোলে কোনো ঘাটতি নেই। প্রমাণ হালনাগাদ রাখুন।'), style: body(14, color: Colors.white)));
    }
    final key = n['skillKey'];
    final isQuiz = n['action'] == 'quiz';
    final mentors = (n['mentorsAvailable'] ?? 0) as int;
    return _box(
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(tr(context, 'YOUR NEXT BEST STEP', 'আপনার পরের সেরা ধাপ'), style: body(11, color: _warn, w: FontWeight.w800)),
        const SizedBox(height: 4),
        Text(nm(context, n, 'nameEn', 'nameBn'), style: display(20, color: Colors.white)),
        Text(tr(context, 'Level ${n['current']} → ${n['required']} · priority ${n['priority']}', 'লেভেল ${n['current']} → ${n['required']} · অগ্রাধিকার ${n['priority']}'), style: body(13, color: Colors.white70)),
        const SizedBox(height: 10),
        Wrap(spacing: 8, runSpacing: 6, children: [
          FilledButton.tonal(onPressed: () => context.push(isQuiz ? '/quiz/$key' : '/roadmap/$key'), child: Text(isQuiz ? tr(context, 'Take the quiz', 'কুইজ দিন') : tr(context, 'Submit a project', 'প্রজেক্ট দিন'))),
          OutlinedButton(onPressed: () => context.push('/roadmap/$key'), style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: BorderSide(color: _lab(Colors.white, .3))), child: Text(tr(context, 'Roadmap', 'রোডম্যাপ'))),
          OutlinedButton(onPressed: () => context.push('/gap/$key/mentors'), style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: BorderSide(color: _lab(Colors.white, .3))), child: Text(tr(context, 'Mentors ($mentors with open spots)', 'মেন্টর (${mentors}জন খালি আছে)'))),
        ]),
        const SizedBox(height: 6),
        Text(tr(context, 'A quiz or a mentor-reviewed project makes this count as proof and changes what comes next.', 'কুইজ বা মেন্টর-রিভিউ করা প্রজেক্ট এটিকে প্রমাণ হিসেবে গণ্য করে এবং পরের ধাপ বদলে দেয়।'), style: body(12, color: Colors.white54)),
      ]),
      border: _lab(_warn, .5),
    );
  }

  Widget _skillsCard(BuildContext context, Map role) {
    final skills = ((role['skills'] ?? []) as List).cast<Map>();
    if (skills.isEmpty) return const SizedBox();
    return _box(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(tr(context, 'WHY THIS ORDER', 'কেন এই ক্রম'), style: body(11, color: Colors.white60, w: FontWeight.w800)),
      Text(tr(context, 'Priority = demand × importance × gap', 'অগ্রাধিকার = চাহিদা × গুরুত্ব × ঘাটতি'), style: body(12, color: Colors.white54)),
      const SizedBox(height: 6),
      for (final s in skills)
        Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Checkbox(
            value: _learn.contains(s['skillKey']),
            activeColor: _good,
            visualDensity: VisualDensity.compact,
            onChanged: (v) => setState(() { v == true ? _learn.add(s['skillKey'] as String) : _learn.remove(s['skillKey']); _sim = null; }),
          ),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(nm(context, s, 'nameEn', 'nameBn'), style: body(15, color: Colors.white, w: FontWeight.w700))),
              Text('${s['priority']}', style: body(15, color: _warn, w: FontWeight.w800)),
            ]),
            Text('D ${s['D']} × W ${s['W']} × G ${s['G']} · ${tr(context, 'level', 'লেভেল')} ${s['current']}/${s['required']} · ${_evLabel(context, s['evidence'] as String)}', style: body(11, color: Colors.white60)),
            if (s['startable'] == false)
              Text('${tr(context, 'Learn first', 'আগে শিখুন')}: ${((s['learnFirst'] ?? []) as List).cast<Map>().map((l) => '${nm(context, l, 'nameEn', 'nameBn')} (L${l['level']})').join(', ')}', style: body(11, color: _warn)),
          ])),
        ])),
    ]));
  }

  String _evLabel(BuildContext c, String e) => e == 'verified' ? tr(c, 'proven', 'প্রমাণিত') : e == 'self' ? tr(c, 'self-rated only', 'শুধু নিজে দেওয়া') : tr(c, 'no evidence', 'প্রমাণ নেই');

  Widget _simCard(BuildContext context, Map role) {
    final sim = _sim;
    return _box(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Expanded(child: Text(tr(context, 'WHAT IF I LEARN…', 'যদি আমি শিখি…'), style: body(11, color: Colors.white60, w: FontWeight.w800))),
        Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), decoration: BoxDecoration(color: _lab(_warn, .15), borderRadius: BorderRadius.circular(10)), child: Text(tr(context, 'SIMULATION', 'সিমুলেশন'), style: body(10, color: _warn, w: FontWeight.w800))),
      ]),
      const SizedBox(height: 6),
      Text(_learn.isEmpty ? tr(context, 'Tick skills above to reach their required level, then simulate.', 'উপরে দক্ষতা টিক দিন, তারপর সিমুলেট করুন।') : tr(context, '${_learn.length} skill(s) selected', '${_learn.length}টি দক্ষতা বাছাই'), style: body(13, color: Colors.white70)),
      const SizedBox(height: 8),
      FilledButton(onPressed: _learn.isEmpty || _busy ? null : () => _simulate(role), child: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : Text(tr(context, 'Run simulation', 'সিমুলেশন চালান'))),
      if (sim != null) ...[
        const SizedBox(height: 12),
        Row(children: [
          _stat(tr(context, 'Now', 'এখন'), '${(sim['before'] as Map)['readiness']}%', Colors.white),
          const Icon(Icons.arrow_forward, color: Colors.white54),
          _stat(tr(context, 'If you get there', 'পৌঁছালে'), '${(sim['after'] as Map)['readiness']}%', _good),
          _stat(tr(context, 'Study hours', 'পড়ার ঘণ্টা'), '${sim['studyHoursNeeded']}', _warn),
        ]),
        const SizedBox(height: 6),
        Text('${tr(context, 'Proven by evidence stays', 'প্রমাণিত স্কোর থাকে')} ${(sim['provenReadiness'] as Map)['after']}%. ${sim['label']}', style: body(12, color: Colors.white60)),
      ],
    ]));
  }
}

// ---------------------------------------------------------------- exploration graph
class _Pos {
  _Pos(Size s, int n) {
    me = Offset(s.width * .12, s.height * .5);
    for (var i = 0; i < n; i++) {
      final y = n == 1 ? .5 : (.2 + .6 * i / (n - 1));
      roles.add(Offset(s.width * .44, s.height * y));
      skills.add([Offset(s.width * .72, s.height * (y - .08)), Offset(s.width * .72, s.height * (y + .08))]);
    }
  }
  late final Offset me;
  final List<Offset> roles = [];
  final List<List<Offset>> skills = [];
}

class _Graph extends StatelessWidget {
  const _Graph({required this.roles, required this.selected, required this.onSelect});
  final List<Map> roles;
  final int selected;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 400,
      decoration: BoxDecoration(color: _panel, borderRadius: BorderRadius.circular(22), border: Border.all(color: _lab(const Color(0xFF8B5CF6), .5))),
      clipBehavior: Clip.antiAlias,
      child: LayoutBuilder(builder: (context, box) {
        final pos = _Pos(Size(box.maxWidth, box.maxHeight), roles.length);
        return Stack(children: [
          Positioned.fill(child: CustomPaint(painter: _GraphPainter(roles, selected, pos))),
          Positioned(left: pos.me.dx - 34, top: pos.me.dy + 30, width: 68, child: Text(tr(context, 'YOU', 'আপনি'), textAlign: TextAlign.center, style: body(11, color: Colors.white, w: FontWeight.w800))),
          for (var i = 0; i < roles.length; i++) ...[
            Positioned(
              left: pos.roles[i].dx - 52, top: pos.roles[i].dy - 30, width: 104, height: 92,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onSelect(i),
                child: Column(children: [
                  const SizedBox(height: 10),
                  SizedBox(height: 40, child: Center(child: Text('${roles[i]['readiness']}%', style: display(14, color: Colors.white)))),
                  Text(nm(context, roles[i]['role'] as Map, 'titleEn', 'titleBn'), maxLines: 2, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis, style: body(11, color: _roleColors[i % 3], w: i == selected ? FontWeight.w800 : FontWeight.w600)),
                ]),
              ),
            ),
            for (var j = 0; j < math.min(2, ((roles[i]['skills'] ?? []) as List).length); j++)
              Positioned(
                left: pos.skills[i][j].dx + 10, top: pos.skills[i][j].dy - 14, width: box.maxWidth - pos.skills[i][j].dx - 14,
                child: Text('${nm(context, ((roles[i]['skills'] as List)[j]) as Map, 'nameEn', 'nameBn')}\nL${((roles[i]['skills'] as List)[j] as Map)['current']}→${((roles[i]['skills'] as List)[j] as Map)['required']}', maxLines: 2, overflow: TextOverflow.ellipsis, style: body(10.5, color: Colors.white70)),
              ),
          ],
        ]);
      }),
    );
  }
}

class _GraphPainter extends CustomPainter {
  _GraphPainter(this.roles, this.selected, this.pos);
  final List<Map> roles;
  final int selected;
  final _Pos pos;

  Path _hex(Offset c, double r) {
    final p = Path();
    for (var k = 0; k < 6; k++) {
      final a = math.pi / 3 * k - math.pi / 2;
      final pt = Offset(c.dx + r * math.cos(a), c.dy + r * math.sin(a));
      k == 0 ? p.moveTo(pt.dx, pt.dy) : p.lineTo(pt.dx, pt.dy);
    }
    return p..close();
  }

  void _glowHex(Canvas canvas, Offset c, double r, Color col, {bool strong = false}) {
    canvas.drawPath(_hex(c, r), Paint()..color = _lab(col, strong ? .35 : .18)..maskFilter = const MaskFilter.blur(BlurStyle.normal, 10));
    canvas.drawPath(_hex(c, r), Paint()..color = const Color(0xFF0F1630));
    canvas.drawPath(_hex(c, r), Paint()..color = col..style = PaintingStyle.stroke..strokeWidth = strong ? 2.6 : 1.6);
  }

  void _curve(Canvas canvas, Offset a, Offset b, Color col, bool strong) {
    final mid = (b.dx - a.dx) * .5;
    final path = Path()..moveTo(a.dx, a.dy)..cubicTo(a.dx + mid, a.dy, b.dx - mid, b.dy, b.dx, b.dy);
    canvas.drawPath(path, Paint()..color = _lab(col, strong ? .5 : .25)..style = PaintingStyle.stroke..strokeWidth = strong ? 6 : 4..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5));
    canvas.drawPath(path, Paint()..color = _lab(col, strong ? 1 : .6)..style = PaintingStyle.stroke..strokeWidth = strong ? 2.2 : 1.4);
  }

  @override
  void paint(Canvas canvas, Size size) {
    for (var i = 0; i < roles.length; i++) {
      final col = _roleColors[i % 3];
      final on = i == selected;
      _curve(canvas, pos.me, pos.roles[i], col, on);
      final sk = ((roles[i]['skills'] ?? []) as List).cast<Map>();
      for (var j = 0; j < math.min(2, sk.length); j++) {
        _curve(canvas, pos.roles[i], pos.skills[i][j], col, on);
        final s = sk[j];
        final cur = (s['current'] as num).toDouble(), req = (s['required'] as num).toDouble();
        final c = pos.skills[i][j];
        canvas.drawCircle(c, 9, Paint()..color = _lab(col, .25)..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6));
        canvas.drawCircle(c, 7, Paint()..color = const Color(0xFF0F1630));
        canvas.drawArc(Rect.fromCircle(center: c, radius: 7), -math.pi / 2, 2 * math.pi * (req == 0 ? 0 : cur / req), false, Paint()..color = col..style = PaintingStyle.stroke..strokeWidth = 3);
      }
      _glowHex(canvas, pos.roles[i], 26, col, strong: on);
    }
    _glowHex(canvas, pos.me, 24, const Color(0xFF60A5FA), strong: true);
  }

  @override
  bool shouldRepaint(covariant _GraphPainter old) => old.selected != selected || old.roles != roles;
}

final decisionLabRoutes = <RouteBase>[
  GoRoute(path: '/decision-lab', builder: (_, __) => const DecisionLabScreen()),
];
