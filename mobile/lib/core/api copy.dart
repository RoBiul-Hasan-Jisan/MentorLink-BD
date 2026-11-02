
import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart' show kIsWeb;

// Production backend: Render
const _productionApiUrl = 'https://dryrunapp.onrender.com';

// Optional override:
// flutter run --dart-define=API_URL=http://localhost:4000
const _apiOverride = String.fromEnvironment('API_URL');

// Uses the production backend by default.
// Set API_URL to use a local or alternative backend.
final String apiUrl = _apiOverride.isNotEmpty
    ? _apiOverride
    : _productionApiUrl;

Dio buildDio() {
  final dio = Dio(
    BaseOptions(
      baseUrl: '$apiUrl/api',
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final user = FirebaseAuth.instance.currentUser;

        if (user != null) {
          final token = await user.getIdToken();

          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
        }

        handler.next(options);
      },
      onError: (error, handler) {
        handler.next(error);
      },
    ),
  );

  return dio;
}

String errorText(Object e) {
  if (e is DioException) {
    final data = e.response?.data;

    if (data is Map && data['error'] is Map) {
      final message = data['error']['message'];

      if (message is String) return message;
    }

    if (e.response == null) {
      return 'Cannot connect to the MentorLink BD server. '
          'Check your internet connection or try again later.';
    }

    return 'Server error (${e.response?.statusCode}).';
  }

  return e.toString();
}
