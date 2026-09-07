CREATE TRIGGER guard_import_insert BEFORE INSERT ON imports
WHEN (SELECT status FROM cases WHERE id=NEW.case_id)='closed'
BEGIN SELECT RAISE(ABORT, 'LAB_CASE_CLOSED'); END;
--> statement-breakpoint
CREATE TRIGGER guard_finding_insert BEFORE INSERT ON findings
WHEN (SELECT status FROM cases WHERE id=NEW.case_id)='closed'
BEGIN SELECT RAISE(ABORT, 'LAB_CASE_CLOSED'); END;
--> statement-breakpoint
CREATE TRIGGER guard_finding_update BEFORE UPDATE ON findings
WHEN (SELECT status FROM cases WHERE id=NEW.case_id)='closed'
BEGIN SELECT RAISE(ABORT, 'LAB_CASE_CLOSED'); END;
--> statement-breakpoint
CREATE TRIGGER guard_report_insert BEFORE INSERT ON reports
WHEN (SELECT status FROM cases WHERE id=NEW.case_id)='closed'
BEGIN SELECT RAISE(ABORT, 'LAB_CASE_CLOSED'); END;
--> statement-breakpoint
CREATE TRIGGER guard_report_update BEFORE UPDATE ON reports
WHEN (SELECT status FROM cases WHERE id=NEW.case_id)='closed'
BEGIN SELECT RAISE(ABORT, 'LAB_CASE_CLOSED'); END;

