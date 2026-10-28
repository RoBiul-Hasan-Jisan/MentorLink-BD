import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'core/providers.dart';
import 'features/auth.dart';
import 'features/shell.dart';
import 'features/chat.dart';
import 'features/employer.dart';
import 'features/notifications.dart';
import 'features/quiz.dart';
import 'features/jobs.dart';
import 'features/cv.dart';
import 'features/roadmap.dart';
import 'features/targets.dart';
import 'features/mentor_detail.dart';
import 'features/skillgap.dart';
import 'features/welcome.dart';
import 'features/university.dart';
import 'features/sessions.dart';
import 'features/onboarding.dart';
import 'features/path_twin.dart';
import 'features/hub.dart';
import 'features/feed.dart';
import 'features/loop.dart';
import 'features/job_gaps.dart';
import 'features/decision_lab.dart';
import 'features/jobs_more.dart';
import 'features/mentor_more.dart';

// The router only decides WHERE you land. The server still checks the role on every API call.
final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier<int>(0);
  ref.listen(meProvider, (_, __) => refresh.value++);
  ref.listen(authStateProvider, (_, __) => refresh.value++);
  var firstLoad = true; // on web the browser may reopen an old #/sign-in URL; a fresh launch must start at Welcome
  return GoRouter(
    refreshListenable: refresh,
    initialLocation: '/',
    redirect: (context, state) {
      final auth = ref.read(authStateProvider);
      final loc = state.matchedLocation;
      if (auth.isLoading) return null;
      if (auth.valueOrNull == null) {
        if (firstLoad) { firstLoad = false; return loc == '/welcome' ? null : '/welcome'; }
        return (loc == '/sign-in' || loc == '/sign-up' || loc == '/welcome') ? null : '/welcome';
      }
      firstLoad = false;
      final meState = ref.read(meProvider);
      if (meState.hasError) return loc == '/problem' ? null : '/problem';
      final me = meState.valueOrNull;
      if (me == null) return null;
      if (me['needsProfile'] == true) return loc == '/complete-profile' ? null : '/complete-profile';
      if (loc == '/complete-profile' && me['role'] == 'student') return '/verify';
      if (loc == '/sign-in' || loc == '/sign-up' || loc == '/complete-profile' || loc == '/welcome' || loc == '/problem') return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (_, __) => const Shell()),
      ...pathTwinRoutes,
      ...hubRoutes,
      ...feedRoutes,
      ...loopRoutes,
      ...jobGapRoutes,
      ...decisionLabRoutes,
      ...mentorMoreRoutes, // before '/mentor/:id' so '/mentor/setup' is not read as a mentor id
      ...studentExtraRoutes, ...onboardingRoutes, ...jobsMoreRoutes,
      GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),
      GoRoute(path: '/quiz/:skill', builder: (_, s) => QuizScreen(skill: s.pathParameters['skill']!)),
      GoRoute(path: '/applicants/:id', builder: (_, s) => ApplicantsScreen(jobId: s.pathParameters['id']!, title: s.extra as String?)),
      GoRoute(path: '/mentor/:id', builder: (_, s) => MentorDetailScreen(id: s.pathParameters['id']!)),
      GoRoute(path: '/problem', builder: (_, __) => const ProblemScreen()),
      GoRoute(path: '/cv', builder: (_, __) => const CvScreen()),
      GoRoute(path: '/review-cv/:studentId', builder: (_, s) => ReviewCvScreen(studentId: s.pathParameters['studentId']!)),
      GoRoute(path: '/targets', builder: (_, __) => const TargetsScreen()),
      GoRoute(path: '/target/:key', builder: (_, s) => TargetScreen(targetKey: s.pathParameters['key']!)),
      GoRoute(path: '/roadmaps', builder: (_, __) => const RoadmapsScreen()),
      GoRoute(path: '/roadmap/:skillKey', builder: (_, s) => RoadmapScreen(skillKey: s.pathParameters['skillKey']!)),
      GoRoute(path: '/welcome', builder: (_, __) => const WelcomeScreen()),
      GoRoute(path: '/skill-gap', builder: (_, __) => const SkillGapScreen()),
      GoRoute(path: '/applications', builder: (_, __) => const ApplicationsScreen()),
      GoRoute(path: '/sign-in', builder: (_, __) => const SignInScreen()),
      GoRoute(path: '/sign-up', builder: (_, __) => const SignUpScreen()),
      GoRoute(path: '/complete-profile', builder: (_, __) => const CompleteProfileScreen()),
      GoRoute(path: '/chat/:id', builder: (_, s) => ChatScreen(requestId: s.pathParameters['id']!)),
      GoRoute(path: '/university-map', builder: (_, __) => const UniversityMapScreen()),
      GoRoute(path: '/university/:id', builder: (_, s) => UniversityMembersScreen(id: s.pathParameters['id']!)),
    ],
  );
});
