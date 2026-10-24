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
import 'features/mentor_detail.dart';
import 'features/skillgap.dart';
import 'features/welcome.dart';
import 'features/university.dart';

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
      if (loc == '/sign-in' || loc == '/sign-up' || loc == '/complete-profile' || loc == '/welcome' || loc == '/problem') return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (_, __) => const Shell()),
      GoRoute(path: '/notifications', builder: (_, __) => const NotificationsScreen()),
      GoRoute(path: '/quiz/:skill', builder: (_, s) => QuizScreen(skill: s.pathParameters['skill']!)),
      GoRoute(path: '/applicants/:id', builder: (_, s) => ApplicantsScreen(jobId: s.pathParameters['id']!, title: s.extra as String?)),
      GoRoute(path: '/mentor/:id', builder: (_, s) => MentorDetailScreen(id: s.pathParameters['id']!)),
      GoRoute(path: '/problem', builder: (_, __) => const ProblemScreen()),
      GoRoute(path: '/cv', builder: (_, __) => const CvScreen()),
      GoRoute(path: '/review-cv/:studentId', builder: (_, s) => ReviewCvScreen(studentId: s.pathParameters['studentId']!)),
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
