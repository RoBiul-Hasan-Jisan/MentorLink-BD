import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';

/// Welcome screen — "Your future deserves proof."  (WILD edition)
///
/// The screen is a toy. Things to try:
///  • WATCH   – "proof." decodes from noise, the golden path draws itself with haptic ticks,
///              a shockwave fires and a VERIFIED stamp slams in.
///  • TOUCH   – drag: the whole stage tilts in 3D toward your finger, you write in
///              fading golden ink, and the dust runs away from you.
///  • HOLD    – press and hold: a BLACK HOLE grows under your finger and sucks the dust
///              into a spiral. Let go: it detonates a shockwave through the dust (heavy haptic).
///  • TAP     – tap a milestone: it flips in 3D, pings, and reveals a check mark.
///  • POKE    – tap the headline: it GLITCHES (RGB split + scramble). It also glitches by itself every 6 s.
///  • IDLE    – an aurora orbits the background and a comet laps the golden path forever.
///
/// Tap the journey to skip the intro. Reduced-motion shows the finished, static state.
class WelcomeScreen extends ConsumerStatefulWidget {
  const WelcomeScreen({super.key});

  @override
  ConsumerState<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends ConsumerState<WelcomeScreen>
    with TickerProviderStateMixin {
  // Intro timeline.
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 3400),
  );
  // Shockwave + stamp slam when the path lands.
  late final AnimationController _burst = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  );
  // Endless clock: dust, aurora, comet, idle glitch (24 s loop).
  late final AnimationController _tick = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 24),
  );
  // Headline poke-glitch.
  late final AnimationController _poke = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );
  // Node flip.
  late final AnimationController _flip = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 800),
  );
  // Black-hole charge while pressing (0 → 1 over 1.5 s).
  late final AnimationController _hold = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1500),
  );
  // Release shockwave.
  late final AnimationController _shock = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  );

  final ValueNotifier<Offset?> _touch = ValueNotifier<Offset?>(null);
  final ValueNotifier<Offset> _shockAt = ValueNotifier<Offset>(Offset.zero);
  final ValueNotifier<double> _shockPower = ValueNotifier<double>(0);
  final ValueNotifier<int> _trailV = ValueNotifier<int>(0);
  final List<Offset> _trail = [];
  Timer? _fade;

  bool _started = false;
  bool _reduce = false;
  int _lit = 0;
  int _flipIdx = -1;

  // The path is drawn between 16 % and 92 % of the timeline.
  static const _pathCurve = Interval(.16, .92, curve: Curves.easeInOutCubic);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _reduce = MediaQuery.disableAnimationsOf(context);

    _c.addListener(_onProgress);
    _c.addStatusListener((s) {
      if (s == AnimationStatus.completed && !_reduce) {
        HapticFeedback.heavyImpact();
        _burst.forward(from: 0);
      }
    });
    _hold.addStatusListener((s) {
      if (s == AnimationStatus.completed) HapticFeedback.mediumImpact();
    });

    if (_reduce) {
      _c.value = 1; // reduced motion: show the finished journey immediately
      _burst.value = 1; // stamp shown, no burst
    } else {
      _tick.repeat();
      _c.forward();
    }
  }

  /// Haptic tick each time the golden path reaches a new milestone.
  void _onProgress() {
    if (_reduce) return;
    final p = _pathCurve.transform(_c.value);
    var lit = 0;
    for (var i = 0; i < 4; i++) {
      if (p >= i / 3 - .02) lit = i + 1;
    }
    if (lit > _lit) {
      _lit = lit;
      if (lit < 4) HapticFeedback.selectionClick();
    }
  }

  @override
  void dispose() {
    _fade?.cancel();
    _c.dispose();
    _burst.dispose();
    _tick.dispose();
    _poke.dispose();
    _flip.dispose();
    _hold.dispose();
    _shock.dispose();
    _touch.dispose();
    _shockAt.dispose();
    _shockPower.dispose();
    _trailV.dispose();
    super.dispose();
  }

  void _skip() {
    if (_c.isAnimating) _c.value = 1;
  }

  // ── pointer handling: tilt, ink trail, black hole, shockwave ──

  void _addTrail(Offset p) {
    _trail.add(p);
    if (_trail.length > 28) _trail.removeAt(0);
    _trailV.value++;
  }

  void _down(PointerEvent e) {
    if (_reduce) return;
    _fade?.cancel();
    _touch.value = e.localPosition;
    _addTrail(e.localPosition);
    _hold.forward(from: 0);
  }

  void _move(PointerEvent e) {
    if (_reduce) return;
    _touch.value = e.localPosition;
    _addTrail(e.localPosition);
  }

  void _up(PointerEvent e) {
    if (_reduce) return;
    final at = _touch.value;
    final charge = _hold.value;
    if (at != null && charge > .25) {
      _shockAt.value = at;
      _shockPower.value = charge;
      HapticFeedback.heavyImpact();
      _shock.forward(from: 0);
    }
    _hold.value = 0;
    _touch.value = null;
    // let the ink trail melt away
    _fade?.cancel();
    _fade = Timer.periodic(const Duration(milliseconds: 16), (t) {
      if (_trail.isEmpty) {
        t.cancel();
        return;
      }
      _trail.removeAt(0);
      _trailV.value++;
    });
  }

  void _pokeHeadline() {
    if (!_c.isCompleted || _reduce) return;
    HapticFeedback.mediumImpact();
    _poke.forward(from: 0);
  }

  void _onNode(int i) {
    if (!_c.isCompleted) return;
    HapticFeedback.mediumImpact();
    setState(() => _flipIdx = i);
    _flip.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    final bn = ref.watch(localeProvider) == 'bn';
    final scale = MediaQuery.textScalerOf(context).scale(1).clamp(1.0, 1.6);
    final rowH = 76.0 * scale;
    final screen = MediaQuery.sizeOf(context);

    final milestones = <_Milestone>[
      _Milestone(
        Icons.explore_outlined,
        tr(context, 'Discover', 'আবিষ্কার করুন'),
        tr(
          context,
          'Set a career goal and see your skill gaps.',
          'ক্যারিয়ার লক্ষ্য ঠিক করুন, দক্ষতার ঘাটতি দেখুন।',
        ),
      ),
      _Milestone(
        Icons.menu_book_outlined,
        tr(context, 'Learn', 'শিখুন'),
        tr(
          context,
          'Follow roadmaps and learning paths built for your goal.',
          'আপনার লক্ষ্যের রোডম্যাপ ও শেখার পথ অনুসরণ করুন।',
        ),
      ),
      _Milestone(
        Icons.diversity_3_outlined,
        tr(context, 'Connect', 'যুক্ত হোন'),
        tr(
          context,
          'Find relevant mentors who can guide you.',
          'আপনাকে পথ দেখাতে পারেন এমন প্রাসঙ্গিক মেন্টর খুঁজুন।',
        ),
      ),
      _Milestone(
        Icons.verified_outlined,
        tr(context, 'Prove', 'প্রমাণ করুন'),
        tr(
          context,
          'Showcase projects and skills in your Career Passport, then explore opportunities.',
          'ক্যারিয়ার পাসপোর্টে প্রজেক্ট ও দক্ষতা দেখান, তারপর সুযোগ খুঁজুন।',
        ),
      ),
    ];

    // The content that tilts in 3D (built once, animated inside).
    final stage = LayoutBuilder(
      // Everything fits on one screen: if the phone is short (or the
      // text is large) the content scales down instead of scrolling.
      builder: (context, box) => FittedBox(
        fit: BoxFit.scaleDown,
        alignment: Alignment.topCenter,
        child: SizedBox(
          width: box.maxWidth,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 14, 24, 8),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Hero(
                  bn: bn,
                  anim: _c,
                  tick: _tick,
                  poke: _poke,
                  onPoke: _pokeHeadline,
                ),
                const SizedBox(height: 18),
                _JourneyHeader(
                  bn: bn,
                  anim: _c,
                  burst: _burst,
                  onSkip: _skip,
                ),
                const SizedBox(height: 6),
                GestureDetector(
                  behavior: HitTestBehavior.translucent,
                  onTap: _skip,
                  child: _Journey(
                    anim: _c,
                    burst: _burst,
                    tick: _tick,
                    flip: _flip,
                    flipIdx: _flipIdx,
                    onNode: _onNode,
                    reduce: _reduce,
                    items: milestones,
                    rowH: rowH,
                    bn: bn,
                    pathCurve: _pathCurve,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );

    return Scaffold(
      backgroundColor: Brand.forest,
      body: Listener(
        behavior: HitTestBehavior.translucent,
        onPointerDown: _down,
        onPointerMove: _move,
        onPointerUp: _up,
        onPointerCancel: _up,
        child: Stack(
          children: [
            // Brand diamond pattern on forest green + orbiting aurora.
            const Positioned.fill(
              child: DiamondPanel(
                padding: EdgeInsets.zero,
                child: SizedBox.expand(),
              ),
            ),
            Positioned.fill(
              child: IgnorePointer(
                child: RepaintBoundary(
                  child: CustomPaint(painter: _AmbientPainter(tick: _tick)),
                ),
              ),
            ),
            // Dust, black hole, shockwave and golden ink.
            Positioned.fill(
              child: IgnorePointer(
                child: RepaintBoundary(
                  child: CustomPaint(
                    painter: _DustPainter(
                      tick: _tick,
                      touch: _touch,
                      trail: _trail,
                      trailV: _trailV,
                      hold: _hold,
                      shock: _shock,
                      shockAt: _shockAt,
                      shockPower: _shockPower,
                    ),
                  ),
                ),
              ),
            ),
            SafeArea(
              child: Column(
                children: [
                  _Header(
                    bn: bn,
                    onLang: (code) =>
                        ref.read(localeProvider.notifier).state = code,
                  ),
                  Expanded(
                    // 3D tilt toward the finger, eased.
                    child: ValueListenableBuilder<Offset?>(
                      valueListenable: _touch,
                      child: stage,
                      builder: (context, tp, child) {
                        final target = tp == null
                            ? Offset.zero
                            : Offset(
                                (tp.dx / screen.width - .5) * 2,
                                (tp.dy / screen.height - .5) * 2,
                              );
                        return TweenAnimationBuilder<Offset>(
                          tween: Tween<Offset>(end: target),
                          duration: const Duration(milliseconds: 160),
                          curve: Curves.easeOut,
                          child: child,
                          builder: (context, o, child) => Transform(
                            alignment: Alignment.center,
                            transform: Matrix4.identity()
                              ..setEntry(3, 2, .0012)
                              ..rotateX(-o.dy * .10)
                              ..rotateY(o.dx * .14),
                            child: child,
                          ),
                        );
                      },
                    ),
                  ),
                  _Actions(bn: bn),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ───────────────────────── text helpers ─────────────────────────

/// Bricolage Grotesque has no Bengali glyphs, so Bangla uses Hind Siliguri.
TextStyle _head(
  bool bn,
  double size, {
  Color color = Colors.white,
  FontWeight? w,
}) => bn
    ? GoogleFonts.hindSiliguri(
        fontSize: size,
        fontWeight: w ?? FontWeight.w700,
        color: color,
        height: 1.28,
      )
    : display(
        size,
        color: color,
        w: w ?? FontWeight.w800,
      ).copyWith(height: 1.08, letterSpacing: -.4);

TextStyle _ui(
  bool bn,
  double size, {
  Color color = Colors.white,
  FontWeight w = FontWeight.w700,
}) => bn ? body(size, color: color, w: w) : display(size, color: color, w: w);

/// "Decrypt" effect: every glyph flickers through random characters, then locks
/// onto the real one, left to right. [t] is 0..1, [frame] changes ~20x per second.
String _decode(String target, double t, int frame) {
  const pool = 'abcdefghkmnopqrstuvwxyz#%&?*+<>01';
  final b = StringBuffer();
  for (var i = 0; i < target.length; i++) {
    final at = i / target.length * .7;
    if (t >= at + .3 || target[i] == '.') {
      b.write(target[i]);
    } else {
      b.write(pool[math.Random(frame * 13 + i * 5).nextInt(pool.length)]);
    }
  }
  return b.toString();
}

// ───────────────────────── header ─────────────────────────

class _Header extends StatelessWidget {
  const _Header({required this.bn, required this.onLang});
  final bool bn;
  final ValueChanged<String> onLang;

  @override
  Widget build(BuildContext context) {
    Widget lang(String t, bool on, String code, String semantic) => Semantics(
      button: true,
      selected: on,
      label: semantic,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => onLang(code),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          constraints: const BoxConstraints(minHeight: 40, minWidth: 48),
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: on ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(22),
          ),
          child: Text(
            t,
            style: _ui(
              code == 'bn',
              14,
              color: on ? Brand.forest : Colors.white,
            ),
          ),
        ),
      ),
    );

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Semantics(
                label: 'MentorLink BD',
                excludeSemantics: true,
                child: Row(
                  children: [
                    const _Logo(),
                    const SizedBox(width: 10),
                    Text('MentorLink', style: display(20, color: Colors.white)),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: Brand.saffron,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text('BD', style: display(11, color: Brand.ink)),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.all(2),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: .10),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: Colors.white.withValues(alpha: .14)),
            ),
            child: Row(
              children: [
                lang('EN', !bn, 'en', 'English'),
                lang('বাংলা', bn, 'bn', 'বাংলা'),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Refined M mark: soft white tile, forest "M", a saffron path-dot echoing the journey.
class _Logo extends StatelessWidget {
  const _Logo();
  @override
  Widget build(BuildContext context) => Container(
    width: 40,
    height: 40,
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(12),
      gradient: const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [Colors.white, Color(0xFFDDEBE4)],
      ),
      boxShadow: [
        BoxShadow(
          color: Brand.saffron.withValues(alpha: .28),
          blurRadius: 14,
          offset: const Offset(0, 4),
        ),
      ],
    ),
    child: Stack(
      alignment: Alignment.center,
      children: [
        Text('M', style: display(25, color: Brand.delta)),
        Positioned(
          right: 6,
          bottom: 6,
          child: Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              color: Brand.saffron,
              shape: BoxShape.circle,
            ),
          ),
        ),
      ],
    ),
  );
}

// ───────────────────────── hero ─────────────────────────

class _Hero extends StatelessWidget {
  const _Hero({
    required this.bn,
    required this.anim,
    required this.tick,
    required this.poke,
    required this.onPoke,
  });
  final bool bn;
  final Animation<double> anim, tick, poke;
  final VoidCallback onPoke;

  static const _cyan = Color(0xFF2BF0FF);
  static const _magenta = Color(0xFFFF2BD6);

  @override
  Widget build(BuildContext context) {
    final big = bn ? 34.0 : 38.0;

    Widget headline(Color c1, Color c2, String proofEn) {
      final line1 = _head(bn, big, color: c1);
      final line2 = _head(bn, big, color: c2);
      return Text.rich(
        TextSpan(
          style: line1,
          children: bn
              ? [
                  const TextSpan(text: 'আপনার ভবিষ্যৎ চায় '),
                  TextSpan(text: 'প্রমাণ।', style: line2),
                ]
              : [
                  const TextSpan(text: 'Your future\ndeserves '),
                  TextSpan(text: proofEn, style: line2),
                ],
        ),
      );
    }

    return AnimatedBuilder(
      animation: Listenable.merge([anim, tick, poke]),
      builder: (context, _) {
        final t = const Interval(
          0,
          .22,
          curve: Curves.easeOutCubic,
        ).transform(anim.value);

        // Intro: "proof." decodes from noise.
        final dt = const Interval(.04, .42).transform(anim.value);
        final introFrame = (anim.value * 3400 / 50).floor();
        var proofEn = dt >= 1 ? 'proof.' : _decode('proof.', dt, introFrame);

        // Glitch: every 6 s by itself, or whenever the headline is poked.
        final secs = tick.value * 24;
        final live = anim.isCompleted && tick.isAnimating;
        final glitch = live && ((secs % 6) < .35 || poke.isAnimating);
        final gFrame = (secs * 30).floor();
        if (glitch) {
          proofEn = _decode('proof.', .15 + (gFrame % 5) * .1, gFrame);
        }

        final Widget text = glitch
            ? Transform.translate(
                offset: Offset(math.sin(gFrame * 7.0) * 2.5, 0),
                child: Stack(
                  children: [
                    Transform.translate(
                      offset: const Offset(-3.5, 0),
                      child: headline(
                        Colors.transparent,
                        _cyan.withValues(alpha: .8),
                        proofEn,
                      ),
                    ),
                    Transform.translate(
                      offset: const Offset(3.5, 1),
                      child: headline(
                        Colors.transparent,
                        _magenta.withValues(alpha: .8),
                        proofEn,
                      ),
                    ),
                    headline(Colors.white, Brand.saffron, proofEn),
                  ],
                ),
              )
            : headline(Colors.white, Brand.saffron, proofEn);

        return Opacity(
          opacity: t,
          child: Transform.translate(
            offset: Offset(0, (1 - t) * 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GestureDetector(
                  behavior: HitTestBehavior.translucent,
                  onTap: onPoke,
                  child: Semantics(
                    header: true,
                    label: tr(
                      context,
                      'Your future deserves proof.',
                      'আপনার ভবিষ্যৎ চায় প্রমাণ।',
                    ),
                    excludeSemantics: true,
                    child: text,
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  width: 44,
                  height: 3,
                  decoration: BoxDecoration(
                    color: Brand.saffron,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  tr(
                    context,
                    'Find your direction, learn with guidance, prove your skills, and discover your next opportunity.',
                    'দিক খুঁজে নিন, গাইডেন্স নিয়ে শিখুন, দক্ষতা প্রমাণ করুন এবং পরের সুযোগ খুঁজে নিন।',
                  ),
                  style: body(
                    16,
                    color: Colors.white.withValues(alpha: .82),
                    w: FontWeight.w500,
                  ).copyWith(height: 1.45),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

// ───────────────────────── journey ─────────────────────────

class _Milestone {
  const _Milestone(this.icon, this.title, this.desc);
  final IconData icon;
  final String title, desc;
}

class _JourneyHeader extends StatelessWidget {
  const _JourneyHeader({
    required this.bn,
    required this.anim,
    required this.burst,
    required this.onSkip,
  });
  final bool bn;
  final Animation<double> anim;
  final Animation<double> burst;
  final VoidCallback onSkip;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [
      Text(
        tr(context, 'YOUR JOURNEY', 'আপনার যাত্রা'),
        style: _ui(
          bn,
          12,
          color: Brand.saffron,
        ).copyWith(letterSpacing: bn ? 0 : 1.6),
      ),
      SizedBox(
        height: 40,
        child: AnimatedBuilder(
          animation: Listenable.merge([anim, burst]),
          builder: (context, _) {
            final running = anim.isAnimating;
            return Stack(
              alignment: Alignment.centerRight,
              clipBehavior: Clip.none,
              children: [
                // Skip fades out while the stamp slams in on the same spot.
                IgnorePointer(
                  ignoring: !running,
                  child: AnimatedOpacity(
                    duration: const Duration(milliseconds: 200),
                    opacity: running ? 1 : 0,
                    child: Semantics(
                      button: true,
                      excludeSemantics: !running,
                      label: tr(
                        context,
                        'Skip animation',
                        'অ্যানিমেশন এড়িয়ে যান',
                      ),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(16),
                        onTap: onSkip,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 12,
                          ),
                          child: Text(
                            tr(context, 'Skip', 'এড়িয়ে যান'),
                            style: body(
                              13,
                              color: Colors.white.withValues(alpha: .75),
                              w: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                ExcludeSemantics(child: _Stamp(t: burst.value, bn: bn)),
              ],
            );
          },
        ),
      ),
    ],
  );
}

/// Rubber-stamp "VERIFIED": scales down from huge, hits, then shakes and settles.
class _Stamp extends StatelessWidget {
  const _Stamp({required this.t, required this.bn});
  final double t;
  final bool bn;

  @override
  Widget build(BuildContext context) {
    if (t <= 0) return const SizedBox.shrink();
    final slam = Curves.easeInQuart.transform((t / .3).clamp(0.0, 1.0));
    final scale = lerpDouble(2.6, 1, slam)!;
    final opacity = (t / .18).clamp(0.0, 1.0);
    final shake = t > .3 ? math.sin(t * 60) * (1 - t) * 3 : 0.0;

    return Transform.translate(
      offset: Offset(0, shake),
      child: Transform.rotate(
        angle: -.1,
        child: Transform.scale(
          scale: scale,
          child: Opacity(
            opacity: opacity,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: Brand.saffron.withValues(alpha: .14),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Brand.saffron, width: 2),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.check_rounded, size: 14, color: Brand.saffron),
                  const SizedBox(width: 4),
                  Text(
                    tr(context, 'VERIFIED', 'যাচাইকৃত'),
                    style: _ui(
                      bn,
                      11.5,
                      color: Brand.saffron,
                    ).copyWith(letterSpacing: bn ? 0 : 1.8),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Journey extends StatelessWidget {
  const _Journey({
    required this.anim,
    required this.burst,
    required this.tick,
    required this.flip,
    required this.flipIdx,
    required this.onNode,
    required this.reduce,
    required this.items,
    required this.rowH,
    required this.bn,
    required this.pathCurve,
  });
  final Animation<double> anim, burst, tick, flip;
  final int flipIdx;
  final ValueChanged<int> onNode;
  final bool reduce;
  final List<_Milestone> items;
  final double rowH;
  final bool bn;
  final Curve pathCurve;

  static const double _colW = 76;
  static const double _nodeD = 44;
  static const List<double> _xs = [22, 54];

  List<Offset> _points() => [
    for (var i = 0; i < items.length; i++)
      Offset(_xs[i % 2], rowH * i + rowH / 2),
  ];

  @override
  Widget build(BuildContext context) {
    final pts = _points();
    final n = items.length;
    final totalH = rowH * n;

    return Semantics(
      container: true,
      label: tr(
        context,
        'Your journey in four steps: Discover, Learn, Connect, Prove.',
        'চার ধাপে আপনার যাত্রা: আবিষ্কার, শেখা, যুক্ত হওয়া, প্রমাণ।',
      ),
      child: SizedBox(
        height: totalH,
        child: AnimatedBuilder(
          animation: Listenable.merge([anim, burst, tick, flip]),
          builder: (context, _) {
            final p = pathCurve.transform(anim.value);
            // After the intro, a comet laps the path forever (4 s per lap).
            final spark = (anim.isCompleted && !reduce)
                ? (tick.value * 6) % 1.0
                : null;
            return Stack(
              clipBehavior: Clip.none,
              children: [
                // golden path
                Positioned(
                  left: 0,
                  top: 0,
                  width: _colW,
                  height: totalH,
                  child: ExcludeSemantics(
                    child: RepaintBoundary(
                      child: CustomPaint(
                        painter: _PathPainter(
                          points: pts,
                          progress: p,
                          drawing: anim.isAnimating,
                          spark: spark,
                        ),
                      ),
                    ),
                  ),
                ),
                for (var i = 0; i < n; i++) ...[
                  // node — tap to flip in 3D
                  Positioned(
                    left: pts[i].dx - _nodeD / 2,
                    top: pts[i].dy - _nodeD / 2,
                    child: ExcludeSemantics(
                      child: Builder(
                        builder: (context) {
                          final ft = flipIdx == i ? flip.value : 0.0;
                          final ang =
                              Curves.easeInOutCubic.transform(ft) *
                              math.pi *
                              2;
                          return GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: () => onNode(i),
                            child: Transform(
                              alignment: Alignment.center,
                              transform: Matrix4.identity()
                                ..setEntry(3, 2, .003)
                                ..rotateY(ang),
                              child: _Node(
                                icon: items[i].icon,
                                t: _local(p, i / (n - 1), .04, .14),
                                last: i == n - 1,
                                size: _nodeD,
                                ping: ft,
                                back: ang > math.pi / 2 && ang < math.pi * 1.5,
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                  // label
                  Positioned(
                    left: _colW + 14,
                    right: 0,
                    top: rowH * i,
                    height: rowH,
                    child: IgnorePointer(
                      child: Builder(
                        builder: (context) {
                          final t = Curves.easeOutCubic.transform(
                            _local(p, i / (n - 1), .0, .2),
                          );
                          return Opacity(
                            opacity: t,
                            child: Transform.translate(
                              offset: Offset((1 - t) * 12, 0),
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      items[i].title,
                                      style: _head(bn, 19, w: FontWeight.w700)
                                          .copyWith(
                                            height: 1.15,
                                            letterSpacing: bn ? 0 : -.2,
                                          ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      items[i].desc,
                                      style: body(
                                        13.5,
                                        color: Colors.white.withValues(
                                          alpha: .78,
                                        ),
                                        w: FontWeight.w500,
                                      ).copyWith(height: 1.35),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                ],
                // shockwave + sparks from the final node
                Positioned.fill(
                  child: IgnorePointer(
                    child: CustomPaint(
                      painter: _BurstPainter(center: pts.last, t: burst.value),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  /// Local 0..1 progress for a node that the path reaches at [at]; [lead] lets it start slightly early.
  static double _local(double p, double at, double lead, double span) =>
      ((p - at + lead) / span).clamp(0.0, 1.0);
}

class _Node extends StatelessWidget {
  const _Node({
    required this.icon,
    required this.t,
    required this.last,
    required this.size,
    required this.ping,
    required this.back,
  });
  final IconData icon;
  final double t, size, ping;
  final bool last, back;

  @override
  Widget build(BuildContext context) {
    final pop = Curves.easeOutBack.transform(t);
    final lit = t > 0;
    final fill = last ? Brand.saffron : Brand.forest;
    final iconColor = last ? Brand.ink : Brand.saffron;

    return Transform.scale(
      scale: lerpDouble(.7, 1, pop)!,
      child: Opacity(
        opacity: lerpDouble(.35, 1, t)!,
        child: SizedBox(
          width: size,
          height: size,
          child: Stack(
            clipBehavior: Clip.none,
            alignment: Alignment.center,
            children: [
              if (last && lit)
                // destination halo
                Container(
                  width: size + 14 * t,
                  height: size + 14 * t,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Brand.saffron.withValues(alpha: .35 * t),
                      width: 2,
                    ),
                  ),
                ),
              if (ping > 0 && ping < 1)
                // tap ping
                Container(
                  width: size + ping * 46,
                  height: size + ping * 46,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Brand.saffron.withValues(alpha: .65 * (1 - ping)),
                      width: 2.5 * (1 - ping) + .5,
                    ),
                  ),
                ),
              Container(
                width: size,
                height: size,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: fill,
                  border: Border.all(
                    color: Brand.saffron.withValues(alpha: lit ? 1 : .3),
                    width: 2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Brand.saffron.withValues(alpha: .38 * t),
                      blurRadius: 18,
                      spreadRadius: 1,
                    ),
                  ],
                ),
                child: back
                    ? Transform.flip(
                        flipX: true,
                        child: Icon(
                          Icons.check_rounded,
                          size: 24,
                          color: iconColor,
                        ),
                      )
                    : Icon(icon, size: 22, color: iconColor),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Draws the faint full track, then the golden path (with a soft glow and a leading spark) up to [progress].
/// When [spark] is set (intro finished) a bright comet keeps lapping the path.
class _PathPainter extends CustomPainter {
  _PathPainter({
    required this.points,
    required this.progress,
    required this.drawing,
    required this.spark,
  });
  final List<Offset> points;
  final double progress;
  final bool drawing;
  final double? spark;

  Path _full() {
    final path = Path()..moveTo(points.first.dx, points.first.dy);
    for (var i = 1; i < points.length; i++) {
      final a = points[i - 1], b = points[i];
      final dy = b.dy - a.dy;
      path.cubicTo(a.dx, a.dy + dy * .62, b.dx, b.dy - dy * .62, b.dx, b.dy);
    }
    return path;
  }

  @override
  void paint(Canvas canvas, Size size) {
    final full = _full();
    final track = Paint()
      ..color = Colors.white.withValues(alpha: .14)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;
    canvas.drawPath(full, track);

    final p = progress.clamp(0.0, 1.0);
    if (p <= 0) return;
    final metric = full.computeMetrics().first;
    final drawn = metric.extractPath(0, metric.length * p);

    canvas.drawPath(
      drawn,
      Paint()
        ..color = Brand.saffron.withValues(alpha: .45)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 9
        ..strokeCap = StrokeCap.round
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6),
    );
    canvas.drawPath(
      drawn,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Brand.saffron, Color(0xFFFFD98A)],
        ).createShader(Offset.zero & size)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3.5
        ..strokeCap = StrokeCap.round,
    );

    if (drawing && p < 1) {
      final tip = metric.getTangentForOffset(metric.length * p)?.position;
      if (tip != null) {
        canvas.drawCircle(
          tip,
          9,
          Paint()
            ..color = Brand.saffron.withValues(alpha: .5)
            ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5),
        );
        canvas.drawCircle(tip, 4, Paint()..color = const Color(0xFFFFF3D6));
      }
    }

    // idle comet
    final s = spark;
    if (s != null && p >= 1) {
      final len = metric.length;
      if (s > .1) {
        canvas.drawPath(
          metric.extractPath(len * (s - .1), len * s),
          Paint()
            ..color = const Color(0xFFFFF3D6).withValues(alpha: .55)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 4
            ..strokeCap = StrokeCap.round
            ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2),
        );
      }
      final pos = metric.getTangentForOffset(len * s)?.position;
      if (pos != null) {
        canvas.drawCircle(
          pos,
          10,
          Paint()
            ..color = Brand.saffron.withValues(alpha: .55)
            ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6),
        );
        canvas.drawCircle(pos, 3.6, Paint()..color = Colors.white);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _PathPainter old) =>
      old.progress != progress ||
      old.drawing != drawing ||
      old.points != points ||
      old.spark != spark;
}

/// Shockwave ring + radial sparks, fired from the "Prove" node when the path lands.
class _BurstPainter extends CustomPainter {
  _BurstPainter({required this.center, required this.t});
  final Offset center;
  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    if (t <= 0 || t >= 1) return;
    final e = Curves.easeOutCubic.transform(t);

    if (t < .3) {
      canvas.drawCircle(
        center,
        34 * (1 - t / .3) + 10,
        Paint()
          ..color = Brand.saffron.withValues(alpha: .35 * (1 - t / .3))
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 10),
      );
    }
    canvas.drawCircle(
      center,
      22 + e * 120,
      Paint()
        ..color = Brand.saffron.withValues(alpha: .6 * (1 - t))
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3.5 * (1 - t) + .5,
    );
    const count = 18;
    for (var i = 0; i < count; i++) {
      final a = i / count * math.pi * 2 + (i % 2) * .17;
      final dist = e * (70 + (i % 3) * 34);
      final pos = center + Offset(math.cos(a), math.sin(a)) * dist;
      final r = (4 - 3 * t) * (i.isEven ? 1.0 : .7);
      canvas.drawCircle(
        pos,
        r,
        Paint()
          ..color = (i % 3 == 0 ? const Color(0xFFFFF3D6) : Brand.saffron)
              .withValues(alpha: 1 - t),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _BurstPainter old) =>
      old.t != t || old.center != center;
}

// ───────────────────────── background lighting ─────────────────────────

/// Aurora: the two glows slowly orbit (integer loops of the 24 s clock, so it never jumps),
/// plus the M-logo ring and a fine golden arc.
class _AmbientPainter extends CustomPainter {
  _AmbientPainter({required this.tick}) : super(repaint: tick);
  final Animation<double> tick;

  @override
  void paint(Canvas canvas, Size s) {
    final a = tick.value * math.pi * 2 * 2; // 12 s orbit
    final b = tick.value * math.pi * 2; // 24 s orbit

    final top = Rect.fromCircle(
      center: Offset(
        s.width * (.85 + .12 * math.sin(a)),
        s.height * (.08 + .05 * math.cos(a)),
      ),
      radius: s.width * 1.05,
    );
    canvas.drawRect(
      Offset.zero & s,
      Paint()
        ..shader = RadialGradient(
          colors: [
            Brand.delta.withValues(alpha: .75),
            Brand.delta.withValues(alpha: 0),
          ],
        ).createShader(top),
    );

    final gold = Rect.fromCircle(
      center: Offset(
        s.width * (.12 + .14 * math.cos(b)),
        s.height * (.72 + .07 * math.sin(b)),
      ),
      radius: s.width * .8,
    );
    canvas.drawRect(
      Offset.zero & s,
      Paint()
        ..shader = RadialGradient(
          colors: [
            Brand.saffron.withValues(alpha: .12),
            Brand.saffron.withValues(alpha: 0),
          ],
        ).createShader(gold),
    );

    // ring echoing the M logo
    canvas.drawCircle(
      Offset(s.width * 1.02, s.height * .17),
      s.width * .30,
      Paint()
        ..color = Colors.white.withValues(alpha: .05)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 26,
    );
    // single fine golden arc
    final arc = Path()
      ..moveTo(-10, s.height * .30)
      ..cubicTo(
        s.width * .25,
        s.height * .22,
        s.width * .65,
        s.height * .36,
        s.width + 10,
        s.height * .27,
      );
    canvas.drawPath(
      arc,
      Paint()
        ..color = Brand.saffron.withValues(alpha: .16)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}

/// The playground layer:
///  • 72 golden dust motes drifting upward in seamless loops
///  • tap/drag  → motes flee your finger, you write fading golden ink
///  • hold      → a black hole charges and spirals the motes inward
///  • release   → the black hole detonates a shockwave that blasts the motes outward
class _DustPainter extends CustomPainter {
  _DustPainter({
    required this.tick,
    required this.touch,
    required this.trail,
    required this.trailV,
    required this.hold,
    required this.shock,
    required this.shockAt,
    required this.shockPower,
  }) : super(repaint: Listenable.merge([tick, touch, trailV, hold, shock]));

  final Animation<double> tick, hold, shock;
  final ValueNotifier<Offset?> touch;
  final List<Offset> trail;
  final ValueNotifier<int> trailV;
  final ValueNotifier<Offset> shockAt;
  final ValueNotifier<double> shockPower;

  // x, y, rise cycles, sway phase, radius, sway cycles
  static final List<List<double>> _seeds = List.generate(72, (i) {
    final r = math.Random(i * 7 + 3);
    return [
      r.nextDouble(),
      r.nextDouble(),
      (r.nextInt(3) + 1).toDouble(),
      r.nextDouble() * math.pi * 2,
      1 + r.nextDouble() * 2.4,
      (r.nextInt(3) + 1).toDouble(),
    ];
  });

  static const _cream = Color(0xFFFFF3D6);

  @override
  void paint(Canvas canvas, Size size) {
    final t = tick.value;
    final tp = touch.value;
    final charge = hold.value;
    final sv = shock.value;
    final shocking = sv > 0 && sv < 1;
    final sc = shockAt.value;
    final sp = shockPower.value;
    final shockR = Curves.easeOutCubic.transform(sv) * 520;

    // How far the press has turned from "flee" into "black hole".
    final k = (charge / .2).clamp(0.0, 1.0);
    final reach = 130 + 100 * charge;

    final paint = Paint();
    for (final s in _seeds) {
      final x = s[0] + math.sin(t * math.pi * 2 * s[5] + s[3]) * .025;
      final y = (s[1] - t * s[2]) % 1.0;
      var pos = Offset(x * size.width, y * size.height);
      var glow = 0.0;

      if (tp != null) {
        final d = pos - tp;
        final dist = d.distance;
        if (dist < reach && dist > .01) {
          final g = 1 - dist / reach;
          final u = d / dist;
          final radial = lerpDouble(g * g * 70, -g * (40 + 60 * charge), k)!;
          final tangential = g * 55 * charge * k;
          pos += u * radial + Offset(-u.dy, u.dx) * tangential;
          glow = g;
        }
      }

      if (shocking) {
        final d = pos - sc;
        final dist = d.distance;
        final band = (1 - (dist - shockR).abs() / 70).clamp(0.0, 1.0);
        if (band > 0 && dist > .01) {
          pos += d / dist * (band * band * 110 * sp * (1 - sv));
          glow = math.max(glow, band * (1 - sv));
        }
      }

      final edge = math.sin(y * math.pi); // fade at top/bottom
      final alpha = ((.20 + .6 * glow) * edge).clamp(0.0, 1.0);
      paint.color = Color.lerp(
        Brand.saffron,
        _cream,
        glow,
      )!.withValues(alpha: alpha);
      canvas.drawCircle(pos, s[4] * (1 + glow * 1.2), paint);
    }

    // shockwave rings
    if (shocking) {
      canvas.drawCircle(
        sc,
        shockR,
        Paint()
          ..color = Brand.saffron.withValues(alpha: .55 * (1 - sv) * sp)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 4 * (1 - sv) + .5,
      );
      canvas.drawCircle(
        sc,
        shockR * .8,
        Paint()
          ..color = _cream.withValues(alpha: .25 * (1 - sv) * sp)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5,
      );
    }

    // golden ink trail
    if (trail.length > 1) {
      final path = Path()..moveTo(trail.first.dx, trail.first.dy);
      for (var i = 1; i < trail.length; i++) {
        path.lineTo(trail[i].dx, trail[i].dy);
      }
      canvas.drawPath(
        path,
        Paint()
          ..color = Brand.saffron.withValues(alpha: .28)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 12
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5),
      );
      final seg = Paint()
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round;
      for (var i = 1; i < trail.length; i++) {
        final a = i / trail.length;
        seg
          ..strokeWidth = 1 + 5 * a
          ..color = Color.lerp(
            Brand.saffron,
            _cream,
            a,
          )!.withValues(alpha: .75 * a);
        canvas.drawLine(trail[i - 1], trail[i], seg);
      }
    }

    if (tp != null) {
      // soft glow following the finger
      canvas.drawCircle(
        tp,
        70 + 40 * charge,
        Paint()
          ..color = Brand.saffron.withValues(alpha: .14 + .12 * charge)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 30),
      );
      canvas.drawCircle(
        tp,
        22,
        Paint()
          ..color = Colors.white.withValues(alpha: .22)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5,
      );

      // black hole core + spinning accretion arcs
      if (charge > .12) {
        final r = 12 + 26 * charge;
        canvas.drawCircle(
          tp,
          r + 4,
          Paint()
            ..color = Brand.forest.withValues(alpha: .9)
            ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3),
        );
        for (var i = 0; i < 3; i++) {
          final ang = t * math.pi * 2 * (40 + 8 * i) * (i.isEven ? 1 : -1);
          canvas.drawArc(
            Rect.fromCircle(center: tp, radius: r + 8 + i * 7),
            ang,
            1.5 + .3 * i,
            false,
            Paint()
              ..color = (i == 1 ? _cream : Brand.saffron).withValues(
                alpha: (.9 - .22 * i) * charge.clamp(.3, 1.0),
              )
              ..style = PaintingStyle.stroke
              ..strokeWidth = 2.6 - .4 * i
              ..strokeCap = StrokeCap.round,
          );
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DustPainter old) => false;
}

// ───────────────────────── actions ─────────────────────────

class _Actions extends StatelessWidget {
  const _Actions({required this.bn});
  final bool bn;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(24, 14, 24, 14),
    decoration: BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          Brand.forest.withValues(alpha: 0),
          Brand.forest.withValues(alpha: .94),
        ],
        stops: const [0, .32],
      ),
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        _PressButton(
          label: tr(context, 'Get started', 'শুরু করুন'),
          bn: bn,
          primary: true,
          onPressed: () => context.go('/sign-up'),
        ),
        const SizedBox(height: 10),
        _PressButton(
          label: tr(
            context,
            'I already have an account',
            'আমার অ্যাকাউন্ট আছে',
          ),
          bn: bn,
          primary: false,
          onPressed: () => context.go('/sign-in'),
        ),
      ],
    ),
  );
}

/// Pill button with a soft press-scale. Primary = saffron with ink text (high contrast); secondary = outlined white.
class _PressButton extends StatefulWidget {
  const _PressButton({
    required this.label,
    required this.bn,
    required this.primary,
    required this.onPressed,
  });
  final String label;
  final bool bn, primary;
  final VoidCallback onPressed;

  @override
  State<_PressButton> createState() => _PressButtonState();
}

class _PressButtonState extends State<_PressButton> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final primary = widget.primary;
    final reduce = MediaQuery.disableAnimationsOf(context);
    final fg = primary ? Brand.ink : Colors.white;

    return AnimatedScale(
      scale: _down && !reduce ? .97 : 1,
      duration: const Duration(milliseconds: 110),
      curve: Curves.easeOut,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(30),
          boxShadow: primary
              ? [
                  BoxShadow(
                    color: Brand.saffron.withValues(alpha: .35),
                    blurRadius: 22,
                    offset: const Offset(0, 8),
                  ),
                ]
              : null,
        ),
        child: Material(
          color: primary ? Brand.saffron : Colors.white.withValues(alpha: .06),
          shape: StadiumBorder(
            side: primary
                ? BorderSide.none
                : BorderSide(
                    color: Colors.white.withValues(alpha: .45),
                    width: 1.5,
                  ),
          ),
          child: InkWell(
            customBorder: const StadiumBorder(),
            splashColor: (primary ? Brand.ink : Colors.white).withValues(
              alpha: .12,
            ),
            onHighlightChanged: (v) => setState(() => _down = v),
            onTap: () {
              HapticFeedback.selectionClick();
              widget.onPressed();
            },
            child: Container(
              height: primary ? 56 : 52,
              alignment: Alignment.center,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Flexible(
                    child: Text(
                      widget.label,
                      textAlign: TextAlign.center,
                      style: _ui(widget.bn, 16, color: fg),
                    ),
                  ),
                  if (primary) ...[
                    const SizedBox(width: 10),
                    Container(
                      width: 26,
                      height: 26,
                      decoration: BoxDecoration(
                        color: Brand.forest,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.arrow_forward_rounded,
                        color: Brand.saffron,
                        size: 17,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}