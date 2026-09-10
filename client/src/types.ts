export type Complexity = 'Low' | 'Medium' | 'High' | 'Critical';
export type EffortUnit = 'days' | 'weeks' | 'months';

export interface Person {
  id: number;
  name: string;
  role: string | null;
  fte: number;
  created_at?: string;
  updated_at?: string;
}

export interface Project {
  id: number;
  title: string;
  complexity: Complexity;
  effort_amount: number;
  effort_unit: EffortUnit;
  notes: string | null;
  colour: string;
  created_at?: string;
  updated_at?: string;
}

export interface TimelineBar {
  assignment_id: number;
  project_id: number;
  person_id: number;
  person_name: string;
  start_date: string;
  end_date: string;
  calendar_working_days: number;
  effort_working_days: number;
  title: string;
  colour: string;
  complexity: Complexity;
  effort_amount: number;
  effort_unit: EffortUnit;
  assignee_count: number;
  total_fte: number;
}

export interface TimelineData {
  people: Person[];
  bars: TimelineBar[];
  projects: Project[];
}
