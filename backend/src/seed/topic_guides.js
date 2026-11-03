// In-app reading for roadmap topics. Short notes so a student can start studying inside the app, plus links chosen for THAT topic.
// Looked up by "skillKey|English topic title". Topics without an entry get a generic checklist and video-search links (see guideFor).
// Links are public, free pages. Open each once before demo day; students can report a broken link from the topic screen.
const W3 = 'https://www.w3schools.com/sql/';
const PY = 'https://docs.python.org/3/tutorial/';
const L = (title, url, lang = 'en') => ({ title, url, language: lang });

const G = {
  // ---------------- SQL ----------------
  'sql|What a database, table, row and column are': {
    notes: ['A database is an organised store of data. A table is one list of one kind of thing, e.g. students.', 'A row is one record (one student). A column is one fact about every record (name, batch, CGPA).', 'A primary key is a column whose value is different for every row, like a student ID.', 'SQL is the language you use to ask a database questions.'],
    example: 'students\nid | name   | batch\n1  | Rahim  | 2023\n2  | Nusrat | 2022',
    links: [L('SQL Intro (W3Schools)', W3 + 'sql_intro.asp'), L('Kaggle Learn: Intro to SQL', 'https://www.kaggle.com/learn/intro-to-sql')],
  },
  'sql|SELECT, WHERE, ORDER BY, LIMIT': {
    notes: ['SELECT picks columns. FROM says which table.', 'WHERE keeps only rows that match a condition (=, >, <, LIKE, IN, AND, OR).', 'ORDER BY sorts. Add DESC for biggest first.', 'LIMIT keeps only the first N rows.', 'Order you write them: SELECT, FROM, WHERE, ORDER BY, LIMIT.'],
    example: "SELECT name, cgpa\nFROM students\nWHERE batch = 2023 AND cgpa >= 3.5\nORDER BY cgpa DESC\nLIMIT 5;",
    links: [L('SQL SELECT (W3Schools)', W3 + 'sql_select.asp'), L('SQL WHERE (W3Schools)', W3 + 'sql_where.asp'), L('SQLBolt lesson 1: SELECT', 'https://sqlbolt.com/lesson/select_queries_introduction'), L('SQLBolt: filtering with constraints', 'https://sqlbolt.com/lesson/select_queries_with_constraints')],
  },
  'sql|COUNT, SUM, AVG, GROUP BY': {
    notes: ['COUNT(*) counts rows. SUM, AVG, MIN, MAX work on a number column.', 'GROUP BY splits rows into groups, then the aggregate runs once per group.', 'Every column in SELECT must be either in GROUP BY or inside an aggregate.', 'WHERE filters rows before grouping.'],
    example: "SELECT department, COUNT(*) AS students, AVG(cgpa) AS avg_cgpa\nFROM students\nGROUP BY department;",
    links: [L('COUNT, AVG, SUM (W3Schools)', W3 + 'sql_count_avg_sum.asp'), L('GROUP BY (W3Schools)', W3 + 'sql_groupby.asp'), L('SQLBolt: aggregates', 'https://sqlbolt.com/lesson/select_queries_with_aggregates')],
  },
  'sql|INNER and LEFT JOIN': {
    notes: ['A JOIN puts columns from two tables side by side, matching rows on a shared key.', 'INNER JOIN keeps only rows that have a match in both tables.', 'LEFT JOIN keeps every row of the left table, with NULL where there is no match. Use it to find "who has no orders".', 'Always say ON a.key = b.key. Forget it and you get every combination.'],
    example: "SELECT s.name, o.total\nFROM students s\nLEFT JOIN orders o ON o.student_id = s.id\nWHERE o.id IS NULL;   -- students with no orders",
    links: [L('INNER JOIN (W3Schools)', W3 + 'sql_join_inner.asp'), L('LEFT JOIN (W3Schools)', W3 + 'sql_join_left.asp'), L('SQLBolt: JOINs', 'https://sqlbolt.com/lesson/select_queries_with_joins'), L('SQLBolt: outer joins', 'https://sqlbolt.com/lesson/select_queries_with_outer_joins')],
  },
  'sql|HAVING, subqueries, CASE': {
    notes: ['HAVING filters groups after GROUP BY (WHERE cannot use aggregates).', 'A subquery is a query inside another query, often in WHERE ... IN (SELECT ...).', 'CASE WHEN makes a new column from rules, like an if/else.'],
    example: "SELECT department, AVG(cgpa) AS avg_cgpa,\n  CASE WHEN AVG(cgpa) >= 3.5 THEN 'High' ELSE 'Normal' END AS band\nFROM students\nGROUP BY department\nHAVING COUNT(*) >= 10;",
    links: [L('HAVING (W3Schools)', W3 + 'sql_having.asp'), L('CASE (W3Schools)', W3 + 'sql_case.asp'), L('IN / subqueries (W3Schools)', W3 + 'sql_in.asp')],
  },
  'sql|Create tables, INSERT, UPDATE, keys': {
    notes: ['CREATE TABLE defines columns and types (INT, TEXT, DATE).', 'INSERT adds rows. UPDATE changes rows. DELETE removes rows. Always add WHERE to UPDATE and DELETE.', 'PRIMARY KEY identifies a row. FOREIGN KEY points to a row in another table.'],
    example: "CREATE TABLE orders (\n  id INTEGER PRIMARY KEY,\n  student_id INTEGER REFERENCES students(id),\n  total INTEGER\n);\nINSERT INTO orders (student_id, total) VALUES (1, 500);\nUPDATE orders SET total = 550 WHERE id = 1;",
    links: [L('CREATE TABLE (W3Schools)', W3 + 'sql_create_table.asp'), L('INSERT INTO (W3Schools)', W3 + 'sql_insert.asp'), L('UPDATE (W3Schools)', W3 + 'sql_update.asp'), L('Primary key (W3Schools)', W3 + 'sql_primarykey.asp'), L('Foreign key (W3Schools)', W3 + 'sql_foreignkey.asp')],
  },
  'sql|Window functions (RANK, running total)': {
    notes: ['A window function calculates across related rows but keeps every row (unlike GROUP BY).', 'OVER (PARTITION BY x ORDER BY y) defines the window: PARTITION is the group, ORDER BY the order inside it.', 'RANK / ROW_NUMBER number rows inside each partition. SUM(...) OVER (ORDER BY date) gives a running total.', 'LAG and LEAD read the previous or next row, good for month-to-month change.'],
    example: "SELECT name, department, cgpa,\n  RANK() OVER (PARTITION BY department ORDER BY cgpa DESC) AS dept_rank,\n  SUM(cgpa) OVER (ORDER BY id) AS running_total\nFROM students;",
    links: [L('Kaggle: Advanced SQL (analytic functions)', 'https://www.kaggle.com/learn/advanced-sql'), L('PostgreSQL: window functions tutorial', 'https://www.postgresql.org/docs/current/tutorial-window.html')],
  },
  'sql|Indexes and reading a query plan': {
    notes: ['An index is like a book index: the database finds rows without reading the whole table.', 'Index the columns you often filter or join on. Too many indexes slow down INSERT and UPDATE.', 'EXPLAIN shows how the database will run a query. "Seq Scan" or "full table scan" on a big table is a warning sign.'],
    example: "CREATE INDEX idx_students_batch ON students(batch);\nEXPLAIN SELECT * FROM students WHERE batch = 2023;",
    links: [L('CREATE INDEX (W3Schools)', W3 + 'sql_create_index.asp'), L('Use The Index, Luke (free book)', 'https://use-the-index-luke.com/'), L('PostgreSQL: using EXPLAIN', 'https://www.postgresql.org/docs/current/using-explain.html')],
  },
  'sql|Mini project: answer 10 business questions': {
    notes: ['Pick a free sample database (for example a shop with customers, orders, products).', 'Write 10 questions a manager would ask, e.g. "Top 5 products by revenue this month".', 'Answer each with one query. Save the question, the query and a one-line answer.', 'Put it on GitHub as a README. This is the proof a mentor or employer can check.'],
    links: [L('Kaggle datasets', 'https://www.kaggle.com/datasets'), L('SQLBolt: more practice', 'https://sqlbolt.com/'), L('GitHub: create a repository', 'https://docs.github.com/en/repositories/creating-and-managing-repositories/quickstart-for-repositories')],
  },

  // ---------------- Python ----------------
  'python|Install Python, variables, types, input/output': {
    notes: ['Install from python.org, then run "python --version" in a terminal.', 'A variable is a name for a value: age = 21. Types: int, float, str, bool.', 'print() shows output. input() reads text from the user (always a string, so convert with int()).', 'Use f-strings to build text: f"Hello {name}".'],
    example: 'name = input("Name: ")\nage = int(input("Age: "))\nprint(f"{name} will be {age + 1} next year")',
    links: [L('Download Python', 'https://www.python.org/downloads/'), L('Python tutorial: an informal introduction', PY + 'introduction.html'), L('Kaggle Learn: Python', 'https://www.kaggle.com/learn/python')],
  },
  'python|if/else, loops, functions': {
    notes: ['if / elif / else choose a path. Indentation (4 spaces) is part of the syntax.', 'for loops go through a list or range(). while loops repeat until a condition is false.', 'A function groups steps: def area(w, h): return w * h. Use return to give a value back.'],
    example: 'def grade(score):\n    if score >= 80:\n        return "A"\n    elif score >= 60:\n        return "B"\n    return "C"\n\nfor s in [92, 71, 45]:\n    print(s, grade(s))',
    links: [L('Python tutorial: control flow', PY + 'controlflow.html'), L('Python For Loops (W3Schools)', 'https://www.w3schools.com/python/python_for_loops.asp'), L('Python Functions (W3Schools)', 'https://www.w3schools.com/python/python_functions.asp')],
  },
  'python|Lists, dictionaries, tuples, files': {
    notes: ['List: ordered and changeable, [1, 2, 3]. Dictionary: key to value, {"name": "Rahim"}. Tuple: ordered, fixed.', 'List comprehension builds a list in one line: [x * 2 for x in nums].', 'Read a file safely with: with open("a.txt") as f: for line in f: ...'],
    example: 'scores = {"Rahim": 78, "Nusrat": 91}\ntop = max(scores, key=scores.get)\nprint(top)\n\nwith open("scores.txt", "w") as f:\n    for n, s in scores.items():\n        f.write(f"{n},{s}\\n")',
    links: [L('Python tutorial: data structures', PY + 'datastructures.html'), L('Reading and writing files', PY + 'inputoutput.html')],
  },
  'python|Modules, virtual environments, errors': {
    notes: ['import brings in code from a module: import math, from random import choice.', 'A virtual environment keeps each project\'s packages separate: python -m venv .venv, then activate it and pip install.', 'try / except handles errors without crashing. Catch the specific error, not everything.'],
    example: 'try:\n    n = int(input("Number: "))\nexcept ValueError:\n    print("That is not a number")',
    links: [L('Python tutorial: modules', PY + 'modules.html'), L('Virtual environments', PY + 'venv.html'), L('Errors and exceptions', PY + 'errors.html')],
  },
  'python|pandas: load, clean, group data': {
    notes: ['pandas holds tables as a DataFrame. pd.read_csv("file.csv") loads one.', 'Look first: df.head(), df.info(), df.describe().', 'Clean: df.dropna(), df.fillna(0), df.drop_duplicates(), df["col"].astype(int).', 'Summarise: df.groupby("dept")["cgpa"].mean().'],
    example: 'import pandas as pd\ndf = pd.read_csv("students.csv")\nprint(df.groupby("department")["cgpa"].mean().sort_values(ascending=False))',
    links: [L('pandas: 10 minutes to pandas', 'https://pandas.pydata.org/docs/user_guide/10min.html'), L('Kaggle Learn: Pandas', 'https://www.kaggle.com/learn/pandas')],
  },
  'python|Charts with matplotlib': {
    notes: ['Import with: import matplotlib.pyplot as plt.', 'plt.plot for lines, plt.bar for bars, plt.hist for distributions.', 'Always add a title and axis labels, then plt.show().'],
    example: 'import matplotlib.pyplot as plt\nplt.bar(["Mon", "Tue", "Wed"], [4, 7, 5])\nplt.title("Hours studied")\nplt.ylabel("Hours")\nplt.show()',
    links: [L('Matplotlib quick start', 'https://matplotlib.org/stable/users/explain/quick_start.html'), L('Kaggle Learn: Data Visualization', 'https://www.kaggle.com/learn/data-visualization')],
  },
  'python|Read from an API or database': {
    notes: ['An API returns data (usually JSON) from a URL. The requests library fetches it.', 'Always check response.status_code and use timeout=.', 'For a database, sqlite3 comes with Python and needs no setup.'],
    example: 'import requests\nr = requests.get("https://api.github.com/users/octocat", timeout=10)\nr.raise_for_status()\nprint(r.json()["public_repos"])',
    links: [L('Requests quickstart', 'https://requests.readthedocs.io/en/latest/user/quickstart/'), L('sqlite3 in Python', 'https://docs.python.org/3/library/sqlite3.html')],
  },
  'python|Testing with pytest': {
    notes: ['A test is a small function that checks your code gives the right answer.', 'Name files test_*.py and functions test_*. Use plain assert.', 'Run with: pytest. Test normal cases and edge cases (empty list, zero).'],
    example: '# test_grade.py\nfrom grade import grade\n\ndef test_top():\n    assert grade(92) == "A"\n\ndef test_low():\n    assert grade(10) == "C"',
    links: [L('pytest: getting started', 'https://docs.pytest.org/en/stable/getting-started.html')],
  },
  'python|Mini project: analyse a public dataset': {
    notes: ['Pick a small CSV from Kaggle or data.gov. Write 3 questions first.', 'Load with pandas, clean it, answer each question with a table or chart.', 'Write a README: the question, what you did, what you found, what you would do next.', 'Publish to GitHub and send the link to a mentor.'],
    links: [L('Kaggle datasets', 'https://www.kaggle.com/datasets'), L('GitHub quickstart', 'https://docs.github.com/en/repositories/creating-and-managing-repositories/quickstart-for-repositories')],
  },

  // ---------------- Excel ----------------
  'excel|Cells, formats, sorting and filtering': {
    notes: ['Keep data as a clean table: one header row, one record per row, no blank rows or merged cells.', 'Format numbers and dates properly (Home > Number).', 'Sort and Filter (Data tab) let you reorder or hide rows without deleting anything.', 'Ctrl+T turns a range into a Table that grows automatically.'],
    links: [L('Excel help and learning (Microsoft)', 'https://support.microsoft.com/en-us/excel')],
  },
  'excel|Basic formulas: SUM, AVERAGE, IF': {
    notes: ['A formula starts with =. =SUM(B2:B10) adds a range, =AVERAGE(B2:B10) gives the mean.', 'IF decides: =IF(C2>=60,"Pass","Fail").', 'Use $ to lock a reference when copying a formula: $B$1.'],
    example: '=SUM(B2:B10)\n=AVERAGE(B2:B10)\n=IF(C2>=60,"Pass","Fail")',
    links: [L('SUM function (Exceljet)', 'https://exceljet.net/functions/sum-function'), L('IF function (Exceljet)', 'https://exceljet.net/functions/if-function')],
  },
  'excel|VLOOKUP / XLOOKUP, SUMIF, COUNTIF': {
    notes: ['XLOOKUP finds a value in one column and returns the matching value from another: =XLOOKUP(A2, Ids, Names).', 'VLOOKUP does the same from the left-most column. Use FALSE for an exact match.', 'SUMIF adds numbers that meet a condition. COUNTIF counts cells that meet one.'],
    example: '=XLOOKUP(A2, Students[ID], Students[Name], "Not found")\n=SUMIF(B:B, "Dhaka", C:C)\n=COUNTIF(B:B, "Dhaka")',
    links: [L('XLOOKUP (Exceljet)', 'https://exceljet.net/functions/xlookup-function'), L('VLOOKUP (Exceljet)', 'https://exceljet.net/functions/vlookup-function'), L('SUMIF (Exceljet)', 'https://exceljet.net/functions/sumif-function'), L('COUNTIF (Exceljet)', 'https://exceljet.net/functions/countif-function')],
  },
  'excel|PivotTables and slicers': {
    notes: ['A PivotTable summarises a big table in seconds: drag fields into Rows, Columns and Values.', 'Insert > PivotTable, pick your table, then drag. Change Sum to Count or Average in Value Field Settings.', 'A slicer is a button filter you add with PivotTable Analyze > Insert Slicer.', 'Refresh after the data changes.'],
    links: [L('Create a PivotTable (Microsoft)', 'https://support.microsoft.com/en-us/office/create-a-pivottable-to-analyze-worksheet-data-a9a84538-bfe9-40a9-a8e9-f99134456576')],
  },
};

const enc = encodeURIComponent;
function guideFor(skillKey, titleEn) {
  const g = G[`${skillKey}|${titleEn}`];
  const search = [
    L(`Search video: ${titleEn}`, `https://www.youtube.com/results?search_query=${enc(titleEn + ' tutorial')}`),
    L(`Search video (Bangla): ${titleEn}`, `https://www.youtube.com/results?search_query=${enc(titleEn + ' bangla tutorial')}`, 'bn'),
  ];
  if (g) return { notes: g.notes, example: g.example || null, links: [...g.links, ...search], curated: true };
  return {
    notes: [
      `Goal: be able to explain "${titleEn}" in your own words and use it once on a small example.`,
      'Step 1: watch or read one short beginner explanation (use the links below).',
      'Step 2: write 3 lines of notes without looking.',
      'Step 3: do one small practice task. Do not move on until it works.',
      'Step 4: tick the topic only when you could teach it to a friend.',
    ],
    example: null, links: search, curated: false,
  };
}
module.exports = { guideFor, GUIDES: G };
