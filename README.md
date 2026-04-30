# Peloton Training Recommendation Engine v3

A static, local-only browser app that reads a Peloton workout CSV and recommends remaining-week Peloton ride blocks based on:

- weekly mileage goal
- weekly output goal
- primary fitness goal
- optional current FTP and target FTP
- recent Peloton baseline
- available days and preferred rest day
- overload protection rules
- nutrition and recovery guidance

## How to use

1. Open `index.html` in a web browser.
2. Upload your Peloton workout CSV.
3. Choose your primary fitness goal.
4. Enter your weekly mile goal and optional output goal.
5. Enter current FTP and target FTP if known.
6. Confirm available days, max minutes/day, and preferred rest day.
7. Review the weekly summary, recommendation table, warnings, nutrition guidance, and adjustment rules.
8. Use **Copy plan as text** or **Export plan CSV** to save the recommendation.

## Privacy

Your CSV is processed locally in the browser. The app does not upload, transmit, store, or track your workout data.

## Recommendation approach

The app filters the CSV to cycling workouts, identifies the selected training week, calculates current progress, and builds recent ride profiles from your own history. It recommends flexible ride blocks rather than exact Peloton class IDs.

If FTP is entered, the app estimates intensity factor using:

```text
Intensity Factor = Avg. Watts / FTP
```

And estimates training stress using:

```text
Estimated TSS = hours × IF² × 100
```

These are directional estimates because the Peloton CSV contains ride-level summaries, not second-by-second power data.

## Known limitations

- The app recommends ride blocks, not specific Peloton class IDs.
- FTP-based training stress is approximate because it uses average watts.
- If the CSV has limited recent history, fallback estimates are used.
- Nutrition guidance is general and habit-focused, not medical advice.

## Suggested next enhancements

- Add charts for weekly mileage and output trends.
- Add an intensity distribution visualization.
- Add a plan comparison view by fitness goal.
- Add manual current-week override fields for workouts not yet exported.
- Add support for imported TCX/FIT files for second-by-second ride analysis.
