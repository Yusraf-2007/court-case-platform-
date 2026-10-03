-- 009_seed_orders_and_audit.sql
-- Seeds every dated order stated in DOMAIN.md's Example cases, and Case 51's
-- transfer as a case_audit_log row. order_text follows DOMAIN.md's wording.
--
-- ===========================================================================
-- KNOWN GAPS
--
-- Hearings
--   1. NO hearings are seeded. DOMAIN.md gives listed/adjourned COUNTS (e.g.
--      Case 1: listed 23, adjourned 9, with reasons), not hearing dates.
--      Turning counts into rows would mean inventing 500+ dates.
--   2. Case 53's "last effective hearing 04-09-2023" is the only dated
--      hearing; its outcome is not stated, so it is not seeded either.
--   3. Dated ranges are not orders and are not seeded: e.g. Case 1
--      "14-07-2024 to 10-11-2025 prosecution evidence", Case 4 "2024
--      complainant's evidence".
--   4. With no hearings, every order has hearing_id NULL.
--
-- Orders
--   5. order_type mapping (DOMAIN.md's eight types, otherwise 'other'):
--        "cognizance taken, process/summons issued"  -> cognizance
--        "accused appeared, bail granted", Misc. bail -> bail
--        "accused appeared" (no bail stated)         -> other
--        "notice of accusation under s.251 CrPC"     -> charge_framing
--        appeal/revision/complaint dismissed         -> dismissal
--        Case 24 "compounded ... accused acquitted"  -> acquittal
--        appeal admitted, statement of accused,
--        solemn affirmation, allowed/remanded,
--        compounded (Case 47), abated, exemption,
--        stay, renumbering                           -> other
--   6. is_final is true for the order that disposes of the case it is
--      passed in (including Misc. bail orders and Case 48's abatement).
--   7. judge_id is set only for Case 1 (Sri A. K. Verma) and Case 11
--      (Sri S. N. Pandey), the presiding officers DOMAIN.md names, and
--      only on those cases' orders.
--   8. Case 53's stay is an order in Cr. Misc. 3300/2023 (Patna High Court),
--      dated 11-09-2023.
--   9. Not seeded, no date stated: Case 52's two non-bailable warrants.
--
-- Audit log
--  10. Case 51's transfer (JMFC Court No. 3 -> No. 7, 14-06-2023) is seeded.
--      Case 7's reopening on remand is NOT: DOMAIN.md gives the remand order
--      date (18-02-2026, Case 16) but not the date the JMFC reopened it.
-- ===========================================================================

BEGIN;

INSERT INTO orders (case_id, judge_id, order_date, order_type, order_text, is_final)
SELECT c.id, j.id, v.order_date::date, v.order_type::order_type, v.order_text, v.is_final
FROM (VALUES
    -- Case 1, G.R. 412/2024
    ('GR',   412, 2024, 'A. K. Verma',  '2024-03-18', 'cognizance',     'Cognizance taken', false),
    ('GR',   412, 2024, 'A. K. Verma',  '2024-04-02', 'summons_warrant','Summons issued', false),
    ('GR',   412, 2024, 'A. K. Verma',  '2024-04-29', 'bail',           'Accused appeared, bail granted on bond of Rs 15,000', false),
    ('GR',   412, 2024, 'A. K. Verma',  '2024-06-20', 'charge_framing', 'Charge framed under IPC 379', false),
    ('GR',   412, 2024, 'A. K. Verma',  '2025-12-02', 'other',          'Statement of accused recorded', false),
    ('GR',   412, 2024, 'A. K. Verma',  '2026-01-08', 'conviction',     'Judgment: convicted, 2 years RI and fine Rs 5,000', true),
    -- Case 4, C.C. 55/2023
    ('CC',    55, 2023, NULL,           '2023-04-20', 'other',          'Complainant examined on solemn affirmation', false),
    ('CC',    55, 2023, NULL,           '2023-05-11', 'cognizance',     'Cognizance taken, process issued', false),
    ('CC',    55, 2023, NULL,           '2023-08-08', 'other',          'Accused appeared', false),
    ('CC',    55, 2023, NULL,           '2023-11-14', 'charge_framing', 'Charge framed', false),
    ('CC',    55, 2023, NULL,           '2025-11-21', 'acquittal',      'Judgment: acquitted (entrustment not proved)', true),
    -- Case 5, G.R. 120/2022
    ('GR',   120, 2022, NULL,           '2022-03-03', 'cognizance',     'Cognizance', false),
    ('GR',   120, 2022, NULL,           '2022-07-19', 'bail',           'Accused appeared, bail granted', false),
    ('GR',   120, 2022, NULL,           '2022-12-06', 'charge_framing', 'Charge framed', false),
    ('GR',   120, 2022, NULL,           '2024-07-16', 'conviction',     'Judgment: convicted, 1 year RI', true),
    -- Case 6, N.I. Act 201/2024
    ('NI',   201, 2024, NULL,           '2024-03-11', 'cognizance',     'Cognizance, summons issued', false),
    ('NI',   201, 2024, NULL,           '2024-06-06', 'bail',           'Accused appeared, bail granted', false),
    ('NI',   201, 2024, NULL,           '2024-08-02', 'charge_framing', 'Notice of accusation under s.251 CrPC explained', false),
    ('NI',   201, 2024, NULL,           '2026-02-19', 'conviction',     'Judgment: convicted, fine Rs 3,00,000 with default sentence of 6 months SI', true),
    -- Case 7, G.R. 77/2023
    ('GR',    77, 2023, NULL,           '2023-02-10', 'cognizance',     'Cognizance', false),
    ('GR',    77, 2023, NULL,           '2023-05-15', 'other',          'Accused appeared', false),
    ('GR',    77, 2023, NULL,           '2023-09-28', 'charge_framing', 'Charge framed', false),
    ('GR',    77, 2023, NULL,           '2025-09-30', 'acquittal',      'Judgment: acquitted', true),
    -- Case 8, C.C. 33/2024
    ('CC',    33, 2024, NULL,           '2024-06-18', 'dismissal',      'Complaint dismissed at pre-cognizance stage under s.203 CrPC; no sufficient ground for proceeding', true),
    -- Case 11, Cr. Appeal 88/2026
    ('CRA',   88, 2026, 'S. N. Pandey', '2026-02-04', 'other',          'Appeal admitted, LCR called for', false),
    ('CRA',   88, 2026, 'S. N. Pandey', '2026-06-11', 'dismissal',      'Judgment: conviction upheld, appeal dismissed', true),
    -- Case 12, Cr. Revision 1204/2026
    ('CRR', 1204, 2026, NULL,           '2026-08-22', 'other',          'Revision allowed in part; matter remanded to the trial court for fresh consideration of the evidence of PW-3 and PW-5', true),
    -- Case 14, Cr. Appeal 30/2024
    ('CRA',   30, 2024, NULL,           '2025-03-24', 'dismissal',      'Appeal dismissed, conviction upheld', true),
    -- Case 16, Cr. Appeal 70/2025
    ('CRA',   70, 2025, NULL,           '2026-02-18', 'other',          'Appeal allowed; acquittal set aside; matter remanded to JMFC for retrial from the stage of defence evidence', true),
    -- Case 17, Cr. Revision 455/2024
    ('CRR',  455, 2024, NULL,           '2025-01-20', 'dismissal',      'Revision dismissed', true),
    -- Case 18, Cr. Revision 880/2025
    ('CRR',  880, 2025, NULL,           '2025-12-15', 'dismissal',      'Revision dismissed', true),
    -- Case 21, N.I. Act 110/2023
    ('NI',   110, 2023, NULL,           '2025-10-14', 'conviction',     'Convicted, fine Rs 1,70,000', true),
    -- Case 24, N.I. Act 180/2024
    ('NI',   180, 2024, NULL,           '2026-03-11', 'acquittal',      'Parties settled; complaint compounded under s.147 N.I. Act; accused acquitted', true),
    -- Case 26, N.I. Act 95/2023
    ('NI',    95, 2023, NULL,           '2025-08-07', 'dismissal',      'Complainant absent on four consecutive dates; complaint dismissed for default', true),
    -- Group F
    ('GR',   310, 2022, NULL,           '2024-04-17', 'conviction',     'Convicted, 6 months RI', true),                                                    -- 39
    ('GR',   180, 2022, NULL,           '2024-05-23', 'acquittal',      'Acquitted, benefit of doubt; prosecution witnesses did not support the case', true), -- 40
    ('CC',    20, 2023, NULL,           '2024-12-09', 'dismissal',      'Dismissed for want of prosecution after the complainant remained absent on three consecutive dates', true), -- 44
    ('GR',   260, 2023, NULL,           '2025-01-20', 'other',          'Compounded between the parties', true),                                            -- 47
    ('CC',    88, 2022, NULL,           '2024-03-11', 'other',          'Case abated: complainant Ram Pravesh Singh died during the pendency of the proceeding', true), -- 48
    ('GR',    95, 2022, NULL,           '2023-08-28', 'conviction',     'Convicted, fine of Rs 2,000 only, no custodial sentence', true),                   -- 49
    ('GR',   445, 2023, NULL,           '2025-02-14', 'acquittal',      'Acquitted; both eye-witnesses turned hostile', true),                              -- 50
    -- Group G: Misc.
    ('MISC',  92, 2026, NULL,           '2026-04-18', 'bail',           'Bail allowed on a bond of Rs 20,000 with two sureties of the like amount', true),   -- 41
    ('MISC', 118, 2025, NULL,           '2025-11-14', 'bail',           'Bail rejected', true),                                                             -- 42
    ('MISC',  44, 2026, NULL,           '2026-03-06', 'bail',           'Second bail application, on a change of circumstances, allowed', true),          -- 43
    ('MISC',  77, 2024, NULL,           '2024-10-08', 'other',          'Application for exemption from personal appearance allowed', true),               -- 45
    -- Case 53's stay, passed in Cr. Misc. 3300/2023
    ('CRMISC',3300,2023, NULL,          '2023-09-11', 'other',          'Proceedings in G.R. 222/2022 stayed pending disposal of a connected quashing petition', false),
    -- Case 55, C.C. 112/2023
    ('CC',   112, 2023, NULL,           '2024-07-22', 'other',          'Error noticed; matter renumbered into the N.I. Act register as N.I. Act 240/2024, carrying forward all proceedings', true)
) AS v (code, num, yr, judge, order_date, order_type, order_text, is_final)
JOIN case_types ct ON ct.code = v.code
JOIN cases c       ON (c.case_type_id, c.case_number, c.case_year) = (ct.id, v.num, v.yr)
LEFT JOIN judges j ON j.full_name = v.judge;

-- Case 51: transferred from JMFC Court No. 3 to No. 7 on 14-06-2023.
INSERT INTO case_audit_log (case_id, field_changed, old_value, new_value, changed_at)
SELECT c.id, 'court_id', old_court.id::text, new_court.id::text, '2023-06-14'
FROM cases c
JOIN case_types ct      ON ct.id = c.case_type_id
JOIN courts old_court   ON old_court.name = 'JMFC Court No. 3, Begusarai'
JOIN courts new_court   ON new_court.name = 'JMFC Court No. 7, Begusarai'
WHERE (ct.code, c.case_number, c.case_year) = ('GR', 150, 2021);

COMMIT;
