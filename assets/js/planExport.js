function escapeCsv(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildExportOutputs(model) {
  lastPlanText = [
    'Peloton Training Recommendation Engine',
    `Goal: ${model.goalConfig.label}`,
    `Week: ${isoDate(model.currentWeekStart)} to ${isoDate(model.currentWeekEnd)}`,
    `Completed: ${model.completedMiles.toFixed(1)} miles, ${model.completedOutput.toFixed(0)} output, ${model.completedMinutes.toFixed(0)} minutes`,
    `Goal: ${model.effectiveMiles.toFixed(1)} miles, ${model.effectiveOutput.toFixed(0)} output`,
    `Projected: ${model.projectedMiles.toFixed(1)} miles, ${model.projectedOutput.toFixed(0)} output${model.ftp ? `, ${model.projectedTss.toFixed(0)} estimated TSS` : ''}`,
    model.ftp ? `FTP: ${model.ftp.toFixed(0)}w${model.targetFtp ? `; target FTP: ${model.targetFtp.toFixed(0)}w` : ''}` : 'FTP: not entered',
    '',
    'Plan:',
    ...model.plan.map(p => `${fmtDate(p.date)}: ${p.rec.parts.map(partText).join(' + ')} | ${p.rec.minutes.toFixed(0)} min | ${p.rec.miles.toFixed(1)} mi | ${p.rec.output.toFixed(0)} output | ${p.rec.intensityLabel} | ${ftpTargetText(p.rec.intensityLabel, model.ftp)} | ${p.reason}`),
    '',
    'Warnings:',
    ...(model.overload.dangers.length || model.overload.warnings.length ? [...model.overload.dangers, ...model.overload.warnings].map(w => `- ${w}`) : ['- None']),
    '',
    'Adjustment Rules:',
    ...model.adjustmentRules.map(r => `- ${r}`)
  ].join('\n');

  const header = ['Day','Date','Ride Block','Minutes','Miles','Output','Intensity','FTP Target','Reason'];
  const rows = model.plan.map(p => [
    DAY_NAMES[p.date.getDay()], isoDate(p.date), p.rec.parts.map(partText).join(' + '), p.rec.minutes.toFixed(0), p.rec.miles.toFixed(1), p.rec.output.toFixed(0), p.rec.intensityLabel, ftpTargetText(p.rec.intensityLabel, model.ftp), p.reason
  ]);
  lastPlanCsv = [header, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n');
}

