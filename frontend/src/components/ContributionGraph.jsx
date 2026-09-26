import React, { useState } from 'react';

// Day labels for the left axis
const DAY_LABELS = [
  { index: 1, label: 'Mon' },
  { index: 3, label: 'Wed' },
  { index: 5, label: 'Fri' },
];

export default function ContributionGraph({ contributions, title, defaultMode = 'all' }) {
  const [mode, setMode] = useState(defaultMode); // 'all', 'notes', 'habits'
  const [hoveredDay, setHoveredDay] = useState(null);

  if (!contributions || !contributions.days || contributions.days.length === 0) {
    return null;
  }

  const { days, total_notes_written, total_habits_completed } = contributions;

  // Build a lookup map by YYYY-MM-DD
  const dayMap = {};
  days.forEach((d) => {
    dayMap[d.date] = d;
  });

  // Align dates into weeks (Sunday = 0 to Saturday = 6)
  const firstDate = new Date(days[0].date + 'T00:00:00');
  const lastDate = new Date(days[days.length - 1].date + 'T00:00:00');

  // Find start of the first week (previous Sunday)
  const startSunday = new Date(firstDate);
  startSunday.setDate(firstDate.getDate() - firstDate.getDay());

  // Find end of the last week (next Saturday)
  const endSaturday = new Date(lastDate);
  endSaturday.setDate(lastDate.getDate() + (6 - lastDate.getDay()));

  const weeks = [];
  let currentWeek = [];
  const monthLabels = []; // { colIndex: number, text: string }

  let curr = new Date(startSunday);
  let colIndex = 0;
  let lastSeenMonth = -1;

  while (curr <= endSaturday) {
    const dayOfWeek = curr.getDay(); // 0 is Sunday, 6 is Saturday
    const dateStr = curr.toISOString().split('T')[0];
    const item = dayMap[dateStr] || null;

    // Check for month label change around the first week of a month
    const month = curr.getMonth();
    if (dayOfWeek === 0 && month !== lastSeenMonth) {
      const monthName = curr.toLocaleDateString('en-US', { month: 'short' });
      monthLabels.push({ colIndex, text: monthName });
      lastSeenMonth = month;
    }

    currentWeek.push({
      dateStr,
      item,
      inRange: Boolean(item),
      dayOfWeek,
    });

    if (dayOfWeek === 6) {
      weeks.push(currentWeek);
      currentWeek = [];
      colIndex++;
    }

    curr.setDate(curr.getDate() + 1);
  }

  // Calculate intensity level (0 to 4)
  const getIntensityLevel = (item) => {
    if (!item) return 0;

    if (mode === 'notes') {
      if (!item.has_note) return 0;
      if (item.note_words > 120) return 4;
      if (item.note_words > 60) return 3;
      if (item.note_words > 20) return 2;
      return 1;
    }

    if (mode === 'habits') {
      if (!item.habits_completed) return 0;
      const ratio = item.total_habits > 0 ? item.habits_completed / item.total_habits : 0;
      if (ratio >= 0.8) return 4;
      if (ratio >= 0.5) return 3;
      if (ratio >= 0.25) return 2;
      return 1;
    }

    // 'all' combined mode
    let score = 0;
    if (item.has_note) score += 2;
    if (item.habits_completed > 0) {
      const ratio = item.total_habits > 0 ? item.habits_completed / item.total_habits : 0;
      score += ratio >= 0.6 ? 2 : 1;
    }
    return Math.min(score, 4);
  };

  // Active days count
  const activeDaysCount = days.filter((d) => {
    if (mode === 'notes') return d.has_note;
    if (mode === 'habits') return d.habits_completed > 0;
    return d.has_note || d.habits_completed > 0;
  }).length;

  return (
    <div className="contribution-container">
      <div className="contribution-header">
        <div>
          <h3 className="contribution-title">{title || 'Consistency heatmap'}</h3>
          <div className="contribution-stats">
            <span>{activeDaysCount} active days</span>
            <span>&bull;</span>
            <span>{total_notes_written} notes written</span>
            <span>&bull;</span>
            <span>{total_habits_completed} habits checked</span>
          </div>
        </div>

        <div className="contribution-mode-selector">
          <button
            type="button"
            className={`mode-btn ${mode === 'all' ? 'active' : ''}`}
            onClick={() => setMode('all')}
          >
            All
          </button>
          <button
            type="button"
            className={`mode-btn ${mode === 'notes' ? 'active' : ''}`}
            onClick={() => setMode('notes')}
          >
            Daily notes
          </button>
          <button
            type="button"
            className={`mode-btn ${mode === 'habits' ? 'active' : ''}`}
            onClick={() => setMode('habits')}
          >
            Habits
          </button>
        </div>
      </div>

      {/* Heatmap Grid Wrapper with horizontal scroll on small screens */}
      <div className="heatmap-scroll-area">
        <div className="heatmap-grid-table">
          {/* Month Labels */}
          <div className="heatmap-month-row">
            <div className="heatmap-day-label-space" />
            <div className="heatmap-months-container">
              {monthLabels.map((m, idx) => (
                <span
                  key={idx}
                  className="heatmap-month-label"
                  style={{ left: `${m.colIndex * 15}px` }}
                >
                  {m.text}
                </span>
              ))}
            </div>
          </div>

          <div className="heatmap-body">
            {/* Day Axis Labels (Mon, Wed, Fri) */}
            <div className="heatmap-day-labels">
              {DAY_LABELS.map((dl) => (
                <span
                  key={dl.index}
                  className="heatmap-day-label"
                  style={{ top: `${dl.index * 15}px` }}
                >
                  {dl.label}
                </span>
              ))}
            </div>

            {/* Weeks Columns */}
            <div className="heatmap-columns">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="heatmap-week-column">
                  {week.map((day) => {
                    const level = day.inRange ? getIntensityLevel(day.item) : 0;
                    return (
                      <div
                        key={day.dateStr}
                        className={`heatmap-cell level-${level} ${!day.inRange ? 'outside-range' : ''}`}
                        onMouseEnter={() => day.inRange && setHoveredDay(day.item)}
                        onMouseLeave={() => setHoveredDay(null)}
                        onClick={() => day.inRange && setHoveredDay(day.item)}
                        tabIndex={0}
                        aria-label={`${day.dateStr}: level ${level}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip / Status Display */}
      <div className="heatmap-footer">
        <div className="heatmap-tooltip">
          {hoveredDay ? (
            <span>
              <strong>{hoveredDay.date}</strong>: {hoveredDay.has_note ? `${hoveredDay.note_words} words noted` : 'No daily note'},{' '}
              {hoveredDay.habits_completed} / {hoveredDay.total_habits} habits completed
            </span>
          ) : (
            <span>Hover or tap a cell to inspect daily details</span>
          )}
        </div>

        <div className="heatmap-legend">
          <span>Less</span>
          <div className="heatmap-cell level-0" />
          <div className="heatmap-cell level-1" />
          <div className="heatmap-cell level-2" />
          <div className="heatmap-cell level-3" />
          <div className="heatmap-cell level-4" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
