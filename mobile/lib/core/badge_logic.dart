/// Which unread notifications belong to which tab / menu item. Pure Dart (no Flutter), so it is easy to unit-test.
///
/// A notification's "bucket" is its target type when it has one (chat, request, session, plan, application, opportunity,
/// invite, review, sprint, ...), otherwise its kind (community, mock, workshop, ...).
String bucketOf(Map n) {
  final t = n['target'];
  final type = t is Map ? '${t['type'] ?? ''}' : '';
  if (type.isNotEmpty) return type;
  return '${n['kind'] ?? 'info'}';
}

List<Map> onlyUnread(Iterable<Map> all) => [for (final n in all) if (n['read'] != true) n];

int countBuckets(Iterable<Map> unread, Set<String> buckets) => unread.where((n) => buckets.contains(bucketOf(n))).length;

// For each role: the buckets shown on every tab EXCEPT the last one. The last tab is always Profile and gets everything
// not claimed by an earlier tab, so no notification is ever counted twice and none is lost.
const Map<String, List<Set<String>>> _tabBuckets = {
  // Home, Career, Mentors, Jobs
  'student': [
    {'community', 'post', 'qa', 'workshop'},
    {'plan', 'review', 'sprint'},
    {'request', 'chat', 'session', 'mock'},
    {'opportunity', 'application'},
  ],
  // Requests, Opportunities, Impact
  'mentor': [
    {'request', 'chat'},
    {'opportunity'},
    {},
  ],
  // Queue, Jobs, Companies, Resources, Insights
  'admin': [
    {},
    {'opportunity'},
    {'organization'},
    {},
    {},
  ],
  // Overview, Approvals, Analytics, Workshops
  'department': [
    {},
    {'affiliation'},
    {},
    {'workshop'},
  ],
  // Jobs, Talent
  'employer': [
    {'application', 'opportunity', 'organization'},
    {'invite'},
  ],
};

/// One number per tab (same order as the bottom bar). 0 means "no badge".
List<int> tabBadges(List<Map> unread, String role, int tabCount) {
  final claimed = _tabBuckets[role] ?? const <Set<String>>[];
  final out = List<int>.filled(tabCount, 0);
  final used = <String>{};
  for (int i = 0; i < tabCount - 1 && i < claimed.length; i++) {
    out[i] = countBuckets(unread, claimed[i]);
    used.addAll(claimed[i]);
  }
  if (tabCount > 0) out[tabCount - 1] = unread.where((n) => !used.contains(bucketOf(n))).length;
  return out;
}

// Menu items inside Profile. Only items whose notifications really land in the Profile tab are listed here.
const Map<String, Map<String, Set<String>>> _entryBuckets = {
  'student': {
    '/invites': {'invite'},
    '/verify': {'verification'},
  },
  'mentor': {
    '/mentor/reviews': {'review'},
    '/mentor/sprint-reviews': {'sprint'},
    '/sessions': {'session'},
  },
};

int entryBadge(List<Map> unread, String role, String route) {
  final b = _entryBuckets[role]?[route];
  return b == null ? 0 : countBuckets(unread, b);
}
