import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api.dart';
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
