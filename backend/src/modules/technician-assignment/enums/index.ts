// src/modules/technician-assignment/enums/index.ts
//
// Assignment state machine + dispatch tuning constants.
//
// NOTE (schema reconciliation): the approved AssignmentStatus enum has no PENDING — a freshly
// created assignment starts at ASSIGNED. "Rejected" maps to DECLINED. We do not add statuses.

import { AssignmentStatus } from "@prisma/client";

export const ASSIGNMENT_TRANSITIONS: Record<
  AssignmentStatus,
  AssignmentStatus[]
> = {
  ASSIGNED: [
    AssignmentStatus.ACCEPTED,
    AssignmentStatus.DECLINED,
    AssignmentStatus.REASSIGNED,
    AssignmentStatus.CANCELLED,
  ],
  ACCEPTED: [
    AssignmentStatus.COMPLETED,
    AssignmentStatus.REASSIGNED,
    AssignmentStatus.CANCELLED,
  ],
  DECLINED: [],
  REASSIGNED: [],
  CANCELLED: [],
  COMPLETED: [],
};

// Assignments that "occupy" a technician (count toward workload / conflicts).
export const ACTIVE_ASSIGNMENT_STATUSES: AssignmentStatus[] = [
  AssignmentStatus.ASSIGNED,
  AssignmentStatus.ACCEPTED,
];

export function isAssignmentTransitionAllowed(
  from: AssignmentStatus,
  to: AssignmentStatus,
): boolean {
  return ASSIGNMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

// Capacity model (promote to ConfigService/DB if it must be tunable without a deploy).
export const CAPACITY = {
  MAX_CONCURRENT: 1, // one in-window job at a time
  MAX_DAILY_JOBS: 8,
  MAX_WEEKLY_JOBS: 40,
} as const;

// Auto-assignment scoring weights (sum = 100). See assignment-engine.service for rationale.
export const SCORE_WEIGHTS = {
  SERVICE_AREA: 40, // serves the booking's postal code
  SKILL: 30, // has the matching skill
  WORKLOAD: 20, // lighter current load ranks higher (balancing)
  DISTANCE: 10, // closer to the site ranks higher (tiebreaker)
} as const;
