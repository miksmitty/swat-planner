import { useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
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

type ZoomLevel = 'week' | 'month' | 'quarter';

const ZOOM: Record<ZoomLevel, { dayWidth: number; weeksAhead: number; label: string }> = {
  week: { dayWidth: 40, weeksAhead: 8, label: 'Week' },
  month: { dayWidth: 28, weeksAhead: 12, label: 'Month' },
  quarter: { dayWidth: 12, weeksAhead: 26, label: 'Quarter' },
};

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

function quarterLabel(d: Date): string {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

export function Timeline({ data, onChanged }: Props) {
  const [activeBar, setActiveBar] = useState<TimelineBar | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState<ZoomLevel>('month');

  const dayWidth = ZOOM[zoom].dayWidth;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    // iOS: delay so vertical/horizontal scroll still works in the timeline
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    })
  );

  const range = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    let start = startOfWeek(today);
    start.setDate(start.getDate() - 7);

    let end = new Date(start);
    end.setDate(end.getDate() + ZOOM[zoom].weeksAhead * 7 - 1);

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
  }, [data.bars, zoom]);

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

  const quarters = useMemo(() => {
    const groups: { label: string; span: number }[] = [];
    let cur = '';
    for (const d of range.days) {
      const label = quarterLabel(d);
      if (label !== cur) {
        groups.push({ label, span: 1 });
        cur = label;
      } else {
        groups[groups.length - 1].span += 1;
      }
    }
    return groups;
  }, [range.days]);

  const todayIso = formatDate(new Date());
  const todayIndex = useMemo(() => {
    const idx = range.days.findIndex((d) => formatDate(d) === todayIso);
    return idx;
  }, [range.days, todayIso]);

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
    const dayDelta = Math.round(deltaX / dayWidth);
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
  const showMonths = zoom !== 'quarter';
  const showDays = zoom === 'week' || zoom === 'month';

  const zoomLevels: ZoomLevel[] = ['week', 'month', 'quarter'];
  function nudgeZoom(dir: -1 | 1) {
    const i = zoomLevels.indexOf(zoom);
    const next = zoomLevels[Math.min(zoomLevels.length - 1, Math.max(0, i + dir))];
    setZoom(next);
  }

  return (
    <div className="timeline-wrap">
      <div className="timeline-toolbar">
        <div>
          <h2>Resource timeline</h2>
          <p className="hint">
            Drag bars (press-hold on phone) to move/reassign — or tap a bar and use ← Day / Day → / Row.
            Multi-assign shortens calendar (effort / sum FTE).
          </p>
        </div>
        <div className="zoom-toolbar" role="group" aria-label="Timeline zoom">
          <button
            type="button"
            className="btn sm zoom-btn"
            aria-label="Zoom out"
            disabled={zoom === 'quarter'}
            onClick={() => nudgeZoom(1)}
          >
            −
          </button>
          {zoomLevels.map((z) => (
            <button
              key={z}
              type="button"
              className={'btn sm zoom-preset' + (zoom === z ? ' active' : '')}
              onClick={() => setZoom(z)}
            >
              {ZOOM[z].label}
            </button>
          ))}
          <button
            type="button"
            className="btn sm zoom-btn"
            aria-label="Zoom in"
            disabled={zoom === 'week'}
            onClick={() => nudgeZoom(-1)}
          >
            +
          </button>
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
            <div className="touch-controls">
              <button
                type="button"
                className="btn sm"
                disabled={busy}
                onClick={() => {
                  const next = shiftStartByDays(selected.start_date, -1);
                  void applyMove(selected, selected.person_id, next);
                }}
              >
                ← Day
              </button>
              <button
                type="button"
                className="btn sm"
                disabled={busy}
                onClick={() => {
                  const next = shiftStartByDays(selected.start_date, 1);
                  void applyMove(selected, selected.person_id, next);
                }}
              >
                Day →
              </button>
              <label className="reassign">
                <span className="muted">Row</span>
                <select
                  value={selected.person_id}
                  disabled={busy}
                  onChange={(e) => {
                    const personId = Number(e.target.value);
                    if (personId === selected.person_id) return;
                    void applyMove(selected, personId, selected.start_date);
                  }}
                >
                  {data.people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
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
              width: LABEL_WIDTH + range.days.length * dayWidth,
              minHeight: 80 + data.people.length * ROW_HEIGHT,
            }}
          >
            <div className="tl-header">
              <div className="tl-corner" style={{ width: LABEL_WIDTH }}>
                People
              </div>
              <div className="tl-time">
                <div className="tl-quarters">
                  {quarters.map((q) => (
                    <div
                      key={q.label + q.span}
                      className="tl-quarter"
                      style={{ width: q.span * dayWidth }}
                    >
                      {q.label}
                    </div>
                  ))}
                </div>
                {showMonths && (
                  <div className="tl-months">
                    {months.map((m) => (
                      <div
                        key={m.label + m.span}
                        className="tl-month"
                        style={{ width: m.span * dayWidth }}
                      >
                        {m.label}
                      </div>
                    ))}
                  </div>
                )}
                {showDays && (
                  <div className="tl-days">
                    {range.days.map((d) => (
                      <div
                        key={formatDate(d)}
                        className={
                          'tl-day' +
                          (isWeekend(d) ? ' weekend' : '') +
                          (formatDate(d) === todayIso ? ' today' : '')
                        }
                        style={{ width: dayWidth }}
                      >
                        <span className="dow">
                          {d.toLocaleString('en-GB', { weekday: 'narrow' })}
                        </span>
                        <span className="dom">{d.getDate()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="tl-body">
              {todayIndex >= 0 && (
                <div
                  className="tl-today-line"
                  style={{
                    left: LABEL_WIDTH + todayIndex * dayWidth + dayWidth / 2,
                  }}
                  aria-hidden
                />
              )}
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
                  dayWidth={dayWidth}
                />
              ))}
            </div>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeBar ? (
            <div
              className="bar overlay"
              style={{
                width: Math.max(
                  dayWidth,
                  barWidthDays(activeBar.start_date, activeBar.end_date) * dayWidth - 4
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
