import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'api.dart';
import 'providers.dart';
import 'ui.dart';
import '../features/widgets.dart';

// Picks a photo, shrinks it on the device (the server accepts files under 300 KB) and uploads it as PRIVATE verification evidence.
// kind: 'student_id' | 'graduation_proof' | 'department_letter'. Returns true when the upload worked.
// Only admins can open these files; they are deleted automatically if the account is rejected.
Future<bool> pickAndUploadDoc(BuildContext context, WidgetRef ref, String kind) async {
  try {
    final x = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 1000, maxHeight: 1000, imageQuality: 55);
    if (x == null) return false;
    final bytes = await x.readAsBytes();
    if (bytes.length > 290000) {
      if (context.mounted) toast(context, tr(context, 'Photo is too large. Choose a smaller photo.', 'ছবিটি অনেক বড়। ছোট ছবি বাছুন।'));
      return false;
    }
    final isPng = bytes.length > 4 && bytes[0] == 0x89 && bytes[1] == 0x50;
    await ref.read(dioProvider).post('/me/verification-doc', data: {'kind': kind, 'mime': isPng ? 'image/png' : 'image/jpeg', 'dataBase64': base64Encode(bytes)},
        options: Options(sendTimeout: const Duration(seconds: 30)));
    if (context.mounted) toast(context, tr(context, 'Uploaded. Only the admin team can see it.', 'আপলোড হয়েছে। শুধু অ্যাডমিন দল দেখতে পারবে।'));
    return true;
  } catch (e) {
    if (context.mounted) toast(context, errorText(e));
    return false;
  }
}
