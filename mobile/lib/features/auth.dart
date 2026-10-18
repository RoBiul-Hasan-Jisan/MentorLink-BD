import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../l10n/app_localizations.dart';
import 'widgets.dart';

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
    try {
      await FirebaseAuth.instance.signInWithEmailAndPassword(email: email.text.trim(), password: pw.text);
    } on FirebaseAuthException catch (e) {
      if (mounted) toast(context, e.message ?? 'Sign-in failed');
    } finally { if (mounted) setState(() => busy = false); }
  }
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return Scaffold(body: SafeArea(child: ListView(padding: const EdgeInsets.all(24), children: [
      const SizedBox(height: 40),
      Text(t.appName, style: Theme.of(context).textTheme.headlineMedium),
      const SizedBox(height: 24),
      TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: InputDecoration(labelText: t.email)),
      const SizedBox(height: 12),
      TextField(controller: pw, obscureText: true, decoration: InputDecoration(labelText: t.password)),
      const SizedBox(height: 20),
      FilledButton(onPressed: busy ? null : go, child: Text(t.signIn)),
      TextButton(onPressed: () => context.go('/sign-up'), child: Text(t.signUp)),
      Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        TextButton(onPressed: () => ref.read(localeProvider.notifier).state = 'bn', child: const Text('বাংলা')),
        TextButton(onPressed: () => ref.read(localeProvider.notifier).state = 'en', child: const Text('English')),
      ]),
    ])));
  }
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
    try {
      await FirebaseAuth.instance.createUserWithEmailAndPassword(email: email.text.trim(), password: pw.text);
      // the router now sends a new account to /complete-profile
    } on FirebaseAuthException catch (e) {
      if (mounted) toast(context, e.message ?? 'Could not create account');
    } finally { if (mounted) setState(() => busy = false); }
  }
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return Scaffold(appBar: AppBar(leading: BackButton(onPressed: () => context.go('/sign-in'))), body: ListView(padding: const EdgeInsets.all(24), children: [
      Text(t.signUp, style: Theme.of(context).textTheme.headlineMedium),
      const SizedBox(height: 20),
      TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: InputDecoration(labelText: t.email)),
      const SizedBox(height: 12),
      TextField(controller: pw, obscureText: true, decoration: InputDecoration(labelText: t.password)),
      const SizedBox(height: 20),
      FilledButton(onPressed: busy ? null : go, child: Text(t.signUp)),
    ]));
  }
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
    if (uni == null || name.text.trim().length < 2) { toast(context, AppLocalizations.of(context).chooseUniversity); return; }
    setState(() => busy = true);
    try {
      await ref.read(dioProvider).post('/auth/register-profile', data: {'displayName': name.text.trim(), 'universityId': uni, if (dept.text.trim().isNotEmpty) 'department': dept.text.trim(), 'language': ref.read(localeProvider)});
      ref.invalidate(meProvider);
    } catch (e) { if (mounted) toast(context, errorText(e)); }
    finally { if (mounted) setState(() => busy = false); }
  }
  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final unis = ref.watch(universitiesProvider);
    return Scaffold(appBar: AppBar(actions: [TextButton(onPressed: () => FirebaseAuth.instance.signOut(), child: Text(t.signOut))]), body: ListView(padding: const EdgeInsets.all(24), children: [
      TextField(controller: name, decoration: InputDecoration(labelText: t.name)),
      const SizedBox(height: 12),
      AsyncBody(value: unis, builder: (list) => DropdownButtonFormField<String>(
        initialValue: uni, hint: Text(t.chooseUniversity), isExpanded: true,
        decoration: InputDecoration(labelText: t.university),
        items: [for (final u in list) DropdownMenuItem(value: u['id'] as String, child: Text(u['name'] as String, overflow: TextOverflow.ellipsis))],
        onChanged: (v) => setState(() => uni = v),
      )),
      const SizedBox(height: 12),
      TextField(controller: dept, decoration: InputDecoration(labelText: t.department)),
      const SizedBox(height: 20),
      FilledButton(onPressed: busy ? null : save, child: Text(t.signUp)),
    ]));
  }
}
