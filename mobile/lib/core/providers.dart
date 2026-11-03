import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api.dart';

final dioProvider = Provider<Dio>((_) => buildDio());
final authStateProvider = StreamProvider<User?>((_) => FirebaseAuth.instance.authStateChanges());
// The language the user chose. main() loads the saved choice before the app starts and overrides this provider, and
// MentorLinkApp saves every change, so the language never flips back on its own (restart, relaunch, sign-in/out).
final localeProvider = StateProvider<String>((_) => 'en');

// GET helper that returns decoded JSON.
Future<Map<String, dynamic>> getJson(Ref ref, String path, {Map<String, dynamic>? q}) async =>
    (await ref.read(dioProvider).get(path, queryParameters: q)).data as Map<String, dynamic>;

// The signed-in profile from OUR server (role comes from here).
final meProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  final u = ref.watch(authStateProvider).valueOrNull;
  if (u == null) return null;
  try {
    return (await getJson(ref, '/me'))['user'] as Map<String, dynamic>;
  } on DioException catch (e) {
    if (e.response?.statusCode == 403) return {'needsProfile': true};
    rethrow;
  }
});

final universitiesProvider = FutureProvider((ref) async => (await getJson(ref, '/universities'))['universities'] as List);
final readinessProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/readiness'));
final matchesProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/matches'));
final planProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/plan'));
final opportunitiesProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/opportunities'));
final applicationsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/applications'));
final requestsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/requests'));
final dirUniversitiesProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/directory/universities'));
final queueProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/admin/verification-queue'));
final deptProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/department/overview'));
final membersProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) => getJson(ref, '/directory/universities/$id/members'));
final mentorDetailProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) => getJson(ref, '/mentors/$id'));
final cvProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/cv'));
final menteeCvProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) => getJson(ref, '/mentees/$id/cv'));
final roadmapsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/roadmaps'));
final topicProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, k) => getJson(ref, '/roadmaps/${k.split('|')[0]}/topics/${k.split('|')[1]}'));
final roadmapProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, k) => getJson(ref, '/roadmaps/$k'));
final targetsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/targets'));
final targetProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, k) => getJson(ref, '/targets/$k'));
final sessionsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/sessions'));
final resourcesProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/resources'));
final notificationsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/notifications'));
final employerJobsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/employer/jobs'));
final myOrgProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/me/organization'));
final applicantsProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) => getJson(ref, '/employer/jobs/$id/applicants'));
final quizProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, skill) => getJson(ref, '/quizzes/$skill'));
