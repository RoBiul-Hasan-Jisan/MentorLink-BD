import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';

class WelcomeScreen extends ConsumerWidget {
  const WelcomeScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bn = ref.watch(localeProvider) == 'bn';
    Widget lang(String t, bool on, String code) => GestureDetector(
          onTap: () => ref.read(localeProvider.notifier).state = code,
          child: Container(padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10), decoration: BoxDecoration(color: on ? Colors.white : Colors.transparent, borderRadius: BorderRadius.circular(24)), child: Text(t, style: display(15, color: on ? Brand.forest : Colors.white))),
        );
    return Scaffold(
      body: Column(children: [
        GreenHeader(radius: 44, bottomPad: 0, child: SizedBox(height: 400, child: Stack(children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Row(children: [
              Container(width: 38, height: 38, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10)), child: Center(child: Text('M', style: display(24, color: Brand.delta)))),
              const SizedBox(width: 8),
              Text('MentorLink', style: display(20, color: Colors.white)),
              const SizedBox(width: 6),
              Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: Brand.saffron, borderRadius: BorderRadius.circular(6)), child: Text('BD', style: display(11, color: Brand.ink))),
            ]),
            Container(decoration: BoxDecoration(color: Colors.white12, borderRadius: BorderRadius.circular(28)), child: Row(children: [lang('EN', !bn, 'en'), lang('বাংলা', bn, 'bn')])),
          ]),
          Positioned(top: 90, left: 0, child: Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)), child: Row(mainAxisSize: MainAxisSize.min, children: [
            Ring(value: .58, size: 48, stroke: 6, dark: false, label: '', labelStyle: const TextStyle(fontSize: 1)),
            const SizedBox(width: 10),
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('58%', style: display(17, color: Brand.forest)), Text(tr(context, 'ready for Data Analyst', 'ডেটা অ্যানালিস্টের জন্য প্রস্তুত'), style: body(13, color: Brand.muted))]),
          ]))),
          Positioned(top: 150, right: 0, child: Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: Brand.saffron, borderRadius: BorderRadius.circular(18)), child: Row(mainAxisSize: MainAxisSize.min, children: [
            const Avatar('AB', size: 38),
            const SizedBox(width: 10),
            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(tr(context, '88% match', '৮৮% মিল'), style: display(17, color: Brand.ink)), Text(tr(context, 'Abrar · alumni verified', 'আবরার · যাচাইকৃত অ্যালামনাই'), style: body(13, color: Brand.ink))]),
          ]))),
          Positioned(bottom: 40, left: 40, right: 30, child: Container(height: 150, decoration: const BoxDecoration(border: Border(top: BorderSide(color: Brand.saffron, width: 8)), borderRadius: BorderRadius.vertical(top: Radius.circular(150))))),
          Positioned(bottom: 90, left: 70, child: Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24)), child: Row(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.verified_user_outlined, color: Brand.forest, size: 20), const SizedBox(width: 8),
            Text(tr(context, 'Scam-checked jobs', 'স্ক্যাম-যাচাইকৃত চাকরি'), style: display(15, color: Brand.ink, w: FontWeight.w700)),
          ]))),
        ]))),
        Expanded(child: Padding(padding: const EdgeInsets.fromLTRB(24, 28, 24, 24), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(tr(context, 'Meet the mentor who has been where you want to go.', 'যেখানে যেতে চান, সেখানে পৌঁছানো মেন্টরের সাথে পরিচিত হন।'), style: display(30)),
          const SizedBox(height: 12),
          Text(tr(context, 'See your skill gaps, get matched with verified alumni, and apply to safe jobs.', 'দক্ষতার ঘাটতি দেখুন, যাচাইকৃত অ্যালামনাইয়ের সাথে মিলুন এবং নিরাপদ চাকরিতে আবেদন করুন।'), style: body(17, color: Brand.muted)),
          const Spacer(),
          BigButton(tr(context, 'Get started', 'শুরু করুন'), onPressed: () => context.go('/sign-up')),
          const SizedBox(height: 10),
          BigButton(tr(context, 'I already have an account', 'আমার অ্যাকাউন্ট আছে'), outlined: true, onPressed: () => context.go('/sign-in')),
        ]))),
      ]),
    );
  }
}
