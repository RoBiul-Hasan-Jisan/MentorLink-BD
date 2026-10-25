const { Quiz } = require('../models');
const Q = (q, options, answer) => ({ q, options, answer });
const QUIZZES = {
  sql: [
    Q('Which clause filters rows BEFORE grouping?', ['HAVING', 'WHERE', 'ORDER BY', 'LIMIT'], 1),
    Q('Which JOIN keeps all rows from the left table?', ['INNER JOIN', 'LEFT JOIN', 'CROSS JOIN', 'SELF JOIN'], 1),
    Q('Which function counts rows?', ['SUM()', 'COUNT()', 'AVG()', 'MAX()'], 1),
    Q('Which clause filters groups after GROUP BY?', ['WHERE', 'HAVING', 'DISTINCT', 'UNION'], 1),
    Q('What does SELECT DISTINCT do?', ['Sorts rows', 'Removes duplicate rows', 'Deletes rows', 'Joins tables'], 1),
    Q('Which statement adds new rows to a table?', ['SELECT', 'INSERT', 'ALTER', 'GRANT'], 1),
    Q('What does a PRIMARY KEY guarantee?', ['Unique, non-null identifier for each row', 'Faster internet', 'Sorted output', 'Encrypted data'], 0),
    Q('Which clause sorts the result?', ['GROUP BY', 'ORDER BY', 'WHERE', 'ON'], 1),
  ],
  excel: [
    Q('Which function looks up a value in the first column of a range?', ['VLOOKUP', 'SUMIF', 'LEN', 'TRIM'], 0),
    Q('What does $A$1 mean?', ['Relative reference', 'Absolute reference', 'A named range', 'A table'], 1),
    Q('Which tool summarises large data quickly?', ['PivotTable', 'Spell check', 'Freeze panes', 'Print area'], 0),
    Q('Which function adds cells that meet a condition?', ['SUMIF', 'COUNTA', 'CONCAT', 'ROUND'], 0),
    Q('Which chart shows share of a whole?', ['Pie chart', 'Scatter plot', 'Histogram', 'Radar'], 0),
    Q('Which shortcut-free feature repeats a formula down a column?', ['Fill handle', 'Spell check', 'Zoom', 'Comments'], 0),
    Q('What does =AVERAGE(A1:A3) return when A1:A3 are 2, 4, 6?', ['3', '4', '6', '12'], 1),
    Q('Which feature highlights cells by rule, such as values above 100?', ['Conditional formatting', 'Merge cells', 'Freeze panes', 'Protect sheet'], 0),
  ],
  python: [
    Q('Which type is immutable?', ['list', 'dict', 'tuple', 'set'], 2),
    Q('What does len([1,2,3]) return?', ['2', '3', '4', 'Error'], 1),
    Q('Which keyword defines a function?', ['func', 'def', 'function', 'lambda only'], 1),
    Q('What is the output of 3 // 2?', ['1.5', '1', '2', '0'], 1),
    Q('Which library is used for data frames?', ['pandas', 'flask', 'pytest', 'requests'], 0),
    Q('What does print(type(5.0)) show?', ['int', 'float', 'str', 'bool'], 1),
    Q('Which loop runs over each item of a list?', ['for', 'if', 'def', 'import'], 0),
    Q('How do you read a dict value safely with a default?', ['d.get(key, default)', 'd.read(key)', 'd[key, default]', 'get(d)'], 0),
  ],
  statistics: [
    Q('What is the median of 2, 3, 7, 9, 10?', ['3', '7', '6.2', '9'], 1),
    Q('Which measure is most affected by outliers?', ['Median', 'Mean', 'Mode', 'Range is not affected'], 1),
    Q('A p-value below 0.05 usually means we...', ['Accept the null hypothesis', 'Reject the null hypothesis', 'Have no data', 'Need a bigger mean'], 1),
    Q('Standard deviation measures...', ['The centre of data', 'The spread of data', 'The sample size', 'The sign of data'], 1),
    Q('Correlation of +1 means...', ['No relation', 'Perfect negative relation', 'Perfect positive linear relation', 'Causation proven'], 2),
    Q('The mode of 2, 3, 3, 5, 9 is...', ['3', '5', '2', '9'], 0),
    Q('A larger sample size usually...', ['Reduces random sampling error', 'Removes all bias', 'Proves causation', 'Makes the mean zero'], 0),
    Q('Which chart shows the distribution of one numeric variable?', ['Histogram', 'Pie chart', 'Gantt chart', 'Sankey'], 0),
  ],
  dashboard: [
    Q('A trend over time is best shown with a...', ['Line chart', 'Pie chart', 'Treemap', 'Table of text'], 0),
    Q('A good KPI card should show...', ['Many decimals', 'One clear number with context', 'Ten colours', 'Only a logo'], 1),
    Q('In Power BI, a measure is written in...', ['DAX', 'HTML', 'SQL only', 'CSS'], 0),
    Q('Why limit colours in a dashboard?', ['Faster rendering only', 'Colour should carry meaning', 'Printers need it', 'No reason'], 1),
    Q('A slicer is used to...', ['Filter data interactively', 'Delete rows', 'Create a database', 'Send email'], 0),
    Q('Which is best for comparing values across categories?', ['Bar chart', '3D pie', 'Word cloud', 'Map only'], 0),
    Q('Before building a dashboard you should first...', ['Decide the question it must answer', 'Pick colours', 'Add every column', 'Buy a licence'], 0),
    Q('A truncated y-axis on a bar chart can...', ['Exaggerate differences', 'Make charts accurate', 'Speed up loading', 'Remove noise'], 0),
  ],
  git: [
    Q('Which command saves staged changes to history?', ['git push', 'git commit', 'git fetch', 'git clone'], 1),
    Q('Which command copies a remote repo locally?', ['git clone', 'git init', 'git merge', 'git stash'], 0),
    Q('What does git status show?', ['Remote URL only', 'State of working tree and staging area', 'Commit author list', 'Disk usage'], 1),
    Q('What is a branch?', ['A deleted commit', 'A movable pointer to a line of commits', 'A remote server', 'A file type'], 1),
    Q('Which command uploads local commits to a remote?', ['git pull', 'git add', 'git push', 'git log'], 2),
    Q('Which command creates a new branch and switches to it?', ['git checkout -b name', 'git commit -b name', 'git push name', 'git new name'], 0),
    Q('What does git pull do?', ['Fetches and merges remote changes', 'Deletes a branch', 'Creates a repo', 'Shows history only'], 0),
    Q('A merge conflict happens when...', ['Two changes touch the same lines differently', 'You forgot to commit', 'The remote is offline', 'A file is empty'], 0),
  ],
  testing: [
    Q('A test case describes...', ['Only the bug title', 'Steps, input and expected result', 'The sprint goal', 'The code style'], 1),
    Q('Regression testing checks that...', ['New code did not break old features', 'The UI is pretty', 'The server is cheap', 'Docs exist'], 0),
    Q('Which is a black-box technique?', ['Boundary value analysis', 'Reading source code line by line', 'Compiling', 'Refactoring'], 0),
    Q('A good bug report includes...', ['Steps to reproduce', 'Only "it is broken"', 'Blame', 'Nothing'], 0),
    Q('Unit tests usually test...', ['A whole system', 'One small piece of code', 'Only the database', 'Only the UI'], 1),
    Q('Which level tests how modules work together?', ['Integration testing', 'Unit testing', 'Spell checking', 'Load balancing'], 0),
    Q('Boundary value analysis tests values...', ['At and around the edges of allowed ranges', 'Only in the middle', 'Randomly with no plan', 'Only invalid types'], 0),
    Q('A bug severity describes...', ['How badly it affects the system', 'Who found it', 'Which day it was found', 'The tester salary'], 0),
  ],
  communication: [
    Q('In an interview, "tell me about yourself" is best answered with...', ['Your full life story', 'A short, relevant summary', 'Silence', 'Salary demands'], 1),
    Q('Active listening includes...', ['Interrupting often', 'Paraphrasing what you heard', 'Checking your phone', 'Planning your reply only'], 1),
    Q('A professional email subject line should be...', ['Empty', 'Clear and specific', 'All capitals', 'A joke'], 1),
    Q('The STAR method stands for...', ['Situation, Task, Action, Result', 'Skill, Time, Attitude, Role', 'Speak, Think, Answer, Repeat', 'Start, Tell, Ask, Rest'], 0),
    Q('When you do not know an answer in an interview, it is best to...', ['Invent one', 'Say so honestly and explain how you would find out', 'Change the topic', 'Leave'], 1),
    Q('Which is the best way to end a job interview?', ['Thank them and ask a thoughtful question', 'Ask for the salary only', 'Leave quietly', 'Criticise the company'], 0),
    Q('In a team disagreement, a good first step is to...', ['Listen to understand the other view', 'Escalate immediately', 'Ignore it', 'Argue louder'], 0),
    Q('A CV for a first job should mostly be...', ['Clear, one to two pages and relevant', 'Ten pages long', 'Handwritten notes', 'Only a photo'], 0),
  ],
};
async function seedQuizzes() {
  for (const [skillKey, questions] of Object.entries(QUIZZES)) await Quiz.updateOne({ skillKey }, { $set: { questions } }, { upsert: true });
  return Object.keys(QUIZZES).length;
}
module.exports = { seedQuizzes };
