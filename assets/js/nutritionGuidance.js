function generateNutritionGuidance(model) {
  const items = [];
  const hasLong = model.plan.some(p => p.rec.minutes >= 60);
  const hasHard = model.plan.some(p => p.rec.hard);
  const hasModerate = model.plan.some(p => p.rec.minutes >= 45 || p.rec.intensityLabel === 'Moderate endurance');
  items.push('For easy rides under 30 minutes, normal meal timing is usually fine. Hydrate and keep the ride easy.');
  if (hasModerate) items.push('For 45–60 minute moderate rides, consider carbs before or after so the ride supports training instead of draining the rest of the week.');
  if (hasLong) items.push('For rides over 60 minutes, fuel before the ride and hydrate during it. A long ride should not feel like a depletion test.');
  if (hasHard) items.push('For hard Power Zone, climb, or interval days, prioritize protein plus carbs afterward to support recovery.');
  if (model.goalKey === 'lose') items.push('For weight-loss support, aim for a modest overall deficit, but do not under-fuel hard or long rides. Consistency beats aggressive restriction.');
  if (model.goalKey === 'endurance') items.push('For endurance building, fuel long rides enough to preserve quality and make the next week possible.');
  if (model.goalKey === 'power') items.push('For power/FTP work, avoid heavy restriction around hard training days; quality work needs fuel.');
  if (model.goalKey === 'deload') items.push('For deload weeks, keep nutrition steady and let the lower training load support recovery rather than cutting fuel sharply.');
  return items;
}

function generateAdjustmentRules(model) {
  const rules = [
    'If legs feel heavy, keep the mileage target but lower the intensity.',
    'If output is unusually low for two rides in a row, switch the next ride to recovery or low impact.',
    'If short on time, use a 20–30 minute low-impact ride plus a 10-minute add-on.',
    'If already ahead of mileage but behind output, do not force hard intensity late in the week unless you feel recovered.',
    'If behind both mileage and output, prioritize mileage first and output second.',
    'If sleep or recovery is poor, reduce intensity before reducing consistency.'
  ];
  if (model.goalKey === 'lose') rules.push('For body-composition goals, do not turn every ride into a calorie chase; choose repeatable aerobic work.');
  if (model.goalKey === 'power') rules.push('For FTP goals, protect the quality days by making the easy days genuinely easy.');
  if (model.goalKey === 'deload') rules.push('For deload weeks, success is feeling fresher at the end of the week, not proving fitness.');
  return rules;
}

