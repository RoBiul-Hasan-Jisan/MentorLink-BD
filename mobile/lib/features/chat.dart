import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../core/api.dart';
import '../core/providers.dart';
import '../l10n/app_localizations.dart';
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
    } catch (e) { setState(() => error = errorText(e)); }
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
    final t = AppLocalizations.of(context);
    final myId = ref.watch(meProvider).valueOrNull?['id'];
    return Scaffold(appBar: AppBar(title: Text(t.chat)), body: error != null ? Center(child: Text(error!)) : Column(children: [
      Expanded(child: ListView(padding: const EdgeInsets.all(12), children: [for (final m in msgs) Align(
        alignment: m['senderId'] == myId ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(margin: const EdgeInsets.symmetric(vertical: 3), padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: m['senderId'] == myId ? const Color(0xFFE3F1EB) : Colors.white, borderRadius: BorderRadius.circular(14)), child: Text(m['text'])))])),
      SafeArea(child: Padding(padding: const EdgeInsets.all(8), child: Row(children: [Expanded(child: TextField(controller: text, decoration: InputDecoration(hintText: t.chat))), IconButton(onPressed: _send, icon: const Icon(Icons.send), tooltip: t.send)]))),
    ]));
  }
}
