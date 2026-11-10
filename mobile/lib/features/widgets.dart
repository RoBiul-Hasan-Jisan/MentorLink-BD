import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import '../l10n/app_localizations.dart';

class AsyncBody extends StatelessWidget {
  const AsyncBody({super.key, required this.value, required this.builder, this.onRetry});
  final AsyncValue<dynamic> value;
  final Widget Function(dynamic data) builder;
  final VoidCallback? onRetry;
  @override
  Widget build(BuildContext context) => value.when(
        // Calm skeleton while loading, then the content fades in.
        data: (d) => FadeSlideIn(offset: 0, child: builder(d)),
        loading: () => const SkeletonList(),
        error: (e, _) => EmptyState(
          icon: Icons.cloud_off_outlined,
          title: tr(context, 'Something went wrong', 'কিছু একটা সমস্যা হয়েছে'),
          subtitle: errorText(e),
          actionLabel: onRetry == null ? null : AppLocalizations.of(context).retryBtn,
          onAction: onRetry,
        ),
      );
}

void toast(BuildContext c, String m) => ScaffoldMessenger.of(c)
  ..hideCurrentSnackBar()
  ..showSnackBar(SnackBar(content: Text(m), duration: const Duration(milliseconds: 2600)));

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

/// Two round swatches (Chrome Black + Lilac / Green + Saffron). Tap one to change the app colours.
/// Used on the welcome screen; the same choice is in Profile > Colour theme.
class PaletteSwitchButton extends ConsumerWidget {
  const PaletteSwitchButton({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cur = ref.watch(paletteProvider);
    Widget dot(String key, Color a, Color b, String label) {
      final on = cur == key;
      return Semantics(
        button: true, selected: on, label: label,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => ref.read(paletteProvider.notifier).state = key,
          child: Container(
            width: 36, height: 36, margin: const EdgeInsets.symmetric(horizontal: 3),
            decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Colors.white, width: on ? 3 : 1.5)),
            child: ClipOval(child: Row(children: [Expanded(child: ColoredBox(color: a, child: const SizedBox.expand())), Expanded(child: ColoredBox(color: b, child: const SizedBox.expand()))])),
          ),
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(24)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.palette_outlined, color: Colors.white, size: 18), const SizedBox(width: 4),
        dot('lilac', const Color(0xFF15151B), const Color(0xFFB79CFF), 'Chrome Black and Digital Lilac'),
        dot('green', const Color(0xFF0F6B52), const Color(0xFFF0A21C), 'Green and Saffron'),
      ]),
    );
  }
}
