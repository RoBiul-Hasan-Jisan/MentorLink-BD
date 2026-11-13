/// Maps a notification to the screen it should open, or null when there is nowhere useful to go.
/// Pure Dart (no Flutter), so it is easy to unit-test. The server sends `target: {type, id}` (see backend/src/utils/notifyTarget.js);
/// older notifications only have `kind`, so a fixed screen is used for those. The id is only used when it is a 24-character id;
/// the destination screen still asks the server, which decides whether this person may see the item.
final RegExp _objectId = RegExp(r'^[a-fA-F0-9]{24}$');

String? notificationRoute(Map n, {required String role}) {
  final t = n['target'];
  final type = t is Map ? '${t['type'] ?? ''}' : '';
  final rawId = t is Map ? '${t['id'] ?? ''}' : '';
  final id = _objectId.hasMatch(rawId) ? rawId : null;
  final mentor = role == 'mentor';
  switch (type) {
    case 'chat':
      return id == null ? null : '/chat/$id';
    case 'request':
      if (mentor && id != null) return '/mentor/request/$id';
      return '/sessions';
    case 'session':
      return '/sessions';
    case 'plan':
      return '/plan';
    case 'application':
      if (id != null) return '/application/$id';
      return role == 'student' ? '/applications' : null;
    case 'opportunity':
      return id == null ? null : '/opportunity/$id';
    case 'invite':
      return role == 'student' ? '/invites' : null;
    case 'review':
      return mentor ? '/mentor/reviews' : '/my-reviews';
    case 'sprint':
      return mentor ? '/mentor/sprint-reviews' : '/sprints';
    case 'post':
      return id == null ? null : '/post/$id';
    case 'qa':
      return id == null ? null : '/qa/$id';
    case '':
      break;
    default:
      return null;
  }
  switch ('${n['kind'] ?? ''}') {
    case 'reminder':
    case 'session':
      return '/sessions';
    case 'plan':
      return '/plan';
    case 'application':
      return role == 'student' ? '/applications' : null;
    case 'invite':
      return role == 'student' ? '/invites' : null;
    default:
      return null;
  }
}
