import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'core/providers.dart';
import 'features/auth.dart';
import 'features/shell.dart';
import 'features/chat.dart';
import 'features/university.dart';

// The router only decides WHERE you land. The server still checks the role on every API call.
final routerProvider = Provider<GoRouter>((ref) {
  final refresh = ValueNotifier<int>(0);
  ref.listen(meProvider, (_, __) => refresh.value++);
  ref.listen(authStateProvider, (_, __) => refresh.value++);
  return GoRouter(
    refreshListenable: refresh,
    initialLocation: '/',
    redirect: (context, state) {
      final auth = ref.read(authStateProvider);
      final loc = state.matchedLocation;
      if (auth.isLoading) return null;
      if (auth.valueOrNull == null) return (loc == '/sign-in' || loc == '/sign-up') ? null : '/sign-in';
      final me = ref.read(meProvider).valueOrNull;
      if (me == null) return null;
      if (me['needsProfile'] == true) return loc == '/complete-profile' ? null : '/complete-profile';
      if (loc == '/sign-in' || loc == '/sign-up' || loc == '/complete-profile') return '/';
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (_, __) => const Shell()),
      GoRoute(path: '/sign-in', builder: (_, __) => const SignInScreen()),
      GoRoute(path: '/sign-up', builder: (_, __) => const SignUpScreen()),
      GoRoute(path: '/complete-profile', builder: (_, __) => const CompleteProfileScreen()),
      GoRoute(path: '/chat/:id', builder: (_, s) => ChatScreen(requestId: s.pathParameters['id']!)),
      GoRoute(path: '/university-map', builder: (_, __) => const UniversityMapScreen()),
      GoRoute(path: '/university/:id', builder: (_, s) => UniversityMembersScreen(id: s.pathParameters['id']!)),
    ],
  );
});
