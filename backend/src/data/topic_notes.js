// In-app reading material for every roadmap topic, so a student can learn INSIDE the app and tick a topic where they study it.
// Layout: NOTES[skillKey][stageIndex][topicIndex], the same order as DATA in ../seed/roadmaps.js (tests/roadmap_notes.test.js checks the shapes match).
//   s  = short explanation (what it is, why it matters)
//   k  = "I can ..." checklist. When a student ticks every line the app marks the topic done.
//   ex = optional tiny example (code or a worked line)
//   l  = optional deep links [label, url]. Only pages that are known to exist; every topic also gets generic search links from topicLinks().
// English only for now. The app falls back to English when a Bangla text is missing.
const t = (s, k, extra = {}) => ({ s, k, ...extra });

const NOTES = {
  sql: [
    [
      t('A database stores information in tables. A table is like a spreadsheet: each column is one kind of fact (name, price), each row is one thing (one student, one order). SQL is the language you use to ask a database questions.',
        ['I can explain table, row, column and primary key in my own words', 'I can look at a table and say what one row means', 'I know SQL asks questions, it does not change the data when I only read'],
        { l: [['W3Schools: SQL intro', 'https://www.w3schools.com/sql/sql_intro.asp'], ['SQLBolt: lesson 1', 'https://sqlbolt.com/lesson/select_queries_introduction']] }),
      t('SELECT chooses columns, WHERE keeps only the rows you want, ORDER BY sorts, LIMIT stops after N rows. 80% of everyday analyst work is these four words.',
        ['I can pick two columns from a table', 'I can filter rows with =, >, AND, OR, IN and LIKE', 'I can sort newest-first and keep the top 10'],
        { ex: "SELECT name, salary\nFROM employees\nWHERE department = 'Sales' AND salary > 30000\nORDER BY salary DESC\nLIMIT 10;",
          l: [['W3Schools: SELECT', 'https://www.w3schools.com/sql/sql_select.asp'], ['W3Schools: WHERE', 'https://www.w3schools.com/sql/sql_where.asp'], ['SQLBolt: constraints', 'https://sqlbolt.com/lesson/select_queries_with_constraints'], ['SQLBolt: sorting', 'https://sqlbolt.com/lesson/filtering_sorting_query_results']] }),
      t('Aggregate functions turn many rows into one number: COUNT, SUM, AVG, MIN, MAX. GROUP BY does it once per group, for example sales per city.',
        ['I can count rows and sum a column', 'I can get one result per group with GROUP BY', 'I know every non-aggregated column must appear in GROUP BY'],
        { ex: 'SELECT city, COUNT(*) AS orders, SUM(total) AS revenue\nFROM orders\nGROUP BY city;',
          l: [['W3Schools: COUNT, AVG, SUM', 'https://www.w3schools.com/sql/sql_count_avg_sum.asp'], ['W3Schools: GROUP BY', 'https://www.w3schools.com/sql/sql_groupby.asp'], ['SQLBolt: aggregates', 'https://sqlbolt.com/lesson/select_queries_with_aggregates']] }),
    ],
    [
      t('Real data lives in several tables linked by ids. INNER JOIN keeps only rows that match on both sides. LEFT JOIN keeps every row from the left table, even with no match (the missing side is NULL).',
        ['I can join two tables on an id', 'I can explain when a LEFT JOIN returns NULL', 'I can find customers with no orders using LEFT JOIN ... WHERE o.id IS NULL'],
        { ex: 'SELECT c.name, o.total\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id;',
          l: [['W3Schools: JOIN', 'https://www.w3schools.com/sql/sql_join.asp'], ['W3Schools: LEFT JOIN', 'https://www.w3schools.com/sql/sql_join_left.asp'], ['SQLBolt: joins', 'https://sqlbolt.com/lesson/select_queries_with_joins']] }),
      t('HAVING filters groups after GROUP BY (WHERE filters rows before). A subquery is a query inside a query. CASE is if/else inside SQL.',
        ['I know WHERE is before grouping and HAVING is after', 'I can write a subquery in WHERE', 'I can label rows with CASE WHEN ... THEN ... END'],
        { ex: "SELECT city, COUNT(*) AS n\nFROM orders\nGROUP BY city\nHAVING COUNT(*) > 100;\n\nSELECT name,\n  CASE WHEN salary >= 50000 THEN 'high' ELSE 'normal' END AS band\nFROM employees;",
          l: [['W3Schools: HAVING', 'https://www.w3schools.com/sql/sql_having.asp'], ['W3Schools: CASE', 'https://www.w3schools.com/sql/sql_case.asp']] }),
      t('You can also build data. CREATE TABLE defines columns and types, INSERT adds rows, UPDATE changes rows (always with WHERE!). A primary key identifies a row; a foreign key points to a row in another table.',
        ['I can create a table with a primary key', 'I can INSERT and UPDATE a row safely with WHERE', 'I can explain a foreign key with an example'],
        { ex: "CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT NOT NULL, dept TEXT);\nINSERT INTO students (name, dept) VALUES ('Rahim', 'CSE');\nUPDATE students SET dept = 'EEE' WHERE id = 1;",
          l: [['W3Schools: CREATE TABLE', 'https://www.w3schools.com/sql/sql_create_table.asp'], ['W3Schools: INSERT', 'https://www.w3schools.com/sql/sql_insert.asp'], ['W3Schools: UPDATE', 'https://www.w3schools.com/sql/sql_update.asp'], ['W3Schools: keys', 'https://www.w3schools.com/sql/sql_primarykey.asp']] }),
    ],
    [
      t('A window function calculates across related rows without collapsing them. RANK() orders rows inside a group; SUM() OVER (ORDER BY ...) gives a running total.',
        ['I can rank rows inside each group with PARTITION BY', 'I can write a running total', 'I know the difference between RANK and ROW_NUMBER'],
        { ex: 'SELECT name, dept, salary,\n  RANK() OVER (PARTITION BY dept ORDER BY salary DESC) AS rank_in_dept,\n  SUM(salary) OVER (ORDER BY id) AS running_total\nFROM employees;',
          l: [['PostgreSQL: window functions tutorial', 'https://www.postgresql.org/docs/current/tutorial-window.html']] }),
      t('An index is like a book index: the database finds rows without reading the whole table. EXPLAIN shows the plan the database will use. Look for full table scans on big tables.',
        ['I can say what an index is and its cost (slower writes, more space)', 'I can run EXPLAIN on a query', 'I can tell a full scan from an index scan'],
        { ex: 'CREATE INDEX idx_orders_customer ON orders (customer_id);\nEXPLAIN SELECT * FROM orders WHERE customer_id = 42;',
          l: [['PostgreSQL: indexes', 'https://www.postgresql.org/docs/current/indexes-intro.html'], ['PostgreSQL: using EXPLAIN', 'https://www.postgresql.org/docs/current/using-explain.html']] }),
      t('Practice project: take one small dataset (for example a public sales or school dataset) and answer 10 real business questions with SQL. Save each question and its query in a README so a mentor can review it.',
        ['I wrote 10 questions in plain words', 'Each question has a working query and the result', 'My README is online (GitHub) and I can send the link to a mentor']),
    ],
  ],

  excel: [
    [
      t('Keep data in a clean table: one header row, one fact per column, no blank rows or merged cells. Then sorting and filtering just work.',
        ['I can format numbers, dates and currency', 'I can sort and filter a table', 'I know why merged cells break tables']),
      t('A formula starts with =. SUM adds, AVERAGE averages, IF chooses between two results.',
        ['I can use SUM and AVERAGE on a range', 'I can write =IF(B2>=40,"Pass","Fail")', 'I understand relative (A1) and absolute ($A$1) references'],
        { ex: '=SUM(B2:B20)\n=AVERAGE(B2:B20)\n=IF(B2>=40,"Pass","Fail")' }),
      t('Pick the chart by the question: compare categories = bar, change over time = line, parts of a whole (few parts) = pie or stacked bar. Label axes and avoid 3D.',
        ['I can make a bar and a line chart', 'I can say which chart fits which question', 'I add a title and axis labels']),
    ],
    [
      t('Lookups fetch a value from another table. XLOOKUP is the modern one. SUMIF and COUNTIF add or count only rows that match a condition.',
        ['I can look up a price by product id', 'I can use SUMIF for total sales of one region', 'I know what #N/A means in a lookup'],
        { ex: '=XLOOKUP(A2, Products!A:A, Products!C:C, "not found")\n=SUMIF(C:C, "Dhaka", E:E)\n=COUNTIF(C:C, "Dhaka")' }),
      t('A PivotTable summarises thousands of rows in seconds: drag fields into Rows, Columns and Values. Slicers are click-filters on top.',
        ['I can build a PivotTable of sales by month', 'I can add a slicer', 'I can refresh it after the data changes']),
      t('Messy data is normal. TRIM removes extra spaces, LEFT/MID/RIGHT cut text, Remove Duplicates removes repeated rows.',
        ['I can clean extra spaces with TRIM', 'I can split a full name into two columns', 'I can remove duplicates and say how many I removed']),
    ],
    [
      t('Conditional formatting colours cells by rule (for example, red if below target). Data validation limits what can be typed (drop-down lists).',
        ['I can highlight values below a target', 'I can make a drop-down list', 'I can explain why validation prevents wrong data']),
      t('A dashboard is one sheet that answers a few questions: KPI numbers at the top, two or three charts, one filter. Remove everything that does not help a decision.',
        ['I can build 3 KPI cells and 2 charts from a PivotTable', 'I can connect one slicer to both charts', 'My dashboard fits on one screen']),
      t('Practice project: build a monthly sales report from a raw sheet: clean, pivot, chart, and write 3 sentences that tell the story.',
        ['The raw data is cleaned', 'The report has a pivot, a chart and 3 insights', 'I can present it in 2 minutes']),
    ],
  ],

  python: [
    [
      t('Install Python, then learn variables (names for values), types (int, float, str, bool) and input()/print().',
        ['I can run a .py file', 'I can read a number from the user and print a result', 'I know the difference between int and str'],
        { ex: 'name = input("Your name: ")\nage = int(input("Age: "))\nprint("Hello", name, "next year you are", age + 1)',
          l: [['Python tutorial: an informal introduction', 'https://docs.python.org/3/tutorial/introduction.html']] }),
      t('if/elif/else makes decisions. for and while repeat work. A function packages steps with def and returns a value.',
        ['I can write an if/else', 'I can loop over a range and over a list', 'I can write a function that returns a value'],
        { ex: 'def grade(score):\n    if score >= 80:\n        return "A"\n    elif score >= 40:\n        return "Pass"\n    return "Fail"\n\nfor s in [90, 55, 20]:\n    print(s, grade(s))',
          l: [['Python tutorial: control flow', 'https://docs.python.org/3/tutorial/controlflow.html']] }),
      t('A list is an ordered collection, a dictionary maps keys to values, a tuple is a fixed list. You can read and write text files.',
        ['I can add to and loop over a list', 'I can count words with a dictionary', 'I can read a text file line by line'],
        { ex: 'counts = {}\nfor w in "to be or not to be".split():\n    counts[w] = counts.get(w, 0) + 1\nprint(counts)',
          l: [['Python tutorial: data structures', 'https://docs.python.org/3/tutorial/datastructures.html'], ['Python tutorial: files', 'https://docs.python.org/3/tutorial/inputoutput.html']] }),
    ],
    [
      t('A module is a file of code you import. A virtual environment keeps each project\'s packages separate. try/except handles errors without crashing.',
        ['I can import and use a module', 'I can create a venv and pip install a package', 'I can catch a ValueError'],
        { ex: 'python -m venv .venv\nsource .venv/bin/activate   # Windows: .venv\\Scripts\\activate\npip install pandas',
          l: [['Python tutorial: modules', 'https://docs.python.org/3/tutorial/modules.html'], ['Python tutorial: virtual environments', 'https://docs.python.org/3/tutorial/venv.html'], ['Python tutorial: errors', 'https://docs.python.org/3/tutorial/errors.html']] }),
      t('pandas is the main tool for tables in Python. A DataFrame is like a sheet: read a CSV, look at it, clean missing values, then group and summarise.',
        ['I can read a CSV into a DataFrame', 'I can filter rows and fix missing values', 'I can use groupby to get totals per category'],
        { ex: 'import pandas as pd\ndf = pd.read_csv("sales.csv")\nprint(df.groupby("city")["total"].sum().sort_values(ascending=False))',
          l: [['pandas: 10 minutes to pandas', 'https://pandas.pydata.org/docs/user_guide/10min.html']] }),
      t('matplotlib draws charts from your data. Always add a title, axis labels and units.',
        ['I can draw a bar and a line chart', 'I can label axes and save the chart as PNG', 'I can chart a pandas column'],
        { ex: 'import matplotlib.pyplot as plt\ndf.groupby("city")["total"].sum().plot(kind="bar")\nplt.title("Revenue by city"); plt.ylabel("Taka")\nplt.savefig("revenue.png")' }),
    ],
    [
      t('Real programs read data from APIs (JSON over HTTP) and databases. You send a request, get JSON, and turn it into a table.',
        ['I can call a public API with requests', 'I can read JSON into a DataFrame', 'I can query a SQLite database from Python']),
      t('pytest runs small checks for your code. A test calls a function and asserts the result. Tests protect you when you change code later.',
        ['I can write a test with assert', 'I can run pytest and read a failure', 'I can test a function with 3 inputs'],
        { ex: '# test_grade.py\nfrom grades import grade\n\ndef test_grade():\n    assert grade(90) == "A"\n    assert grade(10) == "Fail"',
          l: [['pytest: getting started', 'https://docs.pytest.org/en/stable/getting-started.html']] }),
      t('Practice project: pick a public dataset, clean it, find 3 findings, make 2 charts, and write a README. Publish it on GitHub.',
        ['The notebook or script runs from top to bottom', 'README explains the question, method and findings', 'The GitHub link is ready for a mentor']),
    ],
  ],

  statistics: [
    [
      t('Mean is the average, median is the middle value (not moved by outliers), mode is the most common. Range = max - min. Choose the median when a few huge values distort the mean (salaries!).',
        ['I can calculate mean and median by hand for 7 numbers', 'I can say when the median is better', 'I can find the range']),
      t('Variance and standard deviation measure how spread out values are. Small SD = values stay close to the mean.',
        ['I can explain standard deviation in one sentence', 'I know two datasets can share a mean but differ in spread', 'I can compute SD in Excel (STDEV.S) or Python']),
      t('A histogram shows the shape of one variable; a box plot shows median, quartiles and outliers.',
        ['I can read a histogram', 'I can spot an outlier on a box plot', 'I can choose histogram or box plot for a question']),
    ],
    [
      t('Probability is a number from 0 to 1. Many real measurements form a bell curve (normal distribution): about 68% of values lie within 1 SD of the mean and 95% within 2 SD.',
        ['I can compute a simple probability', 'I can explain the 68-95 rule', 'I can say what "independent events" means']),
      t('A sample is a small part used to learn about a population. A confidence interval gives a range likely to contain the true value. Bigger samples give narrower intervals.',
        ['I can explain sample vs population', 'I can read "95% confidence interval"', 'I can name one reason a sample can be biased']),
      t('Two things moving together (correlation) does not prove one causes the other. Look for a third factor or reverse direction.',
        ['I can give a real example of correlation without causation', 'I can read a correlation value from -1 to 1', 'I say "is associated with" instead of "causes" unless I tested it']),
    ],
    [
      t('A hypothesis test asks: if nothing were going on (the null hypothesis), how surprising is my result? The p-value is that surprise level. A small p-value (often below 0.05) is evidence against "nothing is going on". It is not the probability that you are right.',
        ['I can write a null and an alternative hypothesis', 'I can explain what a p-value is and is not', 'I can run a t-test in Excel or Python']),
      t('Simple linear regression draws the best straight line through points, y = a + b x. The slope b says how much y changes when x increases by one.',
        ['I can fit a line in Excel or Python', 'I can explain the slope in words', 'I know a line does not prove cause']),
      t('Practice project: write up one A/B test: question, groups, result, test, decision, limits. One page.',
        ['The write-up has a clear question and result', 'I state the limits honestly', 'A mentor or teacher has read it']),
    ],
  ],

  dashboard: [
    [
      t('Start with the question the viewer must answer ("Are sales on target?"), then pick the chart. A dashboard without a question becomes decoration.',
        ['I can write the question before I build', 'I can name who will use the dashboard and what they decide', 'I can remove one chart that answers no question']),
      t('Bar charts compare categories, line charts show time, tables are for exact numbers. Avoid pie charts with more than four parts.',
        ['I can pick bar, line or table for a given question', 'I can say why a 3D chart is a bad idea', 'I sort bars from largest to smallest']),
      t('A KPI card shows one important number with its target or change. Use colour only to mean something (red = off target).',
        ['I can design a KPI card with value, target and change', 'I use at most 2 or 3 colours with a meaning', 'I can explain each KPI in one sentence']),
    ],
    [
      t('Power BI and Looker Studio connect to Excel, CSV or a database. Load the data, check column types, and fix them before charting.',
        ['I connected a data source', 'I fixed column types (date, number, text)', 'I made my first chart']),
      t('A data model links tables by keys (for example Orders to Customers). Filters and slicers then work across all charts.',
        ['I can relate two tables', 'I can add a slicer that filters every chart', 'I can explain a one-to-many relationship']),
      t('A measure is a calculation done at report time (total sales, profit margin). In Power BI measures are written in DAX, for example Total Sales = SUM(Sales[Amount]).',
        ['I can write a SUM measure', 'I can write a ratio measure with DIVIDE', 'I can explain a measure vs a column'],
        { ex: 'Total Sales = SUM(Sales[Amount])\nMargin % = DIVIDE([Profit], [Total Sales])' }),
    ],
    [
      t('Good layout puts the most important number top-left. Axes should start at zero for bars. Add alt text and enough contrast.',
        ['I can spot a misleading axis', 'My dashboard is readable on a phone screen', 'I added titles that say the takeaway']),
      t('Publish and share with the right people. Set a scheduled refresh so the numbers are not stale.',
        ['I published a report', 'I set a refresh or know how', 'I can share a view-only link']),
      t('Practice project: a sales dashboard with a one-page story: what happened, why, what to do next.',
        ['Dashboard has 3 KPIs and 3 charts', 'A short story explains the findings', 'I can present it in 3 minutes']),
    ],
  ],

  communication: [
    [
      t('A good short email has a clear subject, the request in the first line, details after, and a polite close with the deadline. Write for someone reading on a phone.',
        ['I can write a 5-line email with one clear request', 'My subject line says what I need', 'I re-read for tone and spelling before sending']),
      t('Active listening means listening to understand, not to reply: look at the speaker, do not interrupt, then repeat back what you heard.',
        ['I can paraphrase what someone said', 'I ask one clarifying question', 'I do not interrupt']),
      t('A 60-second introduction: who you are, what you studied or built, what you want next. End with a question to start a conversation.',
        ['I wrote a 60-second introduction', 'I can say it without reading', 'I recorded myself once and improved it']),
    ],
    [
      t('STAR answers an interview question with a story: Situation, Task, Action, Result. Keep it to about two minutes and finish with what you learned.',
        ['I prepared 3 STAR stories (teamwork, problem, mistake)', 'Each has a measurable result', 'I can tell each in under 2 minutes']),
      t('Common questions: "Tell me about yourself", "Why this job?", "Your weakness?". Honest answers with a concrete example beat memorised ones.',
        ['I have an honest answer for each common question', 'I can explain a weakness and what I am doing about it', 'I researched the company before answering "Why us?"']),
      t('A one-page CV: contact line, short summary, education, projects with results, skills. No photo needed unless the job asks. Send as PDF.',
        ['My CV is one page', 'Each project says what I did and the result', 'A mentor reviewed it']),
    ],
    [
      t('Feedback works best when it is specific, about behaviour, and offered with a next step. When receiving it, listen first and say thank you.',
        ['I can give feedback using situation, behaviour, impact', 'I can receive feedback without arguing', 'I wrote one action from the last feedback I got']),
      t('Presenting: one idea per slide, tell the story (problem, solution, result), practice out loud, keep to the time.',
        ['I presented to a group at least once', 'My slides have little text', 'I kept within the time']),
      t('A mock interview with a mentor is the fastest way to improve. Ask them for three things to keep and three to change.',
        ['I booked a mock interview', 'I wrote down 3 keep and 3 change points', 'I practised the changes']),
    ],
  ],

  git: [
    [
      t('Git records snapshots of your project. git init starts a repo, git add chooses changes, git commit saves a snapshot, git status shows what changed, git log shows history.',
        ['I can create a repo and make 3 commits', 'I can read git status and git log', 'I can explain staging vs committing'],
        { ex: 'git init\ngit add .\ngit commit -m "Add first version"\ngit status\ngit log --oneline',
          l: [['Pro Git: getting a repository', 'https://git-scm.com/book/en/v2/Git-Basics-Getting-a-Git-Repository'], ['Pro Git: recording changes', 'https://git-scm.com/book/en/v2/Git-Basics-Recording-Changes-to-the-Repository']] }),
      t('.gitignore lists files Git must not track (passwords, .env, node_modules). A good commit message says what and why in one line.',
        ['I can create a .gitignore', 'I never commit passwords or keys', 'My messages start with a verb, for example "Fix login error"']),
    ],
    [
      t('A branch is a separate line of work. Create one per feature, then merge it back into main when ready.',
        ['I can create, switch and merge a branch', 'I can delete a merged branch', 'I can explain why branches avoid breaking main'],
        { ex: 'git switch -c add-search\n# ...work and commit...\ngit switch main\ngit merge add-search',
          l: [['Pro Git: basic branching and merging', 'https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging']] }),
      t('GitHub hosts your repo online. clone copies it, push uploads your commits, pull downloads others\' commits.',
        ['I pushed a repo to GitHub', 'I cloned a repo to a new folder', 'I can pull new changes'],
        { l: [['Pro Git: working with remotes', 'https://git-scm.com/book/en/v2/Git-Basics-Working-with-Remotes']] }),
      t('A merge conflict happens when two people change the same lines. Git marks both versions; you choose what stays, then commit.',
        ['I created and resolved a conflict on purpose', 'I can read the <<<<<<< markers', 'I know to test after resolving']),
    ],
    [
      t('A pull request asks teammates to review your branch before it joins main. Reviewers comment; you fix and push again.',
        ['I opened a pull request', 'I gave one useful review comment', 'I know to keep PRs small']),
      t('stash parks unfinished work, rebase replays your commits on top of a newer base, and reset/revert undo mistakes. Never rewrite history that others already pulled.',
        ['I can stash and restore changes', 'I can undo my last commit safely (revert or reset --soft)', 'I know why not to force-push shared branches'],
        { l: [['Pro Git: undoing things', 'https://git-scm.com/book/en/v2/Git-Basics-Undoing-Things'], ['Pro Git: stashing', 'https://git-scm.com/book/en/v2/Git-Tools-Stashing-and-Cleaning'], ['Pro Git: rebasing', 'https://git-scm.com/book/en/v2/Git-Branching-Rebasing']] }),
    ],
  ],

  dsa: [
    [
      t('Big-O describes how work grows when input grows. O(1) is constant, O(log n) is very fast growth, O(n) is a single pass, O(n log n) is good sorting, O(n^2) is a loop inside a loop.',
        ['I can say the Big-O of a single loop and a nested loop', 'I can compare two solutions by Big-O', 'I know constant factors are ignored']),
      t('Arrays give fast access by index. Strings are arrays of characters. A hash map (dict) stores key-value pairs with fast lookup. Many interview problems become easy with a hash map.',
        ['I can solve Two Sum with a hash map', 'I can reverse and check a palindrome string', 'I can count frequencies with a dict'],
        { ex: 'def two_sum(nums, target):\n    seen = {}\n    for i, x in enumerate(nums):\n        if target - x in seen:\n            return [seen[target - x], i]\n        seen[x] = i' }),
      t('A stack is last-in-first-out (undo button). A queue is first-in-first-out (waiting line).',
        ['I can implement a stack and a queue', 'I can check balanced brackets with a stack', 'I can name a real use of each']),
    ],
    [
      t('A linked list is a chain of nodes. Recursion is a function calling itself with a smaller problem; it needs a base case.',
        ['I can reverse a linked list', 'I can write factorial and Fibonacci recursively', 'I can find the base case of a recursive function']),
      t('A tree has a root and children. A binary search tree keeps smaller values left and larger right, so search is O(log n) when balanced. Binary search works on a sorted array by halving the range.',
        ['I can write binary search', 'I can traverse a tree in order', 'I can explain why a BST is fast to search']),
      t('Know bubble/insertion sort (simple), then merge sort and quicksort (O(n log n)). In real code use the built-in sort.',
        ['I can write insertion sort', 'I can explain merge sort in words', 'I know Python\'s sorted() is O(n log n)']),
    ],
    [
      t('A graph is nodes with edges (a map of roads). BFS explores level by level (shortest path in unweighted graphs). DFS goes deep first.',
        ['I can build a graph with an adjacency list', 'I can write BFS and DFS', 'I can find the shortest path in a grid with BFS']),
      t('Dynamic programming solves a problem by storing answers to smaller overlapping problems so each is computed once (memoization).',
        ['I can solve Fibonacci with memoization', 'I can solve climbing stairs or coin change', 'I can say what "overlapping subproblems" means']),
      t('Practice: solve 30 mixed problems over a few weeks. After each one write the idea in one line and its Big-O.',
        ['I solved 30 problems', 'I wrote my approach for each', 'I can solve an easy problem in 20 minutes'],
        { l: [['VisuAlgo', 'https://visualgo.net/']] }),
    ],
  ],

  backend: [
    [
      t('The web runs on HTTP: a client sends a request (method + URL), the server returns a response (status code + body). JSON is the usual body format. REST uses URLs for things and methods for actions: GET reads, POST creates, PUT/PATCH updates, DELETE removes.',
        ['I can name 4 HTTP methods and what each does', 'I know 200, 201, 400, 401, 404, 500', 'I can read a JSON object'],
        { l: [['MDN: an overview of HTTP', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview']] }),
      t('Pick one server language (JavaScript with Node.js, or Python) and get comfortable: functions, modules, async code, reading environment variables.',
        ['I can run a script in my chosen language', 'I can split code into modules', 'I can read a value from an environment variable']),
      t('Build the smallest possible server with two routes: GET /health and GET /hello?name=Rahim.',
        ['My server starts', 'Both routes return JSON', 'I can test them with a browser or curl'],
        { ex: "const express = require('express');\nconst app = express();\napp.get('/health', (_req, res) => res.json({ ok: true }));\napp.get('/hello', (req, res) => res.json({ hello: req.query.name || 'world' }));\napp.listen(4000);",
          l: [['Express: hello world', 'https://expressjs.com/en/starter/hello-world.html']] }),
    ],
    [
      t('Routing maps a URL to code. Middleware is a function that runs before your route: logging, parsing JSON, checking login.',
        ['I can add a route with a parameter /users/:id', 'I can write a small middleware', 'I can explain the order middleware runs in'],
        { l: [['Express: routing', 'https://expressjs.com/en/guide/routing.html'], ['Express: using middleware', 'https://expressjs.com/en/guide/using-middleware.html']] }),
      t('Most APIs store data in a database: MongoDB (documents) or SQL (tables). Learn create, read, update and delete (CRUD) from code.',
        ['I connected my server to a database', 'I can create and list records', 'I never put the database password in code']),
      t('Never trust input. Validate every request body, return a clear 400 for bad input, and a safe message for server errors (no stack traces to users).',
        ['I validate body, params and query', 'Errors return a consistent JSON shape', 'I log errors on the server only']),
    ],
    [
      t('Do not write your own password or token system. Use a provider (for example Firebase Auth), verify the token on the server, and read the user\'s role from your own database.',
        ['I protected a route so only a signed-in user can call it', 'I check the role on the server, not in the app', 'I never log passwords or tokens']),
      t('Automated tests call your endpoints and check responses. They catch breakages before users do.',
        ['I wrote tests for 3 endpoints', 'Tests cover one bad-input case', 'Tests run with one command']),
      t('Practice project: a small API (for example a notes or tasks API) with login, validation, a database and tests. Write a README with how to run it.',
        ['API has 4+ endpoints', 'Auth and tests included', 'Repo is public with a README']),
    ],
  ],

  testing: [
    [
      t('Testing finds problems before users do. Levels: unit (one function), integration (parts together), system (whole app), acceptance (does it meet the need).',
        ['I can name the 4 test levels', 'I can explain testing vs debugging', 'I can say why exhaustive testing is impossible']),
      t('A test case has an id, a title, steps, test data, the expected result, and the actual result. Write steps so anyone could repeat them.',
        ['I wrote 5 test cases for a login page', 'Each has an expected result', 'Another person could run them without asking me']),
      t('A good bug report: a clear title, steps to reproduce, expected vs actual result, environment (device, browser, version), and a screenshot.',
        ['I wrote a bug report that a developer could reproduce', 'My title says what is wrong and where', 'I attached evidence']),
    ],
    [
      t('Boundary value analysis tests at the edges (age 17, 18, 19 for an "18+" rule). Equivalence classes group inputs that behave the same so you test one from each group.',
        ['I can list boundary values for a range', 'I can split inputs into equivalence classes', 'I applied both to a form field']),
      t('Regression testing re-checks old features after a change. Exploratory testing is learning and testing at the same time with a goal (a charter).',
        ['I can explain regression vs exploratory', 'I ran a 30-minute exploratory session with notes', 'I can pick the most important tests when time is short']),
      t('A test plan says what, how, who and when. A bug tracker (Jira, Trello, GitHub Issues) follows each bug from new to closed.',
        ['I wrote a one-page test plan', 'I logged bugs in a tracker', 'I know the bug life cycle']),
    ],
    [
      t('API testing sends requests directly to the server. Postman lets you build requests, add checks (status code, JSON fields) and save collections.',
        ['I sent GET and POST requests in Postman', 'I added 3 checks to a request', 'I saved a collection']),
      t('A first automated test: a unit test in your language or a simple browser test with Playwright or Selenium. Start with one stable, valuable flow such as login.',
        ['I automated one test', 'It passes and also fails when I break the app', 'It runs from the command line']),
      t('Practice project: test a small public app: test cases, bugs found, a summary. Publish the report.',
        ['10+ test cases', '3+ real bug reports', 'Summary with risks']),
    ],
  ],

  accounting: [
    [
      t('Assets are what the business owns, liabilities what it owes, equity is the owners\' share. Income is money earned, expenses are costs of running.',
        ['I can classify 10 items into the five groups', 'I can give an example of each', 'I can explain the difference between cash and profit']),
      t('Double entry: every transaction has two sides, a debit and an equal credit. Accounting equation: Assets = Liabilities + Equity.',
        ['I can record a purchase for cash and on credit', 'I can show that the equation stays balanced', 'I know debit does not always mean "decrease"']),
      t('The journal records transactions in date order. The ledger groups them by account. Posting moves entries from journal to ledger.',
        ['I journalised 10 transactions', 'I posted them to ledger accounts', 'I can find an account balance']),
    ],
    [
      t('A trial balance lists every ledger balance; total debits must equal total credits. If not, hunt for the error.',
        ['I prepared a trial balance', 'Debits equal credits', 'I can name two kinds of errors the trial balance cannot catch']),
      t('The income statement shows revenue minus expenses = profit for a period. The balance sheet shows assets, liabilities and equity on one date.',
        ['I prepared both statements for a small shop', 'I can explain what each one answers', 'I can link profit to equity']),
      t('Cash flow shows where cash came from and went: operating, investing and financing. A business can be profitable and still run out of cash.',
        ['I can classify 6 items into the 3 sections', 'I can explain profit vs cash flow', 'I can read a simple cash flow statement']),
    ],
    [
      t('Ratios compare numbers: profitability (net margin = profit / revenue) and liquidity (current ratio = current assets / current liabilities).',
        ['I calculated 4 ratios for a company', 'I can say what a high or low value means', 'I compare against the previous year or a peer']),
      t('Excel keeps books fast: a transaction sheet, SUMIFS by account, and a statement sheet that updates itself.',
        ['I built a transaction sheet with SUMIFS', 'My statements update when I add rows', 'I protected formulas from accidents']),
      t('Practice project: books and statements for a small (real or imagined) shop for one month.',
        ['Journal, ledger and trial balance done', 'Both statements prepared', 'A teacher or mentor reviewed them']),
    ],
  ],

  banking: [
    [
      t('Banks take deposits, give loans and move money (payments). They earn from the gap between loan interest and deposit interest, plus fees.',
        ['I can explain how a bank earns money', 'I can explain deposit vs loan', 'I can name 3 payment channels in Bangladesh']),
      t('Account types: savings, current, fixed deposit, DPS. Bank types in Bangladesh: state-owned, private commercial, foreign, Islamic and specialised banks.',
        ['I can compare savings and current accounts', 'I can name one bank of each type', 'I can explain how Islamic banking differs (profit-sharing, not interest)']),
      t('Bangladesh Bank is the central bank: it issues currency, sets monetary policy, supervises banks and holds the foreign-exchange reserve.',
        ['I can list 4 roles of Bangladesh Bank', 'I can explain what policy rate and CRR mean', 'I know the difference between a central bank and a commercial bank']),
    ],
    [
      t('A loan has principal, interest rate and term. Credit risk is the chance the borrower does not pay; banks check income, collateral and history before lending.',
        ['I can calculate simple interest', 'I can name the 5 Cs of credit', 'I can explain collateral']),
      t('Mobile financial services (bKash, Nagad, Rocket) and QR / bank apps are now a daily part of banking. Know cash-in, cash-out, merchant payment and fees.',
        ['I can explain how MFS differs from a bank account', 'I can name 3 risks (fraud, wrong number, PIN sharing)', 'I can explain how to stay safe']),
      t('KYC (Know Your Customer) verifies who the customer is. Anti-money-laundering rules require banks to watch and report suspicious transactions.',
        ['I can list typical KYC documents', 'I can explain what money laundering is', 'I know what a suspicious transaction report is']),
    ],
    [
      t('Be ready to talk about current banking news (non-performing loans, interest rates, exchange rate) and basic ratios (NPL ratio, capital adequacy).',
        ['I read banking news for a week and noted 5 points', 'I can explain NPL in one sentence', 'I can state the current policy rate (look it up)']),
      t('Customer service scenarios: an angry customer, a wrong transfer, a lost card. Stay calm, listen, apologise for the problem, explain the next step.',
        ['I practised 3 scenarios aloud', 'I follow listen, apologise, solve, confirm', 'I know when to escalate']),
      t('A mock interview with a mentor tests both knowledge and manner.',
        ['I did a mock interview', 'I wrote 3 things to improve', 'I practised again']),
    ],
  ],

  leadership: [
    [
      t('Time management: list tasks, pick the 3 that matter most today, schedule them first. Urgent is not always important.',
        ['I made a weekly plan with priorities', 'I finished my top 3 tasks for 3 days in a row', 'I can say no to a low-value request politely']),
      t('Responsibility means owning the result, not blaming. When something goes wrong: say what happened, what you will fix, what you will change.',
        ['I can describe a mistake I owned', 'I can state what I changed afterwards', 'I follow up without being asked']),
      t('A clear goal is specific, measurable and has a date (SMART). Break it into weekly steps.',
        ['I wrote one SMART goal', 'It has 4 weekly steps', 'I told someone so they can check on me']),
    ],
    [
      t('Delegating is giving a task with a clear outcome, a deadline and the freedom to choose how. Then follow up at an agreed time.',
        ['I delegated a task with outcome and deadline', 'I followed up once, not constantly', 'I thanked the person publicly']),
      t('A short meeting has an agenda, a time limit, and ends with who does what by when.',
        ['I ran a 15-minute meeting', 'I sent notes with owners and dates', 'I started and ended on time']),
      t('Conflict is normal. Listen to each side, separate the person from the problem, look for the shared goal, agree on a next step.',
        ['I can describe 3 steps to handle a conflict', 'I tried them in a real situation', 'I know when to involve a senior']),
    ],
    [
      t('Plan a team project: goal, tasks, owners, deadlines, risks. Track weekly and adjust.',
        ['I made a plan with owners and dates', 'I held weekly check-ins', 'I reported progress honestly']),
      t('Motivate with clear purpose, recognition and fairness. Give feedback soon after the event, specific and kind.',
        ['I gave specific praise to a teammate', 'I gave one improvement feedback kindly', 'I asked for feedback on my own leadership']),
      t('Lead something real: a club event, a class project or a volunteer drive. Write what worked, what did not and what you learned.',
        ['I led a real project', 'I wrote a one-page reflection', 'A teammate or advisor can vouch for it']),
    ],
  ],

  ielts: [
    [
      t('Learn the format: Listening (30 min), Reading (60), Writing (60), Speaking (11-14). Each is scored in bands 0 to 9. Know the band your target university or visa needs.',
        ['I know the test format and timings', 'I wrote my target overall and per-skill band', 'I took one diagnostic test']),
      t('Build core grammar (tenses, articles, conditionals, passive) and vocabulary by topic (education, environment, technology, health). Learn words in phrases, not alone.',
        ['I study 10 new words a day and review them', 'I can use 4 tenses correctly in writing', 'I keep a mistake notebook']),
      t('Daily habit: listen to something in English for 20 minutes and read one article for 20 minutes. Note unknown words and guess meaning first.',
        ['I did the habit for 7 days', 'I note and review new words', 'I read and listen to different topics']),
    ],
    [
      t('Reading skills: skim for the main idea, scan for names, numbers and keywords. Answer in the order of the text for most question types. Watch the word limit.',
        ['I can skim a passage in 2 minutes', 'I can tell True / False / Not Given apart', 'I finish 40 questions in 60 minutes']),
      t('Listening: read the questions first, predict the kind of answer, write while listening, check spelling and plurals. Distractors: speakers correct themselves.',
        ['I predicted answers before the audio', 'I catch self-corrections', 'I check spelling and plurals']),
      t('Writing Task 1: describe a chart in 150+ words (overview first). Task 2: an essay in 250+ words: introduction, two body paragraphs with examples, conclusion.',
        ['I wrote 3 Task 1 answers with an overview', 'I wrote 3 Task 2 essays with a clear position', 'I plan for 5 minutes before writing']),
      t('Speaking: Part 1 short personal answers, Part 2 a 1-2 minute talk with a minute to prepare, Part 3 abstract discussion. Extend answers with reasons and examples.',
        ['I recorded and reviewed my answers', 'I can talk for 2 minutes on one topic', 'I give reasons and examples in Part 3']),
    ],
    [
      t('Take full practice tests with real timing, then review every mistake.',
        ['I took 3 full timed tests', 'I reviewed every wrong answer', 'My score is trending up']),
      t('Get feedback on writing and speaking from a teacher or mentor; self-scoring is unreliable.',
        ['A teacher or mentor marked my writing', 'I practised speaking with a partner', 'I fixed my top 3 repeated errors']),
    ],
  ],

  research: [
    [
      t('Search Google Scholar with keywords, read the title, abstract and conclusion first. Decide in 5 minutes if the paper is worth a full read.',
        ['I found 5 papers on one topic', 'I summarised an abstract in my own words', 'I can tell a journal article from a blog']),
      t('Most papers follow: Introduction, Methods, Results, Discussion, References. Read Methods and Results critically: sample, measures, limits.',
        ['I can find the research question in a paper', 'I can name its method and sample', 'I can list 2 limitations']),
      t('Keep notes with the source: author, year, key finding, page. A reference manager (Zotero) saves hours.',
        ['I installed a reference manager', 'I saved 10 sources with notes', 'I can create a citation in one style (APA or IEEE)']),
    ],
    [
      t('A research question is specific and answerable. A literature review shows what is known, what is unclear and where your question fits.',
        ['I wrote one clear research question', 'I reviewed 8+ sources and grouped them', 'I wrote the gap in one paragraph']),
      t('Methods: who or what you study, what you measure, how you collect it (survey, interview, experiment, existing data). Keep it simple and ethical.',
        ['I chose a method and justified it', 'I wrote a short consent note if people are involved', 'I piloted my survey with 3 people']),
      t('Use basic statistics suited to your data: descriptive statistics, simple charts, and one test if needed. Do not run many tests until something is "significant".',
        ['I described my data with tables and charts', 'I chose a test and said why', 'I report effect sizes, not just p-values']),
    ],
    [
      t('Write a short report or one thesis section: clear headings, short paragraphs, every claim backed by data or a source.',
        ['I wrote 1500+ words with sections', 'Every claim has a source or data', 'I proofread twice']),
      t('Your Statement of Purpose says why this field, what you have done, why this university and what you will do next. Emails to professors: short, specific and polite, with your CV attached.',
        ['My SOP is one page and specific', 'I wrote a 6-line email to a professor', 'A mentor reviewed both']),
      t('Ask a mentor or teacher to read your work and mark the three biggest improvements.',
        ['I received written feedback', 'I fixed the top 3 points', 'I thanked the reviewer']),
    ],
  ],
};

// Generic search links that always resolve (no invented deep links). Bangla search helps students who prefer Bangla explanations.
function topicLinks(skillKey, titleEn, stageIdx, topicIdx) {
  const note = ((NOTES[skillKey] || [])[stageIdx] || [])[topicIdx];
  const q = encodeURIComponent(titleEn.replace(/\(.*?\)/g, '').trim());
  const out = (note && note.l ? note.l : []).map(([label, url]) => ({ label, url, language: 'en', kind: 'lesson' }));
  out.push({ label: 'Watch videos (YouTube)', labelBn: 'ভিডিও দেখুন (YouTube)', url: `https://www.youtube.com/results?search_query=${q}%20tutorial`, language: 'en', kind: 'search' });
  out.push({ label: 'Search in Bangla (YouTube)', labelBn: 'বাংলায় খুঁজুন (YouTube)', url: `https://www.youtube.com/results?search_query=${q}%20%E0%A6%AC%E0%A6%BE%E0%A6%82%E0%A6%B2%E0%A6%BE`, language: 'bn', kind: 'search' });
  out.push({ label: 'Read articles (Google)', labelBn: 'আর্টিকেল পড়ুন (Google)', url: `https://www.google.com/search?q=${q}%20explained%20for%20beginners`, language: 'en', kind: 'search' });
  return out;
}

function topicNote(skillKey, stageIdx, topicIdx) {
  const n = ((NOTES[skillKey] || [])[stageIdx] || [])[topicIdx];
  return n ? { summary: n.s, checklist: n.k, example: n.ex || null } : null;
}

module.exports = { NOTES, topicLinks, topicNote };
