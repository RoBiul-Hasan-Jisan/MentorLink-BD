// Simple, explainable scam signals. Flags go to the admin; nothing is silently deleted.
const PATTERNS = [
  [/registration fee|processing fee|security deposit|pay (us|first)|joining fee|training fee/i, 'asks_for_fee'],
  [/bkash|nagad|rocket|send money|advance payment/i, 'mobile_money'],
  [/whatsapp only|telegram only|dm me|contact on whatsapp/i, 'off_platform_contact'],
  [/guaranteed (job|income)|earn \d+.*(daily|per day)|no experience.*high salary|easy money/i, 'too_good_to_be_true'],
  [/ফি|টাকা পাঠান|অগ্রিম/, 'asks_for_fee_bn'],
];
function scamFlags(text) {
  return PATTERNS.filter(([re]) => re.test(text)).map(([, f]) => f);
}
// 5-stage student view mapped from the 8 backend stages.
function uiStage(stage) {
  if (stage === 'Applied' || stage === 'Under Review') return 'Applied';
  if (stage === 'Shortlisted') return 'Shortlisted';
  if (stage === 'Interview') return 'Interview';
  if (stage === 'Offer' || stage === 'Hired') return 'Selected';
  if (stage === 'Rejected') return 'Not selected';
  return 'Withdrawn';
}
module.exports = { scamFlags, uiStage };
