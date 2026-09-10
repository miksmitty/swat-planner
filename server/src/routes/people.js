import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM people ORDER BY name COLLATE NOCASE').all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM people WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Person not found' });
  res.json(row);
});

router.post('/', (req, res) => {
  const { name, role = null, fte = 1 } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const f = Number(fte);
  if (!Number.isFinite(f) || f < 0 || f > 1) {
    return res.status(400).json({ error: 'fte must be between 0 and 1' });
  }
  const info = db
    .prepare('INSERT INTO people (name, role, fte) VALUES (?, ?, ?)')
    .run(String(name).trim(), role ? String(role).trim() : null, f);
  const row = db.prepare('SELECT * FROM people WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM people WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Person not found' });

  const name = req.body.name !== undefined ? String(req.body.name).trim() : existing.name;
  const role =
    req.body.role !== undefined
      ? req.body.role
        ? String(req.body.role).trim()
        : null
      : existing.role;
  const fte = req.body.fte !== undefined ? Number(req.body.fte) : existing.fte;

  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!Number.isFinite(fte) || fte < 0 || fte > 1) {
    return res.status(400).json({ error: 'fte must be between 0 and 1' });
  }

  db.prepare(
    `UPDATE people SET name = ?, role = ?, fte = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(name, role, fte, req.params.id);

  res.json(db.prepare('SELECT * FROM people WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM people WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Person not found' });
  res.status(204).end();
});

export default router;
