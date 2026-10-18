import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';

const apiUrl = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:4000');

// Every request carries the Firebase credential as an opaque Bearer string.
// The app never decodes it and never sends a role: the server decides who you are.
Dio buildDio() {
  final dio = Dio(BaseOptions(baseUrl: '$apiUrl/api', connectTimeout: const Duration(seconds: 15), receiveTimeout: const Duration(seconds: 20)));
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
    return 'Network problem. Check your connection.';
  }
  return e.toString();
}
