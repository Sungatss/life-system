import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar, RotateCcw, Search } from 'lucide-react';
import { getLocalDateStr } from '../utils/date';

export default function DateNavigator({ currentDateStr, onDateChange, onOpenSearch }) {
  const todayStr = getLocalDateStr();
  const datePickerRef = useRef(null);

  const dateObj = new Date(currentDateStr + 'T00:00:00');
  const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const isToday = currentDateStr === todayStr;

  const handlePrevDay = () => {
    const prev = new Date(dateObj);
    prev.setDate(prev.getDate() - 1);
    onDateChange(getLocalDateStr(prev));
  };

  const handleNextDay = () => {
    const next = new Date(dateObj);
    next.setDate(next.getDate() + 1);
    onDateChange(getLocalDateStr(next));
  };

  const handleJumpToday = () => {
    onDateChange(todayStr);
  };

  const handlePickerChange = (e) => {
    if (e.target.value) {
      onDateChange(e.target.value);
    }
  };

  return (
    <div className="cockpit-date-banner">
      <div className="date-banner-top">
        <div className="date-status-wrap">
          <div className="cockpit-weekday">{weekday}</div>
          {!isToday && (
            <span className="past-date-pill">
              {currentDateStr < todayStr ? 'Past Date' : 'Future Date'}
            </span>
          )}
        </div>

        <div className="date-banner-actions">
          {!isToday && (
            <button
              type="button"
              className="btn-today-return"
              onClick={handleJumpToday}
              title="Return to Today"
            >
              <RotateCcw size={12} />
              <span>Today</span>
            </button>
          )}

          {onOpenSearch && (
            <button
              type="button"
              className="btn-search-trigger"
              onClick={onOpenSearch}
              title="Search all daily notes"
            >
              <Search size={13} />
              <span>Search Notes</span>
            </button>
          )}
        </div>
      </div>

      <div className="date-controls-row">
        <button
          type="button"
          className="date-nav-btn"
          onClick={handlePrevDay}
          title="Previous day"
          aria-label="Previous day"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="date-title-picker-wrap">
          <h1 className="cockpit-title">
            <button
              type="button"
              className="date-title-button"
              onClick={() => datePickerRef.current?.showPicker?.() || datePickerRef.current?.click()}
              aria-label={`Choose date, currently ${formattedDate}`}
            >
              {formattedDate}
            </button>
          </h1>

          <button
            type="button"
            className="calendar-icon-btn"
            onClick={() => datePickerRef.current?.showPicker?.() || datePickerRef.current?.click()}
            title="Pick a specific date"
            aria-label="Open date picker calendar"
          >
            <Calendar size={16} />
          </button>

          {/* Hidden native date input with native picker support */}
          <input
            ref={datePickerRef}
            type="date"
            className="date-picker-hidden"
            value={currentDateStr}
            onChange={handlePickerChange}
            aria-label="Select date"
          />
        </div>

        <button
          type="button"
          className="date-nav-btn"
          onClick={handleNextDay}
          title="Next day"
          aria-label="Next day"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
