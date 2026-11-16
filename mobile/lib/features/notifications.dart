import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/badges.dart';
import '../core/notify_route.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// Notifications grouped into "Today" and "Earlier this week", with "Mark all read".
class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  String _time(DateTime t) {
    final h = t.hour % 12 == 0 ? 12 : t.hour % 12;
    return '$h:${t.minute.toString().padLeft(2, '0')} ${t.hour >= 12 ? 'PM' : 'AM'}';
  }

  String _when(BuildContext context, DateTime t, DateTime now) {
    final sameDay = t.year == now.year && t.month == now.month && t.day == now.day;
    if (sameDay) return _time(t);
    final y = now.subtract(const Duration(days: 1));
    if (t.year == y.year && t.month == y.month && t.day == y.day) return tr(context, 'Yesterday', 'গতকাল');
    const d = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return d[t.weekday - 1];
  }

  Widget _tile(BuildContext context, WidgetRef ref, Map n, DateTime now) {
    final read = n['read'] == true;
    final t = DateTime.tryParse('${n['createdAt']}')?.toLocal();
    return AppCard(
      padding: const EdgeInsets.all(14),
      color: read ? Colors.white : const Color(0xFFF0F9F4),
      onTap: () async {
        // Mark read first (a failure must not block opening the item), then go to where the notification points.
        try {
          await ref.read(dioProvider).post('/notifications/${n['_id'] ?? n['id']}/read');
        } catch (_) {}
        ref.invalidate(notificationsProvider);
        ref.invalidate(unreadNotificationsProvider);
        final role = '${ref.read(meProvider).valueOrNull?['role'] ?? ''}';
        final route = notificationRoute(n, role: role);
        if (route != null && context.mounted) context.push(route);
      },
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(read ? Icons.notifications_none : Icons.notifications_active, color: Brand.delta),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${n['title']}', style: display(17, color: Brand.ink)),
          if ('${n['body'] ?? ''}'.isNotEmpty) Text('${n['body']}', style: body(14, color: Brand.muted)),
        ])),
        if (t != null) Text(_when(context, t, now), style: body(13, color: Brand.muted)),
      ]),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = DateTime.now();
    // The list refreshes by itself when something new arrives or is read elsewhere.
    String sig(AsyncValue<List<Map>>? v) { final l = v?.valueOrNull ?? const <Map>[]; return '${l.length}|${l.isEmpty ? '' : l.first['_id']}'; }
    ref.listen<AsyncValue<List<Map>>>(unreadNotificationsProvider, (p, n) { if (sig(p) != sig(n)) ref.invalidate(notificationsProvider); });
    return Scaffold(
      body: Column(children: [
        GreenHeader(radius: 28, bottomPad: 18, child: Row(children: [
          BackCircle(dark: true, onTap: () => context.pop()),
          const SizedBox(width: 12),
          Expanded(child: Text(tr(context, 'Notifications', 'বিজ্ঞপ্তি'), style: display(26, color: Colors.white))),
          TextButton(
            onPressed: () async {
              try {
                await ref.read(dioProvider).post('/notifications/read-all');
                ref.invalidate(notificationsProvider);
                ref.invalidate(unreadNotificationsProvider);
              } catch (e) {
                if (context.mounted) toast(context, errorText(e));
              }
            },
            child: Text(tr(context, 'Mark all read', 'সব পড়া হয়েছে'), style: body(14, color: Colors.white)),
          ),
        ])),
        Expanded(
          child: AsyncBody(
            value: ref.watch(notificationsProvider),
            onRetry: () => ref.invalidate(notificationsProvider),
            builder: (d) {
              final list = ((d['notifications'] ?? []) as List).cast<Map>();
              if (list.isEmpty) return Center(child: Text(tr(context, 'Nothing new.', 'নতুন কিছু নেই।'), style: body(17, color: Brand.muted)));
              final today = <Map>[], earlier = <Map>[];
              for (final n in list) {
                final t = DateTime.tryParse('${n['createdAt']}')?.toLocal();
                if (t != null && t.year == now.year && t.month == now.month && t.day == now.day) {
                  today.add(n);
                } else {
                  earlier.add(n);
                }
              }
              Widget head(String s) => Padding(padding: const EdgeInsets.only(top: 6, bottom: 8), child: Text(s, style: body(13, color: Brand.muted, w: FontWeight.w800)));
              return ListView(padding: const EdgeInsets.all(16), children: [
                Text(tr(context, 'On-device alerts · no SMS needed', 'ডিভাইস অ্যালার্ট · এসএমএস লাগে না'), style: body(13, color: Brand.muted)),
                if (today.isNotEmpty) head(tr(context, 'TODAY', 'আজ')),
                for (final n in today) _tile(context, ref, n, now),
                if (earlier.isNotEmpty) head(tr(context, 'EARLIER THIS WEEK', 'এই সপ্তাহে আগে')),
                for (final n in earlier) _tile(context, ref, n, now),
              ]);
            },
          ),
        ),
      ]),
    );
  }
}
