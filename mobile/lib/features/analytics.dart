import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/providers.dart';
import '../core/theme.dart';
import '../core/ui.dart';
import 'charts.dart';
import 'widgets.dart';

// Department analytics: grouped, anonymous numbers for your own students. The server hides any group smaller than 5.
final deptAnalyticsProvider = FutureProvider.autoDispose((ref) => getJson(ref, '/department/analytics'));

class DeptAnalytics extends ConsumerWidget {
  const DeptAnalytics({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AsyncBody(value: ref.watch(deptAnalyticsProvider), onRetry: () => ref.invalidate(deptAnalyticsProvider), builder: (d) {
      final m = d as Map<String, dynamic>;
      final head = GreenHeader(radius: 36, bottomPad: 26, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(tr(context, 'Analytics', 'বিশ্লেষণ'), style: display(28, color: Colors.white)),
        const SizedBox(height: 4),
        Text(tr(context, 'Grouped numbers only. No names.', 'শুধু গ্রুপ করা সংখ্যা। কোনো নাম নয়।'), style: body(15, color: Colors.white70)),
      ]));
      if (m['hidden'] == true) {
        return ListView(padding: EdgeInsets.zero, children: [head, Padding(padding: const EdgeInsets.all(16), child: AppCard(child: Text('${m['note']}', style: body(16))))]);
      }
      final bands = (m['readiness']['bands'] as List).cast<Map>();
      final goals = (m['goals'] as List).cast<Map>();
      final ev = m['evidence'] as Map, pf = m['portfolio'] as Map;
      final weeks = m['weeks'] as List?;
      String bandLabel(Map b) => switch (b['key']) { 'low' => tr(context, 'Low\n0–39', 'কম\n০–৩৯'), 'mid' => tr(context, 'Mid\n40–69', 'মাঝারি\n৪০–৬৯'), _ => tr(context, 'High\n70–100', 'বেশি\n৭০–১০০') };
      return ListView(padding: EdgeInsets.zero, children: [
        head,
        Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          AppCard(child: Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('${m['students']}', style: display(34, color: Brand.forest)), Text(tr(context, 'students in your department', 'আপনার বিভাগের শিক্ষার্থী'), style: body(14, color: Brand.muted))])),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(m['readiness']['withGoal'] == null ? '–' : '${m['readiness']['withGoal']}', style: display(34, color: Brand.forest)), Text(tr(context, 'have chosen a career goal', 'ক্যারিয়ার লক্ষ্য বেছেছেন'), style: body(14, color: Brand.muted))])),
          ])),
          AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr(context, 'Readiness today', 'আজকের প্রস্তুতি'), style: display(18, color: Brand.ink)),
            const SizedBox(height: 4),
            Text(tr(context, 'How many students sit in each band of readiness for their own goal.', 'নিজেদের লক্ষ্যের জন্য কতজন শিক্ষার্থী কোন প্রস্তুতির ব্যান্ডে আছেন।'), style: body(13, color: Brand.muted)),
            const SizedBox(height: 12),
            if (bands.isEmpty) Text(tr(context, 'Hidden: fewer than 5 students have a goal.', 'লুকানো: ৫ জনের কম শিক্ষার্থীর লক্ষ্য আছে।'), style: body(14, color: Brand.muted))
            else BarChartBox(data: [for (final b in bands) BarDatum(bandLabel(b), (b['count'] as num?)?.toDouble(), color: b['key'] == 'low' ? Brand.saffron : Brand.delta)]),
          ])),
          if (goals.isNotEmpty) AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr(context, 'Career goals', 'ক্যারিয়ার লক্ষ্য'), style: display(18, color: Brand.ink)),
            const SizedBox(height: 12),
            BarChartBox(data: [for (final g in goals.take(5)) BarDatum(nm(context, g, 'titleEn', 'titleBn'), (g['count'] as num).toDouble())]),
          ])),
          AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr(context, 'Evidence of skills', 'দক্ষতার প্রমাণ'), style: display(18, color: Brand.ink)),
            const SizedBox(height: 4),
            Text(tr(context, 'Students with at least one:', 'অন্তত একটি আছে এমন শিক্ষার্থী:'), style: body(13, color: Brand.muted)),
            const SizedBox(height: 12),
            Row(children: [StatTile(tr(context, 'quiz', 'কুইজ'), ev['quiz'] as num?), StatTile(tr(context, 'project', 'প্রজেক্ট'), ev['project'] as num?), StatTile(tr(context, 'mentor endorsement', 'মেন্টর এন্ডোর্স'), ev['endorsed'] as num?)]),
            const Divider(height: 28),
            Row(children: [StatTile(tr(context, 'in portfolio', 'পোর্টফোলিওতে'), pf['studentsWithProjects'] as num?), StatTile(tr(context, 'GitHub verified', 'GitHub যাচাইকৃত'), pf['githubVerified'] as num?), StatTile(tr(context, 'plan approved', 'পরিকল্পনা অনুমোদিত'), (m['planReviews'] as Map)['approved'] as num?)]),
          ])),
          AppCard(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(tr(context, 'Mentor sessions, last 6 weeks', 'মেন্টর সেশন, গত ৬ সপ্তাহ'), style: display(18, color: Brand.ink)),
            const SizedBox(height: 12),
            if (weeks == null) Text(tr(context, 'Hidden: fewer than 5 sessions.', 'লুকানো: ৫টির কম সেশন।'), style: body(14, color: Brand.muted))
            else SparklineBox(values: [for (final w in weeks.cast<Map>()) (w['sessions'] as num).toDouble()]),
          ])),
          Text('${m['note']}', style: body(12, color: Brand.muted)),
        ])),
      ]);
    });
  }
}
