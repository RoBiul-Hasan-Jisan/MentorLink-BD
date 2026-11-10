import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// Demo cards are shown by default so the app is easy to test. For a real release build with --dart-define=DEMO=false to hide them.
const demoMode = bool.fromEnvironment('DEMO', defaultValue: true);

// ---------- shared look for sign in, sign up and "About you" (same design as the web version) ----------
const _line = Color(0xFFDCE4DE);

Widget _authLabel(String t, {String? hint}) => Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(t, style: body(15, w: FontWeight.w700)),
        if (hint != null) Text(hint, style: body(12.5, color: Brand.muted)),
      ]),
    );

InputDecoration _authDeco(String? hint) => InputDecoration(
      hintText: hint, filled: true, fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: _line)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: _line)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: Brand.delta, width: 2)),
    );

// Password box with a show/hide eye so people can check what they typed.
class _PasswordField extends StatefulWidget {
  const _PasswordField({required this.controller, this.hints, this.onSubmitted});
  final TextEditingController controller;
  final Iterable<String>? hints;
  final ValueChanged<String>? onSubmitted;
  @override
  State<_PasswordField> createState() => _PasswordFieldState();
}
class _PasswordFieldState extends State<_PasswordField> {
  bool hide = true;
  @override
  Widget build(BuildContext context) => TextField(
        controller: widget.controller, obscureText: hide, autofillHints: widget.hints, onSubmitted: widget.onSubmitted,
        decoration: _authDeco(null).copyWith(
          suffixIcon: IconButton(
            tooltip: hide ? tr(context, 'Show password', 'পাসওয়ার্ড দেখুন') : tr(context, 'Hide password', 'পাসওয়ার্ড লুকান'),
            icon: Icon(hide ? Icons.visibility_outlined : Icons.visibility_off_outlined, color: Brand.muted),
            onPressed: () => setState(() => hide = !hide),
          ),
        ),
      );
}

Widget _authNote(String msg, {bool error = true}) => Container(
      margin: const EdgeInsets.only(top: 14), padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: error ? const Color(0xFFFBE6E3) : Brand.lightGreen, borderRadius: BorderRadius.circular(12)),
      child: Text(msg, style: body(14, color: error ? const Color(0xFFB3362B) : Brand.forest, w: FontWeight.w600)),
    );

Widget _authHeading(BuildContext context, String title, String sub) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: display(38)),
      const SizedBox(height: 8),
      Text(sub, style: body(16, color: Brand.muted)),
      const SizedBox(height: 22),
    ]);

/// Page frame: on wide screens (web, tablet, width over 860) the green art panel sits on the left; on a phone only the form shows.
class AuthShell extends StatelessWidget {
  const AuthShell({super.key, required this.child, this.onBack, this.trailing});
  final Widget child; final VoidCallback? onBack; final Widget? trailing;

  Widget _art(BuildContext context) => DiamondPanel(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text('MentorLink BD', style: display(24, color: Colors.white)),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr(context, 'Two paths meet in the middle.', 'দুটি পথ মাঝখানে মিলে যায়।'), style: display(35, color: Colors.white)),
            Text(tr(context, 'Student rising. Mentor reaching back.', 'শিক্ষার্থী এগিয়ে চলে। মেন্টর হাত বাড়ায়।'), style: display(35, color: Colors.white)),
            const SizedBox(height: 16),
            Text(tr(context, 'Verified alumni, honest skill gaps, jobs that never ask for a fee.', 'যাচাইকৃত অ্যালামনাই, সৎ স্কিল গ্যাপ, ফি ছাড়া চাকরি।'), style: body(16, color: const Color(0xFFBCD6CA))),
          ]),
          const SizedBox(height: 1),
        ]),
      );

  Widget _form(BuildContext context) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Row(children: [
                  if (onBack != null) TextButton(onPressed: onBack, child: Text('← MentorLink BD', style: body(14, color: Brand.forest, w: FontWeight.w800))),
                  const Spacer(),
                  if (trailing != null) trailing!,
                ]),
                const SizedBox(height: 8),
                child,
              ]),
            ),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: Brand.paper,
        body: LayoutBuilder(builder: (context, c) {
          if (c.maxWidth > 860) return Row(children: [Expanded(child: _art(context)), Expanded(child: _form(context))]);
          return _form(context);
        }),
      );
}

// ---------- sign in ----------
// Heading, one-role note, labelled fields, Forgot password, Sign up link, and tap-to-sign-in demo cards (on by default, off with --dart-define=DEMO=false).
// Plain-language sign-in errors. Firebase's own text ("invalid-credential: The supplied auth credential is incorrect, malformed or has expired") means nothing to a student.
String authMessage(BuildContext context, FirebaseAuthException x) {
  switch (x.code) {
    case 'invalid-credential':
    case 'wrong-password':
    case 'user-not-found':
    case 'invalid-login-credentials':
      return tr(context, 'Email or password is not right. Check for typos, or tap "Forgot password?". New here? Tap "Sign up".', 'ইমেইল বা পাসওয়ার্ড ঠিক নেই। বানান দেখুন, অথবা "পাসওয়ার্ড ভুলে গেছেন?" চাপুন। নতুন হলে "সাইন আপ" চাপুন।');
    case 'invalid-email':
      return tr(context, 'This email address does not look right.', 'ইমেইল ঠিকানাটি সঠিক মনে হচ্ছে না।');
    case 'user-disabled':
      return tr(context, 'This account has been disabled. Please contact support.', 'এই অ্যাকাউন্ট বন্ধ করা হয়েছে। সাপোর্টে যোগাযোগ করুন।');
    case 'too-many-requests':
      return tr(context, 'Too many tries. Wait a few minutes, or reset your password.', 'অনেকবার চেষ্টা হয়েছে। কয়েক মিনিট অপেক্ষা করুন বা পাসওয়ার্ড রিসেট করুন।');
    case 'network-request-failed':
      return tr(context, 'No internet connection. Check your network and try again.', 'ইন্টারনেট সংযোগ নেই। নেটওয়ার্ক দেখে আবার চেষ্টা করুন।');
    default:
      return tr(context, 'Could not sign in. Please try again.', 'সাইন ইন করা যায়নি। আবার চেষ্টা করুন।');
  }
}

class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});
  @override
  ConsumerState<SignInScreen> createState() => _SignIn();
}
class _SignIn extends ConsumerState<SignInScreen> {
  final email = TextEditingController(), pw = TextEditingController();
  bool busy = false;
  String err = '', info = '';

  Future<void> go([String? e, String? p]) async {
    final em = (e ?? email.text).trim(), pa = p ?? pw.text;
    setState(() { busy = true; err = ''; info = ''; });
    try { await FirebaseAuth.instance.signInWithEmailAndPassword(email: em, password: pa); }
    on FirebaseAuthException catch (x) { if (mounted) setState(() => err = authMessage(context, x)); }
    catch (x) { if (mounted) setState(() => err = x.toString()); }
    finally { if (mounted) setState(() => busy = false); }
  }

  Future<void> reset() async {
    setState(() { err = ''; info = ''; });
    final em = email.text.trim();
    if (em.isEmpty) { setState(() => err = tr(context, 'Type your email first, then tap “Forgot password”.', 'আগে ইমেইল লিখুন, তারপর “পাসওয়ার্ড ভুলে গেছেন?” চাপুন।')); return; }
    try {
      await FirebaseAuth.instance.sendPasswordResetEmail(email: em);
      if (mounted) setState(() => info = tr(context, 'If an account exists for this email, a reset link is on its way.', 'এই ইমেইলে অ্যাকাউন্ট থাকলে রিসেট লিংক পাঠানো হচ্ছে।'));
    } on FirebaseAuthException catch (x) { if (mounted) setState(() => err = x.code == 'invalid-email' ? authMessage(context, x) : tr(context, 'Could not send the email. Try again later.', 'ইমেইল পাঠানো যায়নি। পরে আবার চেষ্টা করুন।')); }
  }

  Widget _demoCard(String name, String desc, String mail, String pass) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: busy ? null : () { email.text = mail; pw.text = pass; go(mail, pass); },
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: _line, width: 2)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, style: body(16, w: FontWeight.w800)),
              const SizedBox(height: 4),
              Text(desc, style: body(13, color: Brand.muted, w: FontWeight.w600)),
            ]),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) => AuthShell(
        onBack: () => context.go('/welcome'),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _authHeading(context, tr(context, 'Welcome back', 'স্বাগতম'), tr(context, 'Your account has one role. The app opens only the screens that role is allowed to use.', 'আপনার অ্যাকাউন্টের একটি ভূমিকা আছে। অ্যাপ শুধু সেই ভূমিকার অনুমোদিত স্ক্রিন খোলে।')),
          _authLabel(tr(context, 'Email', 'ইমেইল')),
          TextField(controller: email, keyboardType: TextInputType.emailAddress, autofillHints: const [AutofillHints.email], decoration: _authDeco('you@university.edu.bd')),
          const SizedBox(height: 16),
          _authLabel(tr(context, 'Password', 'পাসওয়ার্ড')),
          _PasswordField(controller: pw, hints: const [AutofillHints.password], onSubmitted: (_) => busy ? null : go()),
          if (err.isNotEmpty) _authNote(err),
          if (info.isNotEmpty) _authNote(info, error: false),
          const SizedBox(height: 20),
          BigButton(tr(context, 'Log in', 'লগ ইন'), onPressed: busy ? null : () => go()),
          Align(alignment: Alignment.centerLeft, child: TextButton(onPressed: busy ? null : reset, child: Text(tr(context, 'Forgot password?', 'পাসওয়ার্ড ভুলে গেছেন?'), style: body(14, color: Brand.delta, w: FontWeight.w800)))),
          const SizedBox(height: 4),
          Row(children: [
            Text(tr(context, 'New here? ', 'নতুন? '), style: body(14, color: Brand.muted)),
            InkWell(onTap: () => context.go('/sign-up'), child: Text(tr(context, 'Sign up', 'সাইন আপ'), style: body(14, color: Brand.delta, w: FontWeight.w800).copyWith(decoration: TextDecoration.underline))),
          ]),
          if (demoMode) ...[
            const SizedBox(height: 18),
            const Divider(color: _line, height: 1),
            const SizedBox(height: 16),
            Text(tr(context, 'Demo accounts. Tap one to sign in.', 'ডেমো অ্যাকাউন্ট। সাইন ইন করতে একটিতে ট্যাপ করুন।'), style: body(14, w: FontWeight.w800)),
            const SizedBox(height: 10),
            _demoCard(tr(context, 'Student · Robiul', 'শিক্ষার্থী · রবিউল'), tr(context, 'Goals, matches, plan, jobs', 'লক্ষ্য, ম্যাচ, প্ল্যান, চাকরি'), 'student.edu@demo.mentorlink.bd', 'Demo@12345'),
            _demoCard(tr(context, 'Alumni mentor · Abrar', 'অ্যালামনাই মেন্টর · আবরার'), tr(context, 'Requests, sessions, own posts', 'অনুরোধ, সেশন, নিজের পোস্ট'), 'mentor1@demo.mentorlink.bd', 'Demo@12345'),
            _demoCard(tr(context, 'Employer · Demo Tech Ltd', 'নিয়োগকর্তা · ডেমো টেক লিমিটেড'), tr(context, 'Post jobs, see applicants who agreed to share', 'চাকরি দিন, সম্মতি দেওয়া আবেদনকারী দেখুন'), 'employer@demo.mentorlink.bd', 'Demo@12345'),
            _demoCard(tr(context, 'Department staff · Dayan', 'বিভাগীয় স্টাফ · দায়ান'), tr(context, 'Anonymized progress and approvals', 'নাম গোপন অগ্রগতি ও অনুমোদন'), 'dept@demo.mentorlink.bd', 'Demo@12345'),
            _demoCard(tr(context, 'Administrator · Ayesha', 'অ্যাডমিন · আয়েশা'), tr(context, 'Full oversight, can preview every role', 'পূর্ণ তত্ত্বাবধান, সব ভূমিকা দেখা যায়'), 'admin@demo.mentorlink.bd', 'Admin@12345'),
          ],
        ]),
      );
}

// Shown when you are signed in with Firebase but our server cannot be reached or answers with an error.
class ProblemScreen extends ConsumerWidget {
  const ProblemScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final err = ref.watch(meProvider).error;
    return Scaffold(body: SafeArea(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Icon(Icons.cloud_off, size: 56, color: Brand.muted),
      const SizedBox(height: 16),
      Text(tr(context, 'Signed in, but the server did not answer', 'সাইন ইন হয়েছে, কিন্তু সার্ভার সাড়া দেয়নি'), textAlign: TextAlign.center, style: display(22, color: Brand.ink)),
      const SizedBox(height: 10),
      Text(err == null ? '' : errorText(err), textAlign: TextAlign.center, style: body(15, color: Brand.muted)),
      const SizedBox(height: 24),
      BigButton(tr(context, 'Try again', 'আবার চেষ্টা করুন'), onPressed: () => ref.invalidate(meProvider)),
      const SizedBox(height: 10),
      BigButton(tr(context, 'Sign out', 'সাইন আউট'), outlined: true, onPressed: () => FirebaseAuth.instance.signOut()),
    ]))));
  }
}

// ---------- sign up, step 1: Firebase account ----------
class SignUpScreen extends ConsumerStatefulWidget {
  const SignUpScreen({super.key});
  @override
  ConsumerState<SignUpScreen> createState() => _SignUp();
}
class _SignUp extends ConsumerState<SignUpScreen> {
  final email = TextEditingController(), pw = TextEditingController();
  bool busy = false, consent = false;
  String err = '';
  Future<void> go() async {
    if (pw.text.length < 8) { setState(() => err = tr(context, 'Password must be at least 8 characters.', 'পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে।')); return; }
    setState(() { busy = true; err = ''; });
    try {
      final cred = await FirebaseAuth.instance.createUserWithEmailAndPassword(email: email.text.trim(), password: pw.text);
      cred.user?.sendEmailVerification().catchError((_) {}); // a confirmation link; a confirmed .ac.bd / .edu.bd address helps verification
    }
    on FirebaseAuthException catch (e) { if (mounted) setState(() => err = e.message ?? 'Could not create account'); }
    finally { if (mounted) setState(() => busy = false); }
  }
  @override
  Widget build(BuildContext context) => AuthShell(
        onBack: () => context.go('/welcome'),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _authHeading(context, tr(context, 'Create your account', 'অ্যাকাউন্ট তৈরি করুন'), tr(context, 'Step 1 of 2. Your role decides which screens this account can ever open.', 'ধাপ ১/২। আপনার ভূমিকা ঠিক করে এই অ্যাকাউন্ট কোন স্ক্রিন খুলতে পারবে।')),
          _authLabel(tr(context, 'University email', 'বিশ্ববিদ্যালয়ের ইমেইল'), hint: tr(context, 'A .ac.bd or .edu.bd address, confirmed by a link we email you, helps verify you.', '.ac.bd বা .edu.bd ঠিকানা, ইমেইলে পাঠানো লিংকে নিশ্চিত করলে যাচাই সহজ হয়।')),
          TextField(controller: email, keyboardType: TextInputType.emailAddress, autofillHints: const [AutofillHints.email], decoration: _authDeco('you@university.edu.bd')),
          const SizedBox(height: 16),
          _authLabel(tr(context, 'Password', 'পাসওয়ার্ড'), hint: tr(context, 'At least 8 characters.', 'অন্তত ৮ অক্ষর।')),
          _PasswordField(controller: pw, hints: const [AutofillHints.newPassword]),
          const SizedBox(height: 14),
          InkWell(
            onTap: () => setState(() => consent = !consent),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Checkbox(value: consent, activeColor: Brand.delta, onChanged: (v) => setState(() => consent = v ?? false)),
              Expanded(child: Padding(padding: const EdgeInsets.only(top: 12), child: Text(tr(context, 'I accept the Code of Conduct and consent to my data being used for mentoring and matching only. Phone numbers stay hidden until both sides agree.', 'আমি আচরণবিধি মানছি এবং শুধু মেন্টরিং ও ম্যাচিংয়ের জন্য আমার তথ্য ব্যবহারে সম্মতি দিচ্ছি। দুই পক্ষ রাজি না হওয়া পর্যন্ত ফোন নম্বর গোপন থাকে।'), style: body(13.5, color: Brand.muted)))),
            ]),
          ),
          if (err.isNotEmpty) _authNote(err),
          const SizedBox(height: 16),
          BigButton(tr(context, 'Continue', 'চালিয়ে যান'), onPressed: (busy || !consent) ? null : go),
          const SizedBox(height: 10),
          Row(children: [
            Text(tr(context, 'Already registered? ', 'আগে থেকেই আছে? '), style: body(14, color: Brand.muted)),
            InkWell(onTap: () => context.go('/sign-in'), child: Text(tr(context, 'Log in', 'লগ ইন'), style: body(14, color: Brand.delta, w: FontWeight.w800).copyWith(decoration: TextDecoration.underline))),
          ]),
        ]),
      );
}

// ---------- sign up, step 2: profile ----------
// University is required. A new account is always a student; Alumni mentor / Department are only a REQUEST that an admin approves.
class CompleteProfileScreen extends ConsumerStatefulWidget {
  const CompleteProfileScreen({super.key});
  @override
  ConsumerState<CompleteProfileScreen> createState() => _Complete();
}
class _Complete extends ConsumerState<CompleteProfileScreen> {
  final name = TextEditingController(), dept = TextEditingController();
  String? uni;
  String want = 'student'; // student | alumni | department
  final jobTitle = TextEditingController(), industry = TextEditingController(), years = TextEditingController(text: '2');
  bool busy = false;
  Future<void> save() async {
    if (uni == null || name.text.trim().length < 2) { toast(context, tr(context, 'Enter your name and choose your university', 'নাম লিখুন ও বিশ্ববিদ্যালয় বেছে নিন')); return; }
    setState(() => busy = true);
    try {
      await ref.read(dioProvider).post('/auth/register-profile', data: {'displayName': name.text.trim(), 'universityId': uni, if (dept.text.trim().isNotEmpty) 'department': dept.text.trim(), 'language': ref.read(localeProvider)});
      try {
        if (want == 'alumni' && jobTitle.text.trim().length >= 2 && industry.text.trim().length >= 2) {
          await ref.read(dioProvider).post('/me/mentor-application', data: {'roleTitle': jobTitle.text.trim(), 'industry': industry.text.trim(), 'yearsExperience': double.tryParse(years.text) ?? 0});
        } else if (want == 'department') {
          await ref.read(dioProvider).post('/me/department-application', data: {});
        }
      } catch (_) {} // the account exists as a student; the application can be sent again from Profile
      ref.invalidate(meProvider);
    } catch (e) { if (mounted) toast(context, errorText(e)); }
    finally { if (mounted) setState(() => busy = false); }
  }
  Widget _roleChoice(String k, String en, String bn) => Expanded(child: Padding(padding: const EdgeInsets.only(right: 8), child: InkWell(
        borderRadius: BorderRadius.circular(14), onTap: () => setState(() => want = k),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 6), alignment: Alignment.center,
          decoration: BoxDecoration(color: want == k ? Brand.lightGreen : Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: want == k ? Brand.delta : _line, width: 2)),
          child: Text(tr(context, en, bn), textAlign: TextAlign.center, style: body(14, color: want == k ? Brand.forest : Brand.ink, w: FontWeight.w800)),
        ))));
  @override
  Widget build(BuildContext context) {
    final unis = ref.watch(universitiesProvider);
    return AuthShell(
      trailing: TextButton(onPressed: () => FirebaseAuth.instance.signOut(), child: Text(tr(context, 'Sign out', 'সাইন আউট'), style: body(14, color: Brand.delta, w: FontWeight.w800))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _authHeading(context, tr(context, 'About you', 'আপনার পরিচয়'), tr(context, 'Step 2 of 2. Finish your profile to continue.', 'ধাপ ২/২। চালিয়ে যেতে প্রোফাইল শেষ করুন।')),
        _authLabel(tr(context, 'Who are you?', 'আপনি কে?')),
        Row(children: [
          _roleChoice('student', 'Student', 'শিক্ষার্থী'),
          _roleChoice('alumni', 'Alumni mentor', 'অ্যালামনাই মেন্টর'),
          _roleChoice('department', 'Department', 'বিভাগ'),
        ]),
        if (want != 'student') Padding(padding: const EdgeInsets.only(top: 4), child: Text(tr(context, 'You start as a student. An admin reviews your request before the role is given.', 'আপনি শিক্ষার্থী হিসেবে শুরু করবেন। রোল দেওয়ার আগে অ্যাডমিন যাচাই করবেন।'), style: body(13, color: Brand.muted))),
        const SizedBox(height: 16),
        _authLabel(tr(context, 'Full name', 'পূর্ণ নাম')),
        TextField(controller: name, autofillHints: const [AutofillHints.name], decoration: _authDeco(null)),
        const SizedBox(height: 16),
        _authLabel(tr(context, 'University', 'বিশ্ববিদ্যালয়')),
        AsyncBody(value: unis, onRetry: () => ref.invalidate(universitiesProvider), builder: (list) => DropdownButtonFormField<String>(
          initialValue: uni, isExpanded: true,
          decoration: _authDeco(tr(context, 'Choose your university', 'আপনার বিশ্ববিদ্যালয় বেছে নিন')),
          items: [for (final u in list as List) DropdownMenuItem(value: u['id'] as String, child: Text(u['name'] as String, overflow: TextOverflow.ellipsis))],
          onChanged: (v) => setState(() => uni = v),
        )),
        const SizedBox(height: 16),
        _authLabel(tr(context, 'Department', 'বিভাগ')),
        TextField(controller: dept, decoration: _authDeco('CSE')),
        if (want == 'alumni') ...[
          const SizedBox(height: 16),
          _authLabel(tr(context, 'Job title', 'পদবি')),
          TextField(controller: jobTitle, decoration: _authDeco(null)),
          const SizedBox(height: 16),
          _authLabel(tr(context, 'Industry', 'শিল্প')),
          TextField(controller: industry, decoration: _authDeco(null)),
          const SizedBox(height: 16),
          _authLabel(tr(context, 'Years of experience', 'অভিজ্ঞতার বছর')),
          TextField(controller: years, keyboardType: TextInputType.number, decoration: _authDeco(null)),
        ],
        const SizedBox(height: 24),
        BigButton(tr(context, 'Finish', 'শেষ করুন'), onPressed: busy ? null : save),
      ]),
    );
  }
}
