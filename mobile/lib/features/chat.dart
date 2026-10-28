import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key, required this.requestId});
  final String requestId;
  @override
  ConsumerState<ChatScreen> createState() => _Chat();
}
class _Chat extends ConsumerState<ChatScreen> {
  final text = TextEditingController();
  final msgs = <Map<String, dynamic>>[];
  io.Socket? socket;
  String? error;

  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    try {
      final r = await ref.read(dioProvider).get('/requests/${widget.requestId}/messages');
      setState(() => msgs..clear()..addAll((r.data['messages'] as List).cast<Map<String, dynamic>>()));
      final credential = await FirebaseAuth.instance.currentUser!.getIdToken();
      socket = io.io(apiUrl, io.OptionBuilder().setTransports(['websocket']).setAuth({'token': credential}).build());
      socket!.onConnect((_) => socket!.emitWithAck('join', widget.requestId, ack: (_) {}));
      socket!.on('message', (m) { if (mounted) setState(() { if (!msgs.any((x) => x['_id'] == m['_id'])) msgs.add(Map<String, dynamic>.from(m)); }); });
    } catch (e) { if (mounted) setState(() => error = errorText(e)); }
  }
  Future<void> _send() async {
    final v = text.text.trim(); if (v.isEmpty) return;
    text.clear();
    try { await ref.read(dioProvider).post('/requests/${widget.requestId}/messages', data: {'text': v}); }
    catch (e) { if (mounted) toast(context, errorText(e)); }
  }
  @override
  void dispose() { socket?.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final myId = ref.watch(meProvider).valueOrNull?['id'];
    return Scaffold(body: Column(children: [
      GreenHeader(radius: 28, bottomPad: 18, child: Row(children: [BackCircle(dark: true, onTap: () => context.pop()), const SizedBox(width: 12), Text(tr(context, 'Chat', 'চ্যাট'), style: display(24, color: Colors.white))])),
      Expanded(child: error != null ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(error!, textAlign: TextAlign.center, style: body(16)))) : ListView(padding: const EdgeInsets.all(14), children: [for (final m in msgs) Align(
        alignment: m['senderId'] == myId ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(constraints: const BoxConstraints(maxWidth: 300), margin: const EdgeInsets.symmetric(vertical: 4), padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10), decoration: BoxDecoration(color: m['senderId'] == myId ? Brand.delta : Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: const Color(0xFFE2E8E3))), child: Text(m['text'], style: body(16, color: m['senderId'] == myId ? Colors.white : Brand.ink))))])),
      SafeArea(top: false, child: Padding(padding: const EdgeInsets.all(10), child: Row(children: [
        Expanded(child: TextField(controller: text, onSubmitted: (_) => _send(), decoration: InputDecoration(hintText: tr(context, 'Write a message', 'বার্তা লিখুন'), contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14), border: OutlineInputBorder(borderRadius: BorderRadius.circular(28), borderSide: BorderSide.none)))),
        const SizedBox(width: 8),
        IconButton.filled(style: IconButton.styleFrom(backgroundColor: Brand.delta, minimumSize: const Size(52, 52)), onPressed: _send, icon: const Icon(Icons.send)),
      ]))),
    ]));
  }
}
