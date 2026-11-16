import 'package:flutter_test/flutter_test.dart';
import 'package:mentorlink_bd/core/badge_logic.dart';
import 'package:mentorlink_bd/core/count_badge.dart';

Map n(String kind, {String? type, bool read = false}) => {'kind': kind, 'read': read, if (type != null) 'target': {'type': type}};

void main() {
  test('bucket is the target type, else the kind', () {
    expect(bucketOf(n('reminder', type: 'session')), 'session');
    expect(bucketOf(n('community')), 'community');
  });
  test('student: each notification lands on exactly one tab', () {
    final unread = [n('info', type: 'chat'), n('info', type: 'chat'), n('application'), n('reminder', type: 'plan'), n('invite', type: 'invite'), n('community')];
    final b = tabBadges(unread, 'student', 5); // Home, Career, Mentors, Jobs, Profile
    expect(b, [1, 1, 2, 1, 1]);
    expect(b.reduce((a, c) => a + c), unread.length);
  });
  test('mentor: sessions and reviews go to Profile', () {
    final unread = [n('info', type: 'request'), n('review'), n('session', type: 'session')];
    expect(tabBadges(unread, 'mentor', 4), [1, 0, 0, 2]);
  });
  test('unknown role puts everything on its only tab', () => expect(tabBadges([n('info')], 'x', 1), [1]));
  test('profile menu rows', () {
    final unread = [n('invite', type: 'invite'), n('invite', type: 'invite')];
    expect(entryBadge(unread, 'student', '/invites'), 2);
    expect(entryBadge(unread, 'student', '/cv'), 0);
  });
  test('onlyUnread drops read items', () => expect(onlyUnread([n('info'), n('info', read: true)]).length, 1));
  test('99+ cap', () {
    expect(badgeText(7), '7');
    expect(badgeText(150), '99+');
  });
}
