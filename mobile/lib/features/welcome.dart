import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';

/// Welcome screen — "3-step journey" design:
/// curved green header with logo-style swoosh, a wavy path linking the 3 steps.
class WelcomeScreen extends ConsumerWidget {
  const WelcomeScreen({super.key});

  static const double _stepH = 92;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bn = ref.watch(localeProvider) == 'bn';

    Widget lang(String t, bool on, String code) => GestureDetector(
          onTap: () => ref.read(localeProvider.notifier).state = code,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
            decoration: BoxDecoration(color: on ? Colors.white : Colors.transparent, borderRadius: BorderRadius.circular(24)),
            child: Text(t, style: display(15, color: on ? Brand.forest : Colors.white)),
          ),
        );

    final headStyle = display(28, color: Colors.white);
    final hiStyle = display(28, color: Brand.saffron);

    final steps = <_StepData>[
      _StepData(tr(context, 'See your skill gaps', 'দক্ষতার ঘাটতি দেখুন'),
          tr(context, 'Pick a goal and see how ready you are.', 'লক্ষ্য বেছে নিন, জানুন আপনি কতটা প্রস্তুত।'), Brand.delta),
      _StepData(tr(context, 'Match with alumni', 'অ্যালামনাইয়ের সাথে মিলুন'),
          tr(context, 'Verified mentors matched to your goal.', 'যাচাইকৃত মেন্টর, আপনার লক্ষ্যের সাথে মিল দেখে।'), Brand.saffron),
      _StepData(tr(context, 'Apply to safe jobs', 'নিরাপদ চাকরিতে আবেদন'),
          tr(context, 'Scam-checked jobs, all in one place.', 'স্ক্যাম-যাচাইকৃত চাকরি, এক জায়গায়।'), Brand.delta),
    ];

    return Scaffold(
      body: Column(children: [
        // ---------- curved header ----------
        GreenHeader(
          radius: 48,
          bottomPad: 0,
          child: SizedBox(
            height: 270,
            child: Stack(clipBehavior: Clip.none, children: [
              // faint ring (echoes the ring in the M logo)
              Positioned(
                right: -70, top: 10,
                child: Container(
                  width: 170, height: 170,
                  decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Colors.white.withOpacity(.07), width: 26)),
                ),
              ),
              // amber swoosh curves
              const Positioned(left: -20, right: -20, bottom: 0, height: 90, child: CustomPaint(painter: _SwooshPainter())),
              // logo row + language toggle
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Row(children: [
                  Container(
                    width: 38, height: 38,
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10)),
                    child: Center(child: Text('M', style: display(24, color: Brand.delta))),
                  ),
                  const SizedBox(width: 8),
                  Text('MentorLink', style: display(20, color: Colors.white)),
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: Brand.saffron, borderRadius: BorderRadius.circular(6)),
                    child: Text('BD', style: display(11, color: Brand.ink)),
                  ),
                ]),
                Container(
                  decoration: BoxDecoration(color: Colors.white12, borderRadius: BorderRadius.circular(28)),
                  child: Row(children: [lang('EN', !bn, 'en'), lang('বাংলা', bn, 'bn')]),
                ),
              ]),
              // headline
              Positioned(
                top: 74, left: 0, right: 0,
                child: Text.rich(
                  TextSpan(style: headStyle.copyWith(height: 1.3), children: bn
                      ? [const TextSpan(text: 'যেখানে যেতে চান, '), TextSpan(text: 'সেখানে পৌঁছানো', style: hiStyle.copyWith(height: 1.3)), const TextSpan(text: ' মেন্টরের সাথে পরিচিত হন।')]
                      : [const TextSpan(text: 'Meet the mentor who has '), TextSpan(text: 'been where you want to go', style: hiStyle.copyWith(height: 1.3)), const TextSpan(text: '.')]),
                ),
              ),
            ]),
          ),
        ),

        // ---------- steps + buttons ----------
        Expanded(
          child: LayoutBuilder(
            builder: (context, c) => SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: c.maxHeight),
                child: IntrinsicHeight(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      // wavy path + steps
                      SizedBox(
                        height: _stepH * 3,
                        child: Stack(children: [
                          const Positioned(left: 0, top: 0, width: 40, height: _stepH * 3, child: CustomPaint(painter: _WavePainter(_stepH))),
                          Column(children: [
                            for (var i = 0; i < steps.length; i++)
                              SizedBox(
                                height: _stepH,
                                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Container(
                                    width: 38, height: 38,
                                    decoration: BoxDecoration(
                                      color: steps[i].color, shape: BoxShape.circle,
                                      border: Border.all(color: Brand.paper, width: 5),
                                      boxShadow: [BoxShadow(color: Brand.paper, blurRadius: 0, spreadRadius: 2)],
                                    ),
                                    child: Center(child: Text('${i + 1}', style: display(15, color: steps[i].color == Brand.saffron ? Brand.ink : Colors.white))),
                                  ),
                                  const SizedBox(width: 16),
                                  Expanded(
                                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                      Text(steps[i].title, style: display(17, color: Brand.forest, w: FontWeight.w700)),
                                      const SizedBox(height: 2),
                                      Text(steps[i].desc, style: body(14, color: Brand.muted)),
                                    ]),
                                  ),
                                ]),
                              ),
                          ]),
                        ]),
                      ),
                      const Spacer(),
                      _Pill(
                        label: tr(context, 'Get started', 'শুরু করুন'),
                        onPressed: () => context.go('/sign-up'),
                      ),
                      const SizedBox(height: 10),
                      _Pill(
                        label: tr(context, 'I already have an account', 'আমার অ্যাকাউন্ট আছে'),
                        outlined: true,
                        onPressed: () => context.go('/sign-in'),
                      ),
                    ]),
                  ),
                ),
              ),
            ),
          ),
        ),
      ]),
    );
  }
}

class _StepData {
  const _StepData(this.title, this.desc, this.color);
  final String title, desc;
  final Color color;
}

/// Rounded pill button (primary has a soft shadow + amber arrow).
class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.onPressed, this.outlined = false});
  final String label;
  final VoidCallback onPressed;
  final bool outlined;
  @override
  Widget build(BuildContext context) {
    const shape = StadiumBorder();
    return SizedBox(
      width: double.infinity,
      height: 54,
      child: outlined
          ? OutlinedButton(
              onPressed: onPressed,
              style: OutlinedButton.styleFrom(shape: shape, side: const BorderSide(color: Color(0xFFB9C9C0), width: 1.5), foregroundColor: Brand.delta),
              child: Text(label, style: display(16, color: Brand.delta, w: FontWeight.w700)),
            )
          : DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(27),
                boxShadow: [BoxShadow(color: Brand.delta.withOpacity(.28), blurRadius: 20, offset: const Offset(0, 8))],
              ),
              child: FilledButton(
                onPressed: onPressed,
                style: FilledButton.styleFrom(backgroundColor: Brand.delta, shape: shape),
                child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Text(label, style: display(16, color: Colors.white, w: FontWeight.w700)),
                  const SizedBox(width: 10),
                  const Icon(Icons.arrow_forward_rounded, color: Brand.saffron, size: 20),
                ]),
              ),
            ),
    );
  }
}

/// Two amber swooshes at the bottom of the header (logo-style curves).
class _SwooshPainter extends CustomPainter {
  const _SwooshPainter();
  @override
  void paint(Canvas canvas, Size s) {
    final w = s.width, h = s.height;
    final main = Paint()..color = Brand.saffron..style = PaintingStyle.stroke..strokeWidth = 5..strokeCap = StrokeCap.round;
    final soft = Paint()..color = Brand.saffron.withOpacity(.35)..style = PaintingStyle.stroke..strokeWidth = 3..strokeCap = StrokeCap.round;
    canvas.drawPath(Path()..moveTo(0, h - 8)..cubicTo(w * .25, h - 88, w * .65, h - 88, w, h - 22), main);
    canvas.drawPath(Path()..moveTo(0, h + 6)..cubicTo(w * .27, h - 64, w * .67, h - 64, w, h - 4), soft);
  }
  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}

/// Wavy amber line running through the three step badges.
class _WavePainter extends CustomPainter {
  const _WavePainter(this.step);
  final double step;
  @override
  void paint(Canvas canvas, Size s) {
    final p = Paint()..color = Brand.saffron..style = PaintingStyle.stroke..strokeWidth = 3.5..strokeCap = StrokeCap.round;
    const x = 19.0;
    final path = Path()..moveTo(x, 19);
    for (var i = 0; i < 2; i++) {
      final y0 = 19 + step * i, y1 = y0 + step;
      path.cubicTo(x - 17, y0 + step * .33, x + 17, y0 + step * .66, x, y1);
    }
    canvas.drawPath(path, p);
  }
  @override
  bool shouldRepaint(covariant _WavePainter old) => old.step != step;
}