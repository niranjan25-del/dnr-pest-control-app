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
  technician_id: string;
  name: string;
  full_name: string;
  score: number;
  hard_eligible: boolean;
  is_available: boolean;
  serves_area: boolean;
  has_skill: boolean;
  active_jobs: number;
  distance_km: number | null;
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
