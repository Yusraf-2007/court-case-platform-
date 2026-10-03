-- 002_seed_example_reference_data.sql
-- Seeds courts, judges and IPC/BNS provisions named in DOMAIN.md's
-- "Example cases" section (commit 810365f). Nothing is invented: every value
-- below is quoted or directly stated in DOMAIN.md. DOMAIN.md itself says the
-- example data is fictional and section numbers are unverified against statute.
--
-- ===========================================================================
-- KNOWN GAPS (not seeded because DOMAIN.md does not state them)
--
-- Courts
--   1. No Chief Judicial Magistrate court is named. "Chief Judicial
--      Magistrate" appears only as the generic level-2 row of the hierarchy
--      table. No CJM row is seeded, so the JMFC courts' parent_court_id is
--      left NULL rather than pointed past level 2 at Sessions. Set it with a
--      later UPDATE once the CJM court is named.
--
-- Judges
--   2. Only two presiding officers are named (Case 1, Case 11), not three.
--   3. No posting dates are stated, so judge_postings is not seeded.
--      (Sri A. K. Verma presides in JMFC Court No. 3 in Case 1; Sri S. N.
--      Pandey in the Court of Sessions, Begusarai in Case 11.)
--
-- Provisions
--   4. No titles are given for IPC 325, IPC 427, IPC 447, IPC 448 or
--      BNS 351(2); title is NULL for these.
--   5. No IPC <-> BNS correspondences are stated, so corresponds_to_id is
--      NULL throughout.
--   6. Cognizable / bailable status is not stated for any section; NULL.
--   7. Non-IPC/BNS provisions cited in the cases are not seeded here:
--      CrPC s.203, CrPC s.251, N.I. Act s.147.
--   8. The "IPC/BNS transition" note (lines 96-97) disagrees with the case
--      entries: it lists Case 9 as IPC (Case 9 cites BNS) and Cases 13, 22,
--      23 as IPC (they cite no sections). The case entries were used.
--
-- Remedies (relates to KNOWN GAPS in 001)
--   9. The example cases use routes that case_type_remedies does not hold:
--      C.C. revision to Sessions (Case 8 -> 17), and revision from a
--      Cr. Appeal to the High Court (Case 11 -> 12, Case 14 -> 18). The
--      appeal-direction trigger will reject these until they are seeded.
-- ===========================================================================

BEGIN;

-- Court of Sessions, Begusarai (Cases 11, 13-17) reports to Patna High Court.
INSERT INTO courts (name, hierarchy_level, parent_court_id, district, state)
    SELECT 'Court of Sessions, Begusarai', 3, id, 'Begusarai', 'Bihar'
    FROM courts WHERE name = 'Patna High Court';

-- JMFC Court Nos. 1-8, Begusarai. Parent left NULL: see gap 1.
INSERT INTO courts (name, hierarchy_level, parent_court_id, district, state)
    SELECT 'JMFC Court No. ' || n || ', Begusarai', 1, NULL, 'Begusarai', 'Bihar'
    FROM generate_series(1, 8) AS n;

-- Presiding officers named in DOMAIN.md. Postings not seeded: see gap 3.
INSERT INTO judges (full_name, designation) VALUES
    ('A. K. Verma',  'JMFC'),                                     -- Case 1
    ('S. N. Pandey', 'Additional District & Sessions Judge');     -- Case 11

-- Every IPC and BNS section cited in DOMAIN.md, with the title given there.
INSERT INTO provisions (act_name, section, title) VALUES
    ('IPC', '323',    'voluntarily causing hurt'),
    ('IPC', '325',    NULL),
    ('IPC', '341',    'wrongful restraint'),
    ('IPC', '379',    'theft'),
    ('IPC', '384',    'extortion'),
    ('IPC', '406',    'criminal breach of trust'),
    ('IPC', '411',    'dishonestly receiving stolen property'),
    ('IPC', '420',    'cheating'),
    ('IPC', '427',    NULL),
    ('IPC', '447',    NULL),
    ('IPC', '448',    NULL),
    ('IPC', '499',    'defamation'),
    ('IPC', '500',    'defamation'),
    ('IPC', '504',    'intentional insult'),
    ('IPC', '506',    'criminal intimidation'),
    ('BNS', '115(2)', 'voluntarily causing hurt'),
    ('BNS', '118(1)', 'hurt by dangerous weapon'),
    ('BNS', '189(2)', 'unlawful assembly'),
    ('BNS', '191(2)', 'rioting'),
    ('BNS', '303(2)', 'theft'),
    ('BNS', '318(4)', 'cheating'),
    ('BNS', '324(4)', 'mischief'),
    ('BNS', '351(2)', NULL);

COMMIT;
