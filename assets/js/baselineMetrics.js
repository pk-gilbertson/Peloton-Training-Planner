function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  d.setHours(0,0,0,0);
  return d;
}

function startOfWeek(date, weekStart) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  const diff = (d.getDay() - weekStart + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

function endOfWeek(date, weekStart) {
  return addDays(startOfWeek(date, weekStart), 6);
}

function isoDate(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fmtDate(date) {
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function sum(list, key) {
  return list.reduce((total, item) => total + (Number(item[key]) || 0), 0);
}

function avg(values) {
  const arr = values.filter(v => Number.isFinite(v) && v > 0);
  return arr.length ? arr.reduce((a,b) => a + b, 0) / arr.length : 0;
}

function median(values) {
  return percentile(values, .5);
}

function percentile(values, p) {
  const arr = values.filter(v => Number.isFinite(v) && v > 0).sort((a,b) => a-b);
  if (!arr.length) return 0;
  const idx = (arr.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return arr[lo];
  return arr[lo] + (arr[hi] - arr[lo]) * (idx - lo);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildWeeklySummaries(rides, weekStart) {
  const weeks = new Map();
  for (const r of rides) {
    const start = startOfWeek(r.date, weekStart);
    const key = isoDate(start);
    if (!weeks.has(key)) {
      weeks.set(key, { start, end: addDays(start, 6), rides: 0, miles: 0, output: 0, minutes: 0, tss: 0, hardRides: 0, easyMiles: 0, longestRide: 0 });
    }
    const w = weeks.get(key);
    w.rides += 1;
    w.miles += r.distance;
    w.output += r.output;
    w.minutes += r.minutes;
    w.tss += r.tss || 0;
    w.longestRide = Math.max(w.longestRide, r.distance);
    if (r.intensity && r.intensity.hard) w.hardRides += 1;
    if (r.intensity && ['Recovery', 'Easy endurance'].includes(r.intensity.label)) w.easyMiles += r.distance;
  }
  return [...weeks.values()].sort((a,b) => a.start - b.start);
}

function recentCompleteWeeks(rides, weekStart, referenceDate, count) {
  const currentStart = startOfWeek(referenceDate, weekStart);
  return buildWeeklySummaries(rides.filter(r => r.date < currentStart), weekStart).slice(-count);
}

function averageWeek(weeks) {
  if (!weeks.length) return { miles: 0, output: 0, rides: 0, minutes: 0, tss: 0, hardRides: 0, longestRide: 0, easyShare: 0 };
  return {
    miles: avg(weeks.map(w => w.miles)),
    output: avg(weeks.map(w => w.output)),
    rides: avg(weeks.map(w => w.rides)),
    minutes: avg(weeks.map(w => w.minutes)),
    tss: avg(weeks.map(w => w.tss)),
    hardRides: avg(weeks.map(w => w.hardRides)),
    longestRide: avg(weeks.map(w => w.longestRide)),
    easyShare: avg(weeks.map(w => w.miles ? w.easyMiles / w.miles : 0))
  };
}

function calculateRecentBaseline(rides, weekStart, referenceDate) {
  const recent4 = recentCompleteWeeks(rides, weekStart, referenceDate, 4);
  const recent6 = recentCompleteWeeks(rides, weekStart, referenceDate, 6);
  const cutoff180 = addDays(referenceDate, -180);
  const recentRides = rides.filter(r => r.date >= cutoff180 && r.date <= referenceDate);
  const last14 = rides.filter(r => r.date >= addDays(referenceDate, -14) && r.date <= referenceDate);
  const avg4 = averageWeek(recent4);
  const avg6 = averageWeek(recent6);
  return {
    recent4,
    recent6,
    avg4,
    avg6,
    avgMilesPerRide: avg(recentRides.map(r => r.distance)),
    avgOutputPerRide: avg(recentRides.map(r => r.output)),
    avgMilesPerMinute: avg(recentRides.map(r => r.minutes ? r.distance / r.minutes : 0)),
    avgOutputPerMinute: avg(recentRides.map(r => r.minutes ? r.output / r.minutes : 0)),
    recentLongestRideMiles: Math.max(0, ...recentRides.map(r => r.distance)),
    recentLongestRideMinutes: Math.max(0, ...recentRides.map(r => r.minutes)),
    recentHardRideFrequency: last14.filter(r => r.intensity && r.intensity.hard).length,
    recentRideCount: recentRides.length,
    last14RideCount: last14.length
  };
}

function groupTypicalDurations(rides, referenceDate) {
  const cut = addDays(referenceDate, -180);
  const recent = rides.filter(r => r.date >= cut && r.output > 0 && r.distance > 0);
  const durations = [20, 30, 45, 60, 75];
  return durations.map(duration => {
    const close = recent.filter(r => Math.abs(r.minutes - duration) <= 3);
    return {
      duration,
      count: close.length,
      miles: avg(close.map(r => r.distance)),
      output: avg(close.map(r => r.output)),
      watts: avg(close.map(r => r.watts)),
      tss: avg(close.map(r => r.tss)),
      intensity: close.length ? mostCommon(close.map(r => r.intensity.label)) : 'Not enough data'
    };
  });
}

function mostCommon(values) {
  const counts = new Map();
  values.filter(Boolean).forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
  return [...counts.entries()].sort((a,b) => b[1] - a[1])[0]?.[0] || '';
}

function classifyRideFamily(ride) {
  const text = `${ride.type || ''} ${ride.title || ''}`.toLowerCase();
  if (/power zone max/.test(text)) return 'Power Zone Max';
  if (/power zone endurance/.test(text)) return 'Power Zone Endurance';
  if (/power zone/.test(text)) return 'Power Zone';
  if (/tabata/.test(text)) return 'Tabata';
  if (/hiit/.test(text)) return 'HIIT';
  if (/interval/.test(text)) return 'Intervals';
  if (/climb/.test(text)) return 'Climb';
  if (/low impact/.test(text)) return 'Low Impact';
  if (/recovery/.test(text)) return 'Recovery';
  if (/warm.?up/.test(text)) return 'Warm Up';
  if (/cool.?down/.test(text)) return 'Cool Down';
  if (/scenic/.test(text)) return 'Scenic';
  if (/pro cyclist/.test(text)) return 'Pro Cyclist';
  if (/add.?on/.test(text)) return 'Add-on';
  return ride.type || 'Cycling';
}

function buildRideProfiles(rides, referenceDate) {
  const cut = addDays(referenceDate, -180);
  const recent = rides.filter(r => r.date >= cut && r.distance > 0 && r.minutes > 0 && r.output > 0);
  const groups = new Map();
  for (const r of recent) {
    const roundedMinutes = Math.round(r.minutes / 5) * 5;
    const family = classifyRideFamily(r);
    const key = `${family}|${roundedMinutes}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const profiles = [];
  for (const [key, rs] of groups.entries()) {
    const [family, minutesText] = key.split('|');
    const minutes = Number(minutesText);
    if (rs.length < 1) continue;
    const meanWatts = avg(rs.map(r => r.watts));
    const ifValue = avg(rs.map(r => r.intensityFactor));
    const intensity = ifValue ? classifyIntensityFromIF(ifValue) : mostCommonIntensity(rs);
    const examples = rs.slice().sort((a,b) => b.date - a.date).slice(0, 3).map(r => `${r.title}${r.instructor ? ' — ' + r.instructor : ''}`);
    profiles.push({
      family,
      minutes,
      count: rs.length,
      miles: avg(rs.map(r => r.distance)),
      output: avg(rs.map(r => r.output)),
      watts: meanWatts,
      calories: avg(rs.map(r => r.calories)),
      intensityFactor: ifValue,
      intensityLabel: intensity.label,
      intensityCls: intensity.cls,
      hard: intensity.hard,
      tss: avg(rs.map(r => r.tss)),
      examples
    });
  }
  return profiles.sort((a,b) => a.minutes - b.minutes || a.family.localeCompare(b.family));
}

function mostCommonIntensity(rides) {
  const label = mostCommon(rides.map(r => r.intensity.label));
  const representative = rides.find(r => r.intensity.label === label)?.intensity || { label: 'Easy endurance', cls: 'easy', hard: false };
  return representative;
}

