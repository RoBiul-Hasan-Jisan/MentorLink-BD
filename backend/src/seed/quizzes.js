const { Quiz } = require('../models');
const Q = (q, options, answer) => ({ q, options, answer });
const QUIZZES = {
  sql: [
    Q('Which clause filters rows BEFORE grouping?', ['HAVING', 'WHERE', 'ORDER BY', 'LIMIT'], 1),
    Q('Which JOIN keeps all rows from the left table?', ['INNER JOIN', 'LEFT JOIN', 'CROSS JOIN', 'SELF JOIN'], 1),
    Q('Which function counts rows?', ['SUM()', 'COUNT()', 'AVG()', 'MAX()'], 1),
    Q('Which clause filters groups after GROUP BY?', ['WHERE', 'HAVING', 'DISTINCT', 'UNION'], 1),
    Q('What does SELECT DISTINCT do?', ['Sorts rows', 'Removes duplicate rows', 'Deletes rows', 'Joins tables'], 1),
  ],
  excel: [
    Q('Which function looks up a value in the first column of a range?', ['VLOOKUP', 'SUMIF', 'LEN', 'TRIM'], 0),
    Q('What does $A$1 mean?', ['Relative reference', 'Absolute reference', 'A named range', 'A table'], 1),
    Q('Which tool summarises large data quickly?', ['PivotTable', 'Spell check', 'Freeze panes', 'Print area'], 0),
    Q('Which function adds cells that meet a condition?', ['SUMIF', 'COUNTA', 'CONCAT', 'ROUND'], 0),
    Q('Which chart shows share of a whole?', ['Pie chart', 'Scatter plot', 'Histogram', 'Radar'], 0),
  ],
  python: [
    Q('Which type is immutable?', ['list', 'dict', 'tuple', 'set'], 2),
    Q('What does len([1,2,3]) return?', ['2', '3', '4', 'Error'], 1),
    Q('Which keyword defines a function?', ['func', 'def', 'function', 'lambda only'], 1),
    Q('What is the output of 3 // 2?', ['1.5', '1', '2', '0'], 1),
    Q('Which library is used for data frames?', ['pandas', 'flask', 'pytest', 'requests'], 0),
  ],
};
async function seedQuizzes() {
  for (const [skillKey, questions] of Object.entries(QUIZZES)) await Quiz.updateOne({ skillKey }, { $set: { questions } }, { upsert: true });
  return Object.keys(QUIZZES).length;
}
module.exports = { seedQuizzes };
