# Mentor-match accuracy study (pilot protocol)

**Goal:** find out whether students agree with the mentors MentorLink BD ranks for them. This is how we replace "we think it works" with a number.

## Who and how many
- Ask 20 or more students (more is better) from at least two departments. Say how you picked them (for example "volunteers from CSE 464 and BBA").
- 5 or more mentors in the database with different roles, so the ranking has something to choose between.
- Each student gets a career goal set in the app, so they see their own top 5 matches.

## Steps
1. Students sign in, set a career goal and weekly hours, and open **Mentors**. The app saves the top 5 for each.
2. Export an anonymous sheet: `node study/export-sheet.js > study/ratings.csv`. It uses codes (S01, M03). Keep `study/codes.private.json` private; never commit it.
3. Each student reads the "Why this mentor" text and fills in their rows:
   - `rating`: 1 (poor fit) to 5 (excellent fit)
   - `would_request`: yes or no ("would you send this mentor a request?")
4. Run `node study/analyze.js study/ratings.csv`.

## What the numbers mean
- **Mean rating** with a 95% interval: overall satisfaction with the top 5.
- **Rank-1 good rate:** share of students who rated their first match 4 or 5.
- **Precision@3:** share of the top 3 rated 4 or 5.
- **Mean Spearman:** does a higher system score go with a higher rating? Near 1 = yes, near 0 = no relationship.
- **Would request rate:** the most practical signal.

## What you may and may not claim
- You may say: "In a pilot with N students, X% rated their top match 4 or 5."
- You may not say the algorithm is "accurate" in general, or better than other methods, unless you also rate a comparison list (for example the keyword baseline the API returns as `baseline`) and show it scores lower.
- Rating a recommendation is not the same as the mentoring being good. Do not claim outcomes (jobs, grades) from this study.
- Students rate people they know are shown by the system, so expect some bias toward kindness. Say so in your report.

## Ethics
- Ask for consent. Use codes, not names. Share only aggregate results.
