import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api.dart';

final dioProvider = Provider<Dio>((_) => buildDio());
final authStateProvider = StreamProvider<User?>((_) => FirebaseAuth.instance.authStateChanges());
final localeProvider = StateProvider<String>((_) => 'bn');

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
