-- 016_nationwide_courts.sql
-- Extends the court hierarchy from Begusarai to the country:
--   - the 24 High Courts not yet seeded (Patna exists), each under the
--     Supreme Court
--   - high_court_jurisdictions: which states and union territories each High
--     Court covers (all 28 states and 8 UTs, each under exactly one court)
--   - district courts for 33 districts in 11 states: a Court of Sessions
--     reporting to the state's High Court, a CJM court reporting to Sessions,
--     and a JMFC court reporting to the CJM
--
-- courts.state and courts.district already exist (001); nothing is added to
-- courts. Begusarai's 11 courts and every case, hearing and order are
-- untouched: this migration only inserts.
--
-- SOURCE: unlike earlier seeds, this is not from DOMAIN.md. It is public
-- reference data (High Courts and their territorial jurisdiction as of 2026;
-- district names), added at the project owner's request.
--
-- KNOWN GAPS
--   1. Districts have several JMFC courts. One "JMFC Court No. 1" per new
--      district is seeded as a representative court; its number is
--      illustrative, not a claim about that district's actual courts.
--   2. Metropolitan districts (Mumbai, Kolkata, Chennai, Delhi, Hyderabad,
--      Bengaluru, Ahmedabad, Jaipur, Jodhpur) are not seeded: their
--      magistracy was organised as Metropolitan Magistrates under the CrPC,
--      and how the BNSS restructures it is unverified.
--   3. High Court benches (e.g. Nagpur, Madurai, Lucknow, Dharwad) are not
--      modelled; each High Court is one row at its principal seat.
--   4. Additional Sessions Courts and Additional CJM courts are not seeded.

BEGIN;

-- ---------------------------------------------------------------------------
-- High Courts (Patna High Court already exists, from 001)
-- courts.state holds the state or UT of the principal seat.
-- ---------------------------------------------------------------------------
INSERT INTO courts (name, hierarchy_level, parent_court_id, district, state)
SELECT v.name, 4, sc.id, NULL, v.seat_state
FROM (VALUES
    ('Allahabad High Court',                           'Uttar Pradesh'),
    ('Andhra Pradesh High Court',                      'Andhra Pradesh'),
    ('Bombay High Court',                              'Maharashtra'),
    ('Calcutta High Court',                            'West Bengal'),
    ('Chhattisgarh High Court',                        'Chhattisgarh'),
    ('Delhi High Court',                               'Delhi'),
    ('Gauhati High Court',                             'Assam'),
    ('Gujarat High Court',                             'Gujarat'),
    ('Himachal Pradesh High Court',                    'Himachal Pradesh'),
    ('High Court of Jammu & Kashmir and Ladakh',       'Jammu and Kashmir'),
    ('Jharkhand High Court',                           'Jharkhand'),
    ('Karnataka High Court',                           'Karnataka'),
    ('Kerala High Court',                              'Kerala'),
    ('Madhya Pradesh High Court',                      'Madhya Pradesh'),
    ('Madras High Court',                              'Tamil Nadu'),
    ('Manipur High Court',                             'Manipur'),
    ('Meghalaya High Court',                           'Meghalaya'),
    ('Orissa High Court',                              'Odisha'),
    ('Punjab and Haryana High Court',                  'Chandigarh'),
    ('Rajasthan High Court',                           'Rajasthan'),
    ('Sikkim High Court',                              'Sikkim'),
    ('Telangana High Court',                           'Telangana'),
    ('Tripura High Court',                             'Tripura'),
    ('Uttarakhand High Court',                         'Uttarakhand')
) AS v (name, seat_state)
CROSS JOIN (SELECT id FROM courts WHERE name = 'Supreme Court of India') sc;

-- ---------------------------------------------------------------------------
-- Territorial jurisdiction: every state and UT under exactly one High Court
-- ---------------------------------------------------------------------------
CREATE TABLE high_court_jurisdictions (
    court_id  bigint NOT NULL REFERENCES courts (id),
    state     text   NOT NULL,
    PRIMARY KEY (court_id, state),
    CONSTRAINT high_court_jurisdictions_one_court_per_state UNIQUE (state)
);

INSERT INTO high_court_jurisdictions (court_id, state)
SELECT c.id, v.state
FROM (VALUES
    ('Allahabad High Court',                     'Uttar Pradesh'),
    ('Andhra Pradesh High Court',                'Andhra Pradesh'),
    ('Bombay High Court',                        'Maharashtra'),
    ('Bombay High Court',                        'Goa'),
    ('Bombay High Court',                        'Dadra and Nagar Haveli and Daman and Diu'),
    ('Calcutta High Court',                      'West Bengal'),
    ('Calcutta High Court',                      'Andaman and Nicobar Islands'),
    ('Chhattisgarh High Court',                  'Chhattisgarh'),
    ('Delhi High Court',                         'Delhi'),
    ('Gauhati High Court',                       'Assam'),
    ('Gauhati High Court',                       'Arunachal Pradesh'),
    ('Gauhati High Court',                       'Mizoram'),
    ('Gauhati High Court',                       'Nagaland'),
    ('Gujarat High Court',                       'Gujarat'),
    ('Himachal Pradesh High Court',              'Himachal Pradesh'),
    ('High Court of Jammu & Kashmir and Ladakh', 'Jammu and Kashmir'),
    ('High Court of Jammu & Kashmir and Ladakh', 'Ladakh'),
    ('Jharkhand High Court',                     'Jharkhand'),
    ('Karnataka High Court',                     'Karnataka'),
    ('Kerala High Court',                        'Kerala'),
    ('Kerala High Court',                        'Lakshadweep'),
    ('Madhya Pradesh High Court',                'Madhya Pradesh'),
    ('Madras High Court',                        'Tamil Nadu'),
    ('Madras High Court',                        'Puducherry'),
    ('Manipur High Court',                       'Manipur'),
    ('Meghalaya High Court',                     'Meghalaya'),
    ('Orissa High Court',                        'Odisha'),
    ('Patna High Court',                         'Bihar'),
    ('Punjab and Haryana High Court',            'Punjab'),
    ('Punjab and Haryana High Court',            'Haryana'),
    ('Punjab and Haryana High Court',            'Chandigarh'),
    ('Rajasthan High Court',                     'Rajasthan'),
    ('Sikkim High Court',                        'Sikkim'),
    ('Telangana High Court',                     'Telangana'),
    ('Tripura High Court',                       'Tripura'),
    ('Uttarakhand High Court',                   'Uttarakhand')
) AS v (court, state)
JOIN courts c ON c.name = v.court AND c.hierarchy_level = 4;

-- ---------------------------------------------------------------------------
-- District courts: Sessions -> state High Court, CJM -> Sessions,
-- JMFC No. 1 -> CJM (gap 1). Bihar already has Begusarai.
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE new_districts (state text, district text) ON COMMIT DROP;
INSERT INTO new_districts VALUES
    ('Bihar',           'Patna'),           ('Bihar',          'Gaya'),             ('Bihar',          'Muzaffarpur'),
    ('Maharashtra',     'Pune'),            ('Maharashtra',    'Nagpur'),           ('Maharashtra',    'Nashik'),
    ('Uttar Pradesh',   'Lucknow'),         ('Uttar Pradesh',  'Kanpur Nagar'),     ('Uttar Pradesh',  'Varanasi'),
    ('Tamil Nadu',      'Coimbatore'),      ('Tamil Nadu',     'Madurai'),          ('Tamil Nadu',     'Tiruchirappalli'),
    ('Karnataka',       'Mysuru'),          ('Karnataka',      'Belagavi'),         ('Karnataka',      'Kalaburagi'),
    ('West Bengal',     'Purba Bardhaman'), ('West Bengal',    'Darjeeling'),       ('West Bengal',    'Murshidabad'),
    ('Gujarat',         'Surat'),           ('Gujarat',        'Vadodara'),         ('Gujarat',        'Rajkot'),
    ('Rajasthan',       'Udaipur'),         ('Rajasthan',      'Ajmer'),            ('Rajasthan',      'Kota'),
    ('Madhya Pradesh',  'Bhopal'),          ('Madhya Pradesh', 'Indore'),           ('Madhya Pradesh', 'Jabalpur'),
    ('Kerala',          'Thiruvananthapuram'), ('Kerala',      'Ernakulam'),        ('Kerala',         'Kozhikode'),
    ('Telangana',       'Karimnagar'),      ('Telangana',      'Nizamabad'),        ('Telangana',      'Khammam');

INSERT INTO courts (name, hierarchy_level, parent_court_id, district, state)
SELECT 'Court of Sessions, ' || d.district, 3, hc.court_id, d.district, d.state
FROM new_districts d
JOIN high_court_jurisdictions hc ON hc.state = d.state;

INSERT INTO courts (name, hierarchy_level, parent_court_id, district, state)
SELECT 'Court of the Chief Judicial Magistrate, ' || d.district, 2, s.id, d.district, d.state
FROM new_districts d
JOIN courts s ON s.name = 'Court of Sessions, ' || d.district AND s.hierarchy_level = 3;

INSERT INTO courts (name, hierarchy_level, parent_court_id, district, state)
SELECT 'JMFC Court No. 1, ' || d.district, 1, cjm.id, d.district, d.state
FROM new_districts d
JOIN courts cjm ON cjm.name = 'Court of the Chief Judicial Magistrate, ' || d.district
               AND cjm.hierarchy_level = 2;

COMMIT;
