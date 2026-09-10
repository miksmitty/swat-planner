export function seedIfEmpty(db) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM people').get().c;
  if (count > 0) return;

  const insertPerson = db.prepare(
    'INSERT INTO people (name, role, fte) VALUES (?, ?, ?)'
  );
  const insertProject = db.prepare(
    `INSERT INTO projects (title, complexity, effort_amount, effort_unit, notes, colour)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insertAssignment = db.prepare(
    'INSERT INTO assignments (project_id, person_id, start_date) VALUES (?, ?, ?)'
  );

  const seed = db.transaction(() => {
    const people = [
      ['Alice Chen', 'Lead Consultant', 1.0],
      ['Ben Okonkwo', 'Consultant', 1.0],
      ['Clara Webb', 'Analyst', 0.5],
      ['Diego Ruiz', 'Consultant', 0.8],
      ['Emma Frost', 'Senior Consultant', 1.0],
      ['Farah Khan', 'Analyst', 0.6],
    ];
    const personIds = people.map((p) => insertPerson.run(...p).lastInsertRowid);

    const projects = [
      ['Q3 Operating Model', 'High', 3, 'weeks', 'Org design workstream', '#3B82F6'],
      ['Data Platform Discovery', 'Medium', 10, 'days', null, '#10B981'],
      ['Board Pack Refresh', 'Low', 1, 'weeks', 'Light touch', '#F59E0B'],
      ['Cost Takeout Sprint', 'Critical', 2, 'months', 'Parallel workstreams', '#EF4444'],
      ['Vendor RFP Support', 'Medium', 15, 'days', null, '#8B5CF6'],
    ];
    const projectIds = projects.map((p) => insertProject.run(...p).lastInsertRowid);

    // Multi-assign on project 0 (Alice 1.0 + Clara 0.5) → shorter calendar
    insertAssignment.run(projectIds[0], personIds[0], '2026-09-14');
    insertAssignment.run(projectIds[0], personIds[2], '2026-09-14');

    insertAssignment.run(projectIds[1], personIds[1], '2026-09-21');
    insertAssignment.run(projectIds[2], personIds[4], '2026-09-07');

    // Critical long project: Emma + Diego + Farah in parallel
    insertAssignment.run(projectIds[3], personIds[4], '2026-09-28');
    insertAssignment.run(projectIds[3], personIds[3], '2026-09-28');
    insertAssignment.run(projectIds[3], personIds[5], '2026-09-28');

    insertAssignment.run(projectIds[4], personIds[1], '2026-10-05');
    insertAssignment.run(projectIds[4], personIds[2], '2026-10-05');
  });

  seed();
  console.log('Seeded people, projects, and assignments');
}
