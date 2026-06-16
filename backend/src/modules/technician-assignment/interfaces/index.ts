// src/modules/technician-assignment/interfaces/index.ts
//
// Shared shapes for the dispatch engine + dashboards.

export interface ScoreBreakdown {
  serviceArea: number;
  skill: number;
  workload: number;
  distance: number;
}

export interface TechnicianCandidate {
  technicianId: string;
  name: string;
  score: number;            // 0–100 weighted total
  breakdown: ScoreBreakdown;
  distanceKm: number | null;
  dailyActiveJobs: number;
  servesArea: boolean;
  hasSkill: boolean;
}

export interface WorkloadSummary {
  technicianId: string;
  name: string;
  isAvailable: boolean;
  dailyActive: number;
  weeklyActive: number;
  dailyCapacityRemaining: number;
}

export interface ResolvedWindow {
  start: Date;
  end: Date;
}
