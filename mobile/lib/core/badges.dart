import 'dart:async';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'api.dart';
import 'providers.dart';

/// The chat the person is looking at right now (set by the chat screen). Its new-message banners and badge are skipped.
String? activeChatId;

/// One live connection to the server for the signed-in person. The server pushes every new notification the moment it is saved
/// (like Messenger / WhatsApp), so nothing waits for a refresh. It reconnects by itself with a fresh sign-in token.
class LiveFeed {
  LiveFeed(this._user);
  final User _user;
  final StreamController<Map> incoming = StreamController<Map>.broadcast(); // each new notification, as it happens
  final StreamController<void> changed = StreamController<void>.broadcast(); // "refetch": reconnected, or read on another device
  io.Socket? _socket;
  Timer? _retry;
  bool _alive = true;

  bool get connected => _socket?.connected == true;

  Future<void> start() => _connect();

  /// Called when the app comes back to the foreground: Android and iOS may have closed the connection meanwhile.
  void ensureConnected() { if (_alive && !connected) _connect(); }

  Future<void> _connect() async {
    if (!_alive) return;
    try {
      final token = await _user.getIdToken();
      if (!_alive) return;
      _socket?.dispose();
      final s = io.io(apiUrl, io.OptionBuilder().setTransports(['websocket']).disableReconnection().setAuth({'token': token}).build());
      _socket = s;
      s.onConnect((_) { if (_alive) changed.add(null); }); // catch up on anything missed while offline
      s.on('notification', (d) {
        if (!_alive || d is! Map || d['notification'] is! Map) return;
        incoming.add(Map<String, dynamic>.from(d['notification'] as Map));
      });
      s.on('notifications:changed', (_) { if (_alive) changed.add(null); });
      s.onDisconnect((_) => _retryLater());
      s.onConnectError((_) => _retryLater());
    } catch (_) {
      _retryLater();
    }
  }

  void _retryLater() {
    if (!_alive) return;
    _retry?.cancel();
    _retry = Timer(const Duration(seconds: 4), _connect); // a new token is fetched each time
  }

  void dispose() {
    _alive = false;
    _retry?.cancel();
    _socket?.dispose();
    incoming.close();
    changed.close();
  }
}

/// Lives as long as the person is signed in. Signing out closes it; signing in opens a new one.
final liveFeedProvider = Provider<LiveFeed?>((ref) {
  final user = ref.watch(authStateProvider).valueOrNull;
  if (user == null) return null;
  final feed = LiveFeed(user)..start();
  ref.onDispose(feed.dispose);
  return feed;
});

/// The person's unread notifications. A new one is added the instant the server pushes it. A slow 60-second check is only a safety net.
/// `ref.invalidate(unreadNotificationsProvider)` just re-reads the list; it does not reconnect the live feed.
final unreadNotificationsProvider = StreamProvider<List<Map>>((ref) {
  final feed = ref.watch(liveFeedProvider);
  final ctrl = StreamController<List<Map>>();
  if (feed == null) {
    ctrl.add(const <Map>[]);
    ctrl.close();
    return ctrl.stream;
  }
  var alive = true;
  var list = <Map>[];
  Future<void> fetch() async {
    try {
      final d = await getJson(ref, '/notifications', q: {'limit': 100});
      if (!alive) return;
      list = ((d['notifications'] ?? []) as List).cast<Map>().where((n) => n['read'] != true).toList();
      ctrl.add(list);
    } catch (_) {
      // Offline or a server hiccup: keep the last numbers; the next event or check fixes it.
    }
  }
  fetch();
  final subs = <StreamSubscription>[
    feed.incoming.stream.listen((n) {
      if (!alive) return;
      list = [n, ...list.where((x) => '${x['_id']}' != '${n['_id']}')].take(100).toList();
      ctrl.add(list);
    }),
    feed.changed.stream.listen((_) => fetch()),
  ];
  final poll = Timer.periodic(const Duration(seconds: 60), (_) => fetch());
  ref.onDispose(() {
    alive = false;
    poll.cancel();
    for (final s in subs) { s.cancel(); }
    ctrl.close();
  });
  return ctrl.stream;
});
