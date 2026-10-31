import 'package:flutter_test/flutter_test.dart';
import 'package:mentorlink_bd/features/decision_lab_logic.dart';

// Pure-logic tests for the Career Decision Lab: lens ranking, stable role selection, and the written summary.
Map role(String key, {required int readiness, required int proven, required int hours, int confidence = 0, int? weeks, bool small = false, String? en}) => {
      'role': {'key': key, 'titleEn': en ?? key, 'titleBn': '$key-bn'},
      'readiness': readiness,
      'provenReadiness': proven,
      'confidence': confidence,
      'totalHours': hours,
      'timeToReadyWeeks': weeks,
      'postings': {'used': small ? 1 : 8, 'small': small, 'basis': small ? 'role_template' : 'postings'},
    };

List<String> keysOf(List<Map> r) => [for (final x in r) roleKeyOf(x)];

void main() {
  // The goal (data-analyst) is NOT the most ready role, and the fastest role differs from the most ready one.
  final da = role('data-analyst', readiness: 40, proven: 10, hours: 120, confidence: 17, weeks: 24, en: 'Data Analyst');
  final qa = role('qa-engineer', readiness: 70, proven: 20, hours: 60, confidence: 50, weeks: 12, en: 'QA Engineer');
  final mt = role('management-trainee', readiness: 55, proven: 55, hours: 30, confidence: 100, weeks: 6, en: 'Management Trainee');
  final all = [da, qa, mt];

  group('lens ranking uses the existing metrics', () {
    test('Ready Today ranks by readiness', () => expect(keysOf(rankRoles(all, Lens.ready)), ['qa-engineer', 'management-trainee', 'data-analyst']));
    test('Fastest Learning Path ranks by remaining hours', () => expect(keysOf(rankRoles(all, Lens.fastest)), ['management-trainee', 'qa-engineer', 'data-analyst']));
    test('Strongest Demonstrated Readiness ranks by proven readiness', () => expect(keysOf(rankRoles(all, Lens.proven)), ['management-trainee', 'qa-engineer', 'data-analyst']));
    test('ties keep the server order, then use the secondary metric', () {
      final a = role('a', readiness: 50, proven: 0, hours: 40), b = role('b', readiness: 50, proven: 0, hours: 40), c = role('c', readiness: 50, proven: 0, hours: 10);
      expect(keysOf(rankRoles([a, b, c], Lens.ready)), ['c', 'a', 'b']);
      expect(keysOf(rankRoles([b, a], Lens.proven)), ['b', 'a']);
    });
    test('ranking does not change the input list', () {
      final before = keysOf(all);
      rankRoles(all, Lens.fastest);
      expect(keysOf(all), before);
    });
  });

  group('roles are tracked by key, not by position', () {
    test('the goal stays identifiable whatever the order', () {
      for (final lens in Lens.values) {
        final ranked = rankRoles(all, lens);
        expect(ranked.where((r) => roleKeyOf(r) == 'data-analyst').length, 1);
      }
      expect(rankRoles(all, Lens.ready).first['role']['key'], isNot('data-analyst'));
    });
    test('pickSelected prefers the chosen key, then the goal, then the first role', () {
      expect(pickSelected(['a', 'b', 'c'], 'b', 'c'), 'b');
      expect(pickSelected(['a', 'b', 'c'], 'x', 'c'), 'c');
      expect(pickSelected(['a', 'b', 'c'], null, 'zz'), 'a');
    });
    test('replacing swaps exactly the chosen role and keeps the others in place', () {
      expect(replaceKey(['a', 'b', 'c'], 'b', 'z'), ['a', 'z', 'c']);
      expect(replaceKey(['a', 'b', 'c'], 'b', 'c'), ['a', 'b', 'c']); // already compared: no duplicate
      expect(replaceKey(['a', 'b'], 'missing', 'z'), ['a', 'b']);
    });
    test('adding respects the limit of three and never duplicates', () {
      expect(addKey(['a', 'b'], 'c'), ['a', 'b', 'c']);
      expect(addKey(['a', 'b', 'c'], 'd'), ['a', 'b', 'c']);
      expect(addKey(['a', 'b'], 'a'), ['a', 'b']);
    });
    test('removing never empties the comparison', () {
      expect(removeKey(['a', 'b', 'c'], 'b'), ['a', 'c']);
      expect(removeKey(['a'], 'a'), ['a']);
    });
  });

  group('decision summary', () {
    LabSummary s(Lens l, {String? goal = 'data-analyst', int? hours = 5, bool bn = false, List<Map>? roles}) =>
        buildSummary(roles: roles ?? all, goalKey: goal, goalTitle: 'Data Analyst', lens: l, weeklyHours: hours, bn: bn);

    test('uses the real numbers and separates my goal from the most prepared role', () {
      final text = s(Lens.ready).lines.join('\n');
      expect(text, contains('QA Engineer has the highest readiness today: 70%'));
      expect(text, contains('Management Trainee needs fewer remaining learning hours'));
      expect(text, contains('Your current goal, Data Analyst (40%), is not the role where you are most prepared today: QA Engineer is (70%)'));
    });
    test('fastest lens names the role with the fewest hours and the weeks at the saved pace', () {
      expect(s(Lens.fastest).lines.first, contains('Management Trainee needs the fewest remaining learning hours: 30 h (about 6 weeks at 5 h/week)'));
    });
    test('without weekly hours it shows hours only and says why', () {
      final r = s(Lens.fastest, hours: null);
      expect(r.lines.first, isNot(contains('weeks')));
      expect(r.cautions.join(' '), contains('No weekly study hours are saved'));
    });
    test('proven lens reports demonstrated readiness, and says so when nothing is proven', () {
      expect(s(Lens.proven).lines.first, contains('Management Trainee has the strongest demonstrated readiness: 55%'));
      final none = [role('x', readiness: 30, proven: 0, hours: 50), role('y', readiness: 20, proven: 0, hours: 70)];
      expect(s(Lens.proven, roles: none, goal: null).lines.first, contains('No compared role has demonstrated readiness yet'));
    });
    test('thin posting coverage is stated, not hidden', () {
      final thin = [role('x', readiness: 30, proven: 0, hours: 50, small: true, en: 'Thin Role'), qa];
      expect(s(Lens.ready, roles: thin).cautions.join(' '), contains('Thin Role: fewer than 3 approved postings'));
    });
    test('a goal that is not in the comparison, or no goal at all, is stated', () {
      expect(s(Lens.ready, goal: 'banking-trainee').lines.join(' '), contains('is not in this comparison'));
      expect(s(Lens.ready, goal: null).lines.join(' '), contains('not set a current career goal'));
    });
    test('readiness that rests on self-ratings is called out', () {
      expect(s(Lens.ready).lines.join(' '), contains('readiness is 40% but demonstrated readiness is 10%'));
    });
    test('Bangla text is produced, with the same numbers', () {
      final bn = s(Lens.ready, bn: true).lines.join('\n');
      expect(bn, contains('qa-engineer-bn'));
      expect(bn, contains('70%'));
    });
  });
}
