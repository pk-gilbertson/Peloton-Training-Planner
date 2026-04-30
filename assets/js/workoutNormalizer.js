function titleText(workout) {
  return `${workout.title || ''} ${workout.type || ''}`.toLowerCase();
}

function normalizeWorkout(row, map) {
  const date = parsePelotonDate(getMapped(row, map, 'timestamp'));
  const discipline = getMapped(row, map, 'discipline');
  const type = getMapped(row, map, 'type') || 'Ride';
  const title = getMapped(row, map, 'title') || '';
  const minutes = parseMinutes(getMapped(row, map, 'length'));
  const distance = num(getMapped(row, map, 'distance'));
  const output = num(getMapped(row, map, 'output'));
  const watts = num(getMapped(row, map, 'watts'));
  return {
    raw: row,
    date,
    dateKey: date ? isoDate(date) : '',
    live: getMapped(row, map, 'live'),
    instructor: getMapped(row, map, 'instructor'),
    minutes,
    discipline,
    type,
    title,
    output,
    watts,
    resistance: num(getMapped(row, map, 'resistance')),
    cadence: num(getMapped(row, map, 'cadence')),
    speed: num(getMapped(row, map, 'speed')),
    distance,
    calories: num(getMapped(row, map, 'calories')),
    heartRate: num(getMapped(row, map, 'heartRate'))
  };
}

function cleanRows(rows) {
  if (!rows.length) return { rides: [], ignored: 0, map: {} };
  const map = buildColumnMap(rows[0]);
  const normalized = rows.map(r => normalizeWorkout(r, map)).filter(w => w.date && w.minutes > 0);
  const rides = normalized.filter(w => {
    const d = String(w.discipline || '').toLowerCase();
    const t = `${w.type} ${w.title}`.toLowerCase();
    return (d.includes('cycling') || t.includes('ride') || t.includes('power zone') || t.includes('low impact')) && w.distance > 0;
  }).sort((a,b) => a.date - b.date || a.minutes - b.minutes);
  return { rides, ignored: normalized.length - rides.length, map };
}

