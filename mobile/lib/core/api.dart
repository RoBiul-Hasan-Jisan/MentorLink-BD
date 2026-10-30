import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';

// The app talks to the hosted backend on Render by default.
// For local testing: --dart-define=API_URL=http://localhost:4000 (Chrome) or http://10.0.2.2:4000 (Android emulator).
const _apiOverride = String.fromEnvironment('API_URL');
final apiUrl = _apiOverride.isNotEmpty ? _apiOverride : 'https://dryrunapp.onrender.com';

// Every request carries the Firebase credential as an opaque Bearer string.
// The app never decodes it and never sends a role: the server decides who you are.
Dio buildDio() {
  final dio = Dio(BaseOptions(baseUrl: '$apiUrl/api', connectTimeout: const Duration(seconds: 60), receiveTimeout: const Duration(seconds: 60)));
  dio.interceptors.add(InterceptorsWrapper(onRequest: (o, h) async {
    final u = FirebaseAuth.instance.currentUser;
    if (u != null) {
      final credential = await u.getIdToken();
      o.headers['Authorization'] = 'Bearer $credential';
    }
    h.next(o);
  }));
  return dio;
}

String errorText(Object e) {
  if (e is DioException) {
    final d = e.response?.data;
    if (d is Map && d['error'] is Map) return d['error']['message'] as String;
    if (e.response == null) return 'Cannot reach the server at $apiUrl. If it is hosted on the Render free plan, it may be waking up: wait a minute and retry.';
    return 'Server error (${e.response?.statusCode}).';
  }
  return e.toString();
}
