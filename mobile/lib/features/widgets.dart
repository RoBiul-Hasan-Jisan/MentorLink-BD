import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/theme.dart';

class AsyncBody extends StatelessWidget {
  const AsyncBody({super.key, required this.value, required this.builder, this.onRetry});
  final dynamic value; // AsyncValue
  final Widget Function(dynamic data) builder;
  final VoidCallback? onRetry;
  @override
  Widget build(BuildContext context) => value.when(
        data: (d) => builder(d),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Column(mainAxisSize: MainAxisSize.min, children: [Text(errorText(e), textAlign: TextAlign.center), if (onRetry != null) TextButton(onPressed: onRetry, child: const Text('Retry'))])),
      );
}

class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, this.color = Brand.lightGreen, this.fg = Brand.forest});
  final String text; final Color color, fg;
  @override
  Widget build(BuildContext context) => Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(20)), child: Text(text, style: TextStyle(color: fg, fontSize: 12, fontWeight: FontWeight.w600)));
}

void toast(BuildContext c, String m) => ScaffoldMessenger.of(c).showSnackBar(SnackBar(content: Text(m)));
