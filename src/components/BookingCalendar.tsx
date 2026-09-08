import { useState, useEffect, useRef } from 'react';

const blockedDates = [
  '2025-01-20',
  '2025-01-25',
  '2025-02-19',
  '2026-01-19',
];

interface BookingCalendarProps {
  selectedDate: string | null;
  onDateSelect: (date: string) => void;
  showCalendar: boolean;
  onToggleCalendar: (show: boolean) => void;
  disabled?: boolean;
}

export default function BookingCalendar({ selectedDate, onDateSelect, showCalendar, onToggleCalendar, disabled = false }: BookingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const calendarRef = useRef<HTMLDivElement>(null);

  const formatDateToString = (date: Date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateDisplay = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest('.date-picker-wrapper')) {
          onToggleCalendar(false);
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [onToggleCalendar]);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date();
  const todayMidnight = new Date(today);
  todayMidnight.setHours(0, 0, 0, 0);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleDayClick = (dateString: string) => {
    onDateSelect(dateString);
    onToggleCalendar(false);
  };

  const renderDays = () => {
    const days = [];

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day other-month"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const dateString = formatDateToString(date);
      const isPast = date < todayMidnight;
      const isToday = dateString === formatDateToString(today);
      const isBlocked = blockedDates.includes(dateString);
      const isSelected = selectedDate === dateString;

      let classes = 'calendar-day';
      if (isPast) classes += ' disabled';
      if (isToday) classes += ' today';
      if (isBlocked) classes += ' blocked';
      if (isSelected) classes += ' selected';

      days.push(
        <div
          key={day}
          className={classes}
          data-date={dateString}
          onClick={() => {
            if (!isPast && !isBlocked) {
              handleDayClick(dateString);
            }
          }}
        >
          {day}
        </div>
      );
    }

    return days;
  };

  return (
    <div className="form-field">
      <label>Select Date *</label>
      <div className="date-picker-wrapper">
        <input
          type="text"
          id="bookingDate"
          name="date"
          placeholder="Choose a date"
          readOnly
          required
          value={selectedDate ? formatDateDisplay(selectedDate) : ''}
          onClick={() => onToggleCalendar(!showCalendar)}
        />
        <div className="calendar-icon">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="4" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3 8H17M7 2V4M13 2V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
      {showCalendar && (
        <div ref={calendarRef} className="calendar-container" style={{ display: 'block' }}>
          <div className="calendar-header">
            <button type="button" className="calendar-nav-btn" onClick={handlePrevMonth}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="calendar-month-year">{monthNames[currentMonth]} {currentYear}</div>
            <button type="button" className="calendar-nav-btn" onClick={handleNextMonth}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M8 4L14 10L8 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <div className="calendar-weekdays">
            {weekdays.map(day => (
              <div key={day} className="calendar-weekday">{day}</div>
            ))}
          </div>
          <div className="calendar-days">
            {renderDays()}
          </div>
        </div>
      )}
    </div>
  );
}