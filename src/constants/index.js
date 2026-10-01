const ROLES = Object.freeze({ ADMIN: 'Admin', WORKER: 'Worker' });

const JOB_STATUS = Object.freeze({
  PENDING: 'Pending',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
});

const PRIORITIES = Object.freeze(['Low', 'Medium', 'High', 'Urgent']);

// Pending -> Assigned -> In Progress -> Completed, and Cancelled from any open state.
const STATUS_TRANSITIONS = Object.freeze({
  [JOB_STATUS.PENDING]: [JOB_STATUS.ASSIGNED, JOB_STATUS.CANCELLED],
  [JOB_STATUS.ASSIGNED]: [JOB_STATUS.IN_PROGRESS, JOB_STATUS.CANCELLED],
  [JOB_STATUS.IN_PROGRESS]: [JOB_STATUS.COMPLETED, JOB_STATUS.CANCELLED],
  [JOB_STATUS.COMPLETED]: [],
  [JOB_STATUS.CANCELLED]: [],
});

const canTransition = (from, to) => (STATUS_TRANSITIONS[from] || []).includes(to);

module.exports = { ROLES, JOB_STATUS, PRIORITIES, STATUS_TRANSITIONS, canTransition };
