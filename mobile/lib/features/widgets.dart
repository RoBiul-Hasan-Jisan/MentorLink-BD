import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../l10n/app_localizations.dart';

class AsyncBody extends StatelessWidget {
  const AsyncBody({super.key, required this.value, required this.builder, this.onRetry});
  final AsyncValue<dynamic> value;
  final Widget Function(dynamic data) builder;
  final VoidCallback? onRetry;
  @override
  Widget build(BuildContext context) => value.when(
        data: (d) => builder(d),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [Text(errorText(e), textAlign: TextAlign.center), if (onRetry != null) TextButton(onPressed: onRetry, child: Text(AppLocalizations.of(context).retryBtn))])),
      );
}

void toast(BuildContext c, String m) => ScaffoldMessenger.of(c).showSnackBar(SnackBar(content: Text(m)));

// Saves a privacy / data setting on the server (PATCH /me/privacy). The switches read their value from the server copy of the profile,
// so a failed save leaves the switch at the value that is really stored, and the person is told why. Returns true when saved.
Future<bool> savePrivacySetting(BuildContext context, WidgetRef ref, Map<String, dynamic> data) async {
  try {
    await ref.read(dioProvider).patch('/me/privacy', data: data);
    ref.invalidate(meProvider);
    return true;
  } catch (e) {
    if (context.mounted) toast(context, errorText(e));
    return false;
  }
}
