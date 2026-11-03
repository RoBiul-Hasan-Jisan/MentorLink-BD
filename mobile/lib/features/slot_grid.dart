import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// One shared time-slot format for students AND mentors: "<day>-<hour>" e.g. "fri-10", "sat-20" (24-hour clock).
// Before this, students sent "Sat-evening" and mentors saved "sat-20", so the schedule match never found an overlap.
const slotDayIds = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
const slotHours = [10, 16, 20]; // morning, afternoon, evening

String slotDayLabel(BuildContext c, String d) {
  const en = {'sat': 'Sat', 'sun': 'Sun', 'mon': 'Mon', 'tue': 'Tue', 'wed': 'Wed', 'thu': 'Thu', 'fri': 'Fri'};
  const bn = {'sat': 'শনি', 'sun': 'রবি', 'mon': 'সোম', 'tue': 'মঙ্গল', 'wed': 'বুধ', 'thu': 'বৃহ', 'fri': 'শুক্র'};
  return tr(c, en[d] ?? d, bn[d] ?? d);
}

String slotHourLabel(BuildContext c, int h) {
  if (h < 12) return tr(c, 'Morning\n10 AM', 'সকাল\n১০টা');
  if (h < 18) return tr(c, 'Afternoon\n4 PM', 'বিকাল\n৪টা');
  return tr(c, 'Evening\n8 PM', 'রাত\n৮টা');
}

// Day x time grid. Tap a cell to toggle it. Tap a day name to toggle the whole row.
class SlotGrid extends StatelessWidget {
  const SlotGrid({super.key, required this.selected, required this.onChanged, this.max = 14});
  final Set<String> selected;
  final ValueChanged<Set<String>> onChanged;
  final int max;

  void _toggle(BuildContext context, String id) {
    final next = {...selected};
    if (next.contains(id)) {
      next.remove(id);
    } else {
      if (next.length >= max) {
        toast(context, tr(context, 'You can pick up to $max slots.', 'সর্বোচ্চ $maxটি সময় বাছতে পারবেন।'));
        return;
      }
      next.add(id);
    }
    onChanged(next);
  }

  @override
  Widget build(BuildContext context) {
    Widget head(String t) => Expanded(child: Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(t, textAlign: TextAlign.center, style: body(12, color: Brand.muted, w: FontWeight.w700))));
    return Column(children: [
      Row(children: [
        const SizedBox(width: 52),
        for (final h in slotHours) head(slotHourLabel(context, h)),
      ]),
      for (final d in slotDayIds)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 3),
          child: Row(children: [
            SizedBox(width: 52, child: Text(slotDayLabel(context, d), style: body(14, w: FontWeight.w700, color: d == 'fri' ? Brand.forest : Brand.ink))),
            for (final h in slotHours)
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () => _toggle(context, '$d-$h'),
                    child: Container(
                      height: 42,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: selected.contains('$d-$h') ? Brand.lightGreen : Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: selected.contains('$d-$h') ? Brand.delta : const Color(0xFFD6D6D6)),
                      ),
                      child: selected.contains('$d-$h') ? const Icon(Icons.check, size: 20, color: Brand.delta) : null,
                    ),
                  ),
                ),
              ),
          ]),
        ),
    ]);
  }
}
