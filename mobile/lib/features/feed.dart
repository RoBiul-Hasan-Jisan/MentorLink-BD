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

// Filter keys: '' = all, 'following' = people and groups I follow, or a group key such as 'ml'.
final feedPostsProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, filter) {
  final parts = filter.split('|'); // "<group or following>|<search text>"
  final f = parts.first, q = parts.length > 1 ? parts[1] : '';
  return getJson(ref, '/feed', q: <String, dynamic>{
    if (f == 'following') 'following': '1' else if (f.isNotEmpty) 'topic': f,
    if (q.isNotEmpty) 'q': q,
  });
});
final feedGroupsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/groups'));
final feedPostProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) => getJson(ref, '/posts/$id'));

// Like = thumbs up, Helpful = star (this answered my question), Idea = light bulb (a good idea). They are independent: all three can be on.
const _reactionIcons = {'like': Icons.thumb_up_alt_outlined, 'helpful': Icons.star_border, 'idea': Icons.lightbulb_outline};
const _reactionIconsOn = {'like': Icons.thumb_up, 'helpful': Icons.star, 'idea': Icons.lightbulb};
String _reactionName(BuildContext c, String t) => t == 'like' ? tr(c, 'Like', 'লাইক') : t == 'helpful' ? tr(c, 'Helpful', 'কাজের') : tr(c, 'Idea', 'আইডিয়া');

String _groupTitle(BuildContext context, List groups, String key) {
  for (final g in groups.cast<Map>()) {
    if (g['key'] == key) return nm(context, g, 'titleEn', 'titleBn');
  }
  return key;
}

class FeedScreen extends ConsumerStatefulWidget {
  const FeedScreen({super.key});
  @override
  ConsumerState<FeedScreen> createState() => _FeedState();
}

class _FeedState extends ConsumerState<FeedScreen> {
  String group = '';
  String q = '';
  final search = TextEditingController();

  String get _key => '$group|$q';
  void _refresh() {
    ref.invalidate(feedPostsProvider(_key));
    ref.invalidate(feedGroupsProvider);
  }

  Future<void> _react(Map p, String type) async {
    try {
      await ref.read(dioProvider).put('/posts/${p['id']}/reaction', data: {'type': type});
      ref.invalidate(feedPostsProvider(_key));
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  Future<void> _follow(Map author) async {
    try {
      final dio = ref.read(dioProvider);
      if (author['following'] == true) {
        await dio.delete('/follow/user/${author['id']}');
      } else {
        await dio.put('/follow/user/${author['id']}', data: <String, dynamic>{});
      }
      ref.invalidate(feedPostsProvider(_key));
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  Future<void> _report(Map p) async {
    try {
      await ref.read(dioProvider).post('/posts/${p['id']}/report', data: <String, dynamic>{});
      if (mounted) toast(context, tr(context, 'Thanks. We will check it.', 'ধন্যবাদ। আমরা দেখব।'));
      _refresh();
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
      _refresh();
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  Future<void> _compose(List groups) async {
    final text = TextEditingController();
    final link = TextEditingController();
    String topic = group.isNotEmpty && group != 'following' ? group : 'general';
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (c) => StatefulBuilder(
        builder: (c, set) => Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(c).viewInsets.bottom + 20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(tr(context, 'New post', 'নতুন পোস্ট'), style: display(22)),
            const SizedBox(height: 10),
            TextField(controller: text, maxLines: 4, maxLength: 1000, decoration: InputDecoration(hintText: tr(context, 'Ask a question, share a problem or a project', 'প্রশ্ন, সমস্যা বা প্রজেক্ট শেয়ার করুন'))),
            DropdownButtonFormField<String>(
              initialValue: topic,
              isExpanded: true,
              decoration: InputDecoration(labelText: tr(context, 'Group', 'গ্রুপ')),
              items: [for (final g in groups.cast<Map>()) DropdownMenuItem(value: '${g['key']}', child: Text(nm(context, g, 'titleEn', 'titleBn')))],
              onChanged: (v) => set(() => topic = v ?? topic),
            ),
            const SizedBox(height: 8),
            TextField(controller: link, keyboardType: TextInputType.url, decoration: InputDecoration(labelText: tr(context, 'Link (https, optional)', 'লিংক (https, ঐচ্ছিক)'))),
            const SizedBox(height: 12),
            BigButton(tr(context, 'Post', 'পোস্ট করুন'), onPressed: () => Navigator.pop(c, true)),
            const SizedBox(height: 4),
            Text(tr(context, 'No money requests or private contact. Never share passwords or OTP.', 'টাকা চাওয়া বা ব্যক্তিগত যোগাযোগ নয়। পাসওয়ার্ড/ওটিপি দেবেন না।'), textAlign: TextAlign.center, style: body(12, color: Brand.muted)),
          ]),
        ),
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(dioProvider).post('/posts', data: {
        'text': text.text.trim(),
        'topic': topic,
        if (link.text.trim().isNotEmpty) 'link': link.text.trim(),
      });
      _refresh();
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  Widget _post(Map p, List groups) {
    final a = (p['author'] ?? {}) as Map;
    final reactions = (p['reactions'] ?? {}) as Map;
    final mine = ((p['myReactions'] ?? (p['myReaction'] != null ? [p['myReaction']] : [])) as List).map((x) => '$x').toList();
    final isMentor = a['verifiedMentor'] == true;
    return AppCard(
      padding: const EdgeInsets.all(14),
      onTap: () => context.push('/post/${p['id']}'),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Avatar('${a['name']}', size: 38, bg: isMentor ? Brand.saffron : Brand.lightGreen, fg: Brand.forest),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(child: Text('${a['name']}', style: body(16, w: FontWeight.w700), overflow: TextOverflow.ellipsis)),
              if (isMentor) Padding(padding: const EdgeInsets.only(left: 6), child: Pill(tr(context, 'Mentor', 'মেন্টর'), tone: Tone.saffron)),
            ]),
            Text(_groupTitle(context, groups, '${p['topic']}'), style: body(12, color: Brand.muted)),
          ])),
          if (a['isMe'] != true) TextButton(onPressed: () => _follow(a), child: Text(a['following'] == true ? tr(context, 'Following', 'অনুসরণ করছেন') : tr(context, 'Follow', 'অনুসরণ'))),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert, color: Brand.muted),
            onSelected: (v) { if (v == 'report') _report(p); },
            itemBuilder: (_) => [PopupMenuItem<String>(value: 'report', child: Text(tr(context, 'Report', 'রিপোর্ট')))],
          ),
        ]),
        const SizedBox(height: 8),
        Text('${p['text']}', style: body(16)),
        if (p['link'] != null) TextButton.icon(onPressed: () => launchUrl(Uri.parse('${p['link']}'), mode: LaunchMode.externalApplication), icon: const Icon(Icons.link, size: 18), label: Text('${p['link']}', overflow: TextOverflow.ellipsis)),
        const SizedBox(height: 4),
        Row(children: [
          for (final t in const ['like', 'helpful', 'idea'])
            Tooltip(
              message: _reactionName(context, t),
              child: InkWell(
                borderRadius: BorderRadius.circular(20),
                onTap: () => _react(p, t),
                child: Padding(padding: const EdgeInsets.fromLTRB(2, 6, 8, 6), child: Row(children: [
                  Icon(mine.contains(t) ? _reactionIconsOn[t] : _reactionIcons[t], size: 20, color: mine.contains(t) ? Brand.delta : Brand.muted),
                  const SizedBox(width: 3),
                  Text('${_reactionName(context, t)} ${reactions[t] ?? 0}', style: body(12, color: mine.contains(t) ? Brand.forest : Brand.muted, w: mine.contains(t) ? FontWeight.w800 : FontWeight.w500)),
                ])),
              ),
            ),
          const Spacer(),
          const Icon(Icons.chat_bubble_outline, size: 18, color: Brand.muted),
          const SizedBox(width: 4),
          Text('${p['commentCount']}', style: body(13, color: Brand.muted)),
        ]),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final groupsData = ref.watch(feedGroupsProvider).valueOrNull;
    final groups = ((groupsData?['groups'] ?? []) as List);
    final current = groups.cast<Map>().where((g) => g['key'] == group).toList();
    Widget chip(String key, String label) => Padding(
          padding: const EdgeInsets.only(right: 8),
          child: ChoiceChip(label: Text(label), selected: group == key, onSelected: (_) => setState(() => group = key)),
        );
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: Brand.delta,
        onPressed: groups.isEmpty ? null : () => _compose(groups),
        icon: const Icon(Icons.edit, color: Colors.white),
        label: Text(tr(context, 'Post', 'পোস্ট'), style: const TextStyle(color: Colors.white)),
      ),
      body: AsyncBody(
        value: ref.watch(feedPostsProvider(_key)),
        onRetry: _refresh,
        builder: (d) {
          final posts = ((d['posts'] ?? []) as List).cast<Map>();
          return RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(padding: EdgeInsets.zero, children: [
              GreenHeader(radius: 36, bottomPad: 22, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                BackCircle(dark: true, onTap: () => context.pop()),
                const SizedBox(height: 12),
                Text(tr(context, 'Community', 'কমিউনিটি'), style: display(30, color: Colors.white)),
                Text(tr(context, 'Ask, share and learn together.', 'একসাথে প্রশ্ন, শেয়ার ও শেখা।'), style: body(15, color: Colors.white70)),
              ])),
              Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 0), child: TextField(
                controller: search,
                textInputAction: TextInputAction.search,
                onSubmitted: (v) => setState(() => q = v.trim()),
                decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: tr(context, 'Search posts', 'পোস্ট খুঁজুন'), suffixIcon: q.isEmpty ? null : IconButton(icon: const Icon(Icons.close), onPressed: () { search.clear(); setState(() => q = ''); })),
              )),
              Padding(padding: const EdgeInsets.fromLTRB(16, 10, 16, 0), child: SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
                chip('', tr(context, 'All', 'সব')),
                chip('following', tr(context, 'Following', 'অনুসরণ')),
                for (final g in groups.cast<Map>()) chip('${g['key']}', nm(context, g, 'titleEn', 'titleBn')),
              ]))),
              if (current.isNotEmpty) Padding(padding: const EdgeInsets.fromLTRB(16, 4, 16, 0), child: Row(children: [
                Expanded(child: Text('${current.first['posts']} ${tr(context, 'posts in this group', 'টি পোস্ট এই গ্রুপে')}', style: body(13, color: Brand.muted))),
                TextButton(onPressed: () => _joinToggle(current.first), child: Text(current.first['joined'] == true ? tr(context, 'Leave group', 'গ্রুপ ছাড়ুন') : tr(context, 'Join group', 'গ্রুপে যোগ দিন'))),
              ])),
              Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                if (posts.isEmpty) AppCard(child: Text(tr(context, 'No posts here yet. Be the first to post.', 'এখানে এখনও পোস্ট নেই। প্রথম পোস্টটি আপনার হোক।'), style: body(16))),
                for (final p in posts) _post(p, groups),
                const SizedBox(height: 70),
              ])),
            ]),
          );
        },
      ),
    );
  }
}

class PostDetailScreen extends ConsumerStatefulWidget {
  const PostDetailScreen({super.key, required this.postId});
  final String postId;
  @override
  ConsumerState<PostDetailScreen> createState() => _PostDetailState();
}

class _PostDetailState extends ConsumerState<PostDetailScreen> {
  final text = TextEditingController();
  String? replyTo; // id of the top-level comment being answered
  String? replyName;
  bool busy = false;

  Future<void> _send() async {
    final v = text.text.trim();
    if (v.isEmpty) return;
    setState(() => busy = true);
    try {
      await ref.read(dioProvider).post('/posts/${widget.postId}/comments', data: {'text': v, if (replyTo != null) 'parentId': replyTo});
      text.clear();
      replyTo = null;
      replyName = null;
      ref.invalidate(feedPostProvider(widget.postId));
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
    if (mounted) setState(() => busy = false);
  }

  Widget _comment(Map c, {bool reply = false}) => Padding(
        padding: EdgeInsets.fromLTRB(reply ? 28 : 0, 8, 0, 0),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text('${c['by']}', style: body(15, w: FontWeight.w700)),
            if (c['verifiedMentor'] == true) Padding(padding: const EdgeInsets.only(left: 6), child: Pill(tr(context, 'Mentor', 'মেন্টর'), tone: Tone.saffron)),
          ]),
          Text('${c['text']}', style: body(15)),
          if (!reply) TextButton(onPressed: () => setState(() { replyTo = '${c['id']}'; replyName = '${c['by']}'; }), child: Text(tr(context, 'Reply', 'উত্তর দিন'))),
          for (final r in ((c['replies'] ?? []) as List).cast<Map>()) _comment(r, reply: true),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(children: [
        GreenHeader(radius: 28, bottomPad: 18, child: Row(children: [
          BackCircle(dark: true, onTap: () => context.pop()),
          const SizedBox(width: 12),
          Text(tr(context, 'Post', 'পোস্ট'), style: display(24, color: Colors.white)),
        ])),
        Expanded(
          child: AsyncBody(
            value: ref.watch(feedPostProvider(widget.postId)),
            onRetry: () => ref.invalidate(feedPostProvider(widget.postId)),
            builder: (d) {
              final p = (d['post'] ?? {}) as Map;
              final a = (p['author'] ?? {}) as Map;
              final cs = ((d['comments'] ?? []) as List).cast<Map>();
              return ListView(padding: const EdgeInsets.all(16), children: [
                AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${a['name']}', style: body(16, w: FontWeight.w700)),
                  const SizedBox(height: 6),
                  Text('${p['text']}', style: body(17)),
                  if (p['link'] != null) TextButton.icon(onPressed: () => launchUrl(Uri.parse('${p['link']}'), mode: LaunchMode.externalApplication), icon: const Icon(Icons.link, size: 18), label: Text('${p['link']}', overflow: TextOverflow.ellipsis)),
                ])),
                Text('${cs.length} ${tr(context, 'comments', 'মন্তব্য')}', style: body(13, color: Brand.muted, w: FontWeight.w800)),
                for (final c in cs) _comment(c),
              ]);
            },
          ),
        ),
        SafeArea(top: false, child: Padding(padding: const EdgeInsets.all(10), child: Column(mainAxisSize: MainAxisSize.min, children: [
          if (replyTo != null) Row(children: [
            Expanded(child: Text('${tr(context, 'Replying to', 'উত্তর দিচ্ছেন')} $replyName', style: body(13, color: Brand.muted))),
            IconButton(icon: const Icon(Icons.close, size: 18), onPressed: () => setState(() { replyTo = null; replyName = null; })),
          ]),
          Row(children: [
            Expanded(child: TextField(controller: text, onSubmitted: (_) => _send(), decoration: InputDecoration(hintText: tr(context, 'Write a comment', 'মন্তব্য লিখুন')))),
            const SizedBox(width: 8),
            IconButton.filled(style: IconButton.styleFrom(backgroundColor: Brand.delta), onPressed: busy ? null : _send, icon: const Icon(Icons.send)),
          ]),
        ]))),
      ]),
    );
  }
}

final feedRoutes = <RouteBase>[
  GoRoute(path: '/feed', builder: (_, __) => const FeedScreen()),
  GoRoute(path: '/post/:id', builder: (_, s) => PostDetailScreen(postId: s.pathParameters['id']!)),
];
