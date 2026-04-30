function checkOverloadWarnings(model) {
  const warnings = [];
  const dangers = [];
  const projectedMiles = model.completedMiles + model.plannedMiles;
  const projectedOutput = model.completedOutput + model.plannedOutput;
  const projectedTss = model.completedTss + model.plannedTss;
  const avg4 = model.baseline.avg4;
  const plannedHard = model.plan.filter(p => p.rec.hard).length;
  const completedHard = model.currentWeekRides.filter(r => r.intensity?.hard).length;
  const hardTotal = plannedHard + completedHard;
  const plannedLongest = Math.max(0, ...model.plan.map(p => p.rec.miles));
  const easyMiles = model.currentWeekRides.filter(r => ['Recovery','Easy endurance'].includes(r.intensity?.label)).reduce((a,r) => a + r.distance, 0) + model.plan.filter(p => ['Recovery','Easy endurance'].includes(p.rec.intensityLabel) || !p.rec.hard).reduce((a,p) => a + p.rec.miles, 0);
  const easyShare = projectedMiles ? easyMiles / projectedMiles : 0;
  const reqOpm = model.remainingMiles > 0 ? model.remainingOutput / model.remainingMiles : 0;
  const remainingDays = model.planDays.length;
  const maxHistoricalSingle = model.baseline.recentLongestRideMiles || avg4.longestRide || 0;

  if (!model.plan.length && model.remainingMiles > 0) dangers.push('There are no remaining available days in the selected week. Add an available day, change the rest day, or change “Plan from.”');
  if (avg4.miles && projectedMiles > avg4.miles * 1.20) warnings.push(`Projected mileage is more than 20% above your recent 4-week average (${avg4.miles.toFixed(1)} mi). Consider reducing the target or keeping intensity very easy.`);
  else if (avg4.miles && projectedMiles > avg4.miles * 1.15) warnings.push(`Projected mileage is more than 15% above your recent 4-week average. This may be fine, but treat the week as a volume build.`);

  if (avg4.output && projectedOutput > avg4.output * 1.20) warnings.push(`Projected output is more than 20% above your recent 4-week average (${avg4.output.toFixed(0)}). Consider lowering output expectations or replacing one ride with low-impact endurance.`);
  else if (avg4.output && projectedOutput > avg4.output * 1.15) warnings.push('Projected output is more than 15% above your recent 4-week average. Watch for fatigue and do not force late-week intensity.');

  if (model.ftp && avg4.tss && projectedTss > avg4.tss * 1.25) warnings.push('Estimated FTP-based training stress is more than 25% above your recent baseline. Keep the hard days controlled or lower the output goal.');
  if (hardTotal > model.goalConfig.hardDayCap) warnings.push(`This week includes ${hardTotal} hard ride(s), above the recommended cap of ${model.goalConfig.hardDayCap} for this goal.`);
  if (hasBackToBackHard(model)) warnings.push('The plan creates back-to-back hard days. Swap one for low-impact or Power Zone Endurance if recovery is not excellent.');
  if (maxHistoricalSingle && plannedLongest > maxHistoricalSingle * 1.25 && plannedLongest - maxHistoricalSingle > 4) warnings.push(`The longest planned ride (${plannedLongest.toFixed(1)} mi) is much longer than your recent longest ride (${maxHistoricalSingle.toFixed(1)} mi). Consider splitting it into two easier rides.`);
  if (easyShare < model.goalConfig.easyShareTarget - .15 && model.goalKey !== 'power') warnings.push('The plan may not include enough easy mileage for the selected goal. Replace one moderate/hard block with easy endurance.');
  if (reqOpm && model.outputPerMileP75 && reqOpm > model.outputPerMileP75 * 1.05) warnings.push(`The remaining output target requires ${reqOpm.toFixed(1)} output per mile, above your usual high-end range. Prioritize mileage first if fatigue appears.`);
  if (remainingDays && model.remainingMiles / remainingDays > Math.max(15, (model.baseline.avgMilesPerRide || 10) * 1.45)) warnings.push('You are behind enough that the app is recommending larger daily blocks than usual. This is the “weekend bailout” risk: keep intensity low and do not chase both mileage and output aggressively.');
  if (projectedMiles < model.effectiveMiles - .5) warnings.push('The generated plan is short of the planned mileage target. Increase max minutes/day, add an available day, or lower the goal.');
  if (model.goalKey === 'deload' && model.requestedMiles > model.effectiveMiles + 1) warnings.push(`Deload mode reduced the planned target to ${model.effectiveMiles.toFixed(1)} miles so the week supports recovery instead of chasing the original number.`);
  if (model.baseline.recent4.length < 2) warnings.push('Limited recent weekly history was found, so baseline and overload checks are less reliable.');
  if (model.ignoredRows > 0) warnings.push(`${model.ignoredRows} non-cycling or zero-distance workout row(s) were ignored.`);

  return { warnings, dangers };
}

function hasBackToBackHard(model) {
  const daily = new Map();
  for (const r of model.currentWeekRides) {
    if (r.intensity?.hard) daily.set(r.dateKey, true);
  }
  for (const p of model.plan) {
    if (p.rec.hard) daily.set(isoDate(p.date), true);
  }
  const dates = [...daily.keys()].sort().map(s => new Date(s + 'T00:00:00'));
  for (let i = 1; i < dates.length; i++) {
    if ((dates[i] - dates[i - 1]) / 86400000 === 1) return true;
  }
  return false;
}

