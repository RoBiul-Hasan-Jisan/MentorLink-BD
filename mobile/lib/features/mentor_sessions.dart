import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api.dart';
import '../core/links.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart' show toast;

// Mentor side of the session lifecycle. Both dialogs call the server inside the dialog, so if the request fails the
// mentor's typed text stays on screen with an error message instead of being lost.
//   scheduleSessionDialog -> POST /sessions                (needs an ACCEPTED request, checked by the server)
//   completeSessionDialog -> POST /sessions/:id/complete   (notes + next steps; the steps become tasks in the student's plan)
// Each returns true when the server saved the change, so the caller can refresh its lists.

const _modes = [
  ('video', 'Video', 'ভিডিও'),
  ('phone', 'Phone', 'ফোন'),
  ('in_person', 'In person', 'সরাসরি'),
  ('message', 'Message', 'মেসেজ'),
];

String _two(int n) => n.toString().padLeft(2, '0');
String _whenText(DateTime d) => '${d.year}-${_two(d.month)}-${_two(d.day)}  ${_two(d.hour)}:${_two(d.minute)}';

Future<bool> scheduleSessionDialog(BuildContext context, WidgetRef ref, Map request) async {
  DateTime? when;
  String mode = 'video';
  final link = TextEditingController();
  String? error;
  bool busy = false;

  final saved = await showDialog<bool>(
    context: context,
    barrierDismissible: false,
    builder: (c) => StatefulBuilder(builder: (c, setSt) {
      Future<void> pick() async {
        final now = DateTime.now();
        final d = await showDatePicker(context: c, initialDate: when ?? now.add(const Duration(days: 1)), firstDate: now, lastDate: now.add(const Duration(days: 120)));
        if (d == null || !c.mounted) return;
        final t = await showTimePicker(context: c, initialTime: TimeOfDay.fromDateTime(when ?? now.add(const Duration(hours: 24))));
        if (t == null) return;
        setSt(() => when = DateTime(d.year, d.month, d.day, t.hour, t.minute));
      }

      Future<void> save() async {
        final text = link.text.trim();
        final uri = text.isEmpty ? null : parseMeetingUri(text);
        if (when == null || !when!.isAfter(DateTime.now())) {
          setSt(() => error = tr(c, 'Pick a future date and time.', 'ভবিষ্যতের তারিখ ও সময় বেছে নিন।'));
          return;
        }
        if (text.isNotEmpty && uri == null) {
          setSt(() => error = tr(c, 'The meeting link must be a secure https link.', 'মিটিং লিংক অবশ্যই নিরাপদ https লিংক হতে হবে।'));
          return;
        }
        setSt(() { busy = true; error = null; });
        try {
          await ref.read(dioProvider).post('/sessions', data: {
            'requestId': '${request['_id']}',
            'startsAt': when!.toUtc().toIso8601String(),
            'mode': mode,
            if (uri != null) 'meetingLink': uri.toString(),
          });
          ref.invalidate(sessionsProvider);
          if (c.mounted) Navigator.pop(c, true);
        } catch (e) {
          setSt(() { busy = false; error = errorText(e); });
        }
      }

      return AlertDialog(
        title: Text(tr(c, 'Schedule session', 'সেশন নির্ধারণ করুন'), style: display(20)),
        content: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${request['withName'] ?? ''}', style: body(15, color: Brand.muted)),
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: busy ? null : pick,
            icon: const Icon(Icons.event),
            label: Text(when == null ? tr(c, 'Pick date and time', 'তারিখ ও সময় বেছে নিন') : _whenText(when!)),
          ),
          const SizedBox(height: 10),
          Wrap(spacing: 8, children: [
            for (final m in _modes) ChoiceChip(label: Text(tr(c, m.$2, m.$3)), selected: mode == m.$1, onSelected: busy ? null : (_) => setSt(() => mode = m.$1)),
          ]),
          const SizedBox(height: 10),
          TextField(
            controller: link,
            enabled: !busy,
            keyboardType: TextInputType.url,
            maxLength: 300,
            decoration: InputDecoration(labelText: tr(c, 'Meeting link (https)', 'মিটিং লিংক (https)'), hintText: 'https://meet.google.com/…'),
          ),
          if (error != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(error!, style: body(14, color: const Color(0xFF9B2C1F), w: FontWeight.w700))),
        ])),
        actions: [
          TextButton(onPressed: busy ? null : () => Navigator.pop(c, false), child: Text(tr(c, 'Cancel', 'বাতিল'))),
          FilledButton(onPressed: busy ? null : save, child: Text(tr(c, 'Save', 'সংরক্ষণ'))),
        ],
      );
    }),
  );
  link.dispose();
  if (saved == true && context.mounted) toast(context, tr(context, 'Session scheduled', 'সেশন নির্ধারিত হয়েছে'));
  return saved == true;
}

Future<bool> completeSessionDialog(BuildContext context, WidgetRef ref, Map session) async {
  final notes = TextEditingController();
  final stepText = <TextEditingController>[TextEditingController()];
  final stepWeek = <int>[1];
  String? error;
  bool busy = false;

  final saved = await showDialog<bool>(
    context: context,
    barrierDismissible: false,
    builder: (c) => StatefulBuilder(builder: (c, setSt) {
      Future<void> save() async {
        final steps = <Map<String, dynamic>>[];
        for (int i = 0; i < stepText.length; i++) {
          final t = stepText[i].text.trim();
          if (t.isEmpty) continue;
          if (t.length < 2) {
            setSt(() => error = tr(c, 'Each next step needs at least 2 characters.', 'প্রতিটি ধাপে অন্তত ২টি অক্ষর লাগবে।'));
            return;
          }
          steps.add({'text': t, 'week': stepWeek[i]});
        }
        setSt(() { busy = true; error = null; });
        try {
          await ref.read(dioProvider).post('/sessions/${session['_id']}/complete', data: {
            if (notes.text.trim().isNotEmpty) 'notes': notes.text.trim(),
            'nextSteps': steps,
          });
          ref.invalidate(sessionsProvider);
          if (c.mounted) Navigator.pop(c, true);
        } catch (e) {
          setSt(() { busy = false; error = errorText(e); });
        }
      }

      return AlertDialog(
        title: Text(tr(c, 'Complete session', 'সেশন সম্পন্ন করুন'), style: display(20)),
        content: SizedBox(width: 420, child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          TextField(controller: notes, enabled: !busy, maxLines: 4, maxLength: 4000, decoration: InputDecoration(labelText: tr(c, 'Notes for the student', 'শিক্ষার্থীর জন্য নোট'))),
          const SizedBox(height: 6),
          Text(tr(c, 'Next steps (added to their four-week plan)', 'পরের ধাপ (তাদের চার সপ্তাহের প্ল্যানে যোগ হবে)'), style: body(14, color: Brand.muted, w: FontWeight.w700)),
          for (int i = 0; i < stepText.length; i++) Row(children: [
            Expanded(child: TextField(controller: stepText[i], enabled: !busy, maxLength: 200, decoration: InputDecoration(labelText: '${tr(c, 'Step', 'ধাপ')} ${i + 1}'))),
            const SizedBox(width: 8),
            DropdownButton<int>(
              value: stepWeek[i],
              items: [for (int w = 1; w <= 4; w++) DropdownMenuItem(value: w, child: Text('${tr(c, 'Week', 'সপ্তাহ')} $w'))],
              onChanged: busy ? null : (v) => setSt(() => stepWeek[i] = v ?? 1),
            ),
          ]),
          if (stepText.length < 8) TextButton.icon(
            onPressed: busy ? null : () => setSt(() { stepText.add(TextEditingController()); stepWeek.add(1); }),
            icon: const Icon(Icons.add),
            label: Text(tr(c, 'Add a step', 'ধাপ যোগ করুন')),
          ),
          if (error != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(error!, style: body(14, color: const Color(0xFF9B2C1F), w: FontWeight.w700))),
        ]))),
        actions: [
          TextButton(onPressed: busy ? null : () => Navigator.pop(c, false), child: Text(tr(c, 'Cancel', 'বাতিল'))),
          FilledButton(onPressed: busy ? null : save, child: Text(tr(c, 'Mark complete', 'সম্পন্ন করুন'))),
        ],
      );
    }),
  );
  notes.dispose();
  for (final t in stepText) { t.dispose(); }
  if (saved == true && context.mounted) toast(context, tr(context, 'Session completed', 'সেশন সম্পন্ন হয়েছে'));
  return saved == true;
}
