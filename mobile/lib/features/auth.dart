import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

Widget _page(BuildContext context, {required String title, String? sub, required List<Widget> children, VoidCallback? back, List<Widget> actions = const []}) => Scaffold(
      body: ListView(padding: EdgeInsets.zero, children: [
        GreenHeader(radius: 36, bottomPad: 36, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [if (back != null) BackCircle(dark: true, onTap: back), const Spacer(), ...actions]),
          const SizedBox(height: 12),
          Text(title, style: display(32, color: Colors.white)),
          if (sub != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(sub, style: body(16, color: Colors.white70))),
        ])),
        Padding(padding: const EdgeInsets.all(24), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children)),
      ]),
    );

const demoMode = bool.fromEnvironment('DEMO');

class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});
  @override
  ConsumerState<SignInScreen> createState() => _SignIn();
}
class _SignIn extends ConsumerState<SignInScreen> {
  final email = TextEditingController(), pw = TextEditingController();
  bool busy = false;
  Future<void> go() async {
    setState(() => busy = true);
    try { await FirebaseAuth.instance.signInWithEmailAndPassword(email: email.text.trim(), password: pw.text); }
    on FirebaseAuthException catch (e) { if (mounted) toast(context, e.message ?? 'Sign-in failed'); }
    finally { if (mounted) setState(() => busy = false); }
  }
  @override
  Widget build(BuildContext context) => _page(context, title: tr(context, 'Welcome back', 'স্বাগতম'), sub: tr(context, 'Sign in to continue', 'চালিয়ে যেতে সাইন ইন করুন'), back: () => context.go('/welcome'), children: [
        TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: InputDecoration(labelText: tr(context, 'Email', 'ইমেইল'))),
        const SizedBox(height: 12),
        TextField(controller: pw, obscureText: true, decoration: InputDecoration(labelText: tr(context, 'Password', 'পাসওয়ার্ড'))),
        const SizedBox(height: 20),
        BigButton(tr(context, 'Sign in', 'সাইন ইন'), onPressed: busy ? null : go),
        TextButton(onPressed: () => context.go('/sign-up'), child: Text(tr(context, 'Create an account', 'অ্যাকাউন্ট খুলুন'), style: body(16, color: Brand.delta, w: FontWeight.w700))),
        if (demoMode) ...[
          const SizedBox(height: 8), Text('Demo accounts', style: body(14, color: Brand.muted)),
          Wrap(spacing: 8, children: [for (final d in const [('Student', 'student.edu@demo.mentorlink.bd', 'Demo@12345'), ('Mentor', 'mentor1@demo.mentorlink.bd', 'Demo@12345'), ('Employer', 'employer@demo.mentorlink.bd', 'Demo@12345'), ('Department', 'dept@demo.mentorlink.bd', 'Demo@12345'), ('Admin', 'admin@demo.mentorlink.bd', 'Admin@12345')])
            ActionChip(label: Text(d.$1), onPressed: () { email.text = d.$2; pw.text = d.$3; })]),
        ],
      ]);
}

class SignUpScreen extends ConsumerStatefulWidget {
  const SignUpScreen({super.key});
  @override
  ConsumerState<SignUpScreen> createState() => _SignUp();
}
class _SignUp extends ConsumerState<SignUpScreen> {
  final email = TextEditingController(), pw = TextEditingController();
  bool busy = false;
  Future<void> go() async {
    setState(() => busy = true);
    try { await FirebaseAuth.instance.createUserWithEmailAndPassword(email: email.text.trim(), password: pw.text); }
    on FirebaseAuthException catch (e) { if (mounted) toast(context, e.message ?? 'Could not create account'); }
    finally { if (mounted) setState(() => busy = false); }
  }
  @override
  Widget build(BuildContext context) => _page(context, title: tr(context, 'Create account', 'অ্যাকাউন্ট খুলুন'), sub: tr(context, 'Step 1 of 2', 'ধাপ ১/২'), back: () => context.go('/welcome'), children: [
        TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: InputDecoration(labelText: tr(context, 'Email', 'ইমেইল'))),
        const SizedBox(height: 12),
        TextField(controller: pw, obscureText: true, decoration: InputDecoration(labelText: tr(context, 'Password (6+ characters)', 'পাসওয়ার্ড (৬+ অক্ষর)'))),
        const SizedBox(height: 20),
        BigButton(tr(context, 'Continue', 'চালিয়ে যান'), onPressed: busy ? null : go),
        TextButton(onPressed: () => context.go('/sign-in'), child: Text(tr(context, 'I already have an account', 'আমার অ্যাকাউন্ট আছে'), style: body(16, color: Brand.delta, w: FontWeight.w700))),
      ]);
}

// Step 2: university is required. Role is never sent: new accounts are always students.
class CompleteProfileScreen extends ConsumerStatefulWidget {
  const CompleteProfileScreen({super.key});
  @override
  ConsumerState<CompleteProfileScreen> createState() => _Complete();
}
class _Complete extends ConsumerState<CompleteProfileScreen> {
  final name = TextEditingController(), dept = TextEditingController();
  String? uni;
  bool busy = false;
  Future<void> save() async {
    if (uni == null || name.text.trim().length < 2) { toast(context, tr(context, 'Enter your name and choose your university', 'নাম লিখুন ও বিশ্ববিদ্যালয় বেছে নিন')); return; }
    setState(() => busy = true);
    try {
      await ref.read(dioProvider).post('/auth/register-profile', data: {'displayName': name.text.trim(), 'universityId': uni, if (dept.text.trim().isNotEmpty) 'department': dept.text.trim(), 'language': ref.read(localeProvider)});
      ref.invalidate(meProvider);
    } catch (e) { if (mounted) toast(context, errorText(e)); }
    finally { if (mounted) setState(() => busy = false); }
  }
  @override
  Widget build(BuildContext context) {
    final unis = ref.watch(universitiesProvider);
    return _page(context, title: tr(context, 'About you', 'আপনার পরিচয়'), sub: tr(context, 'Step 2 of 2', 'ধাপ ২/২'), actions: [TextButton(onPressed: () => FirebaseAuth.instance.signOut(), child: Text(tr(context, 'Sign out', 'সাইন আউট'), style: body(15, color: Colors.white)))], children: [
      TextField(controller: name, decoration: InputDecoration(labelText: tr(context, 'Full name', 'পূর্ণ নাম'))),
      const SizedBox(height: 12),
      AsyncBody(value: unis, onRetry: () => ref.invalidate(universitiesProvider), builder: (list) => DropdownButtonFormField<String>(
        initialValue: uni, isExpanded: true, hint: Text(tr(context, 'Choose your university', 'আপনার বিশ্ববিদ্যালয় বেছে নিন')),
        decoration: InputDecoration(labelText: tr(context, 'University', 'বিশ্ববিদ্যালয়')),
        items: [for (final u in list as List) DropdownMenuItem(value: u['id'] as String, child: Text(u['name'] as String, overflow: TextOverflow.ellipsis))],
        onChanged: (v) => setState(() => uni = v),
      )),
      const SizedBox(height: 12),
      TextField(controller: dept, decoration: InputDecoration(labelText: tr(context, 'Department', 'বিভাগ'))),
      const SizedBox(height: 20),
      BigButton(tr(context, 'Finish', 'শেষ করুন'), onPressed: busy ? null : save),
    ]);
  }
}
