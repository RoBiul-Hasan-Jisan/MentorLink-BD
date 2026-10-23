import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(body: Column(children: [
        GreenHeader(radius: 28, bottomPad: 18, child: Row(children: [BackCircle(dark: true, onTap: () => context.pop()), const SizedBox(width: 12), Text(tr(context, 'Notifications', 'বিজ্ঞপ্তি'), style: display(24, color: Colors.white))])),
        Expanded(child: AsyncBody(value: ref.watch(notificationsProvider), onRetry: () => ref.invalidate(notificationsProvider), builder: (d) {
          final list = (d['notifications'] as List).cast<Map>();
          if (list.isEmpty) return Center(child: Text(tr(context, 'Nothing new.', 'নতুন কিছু নেই।'), style: body(17, color: Brand.muted)));
          return ListView(padding: const EdgeInsets.all(16), children: [for (final n in list) AppCard(padding: const EdgeInsets.all(14), color: n['read'] == true ? Colors.white : const Color(0xFFF0F9F4), onTap: () async { try { await ref.read(dioProvider).post('/notifications/${n['_id']}/read'); ref.invalidate(notificationsProvider); } catch (e) { if (context.mounted) toast(context, errorText(e)); } }, child: Row(children: [
            Icon(n['read'] == true ? Icons.notifications_none : Icons.notifications_active, color: Brand.delta), const SizedBox(width: 12),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(n['title'], style: display(17, color: Brand.ink)), if ((n['body'] ?? '') != '') Text(n['body'], style: body(14, color: Brand.muted))])),
          ]))]);
        })),
      ]));
}
