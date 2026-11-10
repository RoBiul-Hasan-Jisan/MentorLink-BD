import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import '../core/upload.dart';
import 'widgets.dart';
import 'slot_grid.dart';
import 'launch.dart' show briefProvider;

// Onboarding extras from the design: verify (email + student ID), goal wizard, and the mentor request form.
// Roles are never chosen by the client: "alumni" and "department" create an application that an admin approves.

final onboardingRolesProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/roles'));

class VerifyScreen extends ConsumerStatefulWidget {
  const VerifyScreen({super.key});
  @override
  ConsumerState<VerifyScreen> createState() => _VerifyState();
}

class _VerifyState extends ConsumerState<VerifyScreen> {
  bool uploaded = false;
  bool busy = false;

  Future<void> _sendEmail() async {
    try {
      await FirebaseAuth.instance.currentUser?.sendEmailVerification();
      if (mounted) toast(context, tr(context, 'Verification email sent.', 'যাচাইকরণ ইমেইল পাঠানো হয়েছে।'));
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  Future<void> _upload() async {
    setState(() => busy = true);
    final ok = await pickAndUploadDoc(context, ref, 'student_id');
    if (mounted) setState(() { busy = false; if (ok) uploaded = true; });
    ref.invalidate(meProvider);
  }

  @override
  Widget build(BuildContext context) {
    final u = ref.watch(meProvider).valueOrNull ?? {};
    final emailOk = FirebaseAuth.instance.currentUser?.emailVerified ?? false;
    final match = u['emailDomainMatch'] == true;
    return Scaffold(
      body: ListView(padding: EdgeInsets.zero, children: [
        GreenHeader(radius: 36, bottomPad: 26, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          BackCircle(dark: true, onTap: () => context.pop()),
          const SizedBox(height: 12),
          Text(tr(context, 'Verify your account', 'অ্যাকাউন্ট যাচাই করুন'), style: display(30, color: Colors.white)),
          Text(tr(context, 'Two quick checks keep the community real.', 'দুটি দ্রুত যাচাই কমিউনিটিকে আসল রাখে।'), style: body(15, color: Colors.white70)),
        ])),
        Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(emailOk ? Icons.check_circle : Icons.mail_outline, color: emailOk ? Brand.delta : Brand.muted),
              const SizedBox(width: 10),
              Expanded(child: Text(tr(context, '1. Verify your email', '১. ইমেইল যাচাই করুন'), style: body(17, w: FontWeight.w800))),
              if (emailOk) Pill(tr(context, 'Done', 'সম্পন্ন'), tone: Tone.green),
            ]),
            const SizedBox(height: 6),
            Text('${u['email'] ?? ''}', style: body(15, color: Brand.muted)),
            if (!emailOk) TextButton(onPressed: _sendEmail, child: Text(tr(context, 'Send verification email', 'যাচাইকরণ ইমেইল পাঠান'))),
          ])),
          AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Icon(uploaded ? Icons.check_circle : Icons.badge_outlined, color: uploaded ? Brand.delta : Brand.muted),
              const SizedBox(width: 10),
              Expanded(child: Text(tr(context, '2. Upload your student ID', '২. স্টুডেন্ট আইডি আপলোড করুন'), style: body(17, w: FontWeight.w800))),
            ]),
            const SizedBox(height: 6),
            Text(tr(context, 'Only the admin team can see it. It is deleted if the account is rejected.', 'শুধু অ্যাডমিন দল দেখতে পায়। অ্যাকাউন্ট প্রত্যাখ্যাত হলে মুছে যায়।'), style: body(14, color: Brand.muted)),
            const SizedBox(height: 8),
            BigButton(busy ? '...' : tr(context, 'Choose a photo', 'ছবি বাছুন'), outlined: true, onPressed: busy ? null : _upload),
          ])),
          AppCard(color: Brand.lightGreen, border: Colors.transparent, child: Text(
            match
                ? tr(context, 'Your email matches your university. An admin or your department still confirms you before you get the "University verified" badge.', 'আপনার ইমেইল বিশ্ববিদ্যালয়ের সাথে মেলে। "যাচাইকৃত" ব্যাজের আগে অ্যাডমিন বা বিভাগ নিশ্চিত করবে।')
                : tr(context, 'Your email does not match your university domain, so an admin will review your ID before you appear in the directory.', 'আপনার ইমেইল বিশ্ববিদ্যালয়ের ডোমেইনের সাথে মেলে না, তাই ডিরেক্টরিতে আসার আগে অ্যাডমিন আইডি দেখবেন।'),
            style: body(14, color: Brand.forest),
          )),
          const SizedBox(height: 4),
          BigButton(tr(context, 'Continue', 'চালিয়ে যান'), onPressed: () => context.go('/goal')),
          Center(child: TextButton(onPressed: () => context.go('/goal'), child: Text(tr(context, 'Do this later', 'পরে করব')))),
          Center(child: Text(tr(context, 'You can verify any time from Profile. Next: choose your career goal.', 'প্রোফাইল থেকে যেকোনো সময় যাচাই করতে পারবেন। এরপর: ক্যারিয়ার লক্ষ্য বাছুন।'), textAlign: TextAlign.center, style: body(13, color: Brand.muted))),
        ])),
      ]),
    );
  }
}

class GoalWizardScreen extends ConsumerStatefulWidget {
  const GoalWizardScreen({super.key});
  @override
  ConsumerState<GoalWizardScreen> createState() => _GoalState();
}

class _GoalState extends ConsumerState<GoalWizardScreen> {
  int step = 0;
  String? roleKey;
  double hours = 6;
  final langs = <String>{'bn', 'en'};
  final slots = <String>{};
  bool busy = false;

  Future<void> _save() async {
    setState(() => busy = true);
    try {
      await ref.read(dioProvider).put('/me/goal', data: {
        'careerGoalRoleKey': roleKey,
        'weeklyHours': hours,
        'languages': langs.toList(),
        'requestedSlots': slots.toList(),
      });
      ref.invalidate(readinessProvider);
      ref.invalidate(matchesProvider);
      ref.invalidate(planProvider);
      ref.invalidate(briefProvider);
      if (mounted) {
        toast(context, tr(context, 'Goal saved. Your readiness score and first step are ready on Home.', 'লক্ষ্য সেভ হয়েছে। হোমে আপনার প্রস্তুতি স্কোর ও প্রথম ধাপ তৈরি।'));
        context.go('/');
      }
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
    if (mounted) setState(() => busy = false);
  }

  Widget _stepBody(List roles) {
    if (step == 0) {
      return Column(children: [
        AppCard(
          color: const Color(0xFFFFF7E3), border: Colors.transparent,
          onTap: () => context.push('/decision-lab'),
          child: Row(children: [
            Icon(Icons.science_outlined, color: Brand.forest), const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr(context, 'Not sure yet?', 'এখনও নিশ্চিত নন?'), style: body(16, w: FontWeight.w800)),
              Text(tr(context, 'Compare careers in the Decision Lab, then come back. You can change your goal later.', 'ডিসিশন ল্যাবে ক্যারিয়ার তুলনা করে ফিরে আসুন। লক্ষ্য পরে বদলানো যায়।'), style: body(13, color: Brand.muted)),
            ])),
            Icon(Icons.chevron_right, color: Brand.muted),
          ]),
        ),
        for (final r in roles.cast<Map>())
          AppCard(
            color: roleKey == r['key'] ? Brand.lightGreen : Colors.white,
            onTap: () => setState(() => roleKey = '${r['key']}'),
            child: Row(children: [
              Expanded(child: Text(nm(context, r, 'titleEn', 'titleBn'), style: body(17, w: FontWeight.w700))),
              if (roleKey == r['key']) Icon(Icons.check_circle, color: Brand.delta),
            ]),
          ),
      ]);
    }
    if (step == 1) {
      return AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('${hours.round()} ${tr(context, 'hours per week', 'ঘণ্টা প্রতি সপ্তাহে')}', style: display(24)),
        Slider(value: hours, min: 1, max: 30, divisions: 29, onChanged: (v) => setState(() => hours = v)),
        const SizedBox(height: 8),
        Text(tr(context, 'Languages you are comfortable with', 'যে ভাষায় স্বচ্ছন্দ'), style: body(15, color: Brand.muted)),
        Wrap(spacing: 8, children: [
          for (final l in const ['bn', 'en'])
            FilterChip(
              label: Text(l == 'bn' ? 'বাংলা' : 'English'),
              selected: langs.contains(l),
              onSelected: (v) => setState(() { if (v) { langs.add(l); } else if (langs.length > 1) { langs.remove(l); } }),
            ),
        ]),
      ]));
    }
    return AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(tr(context, 'When are you free for a mentor call?', 'মেন্টর কলের জন্য কখন ফ্রি?'), style: body(16, w: FontWeight.w700)),
      const SizedBox(height: 4),
      Text(tr(context, 'Optional. Pick a few times now, or add them when you request a session.', 'ঐচ্ছিক। এখন কয়েকটি সময় বাছুন, অথবা সেশন চাওয়ার সময় যোগ করুন।'), style: body(13, color: Brand.muted)),
      const SizedBox(height: 8),
      SlotGrid(selected: slots, onChanged: (v) => setState(() { slots..clear()..addAll(v); }), max: 14),
    ]));
  }

  @override
  Widget build(BuildContext context) {
    final labels = [tr(context, 'Goal', 'লক্ষ্য'), tr(context, 'Time', 'সময়'), tr(context, 'Slots', 'স্লট')];
    return Scaffold(
      body: AsyncBody(
        value: ref.watch(onboardingRolesProvider),
        onRetry: () => ref.invalidate(onboardingRolesProvider),
        builder: (d) {
          final roles = (d['roles'] ?? []) as List;
          final canNext = step != 0 || roleKey != null;
          return ListView(padding: EdgeInsets.zero, children: [
            GreenHeader(radius: 36, bottomPad: 26, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr(context, 'Set your career goal', 'ক্যারিয়ার লক্ষ্য ঠিক করুন'), style: display(28, color: Colors.white)),
              const SizedBox(height: 14),
              JourneyStepper(labels: labels, current: step),
            ])),
            Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              _stepBody(roles),
              const SizedBox(height: 8),
              Center(child: Text(tr(context, 'Step ${step + 1} of 3', 'ধাপ ${step + 1}/৩'), style: body(13, color: Brand.muted))),
              const SizedBox(height: 8),
              BigButton(
                step < 2 ? tr(context, 'Next', 'পরবর্তী') : (busy ? '...' : (slots.isEmpty ? tr(context, 'Finish without times', 'সময় ছাড়াই শেষ করুন') : tr(context, 'Finish', 'শেষ করুন'))),
                onPressed: !canNext || busy ? null : () => step < 2 ? setState(() => step++) : _save(),
              ),
              if (step > 0) Center(child: TextButton(onPressed: () => setState(() => step--), child: Text(tr(context, 'Back', 'পেছনে')))),
            ])),
          ]);
        },
      ),
    );
  }
}

class RequestSessionScreen extends ConsumerStatefulWidget {
  const RequestSessionScreen({super.key, required this.mentorId});
  final String mentorId;
  @override
  ConsumerState<RequestSessionScreen> createState() => _RequestState();
}

class _RequestState extends ConsumerState<RequestSessionScreen> {
  final goal = TextEditingController();
  final note = TextEditingController();
  final qs = [TextEditingController(), TextEditingController(), TextEditingController()];
  final slots = <String>{};
  String format = 'video';
  bool busy = false;

  Future<void> _send() async {
    final questions = qs.map((c) => c.text.trim()).where((s) => s.length >= 3).toList();
    if (goal.text.trim().length < 5 || questions.isEmpty) {
      toast(context, tr(context, 'Write your goal and at least one question.', 'লক্ষ্য এবং অন্তত একটি প্রশ্ন লিখুন।'));
      return;
    }
    setState(() => busy = true);
    try {
      await ref.read(dioProvider).post('/requests', data: {
        'mentorId': widget.mentorId,
        'goalText': goal.text.trim(),
        'questions': questions,
        'preferredSlots': slots.toList(),
        'format': format,
        if (note.text.trim().isNotEmpty) 'message': note.text.trim(),
      });
      ref.invalidate(requestsProvider);
      if (mounted) {
        toast(context, tr(context, 'Request sent. Mentors usually reply within 48 hours.', 'অনুরোধ পাঠানো হয়েছে। মেন্টর সাধারণত ৪৮ ঘণ্টায় উত্তর দেন।'));
        context.pop();
      }
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
    if (mounted) setState(() => busy = false);
  }

  @override
  Widget build(BuildContext context) {
    final m = ref.watch(mentorDetailProvider(widget.mentorId)).valueOrNull;
    final mentor = (m?['mentor'] ?? m ?? {}) as Map;
    return Scaffold(
      body: ListView(padding: EdgeInsets.zero, children: [
        GreenHeader(radius: 36, bottomPad: 26, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          BackCircle(dark: true, onTap: () => context.pop()),
          const SizedBox(height: 12),
          Text(tr(context, 'Request a session', 'সেশনের অনুরোধ'), style: display(28, color: Colors.white)),
          if (mentor['name'] != null) Text('${mentor['name']}', style: body(15, color: Colors.white70)),
        ])),
        Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr(context, 'Your goal', 'আপনার লক্ষ্য'), style: body(16, w: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(tr(context, 'Tell the mentor what you want to get out of this session, so they can prepare.', 'এই সেশন থেকে কী পেতে চান লিখুন, যাতে মেন্টর আগে থেকে প্রস্তুতি নিতে পারেন।'), style: body(13, color: Brand.muted)),
            const SizedBox(height: 8),
            TextField(controller: goal, maxLength: 400, minLines: 3, maxLines: 5, textInputAction: TextInputAction.newline, decoration: InputDecoration(
              hintText: tr(context, 'Example: I want to become a backend developer. Please review my roadmap and tell me what to learn first.', 'যেমন: আমি ব্যাকএন্ড ডেভেলপার হতে চাই। আমার রোডম্যাপ দেখে বলুন প্রথমে কী শিখব।'))),
            const SizedBox(height: 10),
            Text(tr(context, 'Your questions', 'আপনার প্রশ্ন'), style: body(16, w: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(tr(context, 'Ask what you want answered in the session. Keep them about your goal, your skills or your career. Question 1 is required.', 'সেশনে কী জানতে চান তা লিখুন। প্রশ্নগুলো আপনার লক্ষ্য, স্কিল বা ক্যারিয়ার নিয়ে হলে ভালো। প্রশ্ন ১ আবশ্যক।'), style: body(13, color: Brand.muted)),
            const SizedBox(height: 4),
            for (int i = 0; i < 3; i++)
              Padding(padding: const EdgeInsets.only(top: 10), child: TextField(controller: qs[i], maxLength: 200, minLines: 2, maxLines: 4, decoration: InputDecoration(
                labelText: '${tr(context, 'Question', 'প্রশ্ন')} ${i + 1}${i == 0 ? ' *' : ''}',
                hintText: [
                  tr(context, 'Example: Which skill should I learn first for this role?', 'যেমন: এই পদের জন্য প্রথমে কোন স্কিল শিখব?'),
                  tr(context, 'Example: How did you prepare for your first interview?', 'যেমন: প্রথম ইন্টারভিউয়ের প্রস্তুতি কীভাবে নিয়েছিলেন?'),
                  tr(context, 'Example: What projects should I show in my CV?', 'যেমন: সিভিতে কোন প্রজেক্ট দেখাব?'),
                ][i]))),
          ])),
          AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr(context, 'Preferred times', 'পছন্দের সময়'), style: body(16, w: FontWeight.w700)),
            const SizedBox(height: 8),
            SlotGrid(selected: slots, onChanged: (v) => setState(() { slots..clear()..addAll(v); }), max: 6),
            const SizedBox(height: 10),
            Text(tr(context, 'Format', 'ফরম্যাট'), style: body(16, w: FontWeight.w700)),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final f in [('video', tr(context, 'Video', 'ভিডিও')), ('phone', tr(context, 'Phone', 'ফোন')), ('in_person', tr(context, 'In person', 'সরাসরি')), ('message', tr(context, 'Message', 'মেসেজ'))])
                ChoiceChip(label: Text(f.$2), selected: format == f.$1, onSelected: (_) => setState(() => format = f.$1)),
            ]),
          ])),
          AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr(context, 'Message to the mentor (optional)', 'মেন্টরকে মেসেজ (ঐচ্ছিক)'), style: body(16, w: FontWeight.w700)),
            const SizedBox(height: 8),
            TextField(controller: note, maxLength: 500, minLines: 2, maxLines: 5, decoration: InputDecoration(
              hintText: tr(context, 'Say hello, share anything else the mentor should know.', 'সালাম/শুভেচ্ছা জানান, মেন্টরের আর কিছু জানা দরকার হলে লিখুন।'))),
          ])),
          AppCard(color: Brand.lightGreen, border: Colors.transparent, child: Text(
            tr(context, 'Sessions are free. Never pay a mentor. Your CV and skill levels are shared only after the mentor accepts.', 'সেশন বিনামূল্যে। মেন্টরকে টাকা দেবেন না। মেন্টর গ্রহণের পরই আপনার সিভি ও স্কিল শেয়ার হয়।'),
            style: body(14, color: Brand.forest),
          )),
          BigButton(busy ? '...' : tr(context, 'Send request', 'অনুরোধ পাঠান'), onPressed: busy ? null : _send),
        ])),
      ]),
    );
  }
}

final onboardingRoutes = <RouteBase>[
  GoRoute(path: '/verify', builder: (_, __) => const VerifyScreen()),
  GoRoute(path: '/goal', builder: (_, __) => const GoalWizardScreen()),
  GoRoute(path: '/request/:mentorId', builder: (_, s) => RequestSessionScreen(mentorId: s.pathParameters['mentorId']!)),
];
