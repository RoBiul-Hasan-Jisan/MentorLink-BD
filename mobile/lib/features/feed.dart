import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// Community feed: posts, comments and replies, reactions, follow people, skill groups, search, report.
// Posts asking for money or off-app contact are refused by the server. Three different reporters hide a post.
//
// The feed keeps its own list so that reactions, deleting and "Load more" feel instant instead of reloading the page.
// Only students and mentors can post or comment (the server enforces this); everyone else can read.

final feedGroupsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/groups'));
final feedPostProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) => getJson(ref, '/posts/$id'));

const _reactionIcons = {'like': Icons.thumb_up_alt_outlined, 'helpful': Icons.lightbulb_outline, 'idea': Icons.star_border};
const _reactionIconsOn = {'like': Icons.thumb_up, 'helpful': Icons.lightbulb, 'idea': Icons.star};
const _reactionTypes = ['like', 'helpful', 'idea'];
const _line = Color(0xFFE2E8E3);
const _fallbackGroups = [
  {'key': 'general', 'titleEn': 'General', 'titleBn': 'সাধারণ', 'posts': 0, 'joined': false},
];

// Short names so nobody has to guess what each icon means. You can give all three together.
String _reactionName(BuildContext c, String t) => t == 'like' ? tr(c, 'Like', 'লাইক') : t == 'helpful' ? tr(c, 'Helpful', 'কাজের') : tr(c, 'Great', 'দারুণ');

String _groupTitle(BuildContext context, List groups, String key) {
  for (final g in groups.whereType<Map>()) {
    if (g['key'] == key) return nm(context, g, 'titleEn', 'titleBn');
  }
  return key;
}

const _moEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const _moBn = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];

// "5m ago", "3h ago", "2d ago", then a plain date.
String _ago(BuildContext c, dynamic raw) {
  final d = DateTime.tryParse('${raw ?? ''}')?.toLocal();
  if (d == null) return '';
  final now = DateTime.now();
  final diff = now.difference(d);
  if (diff.inMinutes < 1) return tr(c, 'Just now', 'এইমাত্র');
  if (diff.inMinutes < 60) return tr(c, '${diff.inMinutes}m ago', '${diff.inMinutes} মিনিট আগে');
  if (diff.inHours < 24) return tr(c, '${diff.inHours}h ago', '${diff.inHours} ঘণ্টা আগে');
  if (diff.inDays < 7) return tr(c, '${diff.inDays}d ago', '${diff.inDays} দিন আগে');
  final month = tr(c, _moEn[d.month - 1], _moBn[d.month - 1]);
  return d.year == now.year ? '${d.day} $month' : '${d.day} $month ${d.year}';
}

String _roleLabel(BuildContext c, dynamic role) => role == 'mentor' ? tr(c, 'Mentor', 'মেন্টর') : role == 'student' ? tr(c, 'Student', 'শিক্ষার্থী') : '';

String _host(String url) {
  final h = Uri.tryParse(url)?.host ?? '';
  if (h.isEmpty) return url;
  return h.startsWith('www.') ? h.substring(4) : h;
}

Future<void> _openLink(BuildContext c, String url) async {
  final u = Uri.tryParse(url);
  if (u == null || !(u.scheme == 'https' || u.scheme == 'http')) return;
  var ok = false;
  try {
    ok = await launchUrl(u, mode: LaunchMode.externalApplication);
  } catch (_) {
    ok = false;
  }
  if (!ok && c.mounted) toast(c, tr(c, 'Could not open the link.', 'লিংকটি খোলা যায়নি।'));
}

// Flips one reaction on the local copy of a post, so the screen answers the tap at once. Calling it twice undoes it.
void _toggleLocal(Map p, String type) {
  final mine = <String>{...((p['myReactions'] ?? (p['myReaction'] != null ? [p['myReaction']] : [])) as List).map((x) => '$x')};
  final counts = Map<String, dynamic>.from((p['reactions'] ?? {}) as Map);
  final n = counts[type] is num ? (counts[type] as num).toInt() : 0;
  if (mine.remove(type)) {
    counts[type] = n > 0 ? n - 1 : 0;
  } else {
    mine.add(type);
    counts[type] = n + 1;
  }
  p['myReactions'] = mine.toList();
  p['reactions'] = counts;
}

Set<String> _myReactions(Map p) => <String>{...((p['myReactions'] ?? (p['myReaction'] != null ? [p['myReaction']] : [])) as List).map((x) => '$x')};
int _count(Map p, String t) => ((p['reactions'] ?? {}) as Map)[t] is num ? (((p['reactions'] ?? {}) as Map)[t] as num).toInt() : 0;

Widget _reactButton(BuildContext context, {required String type, required int count, required bool on, required VoidCallback onTap, bool label = false}) {
  final color = on ? Brand.forest : Brand.muted;
  return Tooltip(
    message: _reactionName(context, type),
    child: InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(color: on ? Brand.lightGreen : Colors.transparent, borderRadius: BorderRadius.circular(20)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(on ? _reactionIconsOn[type] : _reactionIcons[type], size: 19, color: on ? Brand.delta : Brand.muted),
          if (label) ...[const SizedBox(width: 6), Text(_reactionName(context, type), style: body(13, color: color, w: on ? FontWeight.w800 : FontWeight.w600))],
          if (count > 0) ...[const SizedBox(width: 5), Text('$count', style: body(13, color: color, w: FontWeight.w700))],
        ]),
      ),
    ),
  );
}

Widget _linkChip(BuildContext context, String url) => Padding(
      padding: const EdgeInsets.only(top: 10),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => _openLink(context, url),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(color: Brand.paper, borderRadius: BorderRadius.circular(14), border: Border.all(color: _line)),
          child: Row(children: [
            const Icon(Icons.link, size: 18, color: Brand.delta),
            const SizedBox(width: 8),
            Expanded(child: Text(_host(url), maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, color: Brand.delta, w: FontWeight.w700))),
            const Icon(Icons.open_in_new, size: 16, color: Brand.muted),
          ]),
        ),
      ),
    );

Widget _groupTag(String title, {VoidCallback? onTap}) => InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(color: Brand.lightGreen, borderRadius: BorderRadius.circular(20)),
        child: Text('# $title', style: body(12, color: Brand.forest, w: FontWeight.w700)),
      ),
    );

Future<bool> _confirmDelete(BuildContext context) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text(tr(c, 'Delete this post?', 'পোস্টটি মুছবেন?')),
      content: Text(tr(c, 'This cannot be undone.', 'এটি আর ফিরিয়ে আনা যাবে না।')),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr(c, 'Cancel', 'বাতিল'))),
        TextButton(onPressed: () => Navigator.pop(c, true), child: Text(tr(c, 'Delete', 'মুছুন'), style: const TextStyle(color: Color(0xFF9B2C1F)))),
      ],
    ),
  );
  return ok == true;
}

bool _canPost(Map<String, dynamic>? me) => me != null && (me['role'] == 'student' || me['role'] == 'mentor');

// ================= Feed =================

class FeedScreen extends ConsumerStatefulWidget {
  const FeedScreen({super.key});
  @override
  ConsumerState<FeedScreen> createState() => _FeedState();
}

class _FeedState extends ConsumerState<FeedScreen> {
  String group = ''; // '' = all, 'following', or a group key
  String q = '';
  final search = TextEditingController();
  Timer? _debounce;

  List<Map> posts = [];
  String? next; // createdAt of the last post, used to fetch the next page
  bool loading = true, loadingMore = false;
  String? error;
  int _gen = 0; // ignores answers that arrive after the filter has changed

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) { if (mounted) _load(); });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    search.dispose();
    super.dispose();
  }

  Future<void> _load({bool more = false}) async {
    if (more && (loadingMore || next == null)) return;
    final gen = more ? _gen : ++_gen;
    setState(() {
      if (more) {
        loadingMore = true;
      } else {
        loadingMore = false;
        error = null;
        if (posts.isEmpty) loading = true;
      }
    });
    try {
      final r = await ref.read(dioProvider).get('/feed', queryParameters: <String, dynamic>{
        if (group == 'following') 'following': '1' else if (group.isNotEmpty) 'topic': group,
        if (q.isNotEmpty) 'q': q,
        if (more && next != null) 'before': next,
      });
      final d = r.data as Map;
      final list = ((d['posts'] ?? []) as List).whereType<Map>().toList();
      if (!mounted || gen != _gen) return;
      setState(() {
        posts = more ? [...posts, ...list] : list;
        next = d['next']?.toString();
        loading = false;
        loadingMore = false;
      });
    } catch (e) {
      if (!mounted || gen != _gen) return;
      final keepList = more || posts.isNotEmpty;
      setState(() {
        loading = false;
        loadingMore = false;
        if (!keepList) error = errorText(e);
      });
      if (keepList) toast(context, errorText(e));
    }
  }

  Future<void> _reload() {
    ref.invalidate(feedGroupsProvider);
    return _load();
  }

  void _setGroup(String key) {
    if (group == key) return;
    setState(() { group = key; posts = []; next = null; });
    _load();
  }

  void _onSearch(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 450), () {
      final t = v.trim();
      if (t == q || !mounted) return;
      setState(() { q = t; posts = []; next = null; });
      _load();
    });
  }

  Future<void> _react(Map p, String type) async {
    setState(() => _toggleLocal(p, type));
    try {
      await ref.read(dioProvider).put('/posts/${p['id']}/reaction', data: {'type': type});
    } catch (e) {
      if (!mounted) return;
      setState(() => _toggleLocal(p, type)); // put it back
      toast(context, errorText(e));
    }
  }

  Future<void> _follow(Map author) async {
    final was = author['following'] == true;
    final id = '${author['id']}';
    void set(bool v) { for (final x in posts) { final a = x['author']; if (a is Map && '${a['id']}' == id) a['following'] = v; } }
    setState(() => set(!was));
    try {
      final dio = ref.read(dioProvider);
      if (was) {
        await dio.delete('/follow/user/$id');
      } else {
        await dio.put('/follow/user/$id', data: <String, dynamic>{});
      }
      if (group == 'following' && was) _load();
    } catch (e) {
      if (!mounted) return;
      setState(() => set(was));
      toast(context, errorText(e));
    }
  }

  Future<void> _report(Map p) async {
    try {
      final r = await ref.read(dioProvider).post('/posts/${p['id']}/report', data: <String, dynamic>{});
      if (!mounted) return;
      toast(context, tr(context, 'Thanks. We will check it.', 'ধন্যবাদ। আমরা দেখব।'));
      if (r.data is Map && (r.data as Map)['hidden'] == true) setState(() => posts.remove(p));
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  Future<void> _delete(Map p) async {
    if (!await _confirmDelete(context)) return;
    try {
      await ref.read(dioProvider).delete('/posts/${p['id']}');
      if (!mounted) return;
      setState(() => posts.remove(p));
      toast(context, tr(context, 'Post deleted.', 'পোস্ট মুছে ফেলা হয়েছে।'));
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  Future<void> _joinToggle(Map g) async {
    try {
      final dio = ref.read(dioProvider);
      if (g['joined'] == true) {
        await dio.delete('/follow/group/${g['key']}');
      } else {
        await dio.put('/follow/group/${g['key']}', data: <String, dynamic>{});
      }
      ref.invalidate(feedGroupsProvider);
      if (group == 'following') _load();
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  Future<void> _compose(List groups) async {
    final posted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (_) => _ComposeSheet(groups: groups, initialTopic: group.isNotEmpty && group != 'following' ? group : 'general'),
    );
    if (posted != true || !mounted) return;
    toast(context, tr(context, 'Posted.', 'পোস্ট হয়েছে।'));
    ref.invalidate(feedGroupsProvider);
    _load();
  }

  // After the post page is closed, copy its newest numbers back into the card (or drop the card if the post is gone).
  Future<void> _openPost(Map p) async {
    await context.push('/post/${p['id']}');
    if (!mounted) return;
    try {
      final r = await ref.read(dioProvider).get('/posts/${p['id']}');
      final fresh = (r.data as Map)['post'];
      if (fresh is Map && mounted) setState(() => p.addAll(Map<String, dynamic>.from(fresh)));
    } catch (e) {
      // Only a 404 means the post is gone (deleted or hidden meanwhile). A network blip keeps the card.
      if (e is DioException && e.response?.statusCode == 404 && mounted) setState(() => posts.remove(p));
    }
  }

  Widget _chip(String key, String label, {IconData? icon}) {
    final on = group == key;
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        avatar: icon == null ? null : Icon(icon, size: 16, color: on ? Brand.forest : Brand.muted),
        label: Text(label, style: body(14, color: on ? Brand.forest : Brand.ink, w: on ? FontWeight.w800 : FontWeight.w600)),
        selected: on,
        showCheckmark: false,
        selectedColor: Brand.lightGreen,
        backgroundColor: Colors.white,
        side: BorderSide(color: on ? Brand.delta : const Color(0xFFC9D3CC)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        onSelected: (_) => _setGroup(key),
      ),
    );
  }

  Widget _post(Map p, List groups) {
    final a = (p['author'] ?? {}) as Map;
    final name = '${a['name'] ?? '?'}';
    final isMe = a['isMe'] == true;
    final isMentor = a['verifiedMentor'] == true;
    final following = a['following'] == true;
    final mine = _myReactions(p);
    final text = '${p['text'] ?? ''}';
    final long = text.length > 280 || '\n'.allMatches(text).length >= 6;
    final link = p['link'] == null ? null : '${p['link']}';
    final sub = [_roleLabel(context, a['role']), _ago(context, p['createdAt'])].where((s) => s.isNotEmpty).join(' · ');
    final topic = '${p['topic']}';
    return AppCard(
      padding: const EdgeInsets.fromLTRB(16, 14, 8, 6),
      onTap: () => _openPost(p),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Avatar(name, size: 42, bg: isMentor ? Brand.saffron : Brand.lightGreen, fg: Brand.forest),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(child: Text(name, style: body(16, w: FontWeight.w800), maxLines: 1, overflow: TextOverflow.ellipsis)),
              if (isMentor) const Padding(padding: EdgeInsets.only(left: 4), child: Icon(Icons.verified, size: 16, color: Brand.saffron)),
            ]),
            if (sub.isNotEmpty) Text(sub, style: body(12, color: Brand.muted)),
          ])),
          if (!isMe && !following) OutlinedButton(
            onPressed: () => _follow(a),
            style: OutlinedButton.styleFrom(visualDensity: VisualDensity.compact, minimumSize: const Size(0, 32), padding: const EdgeInsets.symmetric(horizontal: 14), shape: const StadiumBorder(), side: const BorderSide(color: Brand.delta), foregroundColor: Brand.delta),
            child: Text(tr(context, 'Follow', 'অনুসরণ'), style: body(13, color: Brand.delta, w: FontWeight.w800)),
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, color: Brand.muted),
            onSelected: (v) {
              if (v == 'report') _report(p);
              if (v == 'delete') _delete(p);
              if (v == 'unfollow') _follow(a);
            },
            itemBuilder: (_) => [
              if (!isMe && following) PopupMenuItem<String>(value: 'unfollow', child: Text(tr(context, 'Unfollow $name', '$name-কে আনফলো করুন'))),
              if (!isMe) PopupMenuItem<String>(value: 'report', child: Text(tr(context, 'Report', 'রিপোর্ট'))),
              if (isMe) PopupMenuItem<String>(value: 'delete', child: Text(tr(context, 'Delete post', 'পোস্ট মুছুন'))),
            ],
          ),
        ]),
        Padding(
          padding: const EdgeInsets.only(top: 8, right: 8),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(text, maxLines: long ? 6 : null, overflow: long ? TextOverflow.ellipsis : TextOverflow.clip, style: body(16).copyWith(height: 1.4)),
            if (long) Padding(padding: const EdgeInsets.only(top: 2), child: Text(tr(context, 'Read more', 'আরও পড়ুন'), style: body(14, color: Brand.delta, w: FontWeight.w800))),
            if (link != null) _linkChip(context, link),
            Padding(padding: const EdgeInsets.only(top: 10), child: _groupTag(_groupTitle(context, groups, topic), onTap: group == topic ? null : () => _setGroup(topic))),
          ]),
        ),
        const SizedBox(height: 4),
        Divider(height: 12, color: _line.withValues(alpha: 0.9)),
        Row(children: [
          for (final t in _reactionTypes) _reactButton(context, type: t, count: _count(p, t), on: mine.contains(t), onTap: () => _react(p, t)),
          const Spacer(),
          InkWell(
            borderRadius: BorderRadius.circular(20),
            onTap: () => _openPost(p),
            child: Padding(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8), child: Row(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.chat_bubble_outline, size: 18, color: Brand.muted),
              const SizedBox(width: 5),
              Text('${p['commentCount'] ?? 0}', style: body(13, color: Brand.muted, w: FontWeight.w700)),
            ])),
          ),
        ]),
      ]),
    );
  }

  Widget _skeleton() => Column(children: [for (var i = 0; i < 3; i++) AppCard(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const CircleAvatar(radius: 21, backgroundColor: Color(0xFFE9EEEA)),
          const SizedBox(width: 10),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_bar(120, 14), const SizedBox(height: 6), _bar(70, 10)]),
        ]),
        const SizedBox(height: 14),
        _bar(double.infinity, 12), const SizedBox(height: 8), _bar(double.infinity, 12), const SizedBox(height: 8), _bar(180, 12),
      ]))]);

  Widget _bar(double w, double h) => Container(width: w, height: h, decoration: BoxDecoration(color: const Color(0xFFE9EEEA), borderRadius: BorderRadius.circular(8)));

  Widget _empty(bool canPost, List groups) {
    final searching = q.isNotEmpty;
    final following = group == 'following';
    final (icon, title, sub) = searching
        ? (Icons.search_off, tr(context, 'Nothing found for "$q"', '"$q" নিয়ে কিছু পাওয়া যায়নি'), tr(context, 'Try a shorter or different word.', 'ছোট বা অন্য কোনো শব্দ দিয়ে খুঁজুন।'))
        : following
            ? (Icons.group_add_outlined, tr(context, 'Your following feed is empty', 'আপনার ফলো ফিড খালি'), tr(context, 'Follow people or join a group to see their posts here.', 'কাউকে ফলো করুন বা গ্রুপে যোগ দিন, তাদের পোস্ট এখানে দেখা যাবে।'))
            : (Icons.forum_outlined, tr(context, 'No posts here yet', 'এখানে এখনও পোস্ট নেই'), tr(context, 'Be the first to ask or share something.', 'প্রথম প্রশ্ন বা পোস্টটি আপনার হোক।'));
    return AppCard(padding: const EdgeInsets.fromLTRB(20, 28, 20, 24), child: Column(children: [
      Container(width: 64, height: 64, decoration: const BoxDecoration(color: Brand.lightGreen, shape: BoxShape.circle), child: Icon(icon, size: 30, color: Brand.delta)),
      const SizedBox(height: 14),
      Text(title, textAlign: TextAlign.center, style: display(19, color: Brand.ink)),
      const SizedBox(height: 6),
      Text(sub, textAlign: TextAlign.center, style: body(14, color: Brand.muted)),
      if (canPost && !searching && !following) ...[const SizedBox(height: 16), BigButton(tr(context, 'Write a post', 'পোস্ট লিখুন'), onPressed: () => _compose(groups))],
      if (searching) TextButton(onPressed: () { search.clear(); setState(() { q = ''; posts = []; next = null; }); _load(); }, child: Text(tr(context, 'Clear search', 'সার্চ মুছুন'))),
    ]));
  }

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(meProvider).valueOrNull;
    final canPost = _canPost(me);
    final myName = '${me?['displayName'] ?? ''}';
    final groupsData = ref.watch(feedGroupsProvider).valueOrNull;
    final loaded = ((groupsData?['groups'] ?? []) as List).whereType<Map>().toList();
    final List groups = loaded.isEmpty ? _fallbackGroups : loaded;
    final current = loaded.where((g) => g['key'] == group).toList();
    return Scaffold(
      floatingActionButton: canPost
          ? FloatingActionButton.extended(
              backgroundColor: Brand.delta,
              onPressed: () => _compose(groups),
              icon: const Icon(Icons.edit, color: Colors.white),
              label: Text(tr(context, 'Post', 'পোস্ট'), style: const TextStyle(color: Colors.white)),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: _reload,
        child: ListView(padding: EdgeInsets.zero, physics: const AlwaysScrollableScrollPhysics(), children: [
          GreenHeader(radius: 36, bottomPad: 22, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            BackCircle(dark: true, onTap: () => context.pop()),
            const SizedBox(height: 12),
            Text(tr(context, 'Community', 'কমিউনিটি'), style: display(30, color: Colors.white)),
            const SizedBox(height: 4),
            Text(tr(context, 'Ask, share and learn together.', 'একসাথে প্রশ্ন, শেয়ার ও শেখা।'), style: body(15, color: Colors.white70)),
          ])),
          if (canPost) Padding(padding: const EdgeInsets.fromLTRB(16, 14, 16, 0), child: AppCard(
            margin: EdgeInsets.zero,
            padding: const EdgeInsets.fromLTRB(12, 10, 14, 10),
            onTap: () => _compose(groups),
            child: Row(children: [
              Avatar(myName.isEmpty ? '?' : myName, size: 38, bg: Brand.lightGreen, fg: Brand.forest),
              const SizedBox(width: 12),
              Expanded(child: Text(tr(context, 'Ask a question or share a project…', 'প্রশ্ন করুন বা প্রজেক্ট শেয়ার করুন…'), style: body(15, color: Brand.muted))),
              const Icon(Icons.edit_outlined, color: Brand.delta, size: 22),
            ]),
          )),
          Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 0), child: TextField(
            controller: search,
            textInputAction: TextInputAction.search,
            onChanged: _onSearch,
            onSubmitted: (v) { _debounce?.cancel(); final t = v.trim(); if (t != q) { setState(() { q = t; posts = []; next = null; }); _load(); } },
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search),
              hintText: tr(context, 'Search posts', 'পোস্ট খুঁজুন'),
              suffixIcon: search.text.isEmpty ? null : IconButton(icon: const Icon(Icons.close), onPressed: () { search.clear(); _debounce?.cancel(); setState(() { q = ''; posts = []; next = null; }); _load(); }),
            ),
          )),
          Padding(padding: const EdgeInsets.fromLTRB(16, 10, 16, 0), child: SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
            _chip('', tr(context, 'All', 'সব'), icon: Icons.dynamic_feed),
            _chip('following', tr(context, 'Following', 'অনুসরণ'), icon: Icons.person_outline),
            for (final g in loaded) _chip('${g['key']}', nm(context, g, 'titleEn', 'titleBn')),
          ]))),
          if (current.isNotEmpty) Padding(padding: const EdgeInsets.fromLTRB(16, 8, 16, 0), child: Row(children: [
            Expanded(child: Text('${current.first['posts']} ${tr(context, 'posts in this group', 'টি পোস্ট এই গ্রুপে')}', style: body(13, color: Brand.muted))),
            current.first['joined'] == true
                ? OutlinedButton.icon(
                    onPressed: () => _joinToggle(current.first),
                    icon: const Icon(Icons.check, size: 16),
                    label: Text(tr(context, 'Joined', 'যোগ দিয়েছেন'), style: body(13, color: Brand.delta, w: FontWeight.w800)),
                    style: OutlinedButton.styleFrom(visualDensity: VisualDensity.compact, shape: const StadiumBorder(), side: const BorderSide(color: Brand.delta), foregroundColor: Brand.delta),
                  )
                : FilledButton(
                    onPressed: () => _joinToggle(current.first),
                    style: FilledButton.styleFrom(minimumSize: const Size(0, 34), padding: const EdgeInsets.symmetric(horizontal: 16), backgroundColor: Brand.delta, shape: const StadiumBorder()),
                    child: Text(tr(context, 'Join group', 'গ্রুপে যোগ দিন'), style: body(13, color: Colors.white, w: FontWeight.w800)),
                  ),
          ])),
          Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (loading && posts.isEmpty) _skeleton()
            else if (error != null && posts.isEmpty) AppCard(child: Column(children: [
              const Icon(Icons.cloud_off, color: Brand.muted, size: 32),
              const SizedBox(height: 8),
              Text(error!, textAlign: TextAlign.center, style: body(15)),
              TextButton(onPressed: _load, child: Text(tr(context, 'Try again', 'আবার চেষ্টা করুন'))),
            ]))
            else if (posts.isEmpty) _empty(canPost, groups)
            else ...[
              for (final p in posts) _post(p, groups),
              if (next != null) Padding(padding: const EdgeInsets.only(bottom: 8), child: loadingMore
                  ? const Center(child: Padding(padding: EdgeInsets.all(12), child: SizedBox(width: 26, height: 26, child: CircularProgressIndicator(strokeWidth: 3))))
                  : BigButton(tr(context, 'Load more posts', 'আরও পোস্ট দেখুন'), outlined: true, onPressed: () => _load(more: true))),
            ],
            const SizedBox(height: 70),
          ])),
        ]),
      ),
    );
  }
}

// ================= New post sheet =================
// The sheet posts by itself and stays open when something goes wrong, so a long post is never lost.

class _ComposeSheet extends ConsumerStatefulWidget {
  const _ComposeSheet({required this.groups, required this.initialTopic});
  final List groups;
  final String initialTopic;
  @override
  ConsumerState<_ComposeSheet> createState() => _ComposeState();
}

class _ComposeState extends ConsumerState<_ComposeSheet> {
  final text = TextEditingController();
  final link = TextEditingController();
  late String topic = widget.groups.whereType<Map>().any((g) => g['key'] == widget.initialTopic) ? widget.initialTopic : 'general';
  bool busy = false, showLink = false;
  String? error;

  @override
  void dispose() {
    text.dispose();
    link.dispose();
    super.dispose();
  }

  Future<void> _post() async {
    final t = text.text.trim();
    final l = link.text.trim();
    if (t.length < 3) { setState(() => error = tr(context, 'Write at least 3 characters.', 'অন্তত ৩টি অক্ষর লিখুন।')); return; }
    if (l.isNotEmpty && !l.startsWith('https://')) { setState(() => error = tr(context, 'The link must start with https://', 'লিংক https:// দিয়ে শুরু হতে হবে।')); return; }
    setState(() { busy = true; error = null; });
    try {
      await ref.read(dioProvider).post('/posts', data: {'text': t, 'topic': topic, if (l.isNotEmpty) 'link': l});
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() { busy = false; error = errorText(e); });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Center(child: Container(width: 40, height: 4, margin: const EdgeInsets.only(bottom: 12), decoration: BoxDecoration(color: const Color(0xFFD9E0DB), borderRadius: BorderRadius.circular(4)))),
          Row(children: [
            Expanded(child: Text(tr(context, 'New post', 'নতুন পোস্ট'), style: display(22))),
            IconButton(onPressed: busy ? null : () => Navigator.pop(context, false), icon: const Icon(Icons.close)),
          ]),
          const SizedBox(height: 6),
          TextField(
            controller: text,
            autofocus: true,
            minLines: 4,
            maxLines: 8,
            maxLength: 1000,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(hintText: tr(context, 'Ask a question, share a problem or a project', 'প্রশ্ন, সমস্যা বা প্রজেক্ট শেয়ার করুন')),
          ),
          const SizedBox(height: 4),
          Text(tr(context, 'Group', 'গ্রুপ'), style: body(13, color: Brand.muted, w: FontWeight.w800)),
          const SizedBox(height: 6),
          SizedBox(
            height: 40,
            child: ListView(scrollDirection: Axis.horizontal, children: [
              for (final g in widget.groups.whereType<Map>()) Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(
                label: Text(nm(context, g, 'titleEn', 'titleBn'), style: body(14, color: topic == '${g['key']}' ? Brand.forest : Brand.ink, w: topic == '${g['key']}' ? FontWeight.w800 : FontWeight.w600)),
                selected: topic == '${g['key']}',
                showCheckmark: false,
                selectedColor: Brand.lightGreen,
                backgroundColor: Colors.white,
                side: BorderSide(color: topic == '${g['key']}' ? Brand.delta : const Color(0xFFC9D3CC)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                onSelected: (_) => setState(() => topic = '${g['key']}'),
              )),
            ]),
          ),
          const SizedBox(height: 8),
          if (showLink || link.text.isNotEmpty)
            TextField(controller: link, keyboardType: TextInputType.url, decoration: InputDecoration(prefixIcon: const Icon(Icons.link), labelText: tr(context, 'Link (https, optional)', 'লিংক (https, ঐচ্ছিক)')))
          else
            Align(alignment: Alignment.centerLeft, child: TextButton.icon(onPressed: () => setState(() => showLink = true), icon: const Icon(Icons.add_link, size: 20), label: Text(tr(context, 'Add a link', 'লিংক যোগ করুন')))),
          if (error != null) Padding(padding: const EdgeInsets.only(top: 6), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Icon(Icons.error_outline, size: 18, color: Color(0xFF9B2C1F)),
            const SizedBox(width: 6),
            Expanded(child: Text(error!, style: body(14, color: const Color(0xFF9B2C1F), w: FontWeight.w700))),
          ])),
          const SizedBox(height: 12),
          BigButton(busy ? tr(context, 'Posting…', 'পোস্ট হচ্ছে…') : tr(context, 'Post', 'পোস্ট করুন'), onPressed: busy ? null : _post),
          const SizedBox(height: 8),
          Text(tr(context, 'No money requests or private contact. Never share passwords or OTP.', 'টাকা চাওয়া বা ব্যক্তিগত যোগাযোগ নয়। পাসওয়ার্ড/ওটিপি দেবেন না।'), textAlign: TextAlign.center, style: body(12, color: Brand.muted)),
        ]),
      ),
    );
  }
}

// ================= Post page =================

class PostDetailScreen extends ConsumerStatefulWidget {
  const PostDetailScreen({super.key, required this.postId});
  final String postId;
  @override
  ConsumerState<PostDetailScreen> createState() => _PostDetailState();
}

class _PostDetailState extends ConsumerState<PostDetailScreen> {
  final text = TextEditingController();
  final scroll = ScrollController();
  final inputFocus = FocusNode();
  String? replyTo; // id of the top-level comment being answered
  String? replyName;
  bool busy = false;

  @override
  void dispose() {
    text.dispose();
    scroll.dispose();
    inputFocus.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    await ref.refresh(feedPostProvider(widget.postId).future);
  }

  Future<void> _send() async {
    final v = text.text.trim();
    if (v.isEmpty || busy) return;
    final wasReply = replyTo != null;
    setState(() => busy = true);
    try {
      await ref.read(dioProvider).post('/posts/${widget.postId}/comments', data: {'text': v, if (replyTo != null) 'parentId': replyTo});
      text.clear();
      replyTo = null;
      replyName = null;
      await _refresh();
      if (!wasReply) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (scroll.hasClients) scroll.animateTo(scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
        });
      }
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
    if (mounted) setState(() => busy = false);
  }

  Future<void> _react(Map p, String type) async {
    setState(() => _toggleLocal(p, type));
    try {
      await ref.read(dioProvider).put('/posts/${p['id']}/reaction', data: {'type': type});
    } catch (e) {
      if (!mounted) return;
      setState(() => _toggleLocal(p, type));
      toast(context, errorText(e));
    }
  }

  Future<void> _report(Map p) async {
    try {
      await ref.read(dioProvider).post('/posts/${p['id']}/report', data: <String, dynamic>{});
      if (mounted) toast(context, tr(context, 'Thanks. We will check it.', 'ধন্যবাদ। আমরা দেখব।'));
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  Future<void> _delete(Map p) async {
    if (!await _confirmDelete(context)) return;
    try {
      await ref.read(dioProvider).delete('/posts/${p['id']}');
      if (!mounted) return;
      toast(context, tr(context, 'Post deleted.', 'পোস্ট মুছে ফেলা হয়েছে।'));
      context.pop();
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  Widget _comment(Map c, {bool reply = false, bool canReply = false}) {
    final mentor = c['verifiedMentor'] == true;
    final by = '${c['by'] ?? '?'}';
    final replies = ((c['replies'] ?? []) as List).whereType<Map>().toList();
    return Padding(
      padding: EdgeInsets.only(top: 10, left: reply ? 34 : 0),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Avatar(by, size: reply ? 28 : 34, bg: mentor ? Brand.saffron : Brand.lightGreen, fg: Brand.forest),
          const SizedBox(width: 8),
          Expanded(child: Container(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: _line)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Flexible(child: Text(by, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(14, w: FontWeight.w800))),
                if (mentor) const Padding(padding: EdgeInsets.only(left: 4), child: Icon(Icons.verified, size: 15, color: Brand.saffron)),
                const SizedBox(width: 8),
                Text(_ago(context, c['createdAt']), style: body(12, color: Brand.muted)),
              ]),
              const SizedBox(height: 2),
              Text('${c['text'] ?? ''}', style: body(15).copyWith(height: 1.35)),
            ]),
          )),
        ]),
        if (!reply && canReply) Padding(padding: const EdgeInsets.only(left: 38), child: TextButton(
          style: TextButton.styleFrom(visualDensity: VisualDensity.compact, minimumSize: const Size(0, 30), padding: const EdgeInsets.symmetric(horizontal: 8)),
          onPressed: () { setState(() { replyTo = '${c['id']}'; replyName = by; }); inputFocus.requestFocus(); },
          child: Text(tr(context, 'Reply', 'উত্তর দিন'), style: body(13, color: Brand.delta, w: FontWeight.w800)),
        )),
        for (final r in replies) _comment(r, reply: true),
      ]),
    );
  }

  Widget _postCard(Map p, List groups) {
    final a = (p['author'] ?? {}) as Map;
    final name = '${a['name'] ?? '?'}';
    final isMentor = a['verifiedMentor'] == true;
    final mine = _myReactions(p);
    final link = p['link'] == null ? null : '${p['link']}';
    final sub = [_roleLabel(context, a['role']), _ago(context, p['createdAt'])].where((s) => s.isNotEmpty).join(' · ');
    return AppCard(
      margin: EdgeInsets.zero,
      padding: const EdgeInsets.fromLTRB(16, 16, 12, 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Avatar(name, size: 46, bg: isMentor ? Brand.saffron : Brand.lightGreen, fg: Brand.forest),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(child: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(17, w: FontWeight.w800))),
              if (isMentor) const Padding(padding: EdgeInsets.only(left: 4), child: Icon(Icons.verified, size: 17, color: Brand.saffron)),
            ]),
            if (sub.isNotEmpty) Text(sub, style: body(13, color: Brand.muted)),
          ])),
        ]),
        Padding(padding: const EdgeInsets.only(top: 12, right: 4), child: SelectableText('${p['text'] ?? ''}', style: body(17).copyWith(height: 1.45))),
        if (link != null) Padding(padding: const EdgeInsets.only(right: 4), child: _linkChip(context, link)),
        Padding(padding: const EdgeInsets.only(top: 12), child: _groupTag(_groupTitle(context, groups, '${p['topic']}'))),
        const SizedBox(height: 6),
        Divider(height: 14, color: _line.withValues(alpha: 0.9)),
        Wrap(spacing: 4, runSpacing: 2, children: [
          for (final t in _reactionTypes) _reactButton(context, type: t, count: _count(p, t), on: mine.contains(t), onTap: () => _react(p, t), label: true),
        ]),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(meProvider).valueOrNull;
    final canPost = _canPost(me);
    final async = ref.watch(feedPostProvider(widget.postId));
    final groups = ((ref.watch(feedGroupsProvider).valueOrNull?['groups'] ?? []) as List);
    final post = async.valueOrNull?['post'];
    final isMe = post is Map && post['author'] is Map && (post['author'] as Map)['isMe'] == true;
    return Scaffold(
      body: Column(children: [
        GreenHeader(radius: 28, bottomPad: 18, child: Row(children: [
          BackCircle(dark: true, onTap: () => context.pop()),
          const SizedBox(width: 12),
          Expanded(child: Text(tr(context, 'Post', 'পোস্ট'), style: display(24, color: Colors.white))),
          if (post is Map) PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, color: Colors.white),
            onSelected: (v) {
              if (v == 'report') _report(post);
              if (v == 'delete') _delete(post);
            },
            itemBuilder: (_) => [
              if (!isMe) PopupMenuItem<String>(value: 'report', child: Text(tr(context, 'Report', 'রিপোর্ট'))),
              if (isMe) PopupMenuItem<String>(value: 'delete', child: Text(tr(context, 'Delete post', 'পোস্ট মুছুন'))),
            ],
          ),
        ])),
        Expanded(
          child: AsyncBody(
            value: async,
            onRetry: () => ref.invalidate(feedPostProvider(widget.postId)),
            builder: (d) {
              final p = (d['post'] ?? {}) as Map;
              final cs = ((d['comments'] ?? []) as List).whereType<Map>().toList();
              final total = cs.fold<int>(0, (n, c) => n + 1 + ((c['replies'] ?? []) as List).length);
              return RefreshIndicator(
                onRefresh: _refresh,
                child: ListView(controller: scroll, physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.all(16), children: [
                  _postCard(p, groups),
                  const SizedBox(height: 18),
                  Text('$total ${tr(context, total == 1 ? 'comment' : 'comments', 'মন্তব্য')}', style: display(16, color: Brand.ink)),
                  if (cs.isEmpty) Padding(padding: const EdgeInsets.symmetric(vertical: 24), child: Column(children: [
                    const Icon(Icons.chat_bubble_outline, size: 34, color: Brand.muted),
                    const SizedBox(height: 8),
                    Text(canPost ? tr(context, 'No comments yet. Start the conversation.', 'এখনও কোনো মন্তব্য নেই। আলোচনা শুরু করুন।') : tr(context, 'No comments yet.', 'এখনও কোনো মন্তব্য নেই।'), textAlign: TextAlign.center, style: body(15, color: Brand.muted)),
                  ])),
                  for (final c in cs) _comment(c, canReply: canPost),
                  const SizedBox(height: 16),
                ]),
              );
            },
          ),
        ),
        if (canPost)
          Container(
            decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: _line))),
            child: SafeArea(top: false, child: Padding(padding: const EdgeInsets.fromLTRB(12, 8, 12, 8), child: Column(mainAxisSize: MainAxisSize.min, children: [
              if (replyTo != null) Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.only(left: 12),
                decoration: BoxDecoration(color: Brand.lightGreen, borderRadius: BorderRadius.circular(12)),
                child: Row(children: [
                  Expanded(child: Text('${tr(context, 'Replying to', 'উত্তর দিচ্ছেন')} $replyName', style: body(13, color: Brand.forest, w: FontWeight.w700))),
                  IconButton(visualDensity: VisualDensity.compact, icon: const Icon(Icons.close, size: 18), onPressed: () => setState(() { replyTo = null; replyName = null; })),
                ]),
              ),
              Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Expanded(child: TextField(
                  controller: text,
                  focusNode: inputFocus,
                  minLines: 1,
                  maxLines: 4,
                  maxLength: 600,
                  textCapitalization: TextCapitalization.sentences,
                  onSubmitted: (_) => _send(),
                  decoration: InputDecoration(counterText: '', isDense: true, hintText: tr(context, 'Write a comment', 'মন্তব্য লিখুন')),
                )),
                const SizedBox(width: 8),
                IconButton.filled(style: IconButton.styleFrom(backgroundColor: Brand.delta), onPressed: busy ? null : _send, icon: busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.send)),
              ]),
            ]))),
          )
        else
          Container(
            width: double.infinity,
            color: Colors.white,
            child: SafeArea(top: false, child: Padding(padding: const EdgeInsets.all(14), child: Text(tr(context, 'Only students and mentors can comment.', 'শুধু শিক্ষার্থী ও মেন্টররা মন্তব্য করতে পারেন।'), textAlign: TextAlign.center, style: body(13, color: Brand.muted)))),
          ),
      ]),
    );
  }
}

// ================= Home preview =================
// A small slice of the community feed for the Home tab: a "write something" row, the 3 newest posts, and "See all".
// Tapping a post opens it; "See all" opens the full feed. Reactions stay on the full feed to keep Home light.

final homeFeedProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/feed'));

class CommunityPreview extends ConsumerWidget {
  const CommunityPreview({super.key});

  Future<void> _compose(BuildContext context, WidgetRef ref, List groups) async {
    final posted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (_) => _ComposeSheet(groups: groups, initialTopic: 'general'),
    );
    if (posted != true || !context.mounted) return;
    toast(context, tr(context, 'Posted.', 'পোস্ট হয়েছে।'));
    ref.invalidate(feedGroupsProvider);
    ref.invalidate(homeFeedProvider);
  }

  Widget _row(BuildContext context, WidgetRef ref, Map p, List groups) {
    final a = (p['author'] ?? {}) as Map;
    final name = '${a['name'] ?? '?'}';
    final isMentor = a['verifiedMentor'] == true;
    final sub = [_roleLabel(context, a['role']), _ago(context, p['createdAt'])].where((s) => s.isNotEmpty).join(' · ');
    final likes = _count(p, 'like') + _count(p, 'helpful') + _count(p, 'idea');
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () async {
        await context.push('/post/${p['id']}');
        ref.invalidate(homeFeedProvider);
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Avatar(name, size: 38, bg: isMentor ? Brand.saffron : Brand.lightGreen, fg: Brand.forest),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(child: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis, style: body(15, w: FontWeight.w800))),
              if (isMentor) const Padding(padding: EdgeInsets.only(left: 4), child: Icon(Icons.verified, size: 15, color: Brand.saffron)),
              if (sub.isNotEmpty) Flexible(child: Text('  $sub', maxLines: 1, overflow: TextOverflow.ellipsis, style: body(12, color: Brand.muted))),
            ]),
            const SizedBox(height: 3),
            Text('${p['text'] ?? ''}', maxLines: 3, overflow: TextOverflow.ellipsis, style: body(15).copyWith(height: 1.35)),
            const SizedBox(height: 6),
            Row(children: [
              _groupTag(_groupTitle(context, groups, '${p['topic']}')),
              const Spacer(),
              Icon(Icons.thumb_up_alt_outlined, size: 15, color: Brand.muted), const SizedBox(width: 4),
              Text('$likes', style: body(12, color: Brand.muted, w: FontWeight.w700)),
              const SizedBox(width: 12),
              Icon(Icons.chat_bubble_outline, size: 15, color: Brand.muted), const SizedBox(width: 4),
              Text('${p['commentCount'] ?? 0}', style: body(12, color: Brand.muted, w: FontWeight.w700)),
            ]),
          ])),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).valueOrNull;
    final canPost = _canPost(me);
    final myName = '${me?['displayName'] ?? ''}';
    final async = ref.watch(homeFeedProvider);
    final loaded = ((ref.watch(feedGroupsProvider).valueOrNull?['groups'] ?? []) as List).whereType<Map>().toList();
    final List groups = loaded.isEmpty ? _fallbackGroups : loaded;
    final posts = async.valueOrNull == null ? <Map>[] : ((async.valueOrNull!['posts'] ?? []) as List).whereType<Map>().take(3).toList();

    return AppCard(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 8),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          Text(tr(context, 'Community', 'কমিউনিটি'), style: display(20, color: Brand.ink)),
          GestureDetector(
            onTap: () async { await context.push('/feed'); ref.invalidate(homeFeedProvider); },
            child: Text(tr(context, 'See all', 'সব দেখুন'), style: display(15, color: Brand.delta, w: FontWeight.w700)),
          ),
        ]),
        const SizedBox(height: 10),
        if (canPost) InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => _compose(context, ref, groups),
          child: Container(
            padding: const EdgeInsets.fromLTRB(10, 8, 12, 8),
            decoration: BoxDecoration(color: Brand.paper, borderRadius: BorderRadius.circular(16), border: Border.all(color: _line)),
            child: Row(children: [
              Avatar(myName.isEmpty ? '?' : myName, size: 32, bg: Brand.lightGreen, fg: Brand.forest),
              const SizedBox(width: 10),
              Expanded(child: Text(tr(context, 'Ask a question or share a project…', 'প্রশ্ন করুন বা প্রজেক্ট শেয়ার করুন…'), style: body(14, color: Brand.muted))),
              const Icon(Icons.edit_outlined, color: Brand.delta, size: 20),
            ]),
          ),
        ),
        if (async.isLoading && posts.isEmpty) const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: Center(child: SizedBox(width: 26, height: 26, child: CircularProgressIndicator(strokeWidth: 3))))
        else if (async.hasError && posts.isEmpty) Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: Row(children: [
          const Icon(Icons.cloud_off, color: Brand.muted, size: 20), const SizedBox(width: 8),
          Expanded(child: Text(tr(context, 'Could not load the feed.', 'ফিড লোড করা যায়নি।'), style: body(14, color: Brand.muted))),
          TextButton(onPressed: () => ref.invalidate(homeFeedProvider), child: Text(tr(context, 'Retry', 'আবার'))),
        ]))
        else if (posts.isEmpty) Padding(padding: const EdgeInsets.symmetric(vertical: 14), child: Text(tr(context, 'No posts yet. Be the first to ask or share something.', 'এখনও কোনো পোস্ট নেই। প্রথম প্রশ্ন বা পোস্টটি আপনার হোক।'), style: body(14, color: Brand.muted)))
        else ...[
          for (var i = 0; i < posts.length; i++) ...[
            if (i > 0) Divider(height: 1, color: _line.withValues(alpha: 0.9)),
            _row(context, ref, posts[i], groups),
          ],
          Divider(height: 1, color: _line.withValues(alpha: 0.9)),
          InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () async { await context.push('/feed'); ref.invalidate(homeFeedProvider); },
            child: Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: Center(child: Text(tr(context, 'Open full community feed', 'পুরো কমিউনিটি ফিড দেখুন'), style: body(14, color: Brand.delta, w: FontWeight.w800)))),
          ),
        ],
      ]),
    );
  }
}

final feedRoutes = <RouteBase>[
  GoRoute(path: '/feed', builder: (_, __) => const FeedScreen()),
  GoRoute(path: '/post/:id', builder: (_, s) => PostDetailScreen(postId: s.pathParameters['id']!)),
];
