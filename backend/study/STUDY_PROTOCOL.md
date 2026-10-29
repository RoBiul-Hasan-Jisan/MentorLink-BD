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

## Version 2: blinded A/B against the keyword baseline (use this one)
The first version only rates MentorLink's own top 5, so it cannot show the weighted model beats a simple keyword search. Version 2 can.
1. Students sign in, set a career goal, open **Mentors** once (this saves their top 5), and agree to take part.
2. Export: `node study/export-sheet-ab.js --students a@uni.edu,b@uni.edu > study/ratings_blind.csv`. Each student gets the SAME pool: MentorLink's top 5 plus the baseline's top 5, duplicates removed, shuffled, shown as neutral profile cards (no scores, no "why this mentor"). Students therefore cannot tell which method picked whom.
3. Each student rates every mentor in their pool (`rating` 1-5 and `would_request` yes/no) and the file is saved as `study/ratings_filled.csv`.
4. Analyse: `node study/analyze-ab.js study/ratings_filled.csv study/ab-key.private.json`. It reports, per method, rank-1 good rate, precision@3, mean rating, would-request rate and nDCG@5, plus the paired difference (system minus baseline) with a 95% interval and how many students favoured each method. Students with any unrated mentor are excluded, not guessed.
5. Read it honestly: if the interval for a difference includes 0, this pilot cannot tell the methods apart. Report that as it is.
Notes: the baseline breaks ties by mentor id so it is repeatable; the seed used for shuffling is stored in the key file; `ab-key.private.json` and the sheets are git-ignored.

### Test the pipeline first (demo data, no real people)
- `npm run seed:demo` now also creates 13 more demo mentors (23 verified in total): several per career goal, different industries, and a "keyword decoy" (title "Data Entry Analyst" with weak skills). It also fixes demo mentors whose capacity was lower than their accepted count, so they can receive requests.
- `npm run study:dryrun` (no database needed) runs the real matching code on 24 invented students, builds the blind sheet, simulates ratings with a made-up rater model, and prints the analysis. Files go to `study/demo-output/` (git-ignored).
- The dry-run numbers are NOT a result. The simulated rater looks at profile fit, which is close to what the system itself uses, so it favours the system by construction. Use it only to check that the sheet, the key and the report work. Never put those numbers in your report or slides.
