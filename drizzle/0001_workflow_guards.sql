CREATE TRIGGER guard_task_insert BEFORE INSERT ON tasks
WHEN (SELECT status FROM cases WHERE id=NEW.case_id)='closed'
BEGIN SELECT RAISE(ABORT, 'LAB_CASE_CLOSED'); END;
--> statement-breakpoint
CREATE TRIGGER guard_task_update BEFORE UPDATE ON tasks
WHEN (SELECT status FROM cases WHERE id=NEW.case_id)='closed'
BEGIN SELECT RAISE(ABORT, 'LAB_CASE_CLOSED'); END;
--> statement-breakpoint
CREATE TRIGGER guard_evidence_insert BEFORE INSERT ON evidence
WHEN (SELECT status FROM cases WHERE id=NEW.case_id)='closed'
BEGIN SELECT RAISE(ABORT, 'LAB_CASE_CLOSED'); END;
--> statement-breakpoint
CREATE TRIGGER guard_evidence_update BEFORE UPDATE ON evidence
WHEN (SELECT status FROM cases WHERE id=NEW.case_id)='closed'
BEGIN SELECT RAISE(ABORT, 'LAB_CASE_CLOSED'); END;
--> statement-breakpoint
CREATE TRIGGER guard_custody_insert BEFORE INSERT ON custody
WHEN (SELECT status FROM cases WHERE id=NEW.case_id)='closed'
BEGIN SELECT RAISE(ABORT, 'LAB_CASE_CLOSED'); END;
--> statement-breakpoint
CREATE TRIGGER guard_case_close BEFORE UPDATE OF status ON cases
WHEN NEW.status='closed' AND EXISTS(SELECT 1 FROM tasks WHERE case_id=NEW.id AND status='open')
BEGIN SELECT RAISE(ABORT, 'LAB_OPEN_TASKS'); END;

