import type { CSSProperties } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { TimelineBar } from '../types';
import { formatDate, isWeekend, parseDate } from '../utils/dates';

const DAY_WIDTH = 28;
const ROW_HEIGHT = 56;
const LABEL_WIDTH = 200;

function dayOffset(rangeStart: Date, iso: string): number {
  const a = rangeStart.getTime();
  const b = parseDate(iso).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function barWidthDays(start: string, end: string): number {
  return dayOffset(parseDate(start), end) + 1;
}

export function PersonRow({
  personId,
  name,
  role,
  fte,
  days,
  bars,
  rangeStart,
  selectedId,
  onSelect,
}: {
  personId: number;
  name: string;
  role: string | null;
  fte: number;
  days: Date[];
  bars: TimelineBar[];
  rangeStart: Date;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `row-${personId}`,
    data: { type: 'row', personId },
  });

  return (
    <div className={'tl-row' + (isOver ? ' drop-over' : '')} ref={setNodeRef}>
      <div className="tl-label" style={{ width: LABEL_WIDTH, height: ROW_HEIGHT }}>
        <div className="person-name">{name}</div>
        <div className="person-meta">
          {role || '-'} | <span className="pill">{fte.toFixed(1)} FTE</span>
        </div>
      </div>
      <div className="tl-track" style={{ height: ROW_HEIGHT }}>
        {days.map((d) => {
          const iso = formatDate(d);
          return (
            <DayCell key={iso} personId={personId} date={iso} weekend={isWeekend(d)} />
          );
        })}
        {bars.map((bar) => (
          <Bar
            key={bar.assignment_id}
            bar={bar}
            left={dayOffset(rangeStart, bar.start_date) * DAY_WIDTH + 2}
            width={barWidthDays(bar.start_date, bar.end_date) * DAY_WIDTH - 4}
            selected={selectedId === bar.assignment_id}
            onSelect={() => onSelect(bar.assignment_id)}
          />
        ))}
      </div>
    </div>
  );
}

function DayCell({
  personId,
  date,
  weekend,
}: {
  personId: number;
  date: string;
  weekend: boolean;
}) {
  const { setNodeRef } = useDroppable({
    id: `day-${personId}-${date}`,
    data: { type: 'day', personId, date },
  });
  return (
    <div
      ref={setNodeRef}
      className={'tl-cell' + (weekend ? ' weekend' : '')}
      style={{ width: DAY_WIDTH, height: ROW_HEIGHT }}
    />
  );
}

export function Bar({
  bar,
  left,
  width,
  selected,
  onSelect,
}: {
  bar: TimelineBar;
  left: number;
  width: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `bar-${bar.assignment_id}`,
    data: { bar },
  });

  const style: CSSProperties = {
    left,
    width: Math.max(DAY_WIDTH - 4, width),
    background: bar.colour,
    opacity: isDragging ? 0.35 : 1,
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      className={'bar' + (selected ? ' selected' : '')}
      style={style}
      title={`${bar.title}\n${bar.start_date}  to  ${bar.end_date}\n${bar.calendar_working_days.toFixed(1)} calendar working days\n${bar.assignee_count} assignees | total FTE ${bar.total_fte.toFixed(1)}\nComplexity: ${bar.complexity} (label only)`}
      onClick={onSelect}
      {...listeners}
      {...attributes}
    >
      <span className="bar-title">{bar.title}</span>
      {bar.assignee_count > 1 && (
        <span className="bar-badge">{bar.assignee_count}x</span>
      )}
    </div>
  );
}
