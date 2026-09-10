import { useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { api } from '../api/client';
import type { TimelineBar, TimelineData } from '../types';
import {
  addCalendarDays,
  eachDay,
  formatDate,
  isWeekend,
  parseDate,
  shiftStartByDays,
  startOfWeek,
} from '../utils/dates';
import { PersonRow } from './TimelineRow';

const DAY_WIDTH = 28;
const ROW_HEIGHT = 56;
const LABEL_WIDTH = 200;

interface Props {
  data: TimelineData;
  onChanged: () => Promise<void>;
}

function dayOffset(rangeStart: Date, iso: string): number {
  const a = rangeStart.getTime();
  const b = parseDate(iso).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function barWidthDays(start: string, end: string): number {
  return dayOffset(parseDate(start), end) + 1;
}

export function Timeline({ data, onChanged }: Props) {
  const [activeBar, setActiveBar] = useState<TimelineBar | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const range = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    let start = startOfWeek(today);
    start.setDate(start.getDate() - 7);

    let end = new Date(start);
    end.setDate(end.getDate() + 12 * 7 - 1); // ~12 weeks

    for (const b of data.bars) {
      const bs = parseDate(b.start_date);
      const be = parseDate(b.end_date);
      if (bs < start) start = startOfWeek(bs);
      if (be > end) {
        end = new Date(be);
        end.setDate(end.getDate() + 14);
      }
    }
    return { start, end, days: eachDay(start, end) };
  }, [data.bars]);

  const months = useMemo(() => {
    const groups: { label: string; span: number }[] = [];
    let cur = '';
    for (const d of range.days) {
      const label = d.toLocaleString('en-GB', { month: 'short', year: 'numeric' });
      if (label !== cur) {
        groups.push({ label, span: 1 });
        cur = label;
      } else {
        groups[groups.length - 1].span += 1;
      }
    }
    return groups;
  }, [range.days]);

  async function applyMove(bar: TimelineBar, personId: number, startDate: string) {
    if (busy) return;
    setBusy(true);
    try {
      await api.updateAssignment(bar.assignment_id, {
        person_id: personId,
        start_date: startDate,
        sync_siblings: true,
      });
      await onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Move failed');
    } finally {
      setBusy(false);
    }
  }

  function onDragStart(e: DragStartEvent) {
    const bar = e.active.data.current?.bar as TimelineBar | undefined;
    setActiveBar(bar || null);
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveBar(null);
    const bar = e.active.data.current?.bar as TimelineBar | undefined;
    if (!bar || !e.over) return;

    const overData = e.over.data.current as
      | { type: 'row'; personId: number }
      | { type: 'day'; personId: number; date: string }
      | undefined;

    if (!overData) return;

    const deltaX = e.delta.x;
    const dayDelta = Math.round(deltaX / DAY_WIDTH);
    let newStart = shiftStartByDays(bar.start_date, dayDelta);
    let newPerson = bar.person_id;

    if (overData.type === 'row' || overData.type === 'day') {
      newPerson = overData.personId;
    }
    if (overData.type === 'day') {
      // Prefer dropping on a specific day cell when available
      newStart = overData.date;
      while (isWeekend(parseDate(newStart))) {
        newStart = addCalendarDays(newStart, 1);
      }
    }

    if (newPerson === bar.person_id && newStart === bar.start_date) return;
    void applyMove(bar, newPerson, newStart);
  }

  async function removeAssignment(id: number) {
    if (!confirm('Remove this assignment?')) return;
    await api.deleteAssignment(id);
    setSelectedId(null);
    await onChanged();
  }

  const selected = data.bars.find((b) => b.assignment_id === selectedId);

  return (
    <div className="timeline-wrap">
      <div className="timeline-toolbar">
        <div>
          <h2>Resource timeline</h2>
          <p className="hint">
            Drag bars horizontally to move start | drop on another row to reassign | multi-assign
            shortens calendar (effort / sum FTE)
          </p>
        </div>
        {selected && (
          <div className="selection-card">
            <strong>{selected.title}</strong>
            <span className="muted">
              {selected.start_date}{' to '}{selected.end_date} |{' '}
              {selected.calendar_working_days.toFixed(1)} cal. days |{' '}
              {selected.assignee_count} assignee
              {selected.assignee_count !== 1 ? 's' : ''} | total FTE{' '}
              {selected.total_fte.toFixed(1)}
            </span>
            <button
              className="btn danger sm"
              onClick={() => removeAssignment(selected.assignment_id)}
            >
              Unassign
            </button>
          </div>
        )}
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="timeline-scroll">
          <div
            className="timeline"
            style={{
              width: LABEL_WIDTH + range.days.length * DAY_WIDTH,
              minHeight: 80 + data.people.length * ROW_HEIGHT,
            }}
          >
            <div className="tl-header">
              <div className="tl-corner" style={{ width: LABEL_WIDTH }}>
                People
              </div>
              <div className="tl-time">
                <div className="tl-months">
                  {months.map((m) => (
                    <div
                      key={m.label + m.span}
                      className="tl-month"
                      style={{ width: m.span * DAY_WIDTH }}
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
                <div className="tl-days">
                  {range.days.map((d) => (
                    <div
                      key={formatDate(d)}
                      className={
                        'tl-day' +
                        (isWeekend(d) ? ' weekend' : '') +
                        (formatDate(d) === formatDate(new Date()) ? ' today' : '')
                      }
                      style={{ width: DAY_WIDTH }}
                    >
                      <span className="dow">
                        {d.toLocaleString('en-GB', { weekday: 'narrow' })}
                      </span>
                      <span className="dom">{d.getDate()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {data.people.map((person) => (
              <PersonRow
                key={person.id}
                personId={person.id}
                name={person.name}
                role={person.role}
                fte={person.fte}
                days={range.days}
                bars={data.bars.filter((b) => b.person_id === person.id)}
                rangeStart={range.start}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ))}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeBar ? (
            <div
              className="bar overlay"
              style={{
                width: Math.max(
                  DAY_WIDTH,
                  barWidthDays(activeBar.start_date, activeBar.end_date) * DAY_WIDTH - 4
                ),
                background: activeBar.colour,
              }}
            >
              <span className="bar-title">{activeBar.title}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <div className="legend">
        <span className="muted">Complexity (label only):</span>
        {['Low', 'Medium', 'High', 'Critical'].map((c) => (
          <span key={c} className={`complexity c-${c.toLowerCase()}`}>
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}
