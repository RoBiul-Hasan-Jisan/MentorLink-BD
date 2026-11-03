import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';

/// Welcome screen — "Your future deserves proof."
///
/// A forest-green stage with a golden path that draws itself through four
/// milestones (Discover → Learn → Connect → Prove). The intro plays once
/// (~3.4 s), can be skipped with a tap, and is replaced by the finished static
/// state when the device asks for reduced motion.
class WelcomeScreen extends ConsumerStatefulWidget {
  const WelcomeScreen({super.key});

  @override
  ConsumerState<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends ConsumerState<WelcomeScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 3400),
  );
  bool _started = false;

  // The path is drawn between 16 % and 92 % of the timeline.
  static const _pathCurve = Interval(.16, .92, curve: Curves.easeInOutCubic);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (MediaQuery.disableAnimationsOf(context)) {
      _c.value = 1; // reduced motion: show the finished journey immediately
    } else {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  void _skip() {
    if (_c.isAnimating) _c.value = 1;
  }

  @override
  Widget build(BuildContext context) {
    final bn = ref.watch(localeProvider) == 'bn';
    final scale = MediaQuery.textScalerOf(context).scale(1).clamp(1.0, 1.6);
    final rowH = 76.0 * scale;

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

    return Scaffold(
      backgroundColor: Brand.forest,
      body: Stack(
        children: [
          // Brand diamond pattern on forest green (existing component) + soft lighting.
          const Positioned.fill(
            child: DiamondPanel(
              padding: EdgeInsets.zero,
              child: SizedBox.expand(),
            ),
          ),
          const Positioned.fill(
            child: IgnorePointer(
              child: RepaintBoundary(
                child: CustomPaint(painter: _AmbientPainter()),
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
                  // Everything fits on one screen: if the phone is short (or the
                  // text is large) the content scales down instead of scrolling.
                  child: LayoutBuilder(
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
                              _Hero(bn: bn, anim: _c),
                              const SizedBox(height: 18),
                              _JourneyHeader(bn: bn, anim: _c, onSkip: _skip),
                              const SizedBox(height: 6),
                              GestureDetector(
                                behavior: HitTestBehavior.translucent,
                                onTap: _skip,
                                child: _Journey(
                                  anim: _c,
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
                  ),
                ),
                _Actions(bn: bn),
              ],
            ),
          ),
        ],
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
            decoration: const BoxDecoration(
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
  const _Hero({required this.bn, required this.anim});
  final bool bn;
  final Animation<double> anim;

  @override
  Widget build(BuildContext context) {
    final big = bn ? 34.0 : 38.0;
    final hi = Brand.saffron;
    final line1 = _head(bn, big);
    final line2 = _head(bn, big, color: hi);

    return AnimatedBuilder(
      animation: anim,
      builder: (context, child) {
        final t = const Interval(
          0,
          .22,
          curve: Curves.easeOutCubic,
        ).transform(anim.value);
        return Opacity(
          opacity: t,
          child: Transform.translate(
            offset: Offset(0, (1 - t) * 14),
            child: child,
          ),
        );
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            header: true,
            child: Text.rich(
              TextSpan(
                style: line1,
                children: bn
                    ? [
                        const TextSpan(text: 'আপনার ভবিষ্যৎ চায় '),
                        TextSpan(text: 'প্রমাণ।', style: line2),
                      ]
                    : [
                        const TextSpan(text: 'Your future\ndeserves '),
                        TextSpan(text: 'proof.', style: line2),
                      ],
              ),
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
    required this.onSkip,
  });
  final bool bn;
  final Animation<double> anim;
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
      AnimatedBuilder(
        animation: anim,
        builder: (context, _) {
          final running = anim.isAnimating;
          return IgnorePointer(
            ignoring: !running,
            child: AnimatedOpacity(
              duration: const Duration(milliseconds: 200),
              opacity: running ? 1 : 0,
              child: Semantics(
                button: true,
                excludeSemantics: !running,
                label: tr(context, 'Skip animation', 'অ্যানিমেশন এড়িয়ে যান'),
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
          );
        },
      ),
    ],
  );
}

class _Journey extends StatelessWidget {
  const _Journey({
    required this.anim,
    required this.items,
    required this.rowH,
    required this.bn,
    required this.pathCurve,
  });
  final Animation<double> anim;
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
          animation: anim,
          builder: (context, _) {
            final p = pathCurve.transform(anim.value);
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
                        ),
                      ),
                    ),
                  ),
                ),
                for (var i = 0; i < n; i++) ...[
                  // node
                  Positioned(
                    left: pts[i].dx - _nodeD / 2,
                    top: pts[i].dy - _nodeD / 2,
                    child: ExcludeSemantics(
                      child: _Node(
                        icon: items[i].icon,
                        t: _local(p, i / (n - 1), .04, .14),
                        last: i == n - 1,
                        size: _nodeD,
                      ),
                    ),
                  ),
                  // label
                  Positioned(
                    left: _colW + 14,
                    right: 0,
                    top: rowH * i,
                    height: rowH,
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
                ],
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
  });
  final IconData icon;
  final double t, size;
  final bool last;

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
                child: Icon(icon, size: 22, color: iconColor),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Draws the faint full track, then the golden path (with a soft glow and a leading spark) up to [progress].
class _PathPainter extends CustomPainter {
  _PathPainter({
    required this.points,
    required this.progress,
    required this.drawing,
  });
  final List<Offset> points;
  final double progress;
  final bool drawing;

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
        ..shader = const LinearGradient(
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
  }

  @override
  bool shouldRepaint(covariant _PathPainter old) =>
      old.progress != progress ||
      old.drawing != drawing ||
      old.points != points;
}

// ───────────────────────── background lighting ─────────────────────────

/// Static, one-time paint: a green glow top-right, the M-logo ring, and a faint golden glow behind the journey.
class _AmbientPainter extends CustomPainter {
  const _AmbientPainter();
  @override
  void paint(Canvas canvas, Size s) {
    final top = Rect.fromCircle(
      center: Offset(s.width * .85, s.height * .08),
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
      center: Offset(s.width * .12, s.height * .72),
      radius: s.width * .8,
    );
    canvas.drawRect(
      Offset.zero & s,
      Paint()
        ..shader = RadialGradient(
          colors: [
            Brand.saffron.withValues(alpha: .10),
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
                      decoration: const BoxDecoration(
                        color: Brand.forest,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
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