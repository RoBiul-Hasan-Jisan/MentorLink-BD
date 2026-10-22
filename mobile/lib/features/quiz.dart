import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

class QuizScreen extends ConsumerStatefulWidget {
  const QuizScreen({super.key, required this.skill});
  final String skill;
  @override
  ConsumerState<QuizScreen> createState() => _QuizState();
}
class _QuizState extends ConsumerState<QuizScreen> {
  final Map<int, int> picked = {};
  Map<String, dynamic>? result;
  @override
  Widget build(BuildContext context) => Scaffold(body: Column(children: [
        GreenHeader(radius: 28, bottomPad: 18, child: Row(children: [BackCircle(dark: true, onTap: () => context.pop()), const SizedBox(width: 12), Text(tr(context, 'Quiz: ${widget.skill.toUpperCase()}', 'কুইজ: ${widget.skill.toUpperCase()}'), style: display(22, color: Colors.white))])),
        Expanded(child: AsyncBody(value: ref.watch(quizProvider(widget.skill)), builder: (d) {
          final qs = (d['questions'] as List).cast<Map>();
          if (result != null) return Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [
            Ring(value: (result!['percent'] as num) / 100, dark: false, size: 140, stroke: 14, label: '${result!['correct']}/${result!['total']}', labelStyle: display(30, color: Brand.ink)),
            const SizedBox(height: 16),
            Text((result!['levelAwarded'] as num) > 0 ? tr(context, 'Level ${result!['levelAwarded']} added as quiz evidence', 'লেভেল ${result!['levelAwarded']} কুইজ প্রমাণ হিসেবে যোগ হয়েছে') : tr(context, 'Not enough to add evidence yet. Try again after practice.', 'প্রমাণ যোগ করার মতো স্কোর হয়নি। অনুশীলনের পর আবার চেষ্টা করুন।'), textAlign: TextAlign.center, style: body(17)),
            const SizedBox(height: 16), BigButton(tr(context, 'Done', 'শেষ'), onPressed: () { ref.invalidate(readinessProvider); context.pop(); }),
          ])));
          return ListView(padding: const EdgeInsets.all(16), children: [
            for (int i = 0; i < qs.length; i++) AppCard(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${i + 1}. ${qs[i]['q']}', style: display(18, color: Brand.ink)),
              for (int o = 0; o < (qs[i]['options'] as List).length; o++) RadioListTile<int>(contentPadding: EdgeInsets.zero, activeColor: Brand.delta, value: o, groupValue: picked[i], title: Text(qs[i]['options'][o], style: body(16)), onChanged: (v) => setState(() => picked[i] = v!)),
            ])),
            BigButton(tr(context, 'Submit', 'জমা দিন'), onPressed: picked.length < qs.length ? null : () async {
              try { final r = await ref.read(dioProvider).post('/quizzes/${widget.skill}/submit', data: {'answers': [for (int i = 0; i < qs.length; i++) picked[i]]}); setState(() => result = r.data as Map<String, dynamic>); }
              catch (e) { if (context.mounted) toast(context, errorText(e)); }
            }),
          ]);
        })),
      ]));
}
