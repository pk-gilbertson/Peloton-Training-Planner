function classifyIntensityFromIF(ifValue) {
  if (!ifValue || !Number.isFinite(ifValue)) return { label: 'Unknown', cls: 'easy', hard: false, rank: 0, range: '' };
  if (ifValue < .55) return { label: 'Recovery', cls: 'recovery', hard: false, rank: 1, range: '<55% FTP' };
  if (ifValue < .70) return { label: 'Easy endurance', cls: 'easy', hard: false, rank: 2, range: '55–70% FTP' };
  if (ifValue < .80) return { label: 'Moderate endurance', cls: 'moderate', hard: false, rank: 3, range: '70–80% FTP' };
  if (ifValue < .90) return { label: 'Tempo / challenging', cls: 'moderate', hard: true, rank: 4, range: '80–90% FTP' };
  return { label: 'Hard / high-intensity', cls: 'hard', hard: true, rank: 5, range: '90%+ FTP' };
}

function classifyRideIntensity(workout, context) {
  const ftp = context.ftp;
  if (ftp && workout.watts) {
    const ifValue = workout.watts / ftp;
    return { ...classifyIntensityFromIF(ifValue), source: 'FTP-based', ifValue };
  }

  const text = titleText(workout);
  let score = 0;
  const opm = workout.minutes ? workout.output / workout.minutes : 0;
  const w = workout.watts || 0;
  if (opm && context.outputPerMinuteP75 && opm >= context.outputPerMinuteP75) score += 2;
  else if (opm && context.outputPerMinuteMedian && opm >= context.outputPerMinuteMedian) score += 1;
  if (w && context.wattsP75 && w >= context.wattsP75) score += 2;
  else if (w && context.wattsMedian && w >= context.wattsMedian) score += 1;
  if (/tabata|hiit|interval|threshold|climb|power zone max/.test(text)) score += 2;
  if (/recovery|cool down|warm up|low impact/.test(text)) score -= 2;
  if (/power zone endurance|endurance|scenic/.test(text)) score -= 1;
  if (score >= 4) return { label: 'Hard / high-intensity', cls: 'hard', hard: true, rank: 5, source: 'Estimated' };
  if (score >= 2) return { label: 'Tempo / challenging', cls: 'moderate', hard: true, rank: 4, source: 'Estimated' };
  if (score >= 1) return { label: 'Moderate endurance', cls: 'moderate', hard: false, rank: 3, source: 'Estimated' };
  if (score <= -2) return { label: 'Recovery', cls: 'recovery', hard: false, rank: 1, source: 'Estimated' };
  return { label: 'Easy endurance', cls: 'easy', hard: false, rank: 2, source: 'Estimated' };
}

function estimateTss(minutes, watts, ftp) {
  if (!ftp || !watts || !minutes) return 0;
  const ifValue = watts / ftp;
  return (minutes / 60) * ifValue * ifValue * 100;
}

function buildIntensityContext(rides, ftp) {
  return {
    ftp,
    outputPerMinuteMedian: median(rides.map(r => r.minutes ? r.output / r.minutes : 0)),
    outputPerMinuteP75: percentile(rides.map(r => r.minutes ? r.output / r.minutes : 0), .75),
    wattsMedian: median(rides.map(r => r.watts)),
    wattsP75: percentile(rides.map(r => r.watts), .75)
  };
}

function enrichIntensity(rides, context) {
  return rides.map(r => {
    const intensity = classifyRideIntensity(r, context);
    return {
      ...r,
      intensity,
      intensityFactor: intensity.ifValue || 0,
      tss: estimateTss(r.minutes, r.watts, context.ftp)
    };
  });
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

