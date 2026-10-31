import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../features/widgets.dart' show toast;
import 'ui.dart';

/// Turns text a mentor typed into a safe meeting link, or returns null.
///
/// Rules (kept in step with backend/src/utils/links.js):
///  - only https links are opened; http:, javascript:, file:, intent: and every other scheme are refused;
///  - a link typed without a scheme ("meet.google.com/abc-defg-hij") gets https:// added;
///  - no spaces, no user:password@ part, a real dotted host name, at most 300 characters.
Uri? parseMeetingUri(String? raw) {
  var t = (raw ?? '').trim();
  if (t.isEmpty || t.length > 300 || RegExp(r'\s').hasMatch(t)) return null;
  if (RegExp(r'^[a-zA-Z][a-zA-Z0-9+.\-]*:').hasMatch(t)) {
    if (!t.toLowerCase().startsWith('https://')) return null;
  } else {
    t = 'https://$t';
  }
  final u = Uri.tryParse(t);
  if (u == null || u.scheme != 'https' || u.host.isEmpty || !u.host.contains('.') || u.userInfo.isNotEmpty) return null;
  return u;
}

/// Opens a session's meeting link in the browser or meeting app. Shows a clear message when the link is missing,
/// unsafe, or the phone cannot open it. The link itself is never put in a toast or a log.
Future<void> openMeetingLink(BuildContext context, String? raw) async {
  if ((raw ?? '').trim().isEmpty) {
    toast(context, tr(context, 'No meeting link yet. Ask your mentor in the chat.', 'এখনও মিটিং লিংক নেই। চ্যাটে মেন্টরকে জিজ্ঞেস করুন।'));
    return;
  }
  final uri = parseMeetingUri(raw);
  if (uri == null) {
    toast(context, tr(context, 'This meeting link is not a secure https link, so it was not opened. Ask your mentor for a new one.', 'এই মিটিং লিংকটি নিরাপদ https লিংক নয়, তাই খোলা হয়নি। মেন্টরকে নতুন লিংক দিতে বলুন।'));
    return;
  }
  var ok = false;
  try {
    ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (_) {
    ok = false;
  }
  if (!ok && context.mounted) toast(context, tr(context, 'Could not open the meeting link.', 'মিটিং লিংক খোলা যায়নি।'));
}
