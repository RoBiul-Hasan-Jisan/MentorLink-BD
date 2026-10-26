// Named proficiency levels shown to students. The stored level stays 0..3 (evidence levels); the names are only labels.
const LEVELS = [
  { level: 0, en: 'Beginner', bn: 'শুরুর স্তর' },
  { level: 1, en: 'Elementary', bn: 'প্রাথমিক' },
  { level: 2, en: 'Intermediate', bn: 'মধ্যম' },
  { level: 3, en: 'Advanced', bn: 'উন্নত' },
];
const levelName = (l) => LEVELS[Math.max(0, Math.min(3, Math.round(l || 0)))];
module.exports = { LEVELS, levelName };
