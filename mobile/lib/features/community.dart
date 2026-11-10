import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../core/api.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'widgets.dart';

// Pathways and community: pathway tips, group workshops and the moderated Q&A.

final communityWorkshopsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/workshops'));
final communityQaListProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, q) => getJson(ref, '/qa', q: <String, dynamic>{'q': q}));
final communityQaDetailProvider = FutureProvider.autoDispose.family<Map<String, dynamic>, String>((ref, id) => getJson(ref, '/qa/$id'));

const List<String> _cMoEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const List<String> _cMoBn = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
const List<String> _cWdEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const List<String> _cWdBn = ['সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি', 'রবি'];

String _cDate(BuildContext c, dynamic raw, {bool withTime = false}) {
  final DateTime? d = DateTime.tryParse('${raw ?? ''}')?.toLocal();
  if (d == null) return '';
  String s = '${tr(c, _cWdEn[d.weekday - 1], _cWdBn[d.weekday - 1])} ${d.day} ${tr(c, _cMoEn[d.month - 1], _cMoBn[d.month - 1])}';
  if (withTime) {
    final int h = d.hour % 12 == 0 ? 12 : d.hour % 12;
    s = '$s · $h:${d.minute.toString().padLeft(2, '0')} ${d.hour >= 12 ? 'PM' : 'AM'}';
  }
  return s;
}

Widget _cHeader(BuildContext context, String title, String subtitle) => GreenHeader(
      radius: 36,
      bottomPad: 26,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        BackCircle(dark: true, onTap: () => context.pop()),
        const SizedBox(height: 12),
        Text(title, style: display(28, color: Colors.white)),
        const SizedBox(height: 4),
        Text(subtitle, style: body(15, color: Colors.white70)),
      ]),
    );

class _Pathway {
  const _Pathway(this.en, this.bn, this.subEn, this.subBn, this.bg, this.fg, this.tipsEn, this.tipsBn);
  final String en, bn, subEn, subBn;
  final Color bg, fg;
  final List<String> tipsEn, tipsBn;
}

List<_Pathway> get _pathways => [
  _Pathway('Higher study abroad', 'বিদেশে উচ্চশিক্ষা', 'SOP tips · scholarship checklist', 'এসওপি টিপস · স্কলারশিপ চেকলিস্ট', Brand.forest, Colors.white, [
    'Write your statement of purpose around one clear story: why this field, why this country, why you.',
    'Make a checklist of every scholarship deadline and the documents each one needs.',
    'Ask teachers and mentors for recommendation letters early, with your resume attached.',
    'Prepare for the language test well before the application deadline.',
  ], [
    'আপনার এসওপি একটি পরিষ্কার গল্পের ওপর লিখুন: কেন এই বিষয়, কেন এই দেশ, কেন আপনি।',
    'প্রতিটি স্কলারশিপের শেষ তারিখ ও প্রয়োজনীয় কাগজপত্রের একটি চেকলিস্ট বানান।',
    'শিক্ষক ও মেন্টরদের কাছে আগেভাগেই সুপারিশপত্র চান, সঙ্গে আপনার সিভি দিন।',
    'আবেদনের শেষ তারিখের অনেক আগে থেকেই ভাষা পরীক্ষার প্রস্তুতি নিন।',
  ]),
  _Pathway('BCS preparation', 'বিসিএস প্রস্তুতি', 'Syllabus plan · weekly goals', 'সিলেবাস পরিকল্পনা · সাপ্তাহিক লক্ষ্য', Brand.lightGreen, Brand.forest, [
    'Split the syllabus into weekly goals and tick them off every Friday.',
    'Practise previous years questions under a timer.',
    'Read one newspaper daily and keep short notes on current affairs.',
    'Join a study group so you keep a steady routine.',
  ], [
    'সিলেবাসকে সাপ্তাহিক লক্ষ্যে ভাগ করুন এবং প্রতি শুক্রবার হিসাব মেলান।',
    'আগের বছরের প্রশ্ন সময় ধরে অনুশীলন করুন।',
    'প্রতিদিন একটি পত্রিকা পড়ুন এবং সাম্প্রতিক বিষয়ে ছোট নোট রাখুন।',
    'নিয়মিত অভ্যাস ধরে রাখতে একটি স্টাডি গ্রুপে যোগ দিন।',
  ]),
  _Pathway('Entrepreneurship', 'উদ্যোক্তা হওয়া', 'Idea check · first 10 customers', 'আইডিয়া যাচাই · প্রথম ১০ জন ক্রেতা', Brand.lightSaffron, Color(0xFF7A4A00), [
    'Check your idea by talking to ten possible customers before you spend money.',
    'Start with the smallest version you can sell, then improve it.',
    'Aim for your first ten paying customers, not for a big launch.',
    'Keep a simple record of income and cost from day one.',
  ], [
    'টাকা খরচ করার আগে দশজন সম্ভাব্য ক্রেতার সঙ্গে কথা বলে আইডিয়া যাচাই করুন।',
    'যেটুকু সহজে বিক্রি করা যায় সেই ছোট রূপ দিয়ে শুরু করুন, পরে উন্নত করুন।',
    'বড় লঞ্চ নয়, প্রথম দশজন ক্রেতা পাওয়াকে লক্ষ্য করুন।',
    'প্রথম দিন থেকেই আয় ও খরচের সহজ হিসাব রাখুন।',
  ]),
  _Pathway('Freelancing', 'ফ্রিল্যান্সিং', 'Profile · pricing · safe payment', 'প্রোফাইল · মূল্য নির্ধারণ · নিরাপদ পেমেন্ট', Color(0xFFE6EEFB), Color(0xFF1F4A8F), [
    'Build a clear profile with two or three real sample projects.',
    'Price by the value of the result, and never work for free as a test.',
    'Use payment methods that protect both sides and keep all talk in writing.',
    'Be careful of anyone who asks you to pay a fee to get work.',
  ], [
    'দুই-তিনটি বাস্তব নমুনা কাজসহ একটি পরিষ্কার প্রোফাইল বানান।',
    'কাজের মূল্য ফলাফলের মান অনুযায়ী ঠিক করুন, পরীক্ষার নামে বিনা পারিশ্রমিকে কাজ করবেন না।',
    'দুই পক্ষকে সুরক্ষা দেয় এমন পেমেন্ট পদ্ধতি ব্যবহার করুন এবং সব কথা লিখিত রাখুন।',
    'কাজ পাওয়ার জন্য যে ফি চায়, তার থেকে সাবধান থাকুন।',
  ]),
];

void _showPathway(BuildContext context, _Pathway p) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Brand.paper,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
    builder: (ctx) {
      final List<String> tips = Localizations.localeOf(ctx).languageCode == 'bn' ? p.tipsBn : p.tipsEn;
      return SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Text(tr(ctx, p.en, p.bn), style: display(24)),
            const SizedBox(height: 4),
            Text(tr(ctx, p.subEn, p.subBn), style: body(14, color: Brand.muted)),
            const SizedBox(height: 14),
            for (final String t in tips)
              Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Padding(padding: EdgeInsets.only(top: 2, right: 10), child: Icon(Icons.check_circle, size: 20, color: Brand.delta)),
                  Expanded(child: Text(t, style: body(16))),
                ]),
              ),
            const SizedBox(height: 6),
            Text(tr(ctx, 'General tips only. Ask a mentor or the community for advice that fits you.', 'এগুলো সাধারণ পরামর্শ। আপনার জন্য উপযুক্ত পরামর্শ পেতে মেন্টর বা কমিউনিটিকে জিজ্ঞাসা করুন।'), style: body(13, color: Brand.muted)),
            const SizedBox(height: 14),
            BigButton(tr(ctx, 'Close', 'বন্ধ করুন'), onPressed: () => Navigator.of(ctx).pop(), outlined: true),
          ]),
        ),
      );
    },
  );
}

class PathwaysScreen extends ConsumerWidget {
  const PathwaysScreen({super.key});

  Widget _pathCard(BuildContext context, _Pathway p) => Expanded(
        child: Padding(
          padding: const EdgeInsets.all(5),
          child: Material(
            color: p.bg,
            borderRadius: BorderRadius.circular(22),
            child: InkWell(
              borderRadius: BorderRadius.circular(22),
              onTap: () => _showPathway(context, p),
              child: Container(
                constraints: const BoxConstraints(minHeight: 116),
                padding: const EdgeInsets.all(14),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(tr(context, p.en, p.bn), style: display(17, color: p.fg)),
                  const SizedBox(height: 6),
                  Text(tr(context, p.subEn, p.subBn), style: body(13, color: p.fg)),
                ]),
              ),
            ),
          ),
        ),
      );

  Future<void> _toggle(BuildContext context, WidgetRef ref, Map w) async {
    final String id = '${w['id']}';
    try {
      if (w['joined'] == true) {
        await ref.read(dioProvider).delete('/workshops/$id/join');
        if (context.mounted) toast(context, tr(context, 'You left the workshop', 'আপনি ওয়ার্কশপ ছেড়েছেন'));
      } else {
        await ref.read(dioProvider).post('/workshops/$id/join');
        if (context.mounted) toast(context, tr(context, 'You joined the workshop', 'আপনি ওয়ার্কশপে যোগ দিয়েছেন'));
      }
      ref.invalidate(communityWorkshopsProvider);
    } catch (e) {
      if (context.mounted) toast(context, errorText(e));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final String role = '${ref.watch(meProvider).valueOrNull?['role'] ?? ''}';
    return Scaffold(
      body: ListView(padding: EdgeInsets.zero, children: [
        _cHeader(context, tr(context, 'Pathways and community', 'পথ ও কমিউনিটি'), tr(context, 'Careers beyond one job route', 'একটি চাকরির পথের বাইরেও ক্যারিয়ার')),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            IntrinsicHeight(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [_pathCard(context, _pathways[0]), _pathCard(context, _pathways[1])])),
            IntrinsicHeight(child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [_pathCard(context, _pathways[2]), _pathCard(context, _pathways[3])])),
            const SizedBox(height: 14),
            Text(tr(context, 'Group workshops', 'গ্রুপ ওয়ার্কশপ'), style: display(20, color: Brand.ink)),
            const SizedBox(height: 8),
            Consumer(builder: (context, ref2, _) {
              final AsyncValue<dynamic> ws = ref2.watch(communityWorkshopsProvider);
              return ws.when(
                loading: () => const Padding(padding: EdgeInsets.all(20), child: Center(child: CircularProgressIndicator())),
                error: (e, _) => Padding(padding: const EdgeInsets.all(8), child: Text(errorText(e), style: body(14, color: Brand.muted))),
                data: (dynamic d) {
                  final List<Map> list = ((d['workshops'] ?? <dynamic>[]) as List).cast<Map>();
                  if (list.isEmpty) {
                    return AppCard(child: Text(tr(context, 'No workshops are open right now. Check again soon.', 'এখন কোনো ওয়ার্কশপ খোলা নেই। একটু পরে আবার দেখুন।'), style: body(15, color: Brand.muted)));
                  }
                  return Column(children: [
                    for (final Map w in list)
                      AppCard(
                        padding: const EdgeInsets.all(14),
                        child: Row(children: [
                          Container(width: 48, height: 48, decoration: BoxDecoration(color: Brand.lightSaffron, borderRadius: BorderRadius.circular(14)), child: Icon(Icons.groups_outlined, color: Brand.forest)),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text('${w['title'] ?? ''}', style: display(16, color: Brand.ink)),
                              const SizedBox(height: 3),
                              Text('${_cDate(context, w['startsAt'])} · ${w['taken'] ?? 0} ${tr(context, 'of', '/')} ${w['seats'] ?? 0} ${tr(context, 'seats', 'আসন')}', style: body(13, color: Brand.muted)),
                              if ('${w['host'] ?? ''}'.isNotEmpty) Text('${tr(context, 'Host', 'আয়োজক')}: ${w['host']}', style: body(13, color: Brand.muted)),
                            ]),
                          ),
                          if (role == 'student')
                            SizedBox(
                              height: 48,
                              child: w['joined'] == true
                                  ? OutlinedButton(onPressed: () => _toggle(context, ref, w), child: Text(tr(context, 'Leave', 'ছাড়ুন')))
                                  : FilledButton(
                                      style: FilledButton.styleFrom(backgroundColor: Brand.saffron, foregroundColor: Brand.ink),
                                      onPressed: ((w['taken'] as num?) ?? 0) >= ((w['seats'] as num?) ?? 0) ? null : () => _toggle(context, ref, w),
                                      child: Text(tr(context, 'Join', 'যোগ দিন')),
                                    ),
                            ),
                        ]),
                      ),
                  ]);
                },
              );
            }),
            const SizedBox(height: 6),
            AppCard(
              onTap: () => context.push('/qa'),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(tr(context, 'Community Q&A', 'কমিউনিটি প্রশ্নোত্তর'), style: display(19, color: Brand.ink))),
                  Pill(tr(context, 'Moderated', 'তত্ত্বাবধানে')),
                ]),
                const SizedBox(height: 10),
                Container(
                  height: 48,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFCBD6CF))),
                  child: Row(children: [
                    Icon(Icons.search, color: Brand.muted),
                    const SizedBox(width: 8),
                    Expanded(child: Text(tr(context, 'Search in Bangla or English', 'বাংলা বা ইংরেজিতে খুঁজুন'), style: body(15, color: Brand.muted))),
                  ]),
                ),
                const SizedBox(height: 10),
                Text(tr(context, 'Open the questions and answers from students and verified mentors.', 'শিক্ষার্থী ও যাচাইকৃত মেন্টরদের প্রশ্ন ও উত্তর দেখুন।'), style: body(14, color: Brand.muted)),
              ]),
            ),
            const SizedBox(height: 4),
            BigButton(tr(context, 'Ask a question', 'প্রশ্ন করুন'), onPressed: () => context.push('/qa')),
          ]),
        ),
      ]),
    );
  }
}

class _AskDialog extends StatefulWidget {
  const _AskDialog();
  @override
  State<_AskDialog> createState() => _AskDialogState();
}

class _AskDialogState extends State<_AskDialog> {
  final TextEditingController _title = TextEditingController();
  final TextEditingController _body = TextEditingController();
  String? _err;

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(tr(context, 'Ask a question', 'প্রশ্ন করুন'), style: display(20)),
        content: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            TextField(controller: _title, maxLength: 150, decoration: InputDecoration(labelText: tr(context, 'Your question (at least 8 characters)', 'আপনার প্রশ্ন (কমপক্ষে ৮ অক্ষর)'))),
            const SizedBox(height: 8),
            TextField(controller: _body, maxLength: 1000, maxLines: 4, decoration: InputDecoration(labelText: tr(context, 'Details (optional)', 'বিস্তারিত (ঐচ্ছিক)'))),
            if (_err != null) Padding(padding: const EdgeInsets.only(top: 4), child: Text(_err!, style: body(13, color: const Color(0xFF9B2C1F)))),
            const SizedBox(height: 6),
            Text(tr(context, 'Do not share phone numbers or ask for money. Posts are moderated.', 'ফোন নম্বর দেবেন না, টাকা চাইবেন না। পোস্ট তত্ত্বাবধানে থাকে।'), style: body(12, color: Brand.muted)),
          ]),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(), child: Text(tr(context, 'Cancel', 'বাতিল'))),
          FilledButton(
            onPressed: () {
              final String t = _title.text.trim();
              if (t.length < 8) {
                setState(() => _err = tr(context, 'Please write at least 8 characters.', 'কমপক্ষে ৮ অক্ষর লিখুন।'));
                return;
              }
              Navigator.of(context).pop(<String, String>{'title': t, 'body': _body.text.trim()});
            },
            child: Text(tr(context, 'Post', 'পোস্ট করুন')),
          ),
        ],
      );
}

class QaListScreen extends ConsumerStatefulWidget {
  const QaListScreen({super.key});
  @override
  ConsumerState<QaListScreen> createState() => _QaListScreenState();
}

class _QaListScreenState extends ConsumerState<QaListScreen> {
  final TextEditingController _search = TextEditingController();
  String _q = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _ask() async {
    final Map<String, String>? v = await showDialog<Map<String, String>>(context: context, builder: (_) => const _AskDialog());
    if (v == null) return;
    final Map<String, dynamic> data = <String, dynamic>{'title': v['title']};
    if ((v['body'] ?? '').isNotEmpty) data['body'] = v['body'];
    try {
      await ref.read(dioProvider).post('/qa', data: data);
      ref.invalidate(communityQaListProvider);
      if (mounted) toast(context, tr(context, 'Question posted', 'প্রশ্ন পোস্ট হয়েছে'));
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final String role = '${ref.watch(meProvider).valueOrNull?['role'] ?? ''}';
    final bool canPost = role == 'student' || role == 'mentor';
    final AsyncValue<Map<String, dynamic>> qa = ref.watch(communityQaListProvider(_q));
    return Scaffold(
      floatingActionButton: canPost
          ? FloatingActionButton.extended(onPressed: _ask, backgroundColor: Brand.delta, foregroundColor: Colors.white, icon: const Icon(Icons.edit), label: Text(tr(context, 'Ask a question', 'প্রশ্ন করুন')))
          : null,
      body: ListView(padding: const EdgeInsets.only(bottom: 90), children: [
        _cHeader(context, tr(context, 'Community Q&A', 'কমিউনিটি প্রশ্নোত্তর'), tr(context, 'Moderated · Bangla or English', 'তত্ত্বাবধানে · বাংলা বা ইংরেজি')),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            TextField(
              controller: _search,
              textInputAction: TextInputAction.search,
              onSubmitted: (String v) => setState(() => _q = v.trim()),
              decoration: InputDecoration(
                hintText: tr(context, 'Search in Bangla or English', 'বাংলা বা ইংরেজিতে খুঁজুন'),
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  tooltip: tr(context, 'Search', 'খুঁজুন'),
                  icon: const Icon(Icons.arrow_forward),
                  onPressed: () => setState(() => _q = _search.text.trim()),
                ),
              ),
            ),
            const SizedBox(height: 12),
            qa.when(
              loading: () => const Padding(padding: EdgeInsets.all(30), child: Center(child: CircularProgressIndicator())),
              error: (Object e, StackTrace _) => Center(child: Column(children: [Text(errorText(e), textAlign: TextAlign.center), TextButton(onPressed: () => ref.invalidate(communityQaListProvider), child: Text(tr(context, 'Retry', 'আবার চেষ্টা করুন')))])),
              data: (Map<String, dynamic> d) {
                final List<Map> list = ((d['questions'] ?? <dynamic>[]) as List).cast<Map>();
                return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  if (list.isEmpty) AppCard(child: Text(tr(context, 'No questions found. Be the first to ask.', 'কোনো প্রশ্ন পাওয়া যায়নি। প্রথম প্রশ্নটি আপনিই করুন।'), style: body(15, color: Brand.muted))),
                  for (final Map x in list)
                    AppCard(
                      padding: const EdgeInsets.all(16),
                      onTap: () => context.push('/qa/${x['id']}'),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('${x['title'] ?? ''}', style: display(17, color: Brand.ink)),
                        const SizedBox(height: 6),
                        Wrap(spacing: 8, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, children: [
                          Text('${x['answers'] ?? 0} ${tr(context, 'answers', 'উত্তর')} · ${x['by'] ?? ''} · ${_cDate(context, x['createdAt'])}', style: body(13, color: Brand.muted)),
                          if ((((x['mentorAnswers'] as num?) ?? 0).toInt()) > 0) Pill(tr(context, 'Mentor answer', 'মেন্টরের উত্তর'), tone: Tone.saffron),
                        ]),
                      ]),
                    ),
                  const SizedBox(height: 4),
                  Text('${d['note'] ?? tr(context, 'Moderated. Reported posts are hidden for review.', 'তত্ত্বাবধানে। অভিযোগ পাওয়া পোস্ট পর্যালোচনার জন্য লুকানো হয়।')}', style: body(13, color: Brand.muted)),
                ]);
              },
            ),
          ]),
        ),
      ]),
    );
  }
}

class QaDetailScreen extends ConsumerStatefulWidget {
  const QaDetailScreen({super.key, required this.id});
  final String id;
  @override
  ConsumerState<QaDetailScreen> createState() => _QaDetailScreenState();
}

class _QaDetailScreenState extends ConsumerState<QaDetailScreen> {
  final TextEditingController _answer = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _answer.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final String t = _answer.text.trim();
    if (t.length < 3) {
      toast(context, tr(context, 'Write at least 3 characters.', 'কমপক্ষে ৩ অক্ষর লিখুন।'));
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(dioProvider).post('/qa/${widget.id}/answers', data: <String, dynamic>{'body': t});
      _answer.clear();
      ref.invalidate(communityQaDetailProvider(widget.id));
      if (mounted) toast(context, tr(context, 'Answer posted', 'উত্তর পোস্ট হয়েছে'));
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _report() async {
    final bool? ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(tr(ctx, 'Report this question?', 'এই প্রশ্নটি রিপোর্ট করবেন?')),
        content: Text(tr(ctx, 'Reported posts are hidden for review by the safety team.', 'রিপোর্ট করা পোস্ট সেফটি টিমের পর্যালোচনার জন্য লুকানো হয়।')),
        actions: [
          TextButton(onPressed: () => Navigator.of(ctx).pop(false), child: Text(tr(ctx, 'Cancel', 'বাতিল'))),
          FilledButton(onPressed: () => Navigator.of(ctx).pop(true), child: Text(tr(ctx, 'Report', 'রিপোর্ট করুন'))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final Response2 res = await _postReport();
      if (!mounted) return;
      toast(context, tr(context, 'Thank you. We will review it.', 'ধন্যবাদ। আমরা এটি পর্যালোচনা করব।'));
      if (res.hidden) context.pop();
    } catch (e) {
      if (mounted) toast(context, errorText(e));
    }
  }

  Future<Response2> _postReport() async {
    final dynamic r = await ref.read(dioProvider).post('/qa/${widget.id}/report');
    final dynamic data = r.data;
    final bool hidden = data is Map && data['hidden'] == true;
    return Response2(hidden);
  }

  @override
  Widget build(BuildContext context) {
    final String role = '${ref.watch(meProvider).valueOrNull?['role'] ?? ''}';
    final bool canPost = role == 'student' || role == 'mentor';
    final AsyncValue<Map<String, dynamic>> q = ref.watch(communityQaDetailProvider(widget.id));
    return Scaffold(
      body: q.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (Object e, StackTrace _) => SafeArea(child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [Text(errorText(e), textAlign: TextAlign.center), TextButton(onPressed: () => context.pop(), child: Text(tr(context, 'Back', 'ফিরে যান')))]))),
        data: (Map<String, dynamic> d) {
          final List<Map> answers = ((d['answers'] ?? <dynamic>[]) as List).cast<Map>();
          return ListView(padding: const EdgeInsets.only(bottom: 24), children: [
            GreenHeader(
              radius: 36,
              bottomPad: 26,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                BackCircle(dark: true, onTap: () => context.pop()),
                const SizedBox(height: 12),
                Text('${d['title'] ?? ''}', style: display(22, color: Colors.white)),
                const SizedBox(height: 6),
                Text('${d['by'] ?? ''} · ${_cDate(context, d['createdAt'])}', style: body(14, color: Colors.white70)),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if ('${d['body'] ?? ''}'.isNotEmpty) AppCard(child: Text('${d['body']}', style: body(16))),
                Row(children: [
                  Expanded(child: Text('${answers.length} ${tr(context, 'answers', 'উত্তর')}', style: display(19, color: Brand.ink))),
                  if (canPost) TextButton.icon(onPressed: _report, icon: const Icon(Icons.flag_outlined, size: 20), label: Text(tr(context, 'Report', 'রিপোর্ট'))),
                ]),
                const SizedBox(height: 6),
                if (answers.isEmpty) AppCard(child: Text(tr(context, 'No answers yet.', 'এখনো কোনো উত্তর নেই।'), style: body(15, color: Brand.muted))),
                for (final Map a in answers)
                  AppCard(
                    color: a['verifiedMentor'] == true ? Brand.lightGreen : Colors.white,
                    padding: const EdgeInsets.all(16),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Avatar('${a['by'] ?? '?'}', size: 36),
                        const SizedBox(width: 10),
                        Expanded(child: Text('${a['by'] ?? ''}', style: display(15, color: Brand.ink))),
                        if (a['verifiedMentor'] == true) Pill(tr(context, 'Verified mentor', 'যাচাইকৃত মেন্টর')),
                      ]),
                      const SizedBox(height: 8),
                      Text('${a['body'] ?? ''}', style: body(15)),
                      const SizedBox(height: 4),
                      Text(_cDate(context, a['createdAt']), style: body(12, color: Brand.muted)),
                    ]),
                  ),
                if (canPost) ...[
                  const SizedBox(height: 6),
                  TextField(controller: _answer, minLines: 3, maxLines: 6, maxLength: 1000, decoration: InputDecoration(hintText: tr(context, 'Write your answer', 'আপনার উত্তর লিখুন'))),
                  const SizedBox(height: 8),
                  BigButton(_busy ? tr(context, 'Posting...', 'পোস্ট হচ্ছে...') : tr(context, 'Post answer', 'উত্তর দিন'), onPressed: _busy ? null : _send),
                ],
                const SizedBox(height: 10),
                Text(tr(context, 'Moderated. Do not share phone numbers or ask for money.', 'তত্ত্বাবধানে। ফোন নম্বর দেবেন না, টাকা চাইবেন না।'), style: body(13, color: Brand.muted)),
              ]),
            ),
          ]);
        },
      ),
    );
  }
}

class Response2 {
  const Response2(this.hidden);
  final bool hidden;
}
