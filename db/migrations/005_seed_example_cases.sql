-- 005_seed_example_cases.sql
-- Seeds the example cases from DOMAIN.md (commit 810365f): firs, cases,
-- case_provisions, persons, case_parties, advocates, case_advocates.
-- DOMAIN.md states the example data is fictional. Nothing below is invented;
-- anything not stated is left NULL or unseeded and listed here.
--
-- ===========================================================================
-- KNOWN GAPS
--
-- Schema changes made by this migration
--   1. cases.filed_on is made nullable: no filing date is stated for
--      Cases 39, 40, 44, 47, 48, 49, 50 and 53.
--   2. cases.stage is made nullable: no stage is stated for Case 46 (pending
--      Misc.), Case 48 (abated) or Case 53 (stayed). Disposed cases are put
--      at stage 'disposal', the twelfth lifecycle stage.
--
-- Cases
--   3. Case 55 (C.C. 112/2023 -> N.I. Act 240/2024) is NOT seeded: its court
--      number is not stated, and the conversion needs the case
--      relationships table. 54 of the 55 cases are seeded.
--   4. No court is stated for the Misc. cases (41, 42, 43, 45, 46). Each is
--      placed in the court of the case it arises in.
--   5. Case 1 is seeded as "disposed / conviction", as its entry states,
--      although Case 12 remanded it on 22-08-2026. Case 7 is seeded as
--      pending at defence evidence, as its entry states ("reopened on remand").
--   6. Case 51 is seeded in JMFC Court No. 7, its current court. The transfer
--      from Court No. 3 (14-06-2023) belongs in case_audit_log (not yet built).
--   7. No FIR is stated for G.R. Cases 39, 40, 47, 49, 50. Case 20 (C.C.)
--      has no fir_id; its link to Case 9's FIR is a relationship (later).
--   8. "Framing of notice" (Case 27) is stored as framing_of_charge.
--
-- Parties and advocates
--   9. No parties are named for Cases 24, 26, 28, 54. Case 37's eleven
--      accused are unnamed and skipped. Respondents are stated only for
--      Cases 11 and 12.
--  10. The State of Bihar is a 'prosecution' party only in Case 1, where the
--      APP (Smt. Rekha Jha) is named and must attach to a party.
--  11. district is set only where the address states it.
--
-- Provisions
--  12. Every N.I. Act case cites s.138, as the case type is defined by it.
--  13. Case 1: IPC 411 is marked is_dropped (charge framed under IPC 379 only).
--
-- Not seeded (tables do not exist yet): case relationships, orders,
-- hearings and adjournments, presiding officer per case, judge postings.
-- ===========================================================================

BEGIN;

ALTER TABLE cases ALTER COLUMN filed_on DROP NOT NULL;
ALTER TABLE cases ALTER COLUMN stage    DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- firs
-- ---------------------------------------------------------------------------
INSERT INTO firs (police_station, fir_number, fir_year, fir_date) VALUES
    ('Begusarai Mufassil',  88, 2024, '2024-03-02'),   -- Cases 1, 2, 3
    ('Teghra',              31, 2022, '2022-02-14'),   -- Case 5
    ('Bachhwara',           14, 2023, '2023-01-21'),   -- Case 7
    ('Bakhri',             102, 2025, '2025-05-08'),   -- Cases 9, 10, 19
    ('Teghra',             211, 2025, '2025-07-14'),   -- Case 29
    ('Balia',               60, 2023, NULL),           -- Case 30
    ('Begusarai Mufassil', 140, 2024, NULL),           -- Case 31
    ('Bachhwara',           22, 2026, '2026-01-19'),   -- Case 32
    ('Sahebpur Kamal',     175, 2025, NULL),           -- Case 33
    ('Naokothi',            70, 2024, NULL),           -- Case 34
    ('Khodawandpur',        95, 2023, NULL),           -- Case 35
    ('Barauni',            240, 2025, NULL),           -- Case 36
    ('Dandari',              9, 2026, NULL),           -- Case 37
    ('Chhaurahi',           91, 2024, NULL),           -- Case 38
    ('Begusarai Mufassil',  42, 2021, NULL),           -- Case 51
    ('Matihani',            81, 2022, NULL);           -- Case 53

-- ---------------------------------------------------------------------------
-- cases (all except Misc.)
-- ---------------------------------------------------------------------------
INSERT INTO cases (case_type_id, case_number, case_year, court_id, fir_id,
                   filed_on, registered_on, stage, status, disposal_mode, disposed_on)
SELECT ct.id, v.num, v.yr, co.id, f.id,
       v.filed::date, v.registered::date, v.stage::case_stage,
       v.status::case_status, v.mode::disposal_mode, v.disposed::date
FROM (VALUES
    -- Group A: appeal chains
    ('GR',   412, 2024, 'JMFC Court No. 3, Begusarai',  'Begusarai Mufassil',  88, 2024, '2024-03-15', '2024-03-18', 'disposal',              'disposed', 'conviction',              '2026-01-08'), -- 1
    ('GR',   415, 2024, 'JMFC Court No. 3, Begusarai',  'Begusarai Mufassil',  88, 2024, '2024-05-22', '2024-05-24', 'prosecution_evidence',  'pending',  NULL,                      NULL),         -- 2
    ('GR',   418, 2024, 'JMFC Court No. 3, Begusarai',  'Begusarai Mufassil',  88, 2024, '2024-08-09', NULL,         'appearance_of_accused', 'pending',  NULL,                      NULL),         -- 3
    ('CC',    55, 2023, 'JMFC Court No. 1, Begusarai',  NULL,                NULL, NULL, '2023-04-12', NULL,         'disposal',              'disposed', 'acquittal',               '2025-11-21'), -- 4
    ('GR',   120, 2022, 'JMFC Court No. 5, Begusarai',  'Teghra',              31, 2022, '2022-02-28', NULL,         'disposal',              'disposed', 'conviction',              '2024-07-16'), -- 5
    ('NI',   201, 2024, 'JMFC Court No. 2, Begusarai',  NULL,                NULL, NULL, '2024-03-04', NULL,         'disposal',              'disposed', 'conviction',              '2026-02-19'), -- 6
    ('GR',    77, 2023, 'JMFC Court No. 4, Begusarai',  'Bachhwara',           14, 2023, '2023-02-06', NULL,         'defence_evidence',      'pending',  NULL,                      NULL),         -- 7
    ('CC',    33, 2024, 'JMFC Court No. 1, Begusarai',  NULL,                NULL, NULL, '2024-05-02', NULL,         'disposal',              'disposed', 'dismissed_at_cognizance', '2024-06-18'), -- 8
    -- Group B: appellate and revisional
    ('CRA',   88, 2026, 'Court of Sessions, Begusarai', NULL,                NULL, NULL, '2026-02-04', NULL,         'disposal',              'disposed', 'dismissed',               '2026-06-11'), -- 11
    ('CRR', 1204, 2026, 'Patna High Court',             NULL,                NULL, NULL, '2026-07-28', NULL,         'disposal',              'disposed', 'allowed_in_part',         '2026-08-22'), -- 12
    ('CRA',   12, 2026, 'Court of Sessions, Begusarai', NULL,                NULL, NULL, '2026-01-19', NULL,         'final_arguments',       'pending',  NULL,                      NULL),         -- 13
    ('CRA',   30, 2024, 'Court of Sessions, Begusarai', NULL,                NULL, NULL, '2024-08-08', NULL,         'disposal',              'disposed', 'dismissed',               '2025-03-24'), -- 14
    ('CRA',   44, 2026, 'Court of Sessions, Begusarai', NULL,                NULL, NULL, '2026-03-14', NULL,         'final_arguments',       'pending',  NULL,                      NULL),         -- 15
    ('CRA',   70, 2025, 'Court of Sessions, Begusarai', NULL,                NULL, NULL, '2025-10-24', NULL,         'disposal',              'disposed', 'allowed',                 '2026-02-18'), -- 16
    ('CRR',  455, 2024, 'Court of Sessions, Begusarai', NULL,                NULL, NULL, '2024-09-09', NULL,         'disposal',              'disposed', 'dismissed',               '2025-01-20'), -- 17
    ('CRR',  880, 2025, 'Patna High Court',             NULL,                NULL, NULL, '2025-06-02', NULL,         'disposal',              'disposed', 'dismissed',               '2025-12-15'), -- 18
    -- Group C: FIR siblings and a cross-case
    ('GR',   250, 2025, 'JMFC Court No. 6, Begusarai',  'Bakhri',             102, 2025, '2025-06-21', NULL,         'framing_of_charge',     'pending',  NULL,                      NULL),         -- 9
    ('GR',   251, 2025, 'JMFC Court No. 6, Begusarai',  'Bakhri',             102, 2025, '2025-06-21', NULL,         'framing_of_charge',     'pending',  NULL,                      NULL),         -- 10
    ('GR',   252, 2025, 'JMFC Court No. 6, Begusarai',  'Bakhri',             102, 2025, '2025-06-21', NULL,         'appearance_of_accused', 'pending',  NULL,                      NULL),         -- 19
    ('CC',   101, 2025, 'JMFC Court No. 6, Begusarai',  NULL,                NULL, NULL, '2025-07-14', NULL,         'prosecution_evidence',  'pending',  NULL,                      NULL),         -- 20
    -- Group D: N.I. Act
    ('NI',   110, 2023, 'JMFC Court No. 2, Begusarai',  NULL,                NULL, NULL, '2023-06-28', NULL,         'disposal',              'disposed', 'conviction',              '2025-10-14'), -- 21
    ('NI',   145, 2024, 'JMFC Court No. 2, Begusarai',  NULL,                NULL, NULL, '2024-05-20', NULL,         'defence_evidence',      'pending',  NULL,                      NULL),         -- 22
    ('NI',   310, 2025, 'JMFC Court No. 7, Begusarai',  NULL,                NULL, NULL, '2025-09-26', NULL,         'appearance_of_accused', 'pending',  NULL,                      NULL),         -- 23
    ('NI',   180, 2024, 'JMFC Court No. 2, Begusarai',  NULL,                NULL, NULL, '2024-07-30', NULL,         'disposal',              'disposed', 'compounded',              '2026-03-11'), -- 24
    ('NI',   220, 2025, 'JMFC Court No. 7, Begusarai',  NULL,                NULL, NULL, '2025-07-16', NULL,         'prosecution_evidence',  'pending',  NULL,                      NULL),         -- 25
    ('NI',    95, 2023, 'JMFC Court No. 2, Begusarai',  NULL,                NULL, NULL, '2023-04-19', NULL,         'disposal',              'disposed', 'dismissed_for_default',   '2025-08-07'), -- 26
    ('NI',   275, 2025, 'JMFC Court No. 7, Begusarai',  NULL,                NULL, NULL, '2025-09-02', NULL,         'framing_of_charge',     'pending',  NULL,                      NULL),         -- 27 (framing of notice)
    ('NI',    48, 2026, 'JMFC Court No. 2, Begusarai',  NULL,                NULL, NULL, '2026-02-17', NULL,         'cognizance',            'pending',  NULL,                      NULL),         -- 28
    -- Group E: pending G.R. cases across every stage
    ('GR',   500, 2025, 'JMFC Court No. 5, Begusarai',  'Teghra',             211, 2025, '2025-08-28', NULL,         'framing_of_charge',     'pending',  NULL,                      NULL),         -- 29
    ('GR',   205, 2023, 'JMFC Court No. 4, Begusarai',  'Balia',               60, 2023, '2023-04-11', NULL,         'defence_evidence',      'pending',  NULL,                      NULL),         -- 30
    ('GR',   330, 2024, 'JMFC Court No. 3, Begusarai',  'Begusarai Mufassil', 140, 2024, '2024-07-02', NULL,         'prosecution_evidence',  'pending',  NULL,                      NULL),         -- 31
    ('GR',    90, 2026, 'JMFC Court No. 8, Begusarai',  'Bachhwara',           22, 2026, '2026-02-24', NULL,         'cognizance',            'pending',  NULL,                      NULL),         -- 32
    ('GR',   410, 2025, 'JMFC Court No. 6, Begusarai',  'Sahebpur Kamal',     175, 2025, '2025-07-09', NULL,         'appearance_of_accused', 'pending',  NULL,                      NULL),         -- 33
    ('GR',   155, 2024, 'JMFC Court No. 1, Begusarai',  'Naokothi',            70, 2024, '2024-04-19', NULL,         'statement_of_accused',  'pending',  NULL,                      NULL),         -- 34
    ('GR',   288, 2023, 'JMFC Court No. 5, Begusarai',  'Khodawandpur',        95, 2023, '2023-05-12', NULL,         'final_arguments',       'pending',  NULL,                      NULL),         -- 35
    ('GR',   601, 2025, 'JMFC Court No. 8, Begusarai',  'Barauni',            240, 2025, '2025-10-03', NULL,         'issue_of_process',      'pending',  NULL,                      NULL),         -- 36
    ('GR',    44, 2026, 'JMFC Court No. 3, Begusarai',  'Dandari',              9, 2026, '2026-01-15', NULL,         'registration',          'pending',  NULL,                      NULL),         -- 37
    ('GR',   199, 2024, 'JMFC Court No. 4, Begusarai',  'Chhaurahi',           91, 2024, '2024-05-06', NULL,         'prosecution_evidence',  'pending',  NULL,                      NULL),         -- 38
    -- Group F: disposed
    ('GR',   310, 2022, 'JMFC Court No. 5, Begusarai',  NULL,                NULL, NULL, NULL,         NULL,         'disposal',              'disposed', 'conviction',              '2024-04-17'), -- 39
    ('GR',   180, 2022, 'JMFC Court No. 1, Begusarai',  NULL,                NULL, NULL, NULL,         NULL,         'disposal',              'disposed', 'acquittal',               '2024-05-23'), -- 40
    ('CC',    20, 2023, 'JMFC Court No. 1, Begusarai',  NULL,                NULL, NULL, NULL,         NULL,         'disposal',              'disposed', 'dismissed_for_default',   '2024-12-09'), -- 44
    ('GR',   260, 2023, 'JMFC Court No. 6, Begusarai',  NULL,                NULL, NULL, NULL,         NULL,         'disposal',              'disposed', 'compounded',              '2025-01-20'), -- 47
    ('CC',    88, 2022, 'JMFC Court No. 2, Begusarai',  NULL,                NULL, NULL, NULL,         NULL,         NULL,                    'abated',   NULL,                      NULL),         -- 48
    ('GR',    95, 2022, 'JMFC Court No. 7, Begusarai',  NULL,                NULL, NULL, NULL,         NULL,         'disposal',              'disposed', 'conviction',              '2023-08-28'), -- 49
    ('GR',   445, 2023, 'JMFC Court No. 3, Begusarai',  NULL,                NULL, NULL, NULL,         NULL,         'disposal',              'disposed', 'acquittal',               '2025-02-14'), -- 50
    -- Group H: transfers, stays and long-pending
    ('GR',   150, 2021, 'JMFC Court No. 7, Begusarai',  'Begusarai Mufassil',  42, 2021, '2021-03-19', NULL,         'prosecution_evidence',  'pending',  NULL,                      NULL),         -- 51
    ('CC',    40, 2021, 'JMFC Court No. 1, Begusarai',  NULL,                NULL, NULL, '2021-02-08', NULL,         'appearance_of_accused', 'pending',  NULL,                      NULL),         -- 52
    ('GR',   222, 2022, 'JMFC Court No. 4, Begusarai',  'Matihani',            81, 2022, NULL,         NULL,         NULL,                    'stayed',   NULL,                      NULL),         -- 53
    ('NI',    15, 2022, 'JMFC Court No. 2, Begusarai',  NULL,                NULL, NULL, '2022-02-11', NULL,         'final_arguments',       'pending',  NULL,                      NULL)          -- 54
) AS v (code, num, yr, court, ps, fir_no, fir_yr, filed, registered, stage, status, mode, disposed)
JOIN case_types ct ON ct.code = v.code
JOIN courts co     ON co.name = v.court
LEFT JOIN firs f   ON (f.police_station, f.fir_number, f.fir_year) = (v.ps, v.fir_no, v.fir_yr);

-- ---------------------------------------------------------------------------
-- cases (Misc.): court taken from the case each one arises in (gap 4)
-- ---------------------------------------------------------------------------
INSERT INTO cases (case_type_id, case_number, case_year, court_id,
                   filed_on, stage, status, disposal_mode, disposed_on)
SELECT misc.id, v.num, v.yr, parent.court_id,
       v.filed::date, v.stage::case_stage,
       v.status::case_status, v.mode::disposal_mode, v.disposed::date
FROM (VALUES
    (92,  2026, 'GR', 500, 2025, '2026-04-02', 'disposal', 'disposed', 'allowed',  '2026-04-18'), -- 41
    (118, 2025, 'GR', 410, 2025, '2025-10-28', 'disposal', 'disposed', 'rejected', '2025-11-14'), -- 42
    (44,  2026, 'GR', 410, 2025, '2026-02-19', 'disposal', 'disposed', 'allowed',  '2026-03-06'), -- 43
    (77,  2024, 'NI', 145, 2024, '2024-09-22', 'disposal', 'disposed', 'allowed',  '2024-10-08'), -- 45
    (303, 2025, 'GR', 601, 2025, '2025-10-21', NULL,       'pending',  NULL,       NULL)          -- 46
) AS v (num, yr, parent_code, parent_num, parent_yr, filed, stage, status, mode, disposed)
JOIN case_types misc  ON misc.code = 'MISC'
JOIN case_types pct   ON pct.code = v.parent_code
JOIN cases parent     ON (parent.case_type_id, parent.case_number, parent.case_year)
                       = (pct.id, v.parent_num, v.parent_yr);

-- ---------------------------------------------------------------------------
-- case_provisions
-- ---------------------------------------------------------------------------
INSERT INTO case_provisions (case_id, provision_id, is_dropped)
SELECT c.id, p.id, v.dropped
FROM (VALUES
    ('GR', 412, 2024, 'IPC', '379',    false),  -- 1
    ('GR', 412, 2024, 'IPC', '411',    true),   -- 1: charge framed under 379 only
    ('GR', 415, 2024, 'IPC', '379',    false),  -- 2
    ('GR', 415, 2024, 'IPC', '411',    false),
    ('GR', 418, 2024, 'IPC', '379',    false),  -- 3
    ('GR', 418, 2024, 'IPC', '411',    false),
    ('CC',  55, 2023, 'IPC', '406',    false),  -- 4
    ('CC',  55, 2023, 'IPC', '420',    false),
    ('GR', 120, 2022, 'IPC', '323',    false),  -- 5
    ('GR', 120, 2022, 'IPC', '504',    false),
    ('GR',  77, 2023, 'IPC', '506',    false),  -- 7
    ('GR',  77, 2023, 'IPC', '341',    false),
    ('CC',  33, 2024, 'IPC', '499',    false),  -- 8
    ('CC',  33, 2024, 'IPC', '500',    false),
    ('GR', 250, 2025, 'BNS', '191(2)', false),  -- 9
    ('GR', 250, 2025, 'BNS', '115(2)', false),
    ('GR', 250, 2025, 'BNS', '324(4)', false),
    ('CC', 101, 2025, 'BNS', '115(2)', false),  -- 20
    ('CC', 101, 2025, 'BNS', '351(2)', false),
    ('GR', 500, 2025, 'BNS', '303(2)', false),  -- 29
    ('GR', 205, 2023, 'IPC', '323',    false),  -- 30
    ('GR', 205, 2023, 'IPC', '325',    false),
    ('GR', 330, 2024, 'IPC', '448',    false),  -- 31
    ('GR', 330, 2024, 'IPC', '427',    false),
    ('GR',  90, 2026, 'BNS', '318(4)', false),  -- 32
    ('GR', 410, 2025, 'BNS', '324(4)', false),  -- 33
    ('GR', 155, 2024, 'IPC', '506',    false),  -- 34
    ('GR', 288, 2023, 'IPC', '379',    false),  -- 35
    ('GR', 601, 2025, 'BNS', '118(1)', false),  -- 36
    ('GR',  44, 2026, 'BNS', '189(2)', false),  -- 37
    ('GR', 199, 2024, 'IPC', '384',    false),  -- 38
    ('GR', 310, 2022, 'IPC', '379',    false),  -- 39
    ('GR', 180, 2022, 'IPC', '323',    false),  -- 40
    ('CC',  20, 2023, 'IPC', '420',    false),  -- 44
    ('GR', 260, 2023, 'IPC', '427',    false),  -- 47
    ('CC',  88, 2022, 'IPC', '323',    false),  -- 48
    ('GR',  95, 2022, 'IPC', '447',    false),  -- 49
    ('GR', 445, 2023, 'IPC', '379',    false),  -- 50
    ('GR', 150, 2021, 'IPC', '379',    false),  -- 51
    ('CC',  40, 2021, 'IPC', '406',    false),  -- 52
    ('GR', 222, 2022, 'IPC', '325',    false)   -- 53
) AS v (code, num, yr, act, section, dropped)
JOIN case_types ct ON ct.code = v.code
JOIN cases c       ON (c.case_type_id, c.case_number, c.case_year) = (ct.id, v.num, v.yr)
JOIN provisions p  ON (p.act_name, p.section) = (v.act, v.section);

-- Every N.I. Act case cites s.138 (gap 12)
INSERT INTO case_provisions (case_id, provision_id)
SELECT c.id, p.id
FROM cases c
JOIN case_types ct ON ct.id = c.case_type_id AND ct.code = 'NI'
JOIN provisions p  ON p.act_name = 'Negotiable Instruments Act, 1881' AND p.section = '138';

-- ---------------------------------------------------------------------------
-- persons
-- ---------------------------------------------------------------------------
INSERT INTO persons (kind, full_name, relation, relative_name, address, district) VALUES
    ('state',        'State of Bihar',            NULL,  NULL,               NULL,                  NULL),
    ('organisation', 'M/s Sharma Traders',        NULL,  NULL,               'Market Road',         'Begusarai'),
    ('organisation', 'M/s Gupta Enterprises',     NULL,  NULL,               NULL,                  NULL),
    ('organisation', 'M/s Verma Steel Suppliers', NULL,  NULL,               NULL,                  NULL),
    ('organisation', 'Kumari Stores',             NULL,  NULL,               NULL,                  NULL),
    ('organisation', 'M/s Agarwal Traders',       NULL,  NULL,               NULL,                  NULL),
    ('organisation', 'M/s Bihar Agro Products',   NULL,  NULL,               NULL,                  NULL),
    ('individual',   'Vinod Sharma',              NULL,  NULL,               NULL,                  NULL),
    ('individual',   'Ashok Gupta',               NULL,  NULL,               NULL,                  NULL),
    ('individual',   'Dinesh Verma',              NULL,  NULL,               NULL,                  NULL),
    ('individual',   'Anita Kumari',              NULL,  NULL,               NULL,                  NULL),
    ('individual',   'Sunil Agarwal',             NULL,  NULL,               NULL,                  NULL),
    ('individual',   'Rajesh Kumar Singh',        's/o', 'Late Bishun Singh', 'Vill. Ulao',         'Begusarai'),
    ('individual',   'Ramesh Paswan',             's/o', 'Jagdish Paswan',   'Vill. Ulao',          'Begusarai'),
    ('individual',   'Sunil Paswan',              's/o', 'Jagdish Paswan',   'Vill. Ulao',          'Begusarai'),
    ('individual',   'Dinesh Ram',                's/o', 'Shivnandan Ram',   'Vill. Barauni',       'Begusarai'),
    ('individual',   'Meena Devi',                'w/o', 'Ram Naresh Prasad', 'Mohalla Kachhari',   'Begusarai'),
    ('individual',   'Anil Kumar Gupta',          's/o', 'Suresh Gupta',     'Mohalla Kachhari',    'Begusarai'),
    ('individual',   'Shyam Bihari Mahto',        's/o', 'Ramdev Mahto',     'Vill. Teghra',        NULL),
    ('individual',   'Jitendra Yadav',            's/o', 'Mahendra Yadav',   'Vill. Teghra',        NULL),
    ('individual',   'Rakesh Singh',              's/o', 'Birendra Singh',   'Vill. Sahebpur Kamal', NULL),
    ('individual',   'Md. Shamim Akhtar',         's/o', 'Md. Ishtiaq',      'Vill. Bachhwara',     NULL),
    ('individual',   'Mohammad Irfan',            's/o', 'Md. Rafiq',        'Vill. Bachhwara',     NULL),
    ('individual',   'Sanjay Mishra',             's/o', 'Devendra Mishra',  'Mohalla Pokhariya',   'Begusarai'),
    ('individual',   'Arvind Choubey',            's/o', 'Ganga Choubey',    'Mohalla Pokhariya',   'Begusarai'),
    ('individual',   'Vijay Kumar Sah',           's/o', 'Lalan Sah',        'Vill. Bakhri Bazar',  NULL),
    ('individual',   'Pramod Sah',                's/o', 'Nageshwar Sah',    'Vill. Bakhri Bazar',  NULL),
    ('individual',   'Pappu Sah',                 's/o', 'Nageshwar Sah',    NULL,                  NULL),
    ('individual',   'Chandan Sah',               's/o', 'Ramvilas Sah',     NULL,                  NULL),
    ('individual',   'Ramvilas Sah',              's/o', 'Dukhan Sah',       'Vill. Bakhri Bazar',  NULL),
    ('individual',   'Nitish Kumar',              's/o', 'Umesh Prasad',     'Vill. Matihani',      NULL),
    ('individual',   'Ashok Jha',                 's/o', 'Baidyanath Jha',   'Vill. Barauni',       NULL),
    ('individual',   'Ravi Thakur',               's/o', 'Mahesh Thakur',    'Vill. Mansurchak',    NULL),
    ('individual',   'Mukesh Roy',                's/o', 'Bhola Roy',        'Vill. Cheria Bariarpur', NULL),
    ('individual',   'Deepak Singh',              's/o', 'Rambalak Singh',   'Vill. Garhpura',      NULL),
    ('individual',   'Santosh Mahto',             's/o', 'Jagarnath Mahto',  'Vill. Teghra',        NULL),
    ('individual',   'Rajiv Ranjan',              's/o', 'Shyam Sundar Rai', 'Vill. Balia',         NULL),
    ('individual',   'Birju Paswan',              NULL,  NULL,               NULL,                  NULL),
    ('individual',   'Manoj Kumar Singh',         NULL,  NULL,               NULL,                  NULL),
    ('individual',   'Lalu Yadav',                's/o', 'Hiralal Yadav',    NULL,                  NULL),
    ('individual',   'Suraj Kumar',               NULL,  NULL,               NULL,                  NULL),
    ('individual',   'Ramashish Das',             NULL,  NULL,               NULL,                  NULL),
    ('individual',   'Shankar Rai',               NULL,  NULL,               NULL,                  NULL),
    ('individual',   'Mithilesh Singh',           NULL,  NULL,               NULL,                  NULL),
    ('individual',   'Ram Pravesh Singh',         NULL,  NULL,               NULL,                  NULL),
    ('individual',   'Umesh Paswan',              NULL,  NULL,               NULL,                  NULL),
    ('individual',   'Devendra Prasad',           NULL,  NULL,               NULL,                  NULL);

-- ---------------------------------------------------------------------------
-- case_parties (every full_name above is unique, so it is safe to join on)
-- ---------------------------------------------------------------------------
INSERT INTO case_parties (case_id, person_id, role, through_person_id)
SELECT c.id, p.id, v.role::party_role, t.id
FROM (VALUES
    ('GR',   412, 2024, 'Rajesh Kumar Singh',        'informant',   NULL),            -- 1
    ('GR',   412, 2024, 'Ramesh Paswan',             'accused',     NULL),
    ('GR',   412, 2024, 'State of Bihar',            'prosecution', NULL),
    ('GR',   415, 2024, 'Sunil Paswan',              'accused',     NULL),            -- 2
    ('GR',   418, 2024, 'Dinesh Ram',                'accused',     NULL),            -- 3
    ('CC',    55, 2023, 'Meena Devi',                'complainant', NULL),            -- 4
    ('CC',    55, 2023, 'Anil Kumar Gupta',          'accused',     NULL),
    ('GR',   120, 2022, 'Shyam Bihari Mahto',        'informant',   NULL),            -- 5
    ('GR',   120, 2022, 'Jitendra Yadav',            'accused',     NULL),
    ('NI',   201, 2024, 'M/s Sharma Traders',        'complainant', 'Vinod Sharma'),  -- 6
    ('NI',   201, 2024, 'Rakesh Singh',              'accused',     NULL),
    ('GR',    77, 2023, 'Md. Shamim Akhtar',         'informant',   NULL),            -- 7
    ('GR',    77, 2023, 'Mohammad Irfan',            'accused',     NULL),
    ('CC',    33, 2024, 'Sanjay Mishra',             'complainant', NULL),            -- 8
    ('CC',    33, 2024, 'Arvind Choubey',            'accused',     NULL),
    ('CRA',   88, 2026, 'Ramesh Paswan',             'appellant',   NULL),            -- 11
    ('CRA',   88, 2026, 'State of Bihar',            'respondent',  NULL),
    ('CRR', 1204, 2026, 'Ramesh Paswan',             'petitioner',  NULL),            -- 12
    ('CRR', 1204, 2026, 'State of Bihar',            'respondent',  NULL),
    ('CRA',   12, 2026, 'Meena Devi',                'appellant',   NULL),            -- 13
    ('CRA',   30, 2024, 'Jitendra Yadav',            'appellant',   NULL),            -- 14
    ('CRA',   44, 2026, 'Rakesh Singh',              'appellant',   NULL),            -- 15
    ('CRA',   70, 2025, 'Md. Shamim Akhtar',         'appellant',   NULL),            -- 16
    ('CRR',  455, 2024, 'Sanjay Mishra',             'petitioner',  NULL),            -- 17
    ('CRR',  880, 2025, 'Jitendra Yadav',            'petitioner',  NULL),            -- 18
    ('GR',   250, 2025, 'Vijay Kumar Sah',           'informant',   NULL),            -- 9
    ('GR',   250, 2025, 'Pramod Sah',                'accused',     NULL),
    ('GR',   251, 2025, 'Pappu Sah',                 'accused',     NULL),            -- 10
    ('GR',   252, 2025, 'Chandan Sah',               'accused',     NULL),            -- 19
    ('CC',   101, 2025, 'Ramvilas Sah',              'complainant', NULL),            -- 20
    ('CC',   101, 2025, 'Vijay Kumar Sah',           'accused',     NULL),
    ('NI',   110, 2023, 'M/s Gupta Enterprises',     'complainant', 'Ashok Gupta'),   -- 21
    ('NI',   110, 2023, 'Nitish Kumar',              'accused',     NULL),
    ('NI',   145, 2024, 'M/s Verma Steel Suppliers', 'complainant', 'Dinesh Verma'),  -- 22
    ('NI',   145, 2024, 'Ashok Jha',                 'accused',     NULL),
    ('NI',   310, 2025, 'Kumari Stores',             'complainant', 'Anita Kumari'),  -- 23
    ('NI',   310, 2025, 'Ravi Thakur',               'accused',     NULL),
    ('NI',   220, 2025, 'M/s Agarwal Traders',       'complainant', 'Sunil Agarwal'), -- 25
    ('NI',   220, 2025, 'Mukesh Roy',                'accused',     NULL),
    ('NI',   275, 2025, 'M/s Bihar Agro Products',   'complainant', NULL),            -- 27
    ('NI',   275, 2025, 'Deepak Singh',              'accused',     NULL),
    ('GR',   500, 2025, 'Santosh Mahto',             'accused',     NULL),            -- 29
    ('GR',   205, 2023, 'Rajiv Ranjan',              'accused',     NULL),            -- 30
    ('GR',   330, 2024, 'Birju Paswan',              'accused',     NULL),            -- 31
    ('GR',    90, 2026, 'Manoj Kumar Singh',         'accused',     NULL),            -- 32
    ('GR',   410, 2025, 'Lalu Yadav',                'accused',     NULL),            -- 33
    ('GR',   155, 2024, 'Suraj Kumar',               'accused',     NULL),            -- 34
    ('GR',   288, 2023, 'Ramashish Das',             'accused',     NULL),            -- 35
    ('GR',   601, 2025, 'Shankar Rai',               'accused',     NULL),            -- 36
    ('GR',   199, 2024, 'Mithilesh Singh',           'accused',     NULL),            -- 38
    ('CC',    88, 2022, 'Ram Pravesh Singh',         'complainant', NULL),            -- 48
    ('MISC',  92, 2026, 'Santosh Mahto',             'applicant',   NULL),            -- 41
    ('MISC', 118, 2025, 'Lalu Yadav',                'applicant',   NULL),            -- 42
    ('MISC',  44, 2026, 'Lalu Yadav',                'applicant',   NULL),            -- 43
    ('MISC',  77, 2024, 'Ashok Jha',                 'applicant',   NULL),            -- 45
    ('MISC', 303, 2025, 'Shankar Rai',               'applicant',   NULL),            -- 46
    ('GR',   150, 2021, 'Umesh Paswan',              'accused',     NULL),            -- 51
    ('CC',    40, 2021, 'Devendra Prasad',           'complainant', NULL)             -- 52
) AS v (code, num, yr, person, role, through)
JOIN case_types ct ON ct.code = v.code
JOIN cases c       ON (c.case_type_id, c.case_number, c.case_year) = (ct.id, v.num, v.yr)
JOIN persons p     ON p.full_name = v.person
LEFT JOIN persons t ON t.full_name = v.through;

-- ---------------------------------------------------------------------------
-- advocates + case_advocates
-- ---------------------------------------------------------------------------
INSERT INTO advocates (full_name, enrolment_number) VALUES
    ('M. P. Chaudhary', 'BR/1142/2009'),
    ('R. N. Jha',       'BR/0887/2004'),
    ('P. K. Sinha',     'BR/1455/2012'),
    ('Rekha Jha',       NULL);            -- APP, Case 1

INSERT INTO case_advocates (case_party_id, advocate_id, capacity)
SELECT cp.id, a.id, v.capacity::advocate_capacity
FROM (VALUES
    ('GR', 412, 2024, 'Ramesh Paswan',      'accused',     'M. P. Chaudhary', 'private'),            -- 1
    ('GR', 412, 2024, 'State of Bihar',     'prosecution', 'Rekha Jha',       'public_prosecutor'),  -- 1
    ('GR', 415, 2024, 'Sunil Paswan',       'accused',     'M. P. Chaudhary', 'private'),            -- 2
    ('CC',  55, 2023, 'Meena Devi',         'complainant', 'R. N. Jha',       'private'),            -- 4
    ('NI', 201, 2024, 'M/s Sharma Traders', 'complainant', 'P. K. Sinha',     'private')             -- 6
) AS v (code, num, yr, person, role, advocate, capacity)
JOIN case_types ct   ON ct.code = v.code
JOIN cases c         ON (c.case_type_id, c.case_number, c.case_year) = (ct.id, v.num, v.yr)
JOIN persons p       ON p.full_name = v.person
JOIN case_parties cp ON (cp.case_id, cp.person_id, cp.role) = (c.id, p.id, v.role::party_role)
JOIN advocates a     ON a.full_name = v.advocate;

COMMIT;
