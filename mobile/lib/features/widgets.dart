import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/ui.dart';
import '../core/theme.dart';
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


/// Day x time-of-day grid for choosing free slots (Saturday to Friday; morning, afternoon, evening, night).
/// Slots are stored as "<day>-<period>", for example "fri-evening". Same form on the student and the mentor side so they can match.
class SlotPicker extends StatelessWidget {
  const SlotPicker({super.key, required this.selected, required this.onChanged, this.max = 14});
  final Set<String> selected;
  final void Function(String slot, bool on) onChanged;
  final int max;

  static const days = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
  static const periods = ['morning', 'afternoon', 'evening', 'night'];

  /// Old data used an hour ("sun-20") or capitals ("Sat-evening"). Returns the current form, or '' when it cannot be read.
  static String norm(String raw) {
    final parts = raw.toLowerCase().split('-');
    if (parts.length != 2) return '';
    if (periods.contains(parts[1])) return '${parts[0]}-${parts[1]}';
    final h = int.tryParse(parts[1]);
    if (h == null) return '';
    final p = h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 21 ? 'evening' : 'night';
    return '${parts[0]}-$p';
  }

  static String dayLabel(BuildContext c, String d) => switch (d) {
        'sat' => tr(c, 'Sat', 'শনি'), 'sun' => tr(c, 'Sun', 'রবি'), 'mon' => tr(c, 'Mon', 'সোম'), 'tue' => tr(c, 'Tue', 'মঙ্গল'),
        'wed' => tr(c, 'Wed', 'বুধ'), 'thu' => tr(c, 'Thu', 'বৃহ'), _ => tr(c, 'Fri', 'শুক্র'),
      };
  static String periodLabel(BuildContext c, String p) => switch (p) {
        'morning' => tr(c, 'Morning', 'সকাল'), 'afternoon' => tr(c, 'Afternoon', 'দুপুর'), 'evening' => tr(c, 'Evening', 'সন্ধ্যা'), _ => tr(c, 'Night', 'রাত'),
      };
  static String periodHint(String p) => switch (p) { 'morning' => '6-12', 'afternoon' => '12-5', 'evening' => '5-9', _ => '9-12' };
  /// "Fri evening" style text for a stored slot.
  static String label(BuildContext c, String slot) {
    final n = norm(slot);
    if (n.isEmpty) return slot;
    final a = n.split('-');
    return '${dayLabel(c, a[0])} ${periodLabel(c, a[1]).toLowerCase()}';
  }

  @override
  Widget build(BuildContext context) {
    Widget cell(Widget child, {double flex = 1}) => Expanded(flex: (flex * 10).round(), child: child);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        cell(const SizedBox(), flex: .8),
        for (final p in periods) cell(Column(children: [
          Text(periodLabel(context, p), style: body(12, w: FontWeight.w800, color: Brand.muted)),
          Text(periodHint(p), style: body(11, color: Brand.muted)),
        ])),
      ]),
      const SizedBox(height: 6),
      for (final d in days) Padding(padding: const EdgeInsets.only(bottom: 6), child: Row(children: [
        cell(Text(dayLabel(context, d), style: body(14, w: FontWeight.w700)), flex: .8),
        for (final p in periods) cell(Padding(padding: const EdgeInsets.symmetric(horizontal: 3), child: _SlotCell(
          on: selected.contains('$d-$p'),
          onTap: () {
            final on = !selected.contains('$d-$p');
            if (on && selected.length >= max) { toast(context, tr(context, 'You can pick up to $max slots.', 'সর্বোচ্চ $maxটি সময় বাছতে পারবেন।')); return; }
            onChanged('$d-$p', on);
          },
        ))),
      ])),
    ]);
  }
}

class _SlotCell extends StatelessWidget {
  const _SlotCell({required this.on, required this.onTap});
  final bool on; final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          height: 44, alignment: Alignment.center,
          decoration: BoxDecoration(color: on ? Brand.lightGreen : Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: on ? Brand.delta : const Color(0xFFD5DDD7), width: on ? 2 : 1)),
          child: on ? const Icon(Icons.check, size: 20, color: Brand.forest) : null,
        ),
      );
}
