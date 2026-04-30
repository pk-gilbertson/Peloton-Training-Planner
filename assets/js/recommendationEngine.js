function estimateFallbackProfile(block, baseline, ftp) {
  const mpm = baseline.avgMilesPerMinute || .30;
  const opm = baseline.avgOutputPerMinute || 9.5;
  const miles = block.minutes * mpm * block.rateMult;
  const output = block.minutes * opm * block.outputMult;
  let ifValue = 0;
  let watts = 0;
  if (ftp) {
    const ranges = intensityTargetRange(block.intensityLabel);
    ifValue = (ranges.low + ranges.high) / 2;
    watts = ftp * ifValue;
  }
  return {
    family: block.family,
    minutes: block.minutes,
    count: 0,
    miles,
    output,
    watts,
    calories: 0,
    intensityFactor: ifValue,
    intensityLabel: block.intensityLabel,
    intensityCls: block.intensityCls,
    hard: block.hard,
    tss: estimateTss(block.minutes, watts, ftp),
    examples: ['Estimated from your recent average pace/output']
  };
}

function ensureProfileOptions(profiles, baseline, ftp) {
  const all = [...profiles];
  for (const block of FALLBACK_BLOCKS) {
    const exists = all.some(p => p.family === block.family && Math.abs(p.minutes - block.minutes) <= 2);
    if (!exists) all.push(estimateFallbackProfile(block, baseline, ftp));
  }
  return all;
}

function intensityTargetRange(label) {
  if (label === 'Recovery') return { low: .45, high: .55, text: '<55% FTP' };
  if (label === 'Easy endurance') return { low: .55, high: .70, text: '55–70% FTP' };
  if (label === 'Moderate endurance') return { low: .70, high: .80, text: '70–80% FTP' };
  if (label === 'Tempo / challenging') return { low: .80, high: .90, text: '80–90% FTP' };
  if (label === 'Hard / high-intensity') return { low: .90, high: 1.02, text: '90–102% FTP' };
  return { low: .55, high: .75, text: '55–75% FTP' };
}

function ftpTargetText(label, ftp) {
  const range = intensityTargetRange(label);
  if (!ftp) return range.text;
  const low = Math.round(range.low * ftp);
  const high = Math.round(range.high * ftp);
  return `${range.text} (${low}–${high}w)`;
}

function includesAny(text, terms) {
  const hay = String(text || '').toLowerCase();
  return terms.some(term => hay.includes(String(term).toLowerCase()));
}

function makeCandidates(profiles, maxMinutes) {
  const usable = profiles.filter(p => p.minutes <= maxMinutes && p.miles > 0 && p.output > 0);
  const candidates = usable.map(p => combineProfiles([p]));
  const addOns = usable.filter(p => p.minutes <= 20 && /add-on|low impact|recovery|warm|cool/i.test(p.family));
  const main = usable.filter(p => p.minutes >= 20);
  for (const a of main) {
    for (const b of addOns) {
      if (a.minutes + b.minutes <= maxMinutes) candidates.push(combineProfiles([a, b]));
    }
  }
  return candidates;
}

function combineProfiles(parts) {
  const minutes = sum(parts, 'minutes');
  const miles = sum(parts, 'miles');
  const output = sum(parts, 'output');
  const watts = minutes ? parts.reduce((t,p) => t + (p.watts || 0) * p.minutes, 0) / minutes : 0;
  const intensityFactor = minutes ? parts.reduce((t,p) => t + (p.intensityFactor || 0) * p.minutes, 0) / minutes : 0;
  const strongest = parts.slice().sort((a,b) => intensityRank(b.intensityLabel) - intensityRank(a.intensityLabel))[0] || parts[0];
  return {
    parts,
    minutes,
    miles,
    output,
    watts,
    intensityFactor,
    intensityLabel: strongest?.intensityLabel || 'Easy endurance',
    intensityCls: strongest?.intensityCls || 'easy',
    hard: parts.some(p => p.hard),
    tss: sum(parts, 'tss'),
    calories: sum(parts, 'calories'),
    examples: parts.flatMap(p => p.examples || []).slice(0, 3)
  };
}

function intensityRank(label) {
  const order = ['Unknown', 'Recovery', 'Easy endurance', 'Moderate endurance', 'Tempo / challenging', 'Hard / high-intensity'];
  const index = order.indexOf(label);
  return index >= 0 ? index : 2;
}

function selectedAvailableDays() {
  const checks = [...document.querySelectorAll('#daysAvailable input[type="checkbox"]')];
  const days = checks.filter(c => c.checked).map(c => Number(c.dataset.day));
  return new Set(days);
}

function selectReferenceDate(rides) {
  if ($('planMode').value === 'today') {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return rides.reduce((latest, r) => !latest || r.date > latest ? r.date : latest, null);
}

function getRemainingPlanDays(referenceDate, weekStart) {
  const available = selectedAvailableDays();
  const restDay = $('preferredRestDay').value;
  const weekEnd = endOfWeek(referenceDate, weekStart);
  const days = [];
  for (let d = addDays(referenceDate, 1); d <= weekEnd; d = addDays(d, 1)) {
    if (!available.has(d.getDay())) continue;
    if (restDay !== 'none' && Number(restDay) === d.getDay()) continue;
    days.push(new Date(d));
  }
  return days;
}

function assignRoles(days, goalConfig, completedCurrentWeek, lastCompletedRide) {
  if (!days.length) return [];
  const pattern = goalConfig.pattern;
  let roles = days.map((date, index) => {
    const ratio = days.length === 1 ? 1 : index / (days.length - 1);
    let patternIndex = Math.round(ratio * (pattern.length - 1));
    let base = { ...pattern[patternIndex] };
    if (date.getDay() === 6 && goalConfig !== GOALS.deload) {
      const longRole = pattern.find(p => p.cls === 'long');
      if (longRole) base = { ...longRole };
    }
    if (date.getDay() === 0 && index === days.length - 1) {
      const finishRole = pattern[pattern.length - 1];
      base = { ...finishRole };
    }
    return { date, ...base };
  });

  const completedHard = completedCurrentWeek.filter(r => r.intensity?.hard).length;
  let plannedHard = 0;
  roles = roles.map((role, index) => {
    const prevRole = roles[index - 1];
    const previousWasHard = (index === 0 && lastCompletedRide?.intensity?.hard) || (prevRole && prevRole.hard);
    if (!role.hard) return role;
    if (completedHard + plannedHard >= goalConfig.hardDayCap || previousWasHard) {
      return { ...role, role: 'Controlled endurance', intensity: 'Moderate endurance', cls: 'moderate', hard: false };
    }
    plannedHard += 1;
    return role;
  });
  return roles;
}

function effectiveGoals(goalKey, requestedMiles, requestedOutput, baseline, recentOutputPerMile) {
  const config = GOALS[goalKey] || GOALS.maintain;
  let miles = requestedMiles;
  let output = requestedOutput;
  const hasHistory = baseline.avg4.miles > 0;
  if (!output) {
    const opm = recentOutputPerMile || 32;
    output = Math.round(miles * opm * config.outputBias / 10) * 10;
  }
  if (goalKey === 'deload') {
    const deloadMiles = hasHistory ? baseline.avg4.miles * .65 : requestedMiles * .65;
    const deloadOutput = hasHistory ? baseline.avg4.output * .60 : output * .60;
    miles = Math.min(requestedMiles, Math.max(10, deloadMiles));
    output = Math.min(output, Math.max(0, deloadOutput));
  }
  return { miles, output: Math.round(output / 10) * 10, requestedMiles, requestedOutput };
}

function scoreCandidate(candidate, role, targetMiles, targetOutput, goalConfig, context) {
  const mileScore = Math.abs(candidate.miles - targetMiles) / Math.max(2.5, targetMiles);
  const outputScore = targetOutput > 0 ? Math.abs(candidate.output - targetOutput) / Math.max(120, targetOutput) : 0;
  const familyText = candidate.parts.map(p => p.family).join(' | ');
  let stylePenalty = 0;

  if (!includesAny(familyText, goalConfig.preferredTypes)) stylePenalty += .16;
  if (role.cls === 'recovery' && candidate.hard) stylePenalty += .60;
  if (role.cls === 'easy' && candidate.hard) stylePenalty += .42;
  if (role.cls === 'long' && candidate.minutes < 45) stylePenalty += .30;
  if (role.cls === 'hard' && !candidate.hard) stylePenalty += .24;
  if (context.bias === 'easy' && candidate.hard) stylePenalty += .38;
  if (context.bias === 'output' && candidate.output < targetOutput * .9) stylePenalty += .10;
  if (context.goalKey === 'lose' && includesAny(familyText, ['Intervals', 'HIIT', 'Tabata', 'Power Zone Max'])) stylePenalty += .36;
  if (context.goalKey === 'power' && role.hard && !includesAny(familyText, ['Power Zone', 'Climb', 'Intervals', 'HIIT', 'Tabata'])) stylePenalty += .30;
  if (context.goalKey === 'endurance' && role.cls === 'long' && candidate.minutes < 60) stylePenalty += .22;
  if (context.goalKey === 'deload' && candidate.hard) stylePenalty += 1.0;

  if (context.ftp && candidate.intensityFactor) {
    const range = intensityTargetRange(role.intensity);
    if (candidate.intensityFactor < range.low - .08) stylePenalty += .08;
    if (candidate.intensityFactor > range.high + .08) stylePenalty += .20;
    if (role.cls === 'long' && candidate.intensityFactor > .80) stylePenalty += .30;
    if (role.cls === 'recovery' && candidate.intensityFactor > .65) stylePenalty += .34;
  }

  return mileScore * 1.55 + outputScore * (context.goalKey === 'power' ? .95 : .55) + stylePenalty;
}

function generateRidePlan(model) {
  const roles = assignRoles(model.planDays, model.goalConfig, model.currentWeekRides, model.lastCompletedRide);
  const totalWeight = roles.reduce((a,r) => a + r.weight, 0) || 1;
  const adjustedRemainingMiles = model.remainingMiles * model.goalConfig.volumeBias;
  const candidates = makeCandidates(model.profileOptions, model.maxMinutes);
  const plan = [];
  let plannedMiles = 0;
  let plannedOutput = 0;
  let plannedTss = 0;
  let previousHard = model.lastCompletedRide?.intensity?.hard || false;

  for (const role of roles) {
    const targetMiles = adjustedRemainingMiles * role.weight / totalWeight;
    const targetOutput = model.remainingMiles > 0 ? targetMiles * (model.remainingOutput / Math.max(1, model.remainingMiles)) : 0;
    let eligible = candidates;
    if (role.cls === 'recovery' || role.cls === 'deload') eligible = candidates.filter(c => !c.hard || model.goalKey !== 'deload');
    if (previousHard) eligible = eligible.filter(c => !c.hard);
    if (!eligible.length) eligible = candidates;
    const scored = eligible.map(c => ({ c, score: scoreCandidate(c, role, targetMiles, targetOutput, model.goalConfig, model) })).sort((a,b) => a.score - b.score);
    const selected = scored[0]?.c || fallbackCandidate(model.baseline, model.ftp, Math.min(model.maxMinutes, Math.max(20, targetMiles / Math.max(.1, model.baseline.avgMilesPerMinute))));
    const reason = buildReason(role, selected, model, targetMiles, targetOutput, previousHard);
    plan.push({ ...role, targetMiles, targetOutput, rec: selected, reason });
    plannedMiles += selected.miles;
    plannedOutput += selected.output;
    plannedTss += selected.tss || 0;
    previousHard = selected.hard;
  }

  // If the plan is short and there is room, add a low-impact add-on to the final available day.
  const projectedMiles = model.completedMiles + plannedMiles;
  if (plan.length && projectedMiles < model.effectiveMiles) {
    const gap = model.effectiveMiles - projectedMiles;
    const last = plan[plan.length - 1];
    const addOns = model.profileOptions.filter(p => p.minutes <= 20 && !p.hard).sort((a,b) => Math.abs(a.miles - gap) - Math.abs(b.miles - gap));
    const addOn = addOns.find(p => last.rec.minutes + p.minutes <= model.maxMinutes);
    if (addOn) {
      const old = last.rec;
      const combined = combineProfiles([...old.parts, addOn]);
      plannedMiles += combined.miles - old.miles;
      plannedOutput += combined.output - old.output;
      plannedTss += (combined.tss || 0) - (old.tss || 0);
      last.rec = combined;
      last.reason += ' A short low-impact add-on is included to close the mileage gap without adding much intensity.';
    }
  }

  return { plan, plannedMiles, plannedOutput, plannedTss };
}

function fallbackCandidate(baseline, ftp, minutes) {
  const rounded = Math.max(10, Math.round(minutes / 5) * 5);
  return combineProfiles([estimateFallbackProfile({ family: 'Custom endurance ride', minutes: rounded, intensityLabel: 'Easy endurance', intensityCls: 'easy', hard: false, rateMult: .92, outputMult: .82 }, baseline, ftp)]);
}

function buildReason(role, selected, model, targetMiles, targetOutput, previousHard) {
  const parts = [];
  if (previousHard) parts.push('The previous ride was hard, so this recommendation avoids stacking intensity.');
  if (role.cls === 'long') parts.push('This is the weekly anchor ride to make the mileage goal sustainable.');
  if (role.cls === 'recovery' || role.cls === 'deload') parts.push('This protects recovery while preserving consistency.');
  if (role.hard) parts.push('This is the planned quality day for power/output progression.');
  if (model.goalKey === 'lose') parts.push('The block favors repeatable aerobic work rather than maximum calorie burn.');
  if (model.goalKey === 'power' && role.hard) parts.push('It supports FTP/output development while keeping hard days limited.');
  if (model.goalKey === 'endurance' && selected.minutes >= 45) parts.push('It builds durable endurance with steady volume.');
  if (!parts.length) parts.push(`Recommended to move toward the remaining ${model.remainingMiles.toFixed(1)} mile and ${model.remainingOutput.toFixed(0)} output targets without unnecessary intensity.`);
  if (selected.examples?.[0] && selected.parts.some(p => p.count > 0)) parts.push('Estimate is based on similar rides from your own history.');
  return parts.join(' ');
}

function buildModel(rides, ignoredRows) {
  const goalKey = $('fitnessGoal').value;
  const goalConfig = GOALS[goalKey] || GOALS.maintain;
  const weekStart = Number($('weekStart').value);
  const ftp = num($('ftpWatts').value);
  const targetFtp = num($('targetFtpWatts').value);
  const requestedMiles = num($('mileGoal').value) || 100;
  const requestedOutput = num($('outputGoal').value);
  const maxMinutes = Number($('maxRideMinutes').value);
  const bias = $('intensityBias').value;

  const intensityContext = buildIntensityContext(rides, ftp);
  rides = enrichIntensity(rides, intensityContext);
  const referenceDate = selectReferenceDate(rides);
  const currentWeekStart = startOfWeek(referenceDate, weekStart);
  const currentWeekEnd = endOfWeek(referenceDate, weekStart);
  const currentWeekRides = rides.filter(r => r.date >= currentWeekStart && r.date <= referenceDate);
  const lastCompletedRide = currentWeekRides.slice().sort((a,b) => b.date - a.date)[0] || rides.slice().sort((a,b) => b.date - a.date)[0];
  const baseline = calculateRecentBaseline(rides, weekStart, referenceDate);
  const outputPerMileValues = rides.filter(r => r.distance && r.output).map(r => r.output / r.distance);
  const recentOutputPerMile = baseline.avg4.miles ? baseline.avg4.output / baseline.avg4.miles : avg(outputPerMileValues);
  const goals = effectiveGoals(goalKey, requestedMiles, requestedOutput, baseline, recentOutputPerMile);
  const completedMiles = sum(currentWeekRides, 'distance');
  const completedOutput = sum(currentWeekRides, 'output');
  const completedMinutes = sum(currentWeekRides, 'minutes');
  const completedTss = sum(currentWeekRides, 'tss');
  const remainingMiles = Math.max(0, goals.miles - completedMiles);
  const remainingOutput = Math.max(0, goals.output - completedOutput);
  const planDays = getRemainingPlanDays(referenceDate, weekStart);
  const profiles = buildRideProfiles(rides, referenceDate);
  const profileOptions = ensureProfileOptions(profiles, baseline, ftp);
  const typicalDurations = groupTypicalDurations(rides, referenceDate);

  const partialModel = {
    goalKey, goalConfig, weekStart, ftp, targetFtp, requestedMiles, requestedOutput, effectiveMiles: goals.miles,
    effectiveOutput: goals.output, maxMinutes, bias, rides, ignoredRows, referenceDate, currentWeekStart, currentWeekEnd,
    currentWeekRides, lastCompletedRide, baseline, outputPerMileP75: percentile(outputPerMileValues, .75),
    completedMiles, completedOutput, completedMinutes, completedTss, remainingMiles, remainingOutput, planDays,
    profiles, profileOptions, typicalDurations
  };

  const generated = generateRidePlan(partialModel);
  const model = { ...partialModel, ...generated };
  model.projectedMiles = model.completedMiles + model.plannedMiles;
  model.projectedOutput = model.completedOutput + model.plannedOutput;
  model.projectedTss = model.completedTss + model.plannedTss;
  model.overload = checkOverloadWarnings(model);
  model.nutritionGuidance = generateNutritionGuidance(model);
  model.adjustmentRules = generateAdjustmentRules(model);
  return model;
}

