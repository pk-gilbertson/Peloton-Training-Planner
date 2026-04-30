'use strict';

const $ = (id) => document.getElementById(id);
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
let parsedRows = [];
let lastModel = null;
let lastPlanText = '';
let lastPlanCsv = '';
let hasBuiltPlan = false;

const GOALS = {
  maintain: {
    label: 'Maintain fitness',
    summary: 'Balance mileage, output, and recovery while keeping weekly load close to your recent baseline.',
    outputBias: 1.00,
    volumeBias: 1.00,
    hardDayCap: 2,
    easyShareTarget: .65,
    preferredTypes: ['Power Zone Endurance', 'Power Zone', 'Low Impact', 'Music', 'Pro Cyclist'],
    pattern: [
      { role: 'Recovery', intensity: 'Easy endurance', cls: 'easy', weight: .12, hard: false },
      { role: 'Endurance', intensity: 'Easy endurance', cls: 'easy', weight: .18, hard: false },
      { role: 'Easy aerobic', intensity: 'Easy endurance', cls: 'easy', weight: .13, hard: false },
      { role: 'Controlled quality', intensity: 'Moderate endurance', cls: 'moderate', weight: .18, hard: true },
      { role: 'Long endurance', intensity: 'Easy endurance', cls: 'long', weight: .28, hard: false },
      { role: 'Finish / recovery', intensity: 'Recovery', cls: 'recovery', weight: .11, hard: false }
    ]
  },
  lose: {
    label: 'Lose weight / improve body composition',
    summary: 'Favor repeatable aerobic volume, low-impact work, and recovery. The plan avoids encouraging under-fueling or constant hard rides.',
    outputBias: .86,
    volumeBias: 1.04,
    hardDayCap: 1,
    easyShareTarget: .78,
    preferredTypes: ['Low Impact', 'Power Zone Endurance', 'Recovery', 'Scenic', 'Power Zone'],
    pattern: [
      { role: 'Low-impact volume', intensity: 'Easy endurance', cls: 'easy', weight: .16, hard: false },
      { role: 'Endurance', intensity: 'Easy endurance', cls: 'easy', weight: .18, hard: false },
      { role: 'Easy aerobic', intensity: 'Easy endurance', cls: 'easy', weight: .15, hard: false },
      { role: 'Controlled moderate', intensity: 'Moderate endurance', cls: 'moderate', weight: .14, hard: false },
      { role: 'Long steady ride', intensity: 'Easy endurance', cls: 'long', weight: .25, hard: false },
      { role: 'Recovery finish', intensity: 'Recovery', cls: 'recovery', weight: .12, hard: false }
    ]
  },
  power: {
    label: 'Gain power / increase FTP',
    summary: 'Include structured Power Zone, climb, tempo, or interval-style work while limiting hard days to protect recovery.',
    outputBias: 1.16,
    volumeBias: .97,
    hardDayCap: 2,
    easyShareTarget: .55,
    preferredTypes: ['Power Zone', 'Climb', 'Intervals', 'HIIT', 'Tabata', 'Power Zone Endurance'],
    pattern: [
      { role: 'Recovery', intensity: 'Easy endurance', cls: 'easy', weight: .11, hard: false },
      { role: 'Power development', intensity: 'Tempo / challenging', cls: 'hard', weight: .20, hard: true },
      { role: 'Easy aerobic', intensity: 'Easy endurance', cls: 'easy', weight: .12, hard: false },
      { role: 'Tempo / output', intensity: 'Tempo / challenging', cls: 'hard', weight: .19, hard: true },
      { role: 'Endurance anchor', intensity: 'Moderate endurance', cls: 'long', weight: .27, hard: false },
      { role: 'Finish / recovery', intensity: 'Recovery', cls: 'recovery', weight: .11, hard: false }
    ]
  },
  endurance: {
    label: 'Build endurance',
    summary: 'Shift more work into longer steady rides and aerobic durability while keeping most effort easy to moderate.',
    outputBias: .94,
    volumeBias: 1.10,
    hardDayCap: 1,
    easyShareTarget: .72,
    preferredTypes: ['Power Zone Endurance', 'Power Zone', 'Low Impact', 'Pro Cyclist', 'Scenic'],
    pattern: [
      { role: 'Recovery', intensity: 'Recovery', cls: 'recovery', weight: .10, hard: false },
      { role: 'Endurance build', intensity: 'Easy endurance', cls: 'easy', weight: .18, hard: false },
      { role: 'Easy aerobic', intensity: 'Easy endurance', cls: 'easy', weight: .12, hard: false },
      { role: 'Steady endurance', intensity: 'Moderate endurance', cls: 'moderate', weight: .16, hard: false },
      { role: 'Long endurance', intensity: 'Easy endurance', cls: 'long', weight: .34, hard: false },
      { role: 'Easy finish', intensity: 'Recovery', cls: 'recovery', weight: .10, hard: false }
    ]
  },
  deload: {
    label: 'Recover / deload week',
    summary: 'Reduce weekly stress so you can absorb training. The plan favors recovery, low-impact, and easy endurance rides only.',
    outputBias: .58,
    volumeBias: .62,
    hardDayCap: 0,
    easyShareTarget: .95,
    preferredTypes: ['Low Impact', 'Recovery', 'Warm Up', 'Cool Down', 'Power Zone Endurance'],
    pattern: [
      { role: 'Recovery spin', intensity: 'Recovery', cls: 'deload', weight: .18, hard: false },
      { role: 'Easy aerobic', intensity: 'Easy endurance', cls: 'deload', weight: .20, hard: false },
      { role: 'Rest or short spin', intensity: 'Recovery', cls: 'deload', weight: .12, hard: false },
      { role: 'Easy endurance', intensity: 'Easy endurance', cls: 'deload', weight: .20, hard: false },
      { role: 'Light long ride', intensity: 'Easy endurance', cls: 'deload', weight: .20, hard: false },
      { role: 'Recovery finish', intensity: 'Recovery', cls: 'deload', weight: .10, hard: false }
    ]
  }
};

const FIELD_ALIASES = {
  timestamp: ['Workout Timestamp', 'Workout Date', 'Date', 'Start Time', 'Started At'],
  live: ['Live/On-Demand', 'Live On Demand'],
  instructor: ['Instructor Name', 'Instructor'],
  length: ['Length (minutes)', 'Length', 'Duration', 'Duration (minutes)', 'Workout Length'],
  discipline: ['Fitness Discipline', 'Discipline'],
  type: ['Type', 'Workout Type', 'Class Type'],
  title: ['Title', 'Class Title', 'Workout Title'],
  classTimestamp: ['Class Timestamp', 'Class Date'],
  output: ['Total Output', 'Output', 'Total Output (kj)', 'Total Output (kJ)'],
  watts: ['Avg. Watts', 'Avg Watts', 'Average Watts', 'Avg Power', 'Average Power'],
  resistance: ['Avg. Resistance', 'Avg Resistance', 'Average Resistance'],
  cadence: ['Avg. Cadence (RPM)', 'Avg. Cadence', 'Avg Cadence', 'Average Cadence'],
  speed: ['Avg. Speed (mph)', 'Avg. Speed', 'Avg Speed', 'Average Speed'],
  distance: ['Distance (mi)', 'Distance', 'Miles'],
  calories: ['Calories Burned', 'Calories'],
  heartRate: ['Avg. Heartrate', 'Avg. Heart Rate', 'Avg Heart Rate', 'Average Heart Rate']
};

function saveSettings() {
  const settings = collectSettings();
  localStorage.setItem('pelotonTrainingEngineSettings', JSON.stringify(settings));
}

function collectSettings() {
  return {
    fitnessGoal: $('fitnessGoal').value,
    mileGoal: $('mileGoal').value,
    outputGoal: $('outputGoal').value,
    ftpWatts: $('ftpWatts').value,
    targetFtpWatts: $('targetFtpWatts').value,
    preferredRestDay: $('preferredRestDay').value,
    planMode: $('planMode').value,
    weekStart: $('weekStart').value,
    maxRideMinutes: $('maxRideMinutes').value,
    intensityBias: $('intensityBias').value,
    availableDays: [...document.querySelectorAll('#daysAvailable input[type="checkbox"]')].filter(c => c.checked).map(c => c.dataset.day)
  };
}

function loadSettings() {
  try {
    const raw = localStorage.getItem('pelotonTrainingEngineSettings');
    if (!raw) return;
    const s = JSON.parse(raw);
    ['fitnessGoal','mileGoal','outputGoal','ftpWatts','targetFtpWatts','preferredRestDay','planMode','weekStart','maxRideMinutes','intensityBias'].forEach(id => {
      if (s[id] !== undefined && $(id)) $(id).value = s[id];
    });
    if (Array.isArray(s.availableDays)) {
      document.querySelectorAll('#daysAvailable input[type="checkbox"]').forEach(c => { c.checked = s.availableDays.includes(c.dataset.day); });
    }
  } catch (e) {
    console.warn('Could not load settings', e);
  }
}

function updateGoalHelp() {
  const goal = GOALS[$('fitnessGoal').value] || GOALS.maintain;
  $('goalHelp').textContent = goal.summary;
}

function initGoalCards() {
  const holder = $('goalCards');
  holder.innerHTML = Object.entries(GOALS).map(([key, goal]) => `
    <button type="button" class="goal-card ${$('fitnessGoal').value === key ? 'active' : ''}" data-goal="${key}" role="radio" aria-checked="${$('fitnessGoal').value === key}">
      <strong>${goal.label}</strong>
      <span>${goal.summary}</span>
    </button>
  `).join('');
  holder.querySelectorAll('.goal-card').forEach(card => {
    card.addEventListener('click', () => {
      $('fitnessGoal').value = card.dataset.goal;
      updateGoalHelp();
      initGoalCards();
      handleBuild();
    });
  });
}

function handleBuild() {
  hasBuiltPlan = true;
  saveSettings();
  updateGoalHelp();
  if (!parsedRows.length) {
    $('results').className = 'empty';
    $('results').innerHTML = '<h2>Start with your workout history</h2><p>Upload your Peloton CSV to calculate current-week progress, recent baseline, and a sustainable ride plan.</p>';
    return;
  }
  const cleaned = cleanRows(parsedRows);
  if (!cleaned.rides.length) {
    $('results').className = 'empty';
    $('results').innerHTML = '<h2>We found workouts, but not a usable distance column</h2><p>Mileage-based recommendations may be limited. Check that your export includes Distance and Fitness Discipline columns.</p>';
    return;
  }
  try {
    renderModel(buildModel(cleaned.rides, cleaned.ignored));
  } catch (err) {
    console.error(err);
    $('results').className = 'empty';
    $('results').innerHTML = `<h2>Could not build the plan</h2><p>${err.message || 'An unexpected error occurred.'}</p>`;
  }
}

async function copyText(text) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function setupEvents() {
  $('csvFile').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    $('uploadMeta').textContent = `Loaded: ${file.name}`;
    const text = await file.text();
    parsedRows = parseCsv(text);
    $('uploadMeta').textContent = `Loaded: ${file.name} · ${parsedRows.length} workouts found`; 
    if (!$('outputGoal').value) $('outputGoal').dataset.auto = 'true';
    hasBuiltPlan = false;
    $('results').className = 'empty';
    $('results').innerHTML = '<h2>Set your training goal</h2><p>Choose a primary goal, enter your weekly targets, and click <strong>Build plan</strong> to generate recommendations that balance mileage, output, FTP, and recovery.</p>';
  });

  ['fitnessGoal','mileGoal','outputGoal','ftpWatts','targetFtpWatts','preferredRestDay','planMode','weekStart','maxRideMinutes','intensityBias'].forEach(id => {
    $(id).addEventListener('change', () => {
      if (id === 'fitnessGoal' && $('outputGoal').dataset.auto === 'true') $('outputGoal').value = '';
      if (id === 'fitnessGoal') initGoalCards();
      handleBuild();
    });
  });
  $('outputGoal').addEventListener('input', () => { $('outputGoal').dataset.auto = $('outputGoal').value ? 'false' : 'true'; });
  document.querySelectorAll('#daysAvailable input[type="checkbox"]').forEach(c => c.addEventListener('change', () => {
    saveSettings();
    if (hasBuiltPlan) handleBuild();
  }));
  $('buildBtn').addEventListener('click', handleBuild);
  $('copyBtn').addEventListener('click', async () => {
    if (!lastPlanText && parsedRows.length) handleBuild();
    const ok = await copyText(lastPlanText);
    $('copyBtn').textContent = ok ? 'Copied' : 'Copy failed';
    setTimeout(() => $('copyBtn').textContent = 'Copy plan as text', 1400);
  });
  $('exportCsvBtn').addEventListener('click', () => {
    if (!lastPlanCsv && parsedRows.length) handleBuild();
    if (!lastPlanCsv) return;
    downloadText('peloton-training-plan.csv', lastPlanCsv, 'text/csv;charset=utf-8');
  });
}

initDaysAvailable();
loadSettings();
updateGoalHelp();
initGoalCards();
