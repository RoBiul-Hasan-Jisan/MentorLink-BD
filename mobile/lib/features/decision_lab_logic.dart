// Career Decision Lab: pure logic (no Flutter imports) so ranking, role selection and the written summary can be unit-tested.
// Every number here comes from GET /me/decision-lab. Nothing is invented: no fit score, no hiring chance, no salaries.

/// The three ways to rank the compared roles. Each uses a metric the backend already returns.
enum Lens { ready, fastest, proven }

const int labMaxRoles = 3;

num nv(dynamic v) => v is num ? v : 0;
int iv(dynamic v) => v is num ? v.round() : 0;
String roleKeyOf(Map r) => ((r['role'] as Map)['key'] ?? '') as String;
String roleTitle(Map r, bool bn) {
  final m = r['role'] as Map;
  final en = (m['titleEn'] ?? '') as String;
  final b = (m['titleBn'] ?? '') as String;
  return bn && b.isNotEmpty ? b : en;
}

/// Ranks roles for a lens. Ties keep the order the server sent, so the result is stable.
///  ready   : readiness (highest first), then fewer hours left
///  fastest : estimated learning hours left (fewest first), then higher readiness.
///            Weeks are only a display of those hours at the saved weekly pace, so they never change the order.
///  proven  : readiness backed only by quiz / project / endorsement evidence (highest first), then evidence coverage, then readiness
List<Map> rankRoles(List<Map> roles, Lens lens) {
  final idx = List<int>.generate(roles.length, (i) => i);
  int cmp(int i, int j) {
    final a = roles[i], b = roles[j];
    int c = 0;
    switch (lens) {
      case Lens.ready:
        c = nv(b['readiness']).compareTo(nv(a['readiness']));
        if (c == 0) c = nv(a['totalHours']).compareTo(nv(b['totalHours']));
        break;
      case Lens.fastest:
        c = nv(a['totalHours']).compareTo(nv(b['totalHours']));
        if (c == 0) c = nv(b['readiness']).compareTo(nv(a['readiness']));
        break;
      case Lens.proven:
        c = nv(b['provenReadiness']).compareTo(nv(a['provenReadiness']));
        if (c == 0) c = nv(b['confidence']).compareTo(nv(a['confidence']));
        if (c == 0) c = nv(b['readiness']).compareTo(nv(a['readiness']));
        break;
    }
    return c != 0 ? c : i.compareTo(j);
  }

  idx.sort(cmp);
  return [for (final i in idx) roles[i]];
}

/// Which role is selected. Always a KEY, never a list position:
/// the chosen key if it is still compared, else the user's goal if it is, else the first role.
String pickSelected(List<String> keys, String? current, String? goal) {
  if (current != null && keys.contains(current)) return current;
  if (goal != null && keys.contains(goal)) return goal;
  return keys.first;
}

/// Replace one compared role by key. The other roles keep their place.
List<String> replaceKey(List<String> keys, String oldKey, String newKey) {
  if (keys.contains(newKey)) return List<String>.from(keys);
  final i = keys.indexOf(oldKey);
  if (i < 0) return List<String>.from(keys);
  final out = List<String>.from(keys);
  out[i] = newKey;
  return out;
}

List<String> addKey(List<String> keys, String newKey) {
  if (keys.contains(newKey) || keys.length >= labMaxRoles) return List<String>.from(keys);
  return [...keys, newKey];
}

List<String> removeKey(List<String> keys, String key) {
  if (keys.length <= 1) return List<String>.from(keys);
  return [for (final k in keys) if (k != key) k];
}

class LabSummary {
  const LabSummary(this.lines, this.cautions);
  final List<String> lines;
  final List<String> cautions;
}

/// A short, honest, numbers-only explanation of the comparison. [bn] picks Bangla.
LabSummary buildSummary({
  required List<Map> roles,
  required String? goalKey,
  required String? goalTitle,
  required Lens lens,
  required int? weeklyHours,
  required bool bn,
}) {
  final lines = <String>[];
  final cautions = <String>[];
  if (roles.isEmpty) return LabSummary(lines, cautions);
  String t(String en, String b) => bn ? b : en;
  String name(Map r) => roleTitle(r, bn);
  String hours(Map r) {
    final h = iv(r['totalHours']);
    final w = r['timeToReadyWeeks'];
    if (w is num && weeklyHours != null) {
      return t('$h h (about ${w.round()} weeks at $weeklyHours h/week)', '$h ঘণ্টা (সপ্তাহে $weeklyHours ঘণ্টায় প্রায় ${w.round()} সপ্তাহ)');
    }
    return t('$h h', '$h ঘণ্টা');
  }

  final byReady = rankRoles(roles, Lens.ready);
  final byFast = rankRoles(roles, Lens.fastest);
  final byProven = rankRoles(roles, Lens.proven);
  final rl = byReady.first, fl = byFast.first, pl = byProven.first;
  final many = roles.length > 1;

  // 1) headline for the active lens
  switch (lens) {
    case Lens.ready:
      if (many && nv(byReady[0]['readiness']) == nv(byReady[1]['readiness'])) {
        lines.add(t('${name(byReady[0])} and ${name(byReady[1])} are tied for the highest readiness today (${iv(rl['readiness'])}%).',
            '${name(byReady[0])} ও ${name(byReady[1])} আজকের সর্বোচ্চ প্রস্তুতিতে সমান (${iv(rl['readiness'])}%)।'));
      } else {
        final next = many ? t(' ${name(byReady[1])} is next at ${iv(byReady[1]['readiness'])}%.', ' এরপর ${name(byReady[1])}: ${iv(byReady[1]['readiness'])}%।') : '';
        lines.add(t('${name(rl)} has the highest readiness today: ${iv(rl['readiness'])}%.$next', 'আজ ${name(rl)} রোলে প্রস্তুতি সবচেয়ে বেশি: ${iv(rl['readiness'])}%।$next'));
      }
      break;
    case Lens.fastest:
      if (iv(fl['totalHours']) == 0) {
        lines.add(t('${name(fl)} has no open learning hours left in this model.', 'এই মডেলে ${name(fl)} রোলে শেখার কোনো ঘণ্টা বাকি নেই।'));
      } else if (many && nv(byFast[0]['totalHours']) == nv(byFast[1]['totalHours'])) {
        lines.add(t('${name(byFast[0])} and ${name(byFast[1])} need the same remaining learning time: ${hours(fl)}.', '${name(byFast[0])} ও ${name(byFast[1])} রোলে বাকি শেখার সময় সমান: ${hours(fl)}।'));
      } else {
        lines.add(t('${name(fl)} needs the fewest remaining learning hours: ${hours(fl)}.', '${name(fl)} রোলে বাকি শেখার সময় সবচেয়ে কম: ${hours(fl)}।'));
      }
      break;
    case Lens.proven:
      if (iv(pl['provenReadiness']) == 0) {
        lines.add(t('No compared role has demonstrated readiness yet: nothing is backed by a quiz, project or endorsement.', 'কোনো রোলেই এখনো প্রমাণিত প্রস্তুতি নেই: কুইজ, প্রজেক্ট বা এন্ডোর্সমেন্ট দিয়ে কিছু প্রমাণ হয়নি।'));
      } else if (many && nv(byProven[0]['provenReadiness']) == nv(byProven[1]['provenReadiness'])) {
        lines.add(t('${name(byProven[0])} and ${name(byProven[1])} are tied on demonstrated readiness (${iv(pl['provenReadiness'])}%).', '${name(byProven[0])} ও ${name(byProven[1])} প্রমাণিত প্রস্তুতিতে সমান (${iv(pl['provenReadiness'])}%)।'));
      } else {
        lines.add(t('${name(pl)} has the strongest demonstrated readiness: ${iv(pl['provenReadiness'])}% backed by quizzes, projects or endorsements (readiness overall: ${iv(pl['readiness'])}%).',
            '${name(pl)} রোলে প্রমাণিত প্রস্তুতি সবচেয়ে বেশি: ${iv(pl['provenReadiness'])}% (কুইজ, প্রজেক্ট বা এন্ডোর্সমেন্টে প্রমাণিত; মোট প্রস্তুতি ${iv(pl['readiness'])}%)।'));
      }
      break;
  }

  // 2) readiness vs time
  if (many) {
    if (roleKeyOf(rl) != roleKeyOf(fl)) {
      lines.add(t('${name(rl)} has the highest readiness today (${iv(rl['readiness'])}%), but ${name(fl)} needs fewer remaining learning hours (${hours(fl)} vs ${hours(rl)}).',
          '${name(rl)} রোলে আজ প্রস্তুতি সবচেয়ে বেশি (${iv(rl['readiness'])}%), কিন্তু ${name(fl)} রোলে কম ঘণ্টা বাকি (${hours(fl)}, বনাম ${hours(rl)})।'));
    } else {
      lines.add(t('${name(rl)} leads on both measures: highest readiness (${iv(rl['readiness'])}%) and the fewest remaining hours (${hours(rl)}).',
          '${name(rl)} দুটিতেই এগিয়ে: সর্বোচ্চ প্রস্তুতি (${iv(rl['readiness'])}%) ও সবচেয়ে কম বাকি সময় (${hours(rl)})।'));
    }
  }

  // 3) the user's goal, independent of any ranking
  Map? goal;
  if (goalKey != null) {
    for (final r in roles) {
      if (roleKeyOf(r) == goalKey) goal = r;
    }
  }
  if (goalKey == null) {
    lines.add(t('You have not set a current career goal yet, so no role is marked as yours.', 'আপনি এখনো বর্তমান ক্যারিয়ার লক্ষ্য ঠিক করেননি, তাই কোনো রোল আপনার লক্ষ্য হিসেবে চিহ্নিত নয়।'));
  } else if (goal == null) {
    final g = goalTitle == null ? '' : ' ($goalTitle)';
    lines.add(t('Your current goal$g is not in this comparison. Add it to see how it compares.', 'আপনার বর্তমান লক্ষ্য$g এই তুলনায় নেই। তুলনা দেখতে এটি যোগ করুন।'));
  } else if (nv(goal['readiness']) >= nv(rl['readiness'])) {
    lines.add(t('Your current goal, ${name(goal)}, is also where your readiness is highest today (${iv(goal['readiness'])}%).', 'আপনার বর্তমান লক্ষ্য ${name(goal)} রোলেই আজ আপনার প্রস্তুতি সবচেয়ে বেশি (${iv(goal['readiness'])}%)।'));
  } else {
    lines.add(t('Your current goal, ${name(goal)} (${iv(goal['readiness'])}%), is not the role where you are most prepared today: ${name(rl)} is (${iv(rl['readiness'])}%). That is a trade-off to weigh, not a verdict.',
        'আপনার বর্তমান লক্ষ্য ${name(goal)} (${iv(goal['readiness'])}%) সেই রোল নয় যেখানে আজ আপনি সবচেয়ে প্রস্তুত: সেটি ${name(rl)} (${iv(rl['readiness'])}%)। এটি ভেবে দেখার বিষয়, কোনো রায় নয়।'));
  }

  // 4) readiness that rests on self-ratings
  final focus = goal ?? rl;
  final gap = iv(focus['readiness']) - iv(focus['provenReadiness']);
  if (gap >= 10) {
    lines.add(t('For ${name(focus)}, readiness is ${iv(focus['readiness'])}% but demonstrated readiness is ${iv(focus['provenReadiness'])}%: about $gap points rest on self-ratings or skills without quiz, project or endorsement proof.',
        '${name(focus)} রোলে প্রস্তুতি ${iv(focus['readiness'])}% কিন্তু প্রমাণিত প্রস্তুতি ${iv(focus['provenReadiness'])}%: প্রায় $gap পয়েন্ট নিজের দেওয়া রেটিং বা প্রমাণহীন দক্ষতার ওপর নির্ভর করছে।'));
  }

  // cautions: say plainly what the numbers are built on
  final thin = [for (final r in roles) if ((r['postings'] as Map?)?['small'] == true) name(r)];
  if (thin.isNotEmpty) {
    cautions.add(t('${thin.join(', ')}: fewer than 3 approved postings in this app match, so skill priorities fall back to the role-template requirements instead of employer demand.',
        '${thin.join(', ')}: এই অ্যাপে অনুমোদিত মিলে যাওয়া পোস্টিং ৩টির কম, তাই দক্ষতার অগ্রাধিকার নিয়োগকর্তার চাহিদার বদলে রোলের নির্ধারিত চাহিদা থেকে নেওয়া হয়েছে।'));
  }
  if (weeklyHours == null) {
    cautions.add(t('No weekly study hours are saved, so only hours are shown, not weeks.', 'সাপ্তাহিক পড়ার ঘণ্টা সংরক্ষিত নেই, তাই সপ্তাহ নয়, শুধু ঘণ্টা দেখানো হচ্ছে।'));
  }
  return LabSummary(lines, cautions);
}
