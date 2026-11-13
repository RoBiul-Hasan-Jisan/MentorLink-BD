import 'package:flutter_test/flutter_test.dart';
import 'package:mentorlink_bd/core/links.dart';
import 'package:mentorlink_bd/core/notify_route.dart';

void main() {
  const id = '64b0c0ffee64b0c0ffee1234';
  group('notificationRoute', () {
    test('chat target opens the chat', () => expect(notificationRoute({'target': {'type': 'chat', 'id': id}}, role: 'student'), '/chat/$id'));
    test('mentor request opens the request, student request opens sessions', () {
      expect(notificationRoute({'target': {'type': 'request', 'id': id}}, role: 'mentor'), '/mentor/request/$id');
      expect(notificationRoute({'target': {'type': 'request', 'id': id}}, role: 'student'), '/sessions');
    });
    test('application target opens that application for every role', () {
      expect(notificationRoute({'target': {'type': 'application', 'id': id}}, role: 'student'), '/application/$id');
      expect(notificationRoute({'target': {'type': 'application', 'id': id}}, role: 'employer'), '/application/$id');
      expect(notificationRoute({'target': {'type': 'application'}}, role: 'student'), '/applications');
    });
    test('a malformed id is never put in a route', () => expect(notificationRoute({'target': {'type': 'chat', 'id': '../admin'}}, role: 'student'), isNull));
    test('unknown type goes nowhere', () => expect(notificationRoute({'target': {'type': 'zzz'}}, role: 'student'), isNull));
    test('old notification falls back to kind', () => expect(notificationRoute({'kind': 'reminder'}, role: 'student'), '/sessions'));
  });
  group('parseMeetingUri', () {
    test('accepts https and adds a missing scheme', () {
      expect(parseMeetingUri('https://meet.google.com/abc')?.host, 'meet.google.com');
      expect(parseMeetingUri('meet.google.com/abc')?.scheme, 'https');
    });
    test('refuses unsafe or malformed links', () {
      for (final bad in ['http://x.com', 'javascript:alert(1)', 'file:///etc/passwd', 'https://u:p@x.com', 'a b.com', '', 'https://localhost']) {
        expect(parseMeetingUri(bad), isNull, reason: bad);
      }
    });
  });
}
