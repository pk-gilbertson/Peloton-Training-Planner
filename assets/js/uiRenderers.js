function pct(value, goal) {
  if (!goal) return 0;
  return clamp(Math.round(value / goal * 100), 0, 100);
}

function fmtNum(value, decimals = 0) {
  if (!Number.isFinite(value)) return '—';
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function renderModel(model) {
  // Dashboard-first composition: progress, plan, coaching, and baseline panels.
  lastModel = model;
  buildExportOutputs(model);
  const sustainability = sustainabilityLabel(model);
  const easyModerateHard = summarizeIntensityCounts(model);

  $('results').className = 'stack';
  $('results').innerHTML = `
    <div class="card">
      <h2>Current week progress</h2>
      ${model.overload.dangers.map(w => `<div class="notice danger"><strong>Action needed:</strong> ${w}</div>`).join('')}
      ${model.overload.warnings.map(w => `<div class="notice warn">${w}</div>`).join('')}
      <div class="notice goal"><strong>${model.goalConfig.label}:</strong> ${model.goalConfig.summary}</div>
      <div class="kpis">
        <div class="kpi"><div class="label">Current miles</div><div class="value">${fmtNum(model.completedMiles, 1)}</div><div class="progress"><div class="bar" style="width:${pct(model.completedMiles, model.effectiveMiles)}%"></div></div><div class="note">${fmtNum(model.remainingMiles, 1)} remaining</div></div>
        <div class="kpi"><div class="label">Current output</div><div class="value">${fmtNum(model.completedOutput, 0)}</div><div class="progress"><div class="bar rust" style="width:${pct(model.completedOutput, model.effectiveOutput)}%"></div></div><div class="note">${fmtNum(model.remainingOutput, 0)} remaining</div></div>
        <div class="kpi"><div class="label">Projected miles</div><div class="value">${fmtNum(model.projectedMiles, 1)}</div><div class="note">Goal: ${fmtNum(model.effectiveMiles, 1)}${model.goalKey === 'deload' ? ` · requested ${fmtNum(model.requestedMiles, 0)}` : ''}</div></div>
        <div class="kpi"><div class="label">Projected output</div><div class="value">${fmtNum(model.projectedOutput, 0)}</div><div class="note">Goal: ${fmtNum(model.effectiveOutput, 0)}</div></div>
      </div>
      <div class="kpis section">
        <div class="kpi"><div class="label">Ride mix</div><div class="value">${easyModerateHard}</div><div class="note">easy / moderate / hard planned</div></div>
        <div class="kpi"><div class="label">Sustainability</div><div class="value">${sustainability.label}</div><div class="note">${sustainability.note}</div></div>
        <div class="kpi"><div class="label">Current week rides</div><div class="value">${model.currentWeekRides.length}</div><div class="note">${fmtNum(model.completedMinutes, 0)} completed minutes</div></div>
        <div class="kpi"><div class="label">Available plan days</div><div class="value">${model.planDays.length}</div><div class="note">Through ${fmtDate(model.currentWeekEnd)}</div></div>
      </div>
    </div>

    <div class="card">
      <h2>Recommended plan</h2>
      <div class="table-scroll">
        <table>
          <thead><tr><th>Day</th><th>Ride block</th><th>Minutes</th><th>Miles</th><th>Output</th><th>Intensity</th><th>FTP target</th><th>Reason</th></tr></thead>
          <tbody>${renderPlanRows(model)}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h2>Recent baseline</h2>
      ${model.baseline.recent4.length < 2 ? '<div class="notice info">Less than two complete recent weeks were found. The plan still works, but overload checks and estimates are less reliable.</div>' : ''}
      <div class="kpis">
        <div class="kpi"><div class="label">4-week avg miles</div><div class="value">${fmtNum(model.baseline.avg4.miles, 1)}</div><div class="note">Complete weeks only</div></div>
        <div class="kpi"><div class="label">4-week avg output</div><div class="value">${fmtNum(model.baseline.avg4.output, 0)}</div><div class="note">Complete weeks only</div></div>
        <div class="kpi"><div class="label">Avg miles / ride</div><div class="value">${fmtNum(model.baseline.avgMilesPerRide, 1)}</div><div class="note">Recent 180 days</div></div>
        <div class="kpi"><div class="label">Hard rides, 14 days</div><div class="value">${model.baseline.recentHardRideFrequency}</div><div class="note">${model.ftp ? 'FTP-based' : 'Estimated'} intensity</div></div>
      </div>
      <div class="baseline-list section">
        ${renderTypicalDurations(model.typicalDurations)}
      </div>
    </div>

    ${renderFtpPanel(model)}

    <div class="split">
      <div class="card">
        <h2>Fuel and recover</h2>
        <ul class="compact">${model.nutritionGuidance.map(item => `<li>${item}</li>`).join('')}</ul>
      </div>
      <div class="card">
        <h2>Adjustment rules</h2>
        <ul class="compact">${model.adjustmentRules.map(item => `<li>${item}</li>`).join('')}</ul>
      </div>
    </div>

    <div class="card">
      <h2>Reusable ride profiles</h2>
      <p class="muted">The planner estimates future rides using your own recent history when available, then falls back to conservative estimates from your averages.</p>
      <div class="profile-list section">${renderRideProfiles(model)}</div>
    </div>

    <div class="card">
      <details>
        <summary>How the recommendation engine works</summary>
        <div class="section">
          <p>The app filters to cycling workouts, identifies the selected training week, calculates current progress, and builds recent ride profiles from your CSV. The plan recommends flexible ride blocks rather than exact class IDs.</p>
          <p>The selected goal changes the ride mix. Maintain balances load and recovery. Weight-loss support favors aerobic repeatability. Power adds structured quality days. Endurance adds a longer anchor ride. Deload reduces the effective target and avoids hard rides.</p>
          <p>${model.ftp ? 'FTP was entered, so intensity is based on <code>Intensity Factor = Avg. Watts / FTP</code> and estimated training stress uses <code>hours × IF² × 100</code>.' : 'FTP was not entered, so intensity is estimated from output per minute, watts when present, ride type, class title keywords, and your own historical percentiles.'}</p>
        </div>
      </details>
    </div>
  `;
}

function renderPlanRows(model) {
  if (!model.plan.length) return '<tr><td colspan="8">No remaining available days to plan.</td></tr>';
  return model.plan.map(p => {
    const block = p.rec.parts.map(partText).join(' + ');
    return `<tr>
      <td data-label="Day"><strong>${fmtDate(p.date)}</strong><br><span class="tiny muted">${isoDate(p.date)}</span></td>
      <td data-label="Ride block"><span class="pill ${p.cls}">${p.role}</span><br>${block}</td>
      <td data-label="Minutes"><strong>${fmtNum(p.rec.minutes, 0)}</strong><br><span class="tiny muted">Max ${model.maxMinutes}</span></td>
      <td data-label="Miles"><strong>${fmtNum(p.rec.miles, 1)}</strong><br><span class="tiny muted">target ${fmtNum(p.targetMiles, 1)}</span></td>
      <td data-label="Output"><strong>${fmtNum(p.rec.output, 0)}</strong><br><span class="tiny muted">target ${fmtNum(p.targetOutput, 0)}</span></td>
      <td data-label="Intensity"><span class="pill ${p.rec.intensityCls}">${p.rec.intensityLabel}</span><br><span class="tiny muted">${p.rec.hard ? 'Hard ride' : 'Easy/moderate'}</span></td>
      <td data-label="FTP target">${ftpTargetCell(p.rec.intensityLabel, model.ftp, p.rec)}</td>
      <td data-label="Reason" class="small">${p.reason}</td>
    </tr>`;
  }).join('');
}

function partText(profile) {
  return `${fmtNum(profile.minutes, 0)} min ${profile.family}`;
}

function ftpTargetCell(label, ftp, rec) {
  const target = ftpTargetText(label, ftp);
  if (!ftp) return `<span class="small muted">${target}<br>Enter FTP for watt target</span>`;
  const actual = rec.intensityFactor ? `<br><span class="tiny muted">planned IF ${rec.intensityFactor.toFixed(2)} · ${fmtNum(rec.tss, 0)} est. TSS</span>` : '';
  return `<span class="small">${target}</span>${actual}`;
}

function renderTypicalDurations(items) {
  return items.map(item => `
    <div class="baseline-item">
      <strong>${item.duration} min rides</strong>
      <span class="small muted">${item.count ? `${item.count} matching ride(s)` : 'Limited data'}</span><br>
      <span>${item.count ? `${fmtNum(item.miles, 1)} mi · ${fmtNum(item.output, 0)} output` : 'Uses fallback estimates when needed'}</span>
    </div>`).join('');
}

function renderRideProfiles(model) {
  const profiles = model.profileOptions
    .filter(p => p.count > 0)
    .sort((a,b) => b.count - a.count || a.minutes - b.minutes)
    .slice(0, 12);
  if (!profiles.length) return '<p class="muted">Not enough repeat ride profiles yet. The app used conservative fallback estimates.</p>';
  return profiles.map(p => `
    <div class="profile">
      <strong>${fmtNum(p.minutes, 0)} min ${p.family}</strong>
      <span class="small muted">${p.count} ride(s) in recent history</span><br>
      ${fmtNum(p.miles, 1)} mi · ${fmtNum(p.output, 0)} output<br>
      <span class="small muted">${p.intensityLabel}${model.ftp && p.intensityFactor ? ` · IF ${p.intensityFactor.toFixed(2)}` : ''}</span>
    </div>`).join('');
}

function renderFtpPanel(model) {
  if (!model.ftp) {
    return `<div class="card"><h2>FTP optional</h2><div class="notice info">Add your FTP if you know it. The app will classify intensity using average watts, estimate training stress, and show target watt ranges for each ride block.</div></div>`;
  }
  return `<div class="card">
    <h2>FTP-aware training view</h2>
    <div class="kpis three">
      <div class="kpi"><div class="label">Current FTP</div><div class="value">${fmtNum(model.ftp, 0)}w</div><div class="note">${model.targetFtp ? `Target: ${fmtNum(model.targetFtp, 0)}w` : 'No target FTP entered'}</div></div>
      <div class="kpi"><div class="label">Projected est. TSS</div><div class="value">${fmtNum(model.projectedTss, 0)}</div><div class="note">${fmtNum(model.completedTss, 0)} completed + ${fmtNum(model.plannedTss, 0)} planned</div></div>
      <div class="kpi"><div class="label">4-week avg est. TSS</div><div class="value">${fmtNum(model.baseline.avg4.tss, 0)}</div><div class="note">Ride-summary approximation</div></div>
    </div>
    <div class="notice info section">Training stress is estimated from ride-level CSV averages, not second-by-second power. Use it as a directional guardrail rather than a precise coaching metric.</div>
  </div>`;
}

function summarizeIntensityCounts(model) {
  let easy = 0, moderate = 0, hard = 0;
  for (const p of model.plan) {
    if (p.rec.hard) hard++;
    else if (p.rec.intensityLabel === 'Moderate endurance') moderate++;
    else easy++;
  }
  return `${easy} / ${moderate} / ${hard}`;
}

function sustainabilityLabel(model) {
  if (model.overload.dangers.length) return { label: 'Needs edits', note: 'Availability or goals conflict.' };
  if (model.overload.warnings.length >= 4) return { label: 'Risky', note: 'Multiple overload warnings.' };
  if (model.overload.warnings.length >= 2) return { label: 'Watch', note: 'Achievable, but monitor recovery.' };
  return { label: 'Good', note: 'Likely sustainable if recovery is normal.' };
}

