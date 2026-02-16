-- Phase 21: Defaults hardening (Request workflow)

-- Ensure current_step defaults to 1
ALTER TABLE req_submissions
  MODIFY current_step INT NOT NULL DEFAULT 1;

-- Backfill legacy rows (only active workflow statuses)
UPDATE req_submissions
  SET current_step = 1
  WHERE current_step = 0
    AND status IN ('DRAFT','PENDING');
