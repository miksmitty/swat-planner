import { Router } from 'express';
import db from '../db.js';
import { computeSpan } from '../duration.js';

const router = Router();

/**
 * GET /api/timeline
 * Returns people rows with bars enriched by FTE-scaled calendar duration.
 * Multi-assign: FTEs summed across all assignees of the same project.
 */
router.get('/', (_req, res) => {
  const people = db.prepare('SELECT * FROM people ORDER BY name COLLATE NOCASE').all();
  const projects = db.prepare('SELECT * FROM projects').all();
  const projectById = Object.fromEntries(projects.map((p) => [p.id, p]));

  const allAssignments = db
    .prepare(
      `SELECT a.*, pe.name AS person_name, pe.fte AS person_fte
       FROM assignments a
       JOIN people pe ON pe.id = a.person_id`
    )
    .all();

  // Group by project to sum FTEs
  const byProject = new Map();
  for (const a of allAssignments) {
    if (!byProject.has(a.project_id)) byProject.set(a.project_id, []);
    byProject.get(a.project_id).push(a);
  }

  const bars = allAssignments.map((a) => {
    const project = projectById[a.project_id];
    const siblings = byProject.get(a.project_id) || [];
    const ftes = siblings.map((s) => s.person_fte);
    const span = computeSpan(
      a.start_date,
      project.effort_amount,
      project.effort_unit,
      ftes
    );
    return {
      assignment_id: a.id,
      project_id: a.project_id,
      person_id: a.person_id,
      person_name: a.person_name,
      start_date: span.start_date,
      end_date: span.end_date,
      calendar_working_days: span.calendar_working_days,
      effort_working_days: span.effort_working_days,
      title: project.title,
      colour: project.colour,
      complexity: project.complexity,
      effort_amount: project.effort_amount,
      effort_unit: project.effort_unit,
      assignee_count: siblings.length,
      total_fte: ftes.reduce((s, f) => s + f, 0),
    };
  });

  res.json({ people, bars, projects });
});

export default router;
