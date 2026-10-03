# Domain
# Domain
## Court hierarchy
| Level | Court | Notes |
|-------|-------|-------|
| 1 | JMFC / Judicial Magistrate | trial court, this system's home |
| 2 | Chief Judicial Magistrate | |
| 3 | Sessions Court (ADJ / District & Sessions Judge) | |
| 4 | Patna High Court | |
| 5 | Supreme Court of India | |
## Case types
### G.R. Case (General Register)
- Instituted by: police, on FIR, cognizable offence
- Tried by: JMFC
- Appeal lies to: Sessions Court
- Revision lies to: Sessions Court or High Court
### Complaint Case (C.C.)
- Instituted by: private complaint to the Magistrate
- Tried by: JMFC
- Appeal lies to: Sessions Court
- Revision lies to: High Court
### N.I. Act Case (s.138)
- Instituted by: complaint on dishonoured cheque
- Tried by: JMFC, as a summons case
- Appeal lies to: Sessions Court
### Misc. Case
- Covers: bail applications, miscellaneous petitions
- Decided by: JMFC
- Not a trial; disposed by order rather than judgment
## Lifecycle stages
1. Institution
2. Registration
3. Cognizance
4. Issue of process / summons
5. Appearance of accused
6. Framing of charge
7. Prosecution evidence
8. Statement of accused
9. Defence evidence
10. Final arguments
11. Judgment
12. Disposal
## Order types
| Order type | Closes the case? |
|---|---|
| Bail order | no |
| Cognizance order | no |
| Summons / warrant | no |
| Adjournment | no |
| Charge framing | no |
| Conviction | yes |
| Acquittal | yes |
| Dismissal | yes |
## Adjournment reasons
- Accused absent
- Advocate on strike
- Witness not produced
- Presiding officer on leave
- Records awaited from police
- Time sought by prosecution
- Time sought by defence
## Limitation rules
| Trigger event | Days | Rule |
|---|---|---|
| Judgment of conviction | 30 | appeal to Sessions - VERIFY |
| Order of acquittal | ? | VERIFY |
| Order sought to be revised | 90 | revision - VERIFY |
## Example cases
(to write: 8-10 narratives, 3 with appeal chains 2-3 levels deep,
1 remanded back down, 2 tagged siblings from the same FIR)
## Example cases

> **All names, addresses, case numbers, FIR numbers and facts below are
> fictional.** They are constructed to exercise every relationship type,
> every lifecycle stage and every disposal mode in the schema. Section
> numbers and procedural details are plausible but have not been verified
> against statute â€” confirm before relying on them.

### Conventions used

| Field | Meaning |
|---|---|
| Register | G.R. (police case), C.C. (complaint case), N.I. Act, Misc. |
| Court | All JMFC Begusarai unless stated; court numbers 1â€“8 |
| Stage | One of the twelve lifecycle stages |
| Status | pending / disposed / transferred / stayed / abated |
| Listed | Number of times the matter has been listed for hearing |
| Adjourned | Number of those listings that ended in adjournment |

### A note on the IPC/BNS transition

FIRs registered before 1 July 2024 carry IPC sections; those after carry
BNS sections. The dataset below reflects this deliberately, because it is a
real complication the schema must handle: the `provisions` table needs an
`act_name` column and cases filed across the boundary may cite sections from
both statutes. Cases 1-5, 7, 8, 30, 31, 34, 35, 38-40, 44 and 47-53 cite
IPC. Cases 9, 20, 29, 32, 33, 36 and 37 cite BNS. No case cites both. The
remaining cases cite no IPC or BNS section: the N.I. Act cases, the appellate
and revisional matters, the Misc. applications, and Cases 10 and 19 (which
share Case 9's FIR but list no sections of their own).

---

## Group A â€” appeal chains

These eight cases are the hand-built test data for the recursive family-tree
query. Do not generate them with a script.

### Case 1 â€” G.R. 412/2024

- **Court:** JMFC Court No. 3, Begusarai
- **Presiding officer:** Sri A. K. Verma, JMFC
- **FIR:** 88/2024, Begusarai Mufassil PS, dated 02-03-2024
- **Sections:** IPC 379 (theft), IPC 411 (dishonestly receiving stolen property)
- **Informant:** Rajesh Kumar Singh, s/o Late Bishun Singh, Vill. Ulao, Begusarai
- **Accused:** Ramesh Paswan, s/o Jagdish Paswan, Vill. Ulao, Begusarai
- **Defence advocate:** Sri M. P. Chaudhary, Enrl. BR/1142/2009
- **APP:** Smt. Rekha Jha
- **Facts:** Motorcycle (Hero Splendor, BR09AB1234) stolen from outside the
  informant's shop on the night of 28-02-2024. Recovered 11-03-2024 from the
  accused's possession.
- **Filed:** 15-03-2024 Â· **Registered:** 18-03-2024
- **Listed:** 23 times Â· **Adjourned:** 9
- **Adjournment reasons:** witness not produced (4), advocate on strike (2),
  presiding officer on leave (2), records awaited (1)
- **Order history:**
  - 18-03-2024 â€” cognizance taken
  - 02-04-2024 â€” summons issued
  - 29-04-2024 â€” accused appeared, bail granted on bond of Rs 15,000
  - 20-06-2024 â€” charge framed under IPC 379
  - 14-07-2024 to 10-11-2025 â€” prosecution evidence, 6 witnesses examined
  - 02-12-2025 â€” statement of accused recorded
  - 08-01-2026 â€” **judgment: convicted, 2 years RI and fine Rs 5,000**
- **Status:** disposed Â· **Disposal mode:** conviction
- **Relationships:**
  - `appeal_from` â†’ Case 11 (Cr. Appeal 88/2026)
  - `tagged_with` â†’ Cases 2, 3 (same FIR)
  - `remanded_to` â† Case 12 (from Patna HC)

### Case 2 â€” G.R. 415/2024

- **Court:** JMFC Court No. 3, Begusarai
- **FIR:** 88/2024, Begusarai Mufassil PS â€” **same FIR as Case 1**
- **Sections:** IPC 379, IPC 411
- **Accused:** Sunil Paswan, s/o Jagdish Paswan, Vill. Ulao, Begusarai
  (brother of the accused in Case 1)
- **Defence advocate:** Sri M. P. Chaudhary (same as Case 1)
- **Facts:** Co-accused, alleged to have assisted in disposal of the stolen
  vehicle. Charge-sheeted separately as he was absconding when the first
  charge-sheet was filed.
- **Filed:** 22-05-2024 Â· **Registered:** 24-05-2024
- **Listed:** 18 times Â· **Adjourned:** 7
- **Stage:** prosecution evidence (3 of 6 witnesses examined)
- **Status:** pending
- **Relationships:** `tagged_with` â†’ Cases 1, 3

### Case 3 â€” G.R. 418/2024

- **Court:** JMFC Court No. 3, Begusarai
- **FIR:** 88/2024 â€” **same FIR as Cases 1 and 2**
- **Sections:** IPC 379, IPC 411
- **Accused:** Dinesh Ram, s/o Shivnandan Ram, Vill. Barauni, Begusarai
- **Facts:** Third accused, named in the supplementary charge-sheet.
  Never appeared; proclamation issued.
- **Filed:** 09-08-2024
- **Listed:** 11 times Â· **Adjourned:** 11 (accused absent throughout)
- **Stage:** appearance of accused
- **Status:** pending
- **Relationships:** `tagged_with` â†’ Cases 1, 2

### Case 4 â€” C.C. 55/2023

- **Court:** JMFC Court No. 1, Begusarai
- **Register:** Complaint Case
- **Sections:** IPC 406 (criminal breach of trust), IPC 420 (cheating)
- **Complainant:** Smt. Meena Devi, w/o Ram Naresh Prasad, Mohalla Kachhari, Begusarai
- **Accused:** Anil Kumar Gupta, s/o Suresh Gupta, Mohalla Kachhari, Begusarai
- **Complainant's advocate:** Sri R. N. Jha, Enrl. BR/0887/2004
- **Facts:** Complainant alleges she entrusted gold ornaments weighing
  approximately 85 grams to the accused, a jeweller, for remaking. Ornaments
  never returned.
- **Filed:** 12-04-2023
- **Listed:** 31 times Â· **Adjourned:** 13
- **Order history:**
  - 20-04-2023 â€” complainant examined on solemn affirmation
  - 11-05-2023 â€” cognizance taken, process issued
  - 08-08-2023 â€” accused appeared
  - 14-11-2023 â€” charge framed
  - 2024 â€” complainant's evidence; two witnesses turned hostile
  - 21-11-2025 â€” **judgment: acquitted** (entrustment not proved)
- **Status:** disposed Â· **Disposal mode:** acquittal
- **Relationships:** `appeal_from` â†’ Case 13 (Cr. Appeal 12/2026, against acquittal)

### Case 5 â€” G.R. 120/2022

- **Court:** JMFC Court No. 5, Begusarai
- **FIR:** 31/2022, Teghra PS, dated 14-02-2022
- **Sections:** IPC 323 (voluntarily causing hurt), IPC 504 (intentional insult)
- **Informant:** Shyam Bihari Mahto, s/o Ramdev Mahto, Vill. Teghra
- **Accused:** Jitendra Yadav, s/o Mahendra Yadav, Vill. Teghra
- **Facts:** Dispute over a boundary ridge between adjoining plots; informant
  alleges he was beaten with a lathi and sustained injuries to the left forearm.
- **Filed:** 28-02-2022
- **Listed:** 29 times Â· **Adjourned:** 12
- **Order history:**
  - 03-03-2022 â€” cognizance
  - 19-07-2022 â€” accused appeared, bail granted
  - 06-12-2022 â€” charge framed
  - 2023â€“2024 â€” prosecution evidence, 5 witnesses including the medical officer
  - 16-07-2024 â€” **judgment: convicted, 1 year RI**
- **Status:** disposed Â· **Disposal mode:** conviction
- **Relationships:** `appeal_from` â†’ Case 14 (Cr. Appeal 30/2024)

### Case 6 â€” N.I. Act 201/2024

- **Court:** JMFC Court No. 2, Begusarai
- **Register:** N.I. Act (s.138 Negotiable Instruments Act, 1881)
- **Complainant:** M/s Sharma Traders, through proprietor Vinod Sharma,
  Market Road, Begusarai
- **Accused:** Rakesh Singh, s/o Birendra Singh, Vill. Sahebpur Kamal
- **Complainant's advocate:** Sri P. K. Sinha, Enrl. BR/1455/2012
- **Facts:** Cheque no. 448721 dated 10-01-2024 for Rs 2,50,000 drawn on
  Punjab National Bank, Begusarai branch, returned unpaid on 18-01-2024
  with the endorsement "funds insufficient". Legal notice issued 25-01-2024,
  no payment within 15 days.
- **Filed:** 04-03-2024
- **Listed:** 19 times Â· **Adjourned:** 6
- **Order history:**
  - 11-03-2024 â€” cognizance, summons issued
  - 06-06-2024 â€” accused appeared, bail granted
  - 02-08-2024 â€” notice of accusation under s.251 CrPC explained
  - 2024â€“2025 â€” complainant's evidence by affidavit, cross-examination
  - 19-02-2026 â€” **judgment: convicted, fine Rs 3,00,000 with default
    sentence of 6 months SI**
- **Status:** disposed Â· **Disposal mode:** conviction
- **Relationships:** `appeal_from` â†’ Case 15 (Cr. Appeal 44/2026)

### Case 7 â€” G.R. 77/2023

- **Court:** JMFC Court No. 4, Begusarai
- **FIR:** 14/2023, Bachhwara PS, dated 21-01-2023
- **Sections:** IPC 506 (criminal intimidation), IPC 341 (wrongful restraint)
- **Informant:** Md. Shamim Akhtar, s/o Md. Ishtiaq, Vill. Bachhwara
- **Accused:** Mohammad Irfan, s/o Md. Rafiq, Vill. Bachhwara
- **Facts:** Informant alleges he was stopped on the village road and
  threatened with consequences over a pending panchayat dispute.
- **Filed:** 06-02-2023
- **Listed:** 26 times Â· **Adjourned:** 10
- **Order history:**
  - 10-02-2023 â€” cognizance
  - 15-05-2023 â€” accused appeared
  - 28-09-2023 â€” charge framed
  - 2024â€“2025 â€” prosecution evidence; informant partly resiled
  - 30-09-2025 â€” **judgment: acquitted**
- **Status:** disposed, then **reopened on remand**
- **Relationships:**
  - `appeal_from` â†’ Case 16 (Cr. Appeal 70/2025, against acquittal)
  - `remanded_to` â† Case 16 (Sessions remanded for retrial, Feb 2026)
- **Note:** This is the second remand cycle in the dataset and the one that
  creates a genuine cycle in the relationship graph. Use it to test the
  recursive query's path-array cycle protection.

### Case 8 â€” C.C. 33/2024

- **Court:** JMFC Court No. 1, Begusarai
- **Register:** Complaint Case
- **Sections:** IPC 499/500 (defamation)
- **Complainant:** Sanjay Mishra, s/o Devendra Mishra, Mohalla Pokhariya, Begusarai
- **Accused:** Arvind Choubey, s/o Ganga Choubey, same locality
- **Facts:** Complainant alleges the accused circulated defamatory statements
  about him in a WhatsApp group of approximately 90 members.
- **Filed:** 02-05-2024
- **Listed:** 4 times Â· **Adjourned:** 1
- **Order history:**
  - 18-06-2024 â€” **complaint dismissed at pre-cognizance stage** under
    s.203 CrPC; no sufficient ground for proceeding
- **Status:** disposed Â· **Disposal mode:** dismissal
- **Relationships:** `revision_of` â†’ Case 17 (Cr. Rev. 455/2024, Sessions)

---

## Group B â€” the appellate and revisional matters

These are the higher-court cases that Group A links to. They live at
different `hierarchy_level` values, which is what the appeal-direction
trigger validates against.

### Case 11 â€” Cr. Appeal 88/2026

- **Court:** Court of Sessions, Begusarai (hierarchy level 3)
- **Presiding officer:** Sri S. N. Pandey, Additional District & Sessions Judge
- **Appellant:** Ramesh Paswan (convict in Case 1)
- **Respondent:** State of Bihar
- **Filed:** 04-02-2026 (27 days after judgment in Case 1)
- **Listed:** 7 times Â· **Adjourned:** 2
- **Order history:**
  - 04-02-2026 â€” appeal admitted, LCR called for
  - 11-06-2026 â€” **judgment: conviction upheld, appeal dismissed**
- **Status:** disposed
- **Relationships:**
  - `appeal_from` â† Case 1
  - `revision_of` â†’ Case 12

### Case 12 â€” Cr. Revision 1204/2026

- **Court:** Patna High Court (hierarchy level 4)
- **Petitioner:** Ramesh Paswan
- **Respondent:** State of Bihar
- **Filed:** 28-07-2026
- **Order history:**
  - 22-08-2026 â€” **revision allowed in part; matter remanded to the trial
    court for fresh consideration of the evidence of PW-3 and PW-5**
- **Status:** disposed
- **Relationships:**
  - `revision_of` â† Case 11
  - `remanded_to` â†’ Case 1

### Case 13 â€” Cr. Appeal 12/2026

- **Court:** Court of Sessions, Begusarai
- **Appellant:** Smt. Meena Devi (complainant in Case 4)
- **Nature:** Appeal against acquittal
- **Filed:** 19-01-2026
- **Stage:** final arguments Â· **Status:** pending
- **Relationships:** `appeal_from` â† Case 4

### Case 14 â€” Cr. Appeal 30/2024

- **Court:** Court of Sessions, Begusarai
- **Appellant:** Jitendra Yadav (convict in Case 5)
- **Filed:** 08-08-2024
- **Order history:** 24-03-2025 â€” appeal dismissed, conviction upheld
- **Status:** disposed
- **Relationships:** `appeal_from` â† Case 5; `revision_of` â†’ Case 18

### Case 15 â€” Cr. Appeal 44/2026

- **Court:** Court of Sessions, Begusarai
- **Appellant:** Rakesh Singh (convict in Case 6)
- **Filed:** 14-03-2026
- **Stage:** final arguments Â· **Status:** pending
- **Relationships:** `appeal_from` â† Case 6

### Case 16 â€” Cr. Appeal 70/2025

- **Court:** Court of Sessions, Begusarai
- **Appellant:** Md. Shamim Akhtar (informant in Case 7)
- **Nature:** Appeal against acquittal
- **Filed:** 24-10-2025
- **Order history:** 18-02-2026 â€” **appeal allowed; acquittal set aside;
  matter remanded to JMFC for retrial from the stage of defence evidence**
- **Status:** disposed
- **Relationships:** `appeal_from` â† Case 7; `remanded_to` â†’ Case 7

### Case 17 â€” Cr. Revision 455/2024

- **Court:** Court of Sessions, Begusarai
- **Petitioner:** Sanjay Mishra (complainant in Case 8)
- **Filed:** 09-09-2024
- **Order history:** 20-01-2025 â€” revision dismissed
- **Status:** disposed
- **Relationships:** `revision_of` â† Case 8

### Case 18 â€” Cr. Revision 880/2025

- **Court:** Patna High Court
- **Petitioner:** Jitendra Yadav
- **Filed:** 02-06-2025
- **Order history:** 15-12-2025 â€” revision dismissed
- **Status:** disposed
- **Relationships:** `revision_of` â† Case 14
- **Note:** Cases 5 â†’ 14 â†’ 18 form the longest clean chain in the dataset,
  three levels with no cycle. Use it to test depth reporting.

---

## Group C â€” FIR siblings and a cross-case

### Case 9 â€” G.R. 250/2025

- **Court:** JMFC Court No. 6, Begusarai
- **FIR:** 102/2025, Bakhri PS, dated 08-05-2025
- **Sections:** BNS 191(2) (rioting), BNS 115(2) (voluntarily causing hurt),
  BNS 324(4) (mischief)
- **Informant:** Vijay Kumar Sah, s/o Lalan Sah, Vill. Bakhri Bazar
- **Accused:** Pramod Sah, s/o Nageshwar Sah, Vill. Bakhri Bazar
- **Facts:** Clash between two groups during a temple committee election.
  Six persons injured, a shop front damaged.
- **Filed:** 21-06-2025
- **Listed:** 12 times Â· **Adjourned:** 4
- **Stage:** framing of charge Â· **Status:** pending
- **Relationships:** `tagged_with` â†’ Cases 10, 19, 20

### Case 10 â€” G.R. 251/2025

- **Court:** JMFC Court No. 6, Begusarai
- **FIR:** 102/2025 â€” same FIR as Case 9
- **Accused:** Pappu Sah, s/o Nageshwar Sah
- **Filed:** 21-06-2025
- **Listed:** 12 times Â· **Adjourned:** 4
- **Stage:** framing of charge Â· **Status:** pending
- **Relationships:** `tagged_with` â†’ Cases 9, 19, 20

### Case 19 â€” G.R. 252/2025

- **Court:** JMFC Court No. 6, Begusarai
- **FIR:** 102/2025 â€” same FIR as Cases 9 and 10
- **Accused:** Chandan Sah, s/o Ramvilas Sah
- **Filed:** 21-06-2025
- **Listed:** 9 times Â· **Adjourned:** 9 (accused absent)
- **Stage:** appearance of accused Â· **Status:** pending
- **Relationships:** `tagged_with` â†’ Cases 9, 10, 20

### Case 20 â€” C.C. 101/2025

- **Court:** JMFC Court No. 6, Begusarai
- **Register:** Complaint Case (cross-case arising from the same incident)
- **Sections:** BNS 115(2), BNS 351(2)
- **Complainant:** Ramvilas Sah, s/o Dukhan Sah, Vill. Bakhri Bazar
- **Accused:** Vijay Kumar Sah (the informant in Case 9)
- **Facts:** Cross-complaint over the same temple committee clash, the
  complainant alleging he was the party assaulted.
- **Filed:** 14-07-2025
- **Listed:** 10 times Â· **Adjourned:** 3
- **Stage:** prosecution evidence Â· **Status:** pending
- **Relationships:** `arises_from_same_fir` â†’ Case 9 (connected incident)
- **Note:** Cross-cases are tried together by convention. This is a good
  test of whether your family-tree query handles a link between two cases
  of different registers at the same court level.

---

## Group D â€” N.I. Act cases

### Case 21 â€” N.I. Act 110/2023

- **Court:** JMFC Court No. 2, Begusarai
- **Complainant:** M/s Gupta Enterprises, through Ashok Gupta
- **Accused:** Nitish Kumar, s/o Umesh Prasad, Vill. Matihani
- **Cheque:** no. 227813, Rs 85,000, State Bank of India, returned 12-05-2023
  for "insufficient funds"
- **Filed:** 28-06-2023 Â· **Listed:** 21 times Â· **Adjourned:** 8
- **Order history:** 14-10-2025 â€” convicted, fine Rs 1,70,000
- **Status:** disposed Â· **Disposal mode:** conviction Â· No appeal filed

### Case 22 â€” N.I. Act 145/2024

- **Court:** JMFC Court No. 2, Begusarai
- **Complainant:** M/s Verma Steel Suppliers, through Dinesh Verma
- **Accused:** Ashok Jha, s/o Baidyanath Jha, Vill. Barauni
- **Cheque:** no. 556201, Rs 5,00,000, Bank of India, returned 03-04-2024
  for "payment stopped by drawer"
- **Filed:** 20-05-2024 Â· **Listed:** 17 times Â· **Adjourned:** 6
- **Stage:** defence evidence Â· **Status:** pending
- **Relationships:** Case 45 (exemption application) `arises_in` this case

### Case 23 â€” N.I. Act 310/2025

- **Court:** JMFC Court No. 7, Begusarai
- **Complainant:** Kumari Stores, through Smt. Anita Kumari
- **Accused:** Ravi Thakur, s/o Mahesh Thakur, Vill. Mansurchak
- **Cheque:** Rs 42,000, returned 19-08-2025
- **Filed:** 26-09-2025 Â· **Listed:** 5 times Â· **Adjourned:** 2
- **Stage:** appearance of accused Â· **Status:** pending

### Case 24 â€” N.I. Act 180/2024

- **Court:** JMFC Court No. 2, Begusarai
- **Cheque:** Rs 1,20,000, returned 22-06-2024
- **Filed:** 30-07-2024 Â· **Listed:** 14 times
- **Order history:** 11-03-2026 â€” parties settled; complaint **compounded**
  under s.147 N.I. Act; accused acquitted
- **Status:** disposed Â· **Disposal mode:** compounded
- **Note:** Compounding is a distinct disposal mode from acquittal on merits.
  Your `disposal_mode` column needs both.

### Case 25 â€” N.I. Act 220/2025

- **Court:** JMFC Court No. 7, Begusarai
- **Complainant:** M/s Agarwal Traders, through Sunil Agarwal
- **Accused:** Mukesh Roy, s/o Bhola Roy, Vill. Cheria Bariarpur
- **Cheque:** Rs 3,15,000, returned 05-06-2025
- **Filed:** 16-07-2025 Â· **Listed:** 8 times Â· **Adjourned:** 3
- **Stage:** prosecution evidence Â· **Status:** pending

### Case 26 â€” N.I. Act 95/2023

- **Court:** JMFC Court No. 2, Begusarai
- **Cheque:** Rs 60,000, returned 14-03-2023
- **Filed:** 19-04-2023 Â· **Listed:** 16 times Â· **Adjourned:** 11
- **Order history:** 07-08-2025 â€” complainant absent on four consecutive
  dates; **complaint dismissed for default**
- **Status:** disposed Â· **Disposal mode:** dismissal for default

### Case 27 â€” N.I. Act 275/2025

- **Court:** JMFC Court No. 7, Begusarai
- **Complainant:** M/s Bihar Agro Products
- **Accused:** Deepak Singh, s/o Rambalak Singh, Vill. Garhpura
- **Cheque:** Rs 7,50,000, returned 28-07-2025 â€” largest in the dataset
- **Filed:** 02-09-2025 Â· **Listed:** 6 times
- **Stage:** framing of notice Â· **Status:** pending

### Case 28 â€” N.I. Act 48/2026

- **Court:** JMFC Court No. 2, Begusarai
- **Cheque:** Rs 2,00,000, returned 09-01-2026
- **Filed:** 17-02-2026 Â· **Listed:** 1 time
- **Stage:** cognizance Â· **Status:** pending â€” newest matter in the dataset

---

## Group E â€” pending G.R. cases across every stage

Each of these sits at a different lifecycle stage, so the stage filter on
the case list has something to filter.

### Case 29 â€” G.R. 500/2025
JMFC Court No. 5. FIR 211/2025, Teghra PS, 14-07-2025. BNS 303(2) (theft).
Accused Santosh Mahto, s/o Jagarnath Mahto, Vill. Teghra.
Theft of a submersible pump from an agricultural plot.
Filed 28-08-2025. Listed 7, adjourned 2. **Stage: framing of charge.**
Case 41 (bail application) `arises_in` this case.

### Case 30 â€” G.R. 205/2023
JMFC Court No. 4. FIR 60/2023, Balia PS. IPC 323, 325.
Accused Rajiv Ranjan, s/o Shyam Sundar Rai, Vill. Balia.
Assault during a wedding procession dispute.
Filed 11-04-2023. Listed 24, adjourned 9. **Stage: defence evidence.**

### Case 31 â€” G.R. 330/2024
JMFC Court No. 3. FIR 140/2024, Begusarai Mufassil PS. IPC 448, 427.
Accused Birju Paswan. House trespass and damage to a boundary wall.
Filed 02-07-2024. Listed 15, adjourned 5. **Stage: prosecution evidence**
(2 of 5 witnesses examined).

### Case 32 â€” G.R. 90/2026
JMFC Court No. 8. FIR 22/2026, Bachhwara PS, 19-01-2026. BNS 318(4) (cheating).
Accused Manoj Kumar Singh. Alleged sale of a plot already mortgaged.
Filed 24-02-2026. Listed 2. **Stage: cognizance.**

### Case 33 â€” G.R. 410/2025
JMFC Court No. 6. FIR 175/2025, Sahebpur Kamal PS. BNS 324(4) (mischief).
Accused Lalu Yadav, s/o Hiralal Yadav. Standing crop damaged by cattle
allegedly driven in deliberately.
Filed 09-07-2025. Listed 9, adjourned 4. **Stage: appearance of accused.**
Cases 42 and 43 (bail applications) `arises_in` this case.

### Case 34 â€” G.R. 155/2024
JMFC Court No. 1. FIR 70/2024, Naokothi PS. IPC 506.
Accused Suraj Kumar. Filed 19-04-2024. Listed 20, adjourned 7.
**Stage: statement of accused.**

### Case 35 â€” G.R. 288/2023
JMFC Court No. 5. FIR 95/2023, Khodawandpur PS. IPC 379.
Accused Ramashish Das. Theft of two buffaloes.
Filed 12-05-2023. Listed 27, adjourned 11. **Stage: final arguments.**

### Case 36 â€” G.R. 601/2025
JMFC Court No. 8. FIR 240/2025, Barauni PS. BNS 118(1) (hurt by dangerous
weapon). Accused Shankar Rai. Filed 03-10-2025. Listed 4.
**Stage: issue of process.** Case 46 (bail application) `arises_in` this case.

### Case 37 â€” G.R. 44/2026
JMFC Court No. 3. FIR 9/2026, Dandari PS. BNS 189(2) (unlawful assembly).
Eleven named accused. Filed 15-01-2026. Listed 1. **Stage: registration.**

### Case 38 â€” G.R. 199/2024
JMFC Court No. 4. FIR 91/2024, Chhaurahi PS. IPC 384 (extortion).
Accused Mithilesh Singh. Filed 06-05-2024. Listed 18, adjourned 6.
**Stage: prosecution evidence** (4 witnesses examined).

---

## Group F â€” disposed cases

### Case 39 â€” G.R. 310/2022
JMFC Court No. 5. IPC 379. Convicted 17-04-2024, 6 months RI. Closed.

### Case 40 â€” G.R. 180/2022
JMFC Court No. 1. IPC 323. **Acquitted** 23-05-2024, benefit of doubt â€”
prosecution witnesses did not support the case. Closed.

### Case 44 â€” C.C. 20/2023
JMFC Court No. 1. IPC 420. **Dismissed for want of prosecution** 09-12-2024
after the complainant remained absent on three consecutive dates.

### Case 47 â€” G.R. 260/2023
JMFC Court No. 6. IPC 427. **Compounded** between the parties, disposed
20-01-2025.

### Case 48 â€” C.C. 88/2022
JMFC Court No. 2. IPC 323. Complainant Ram Pravesh Singh died during the
pendency of the proceeding. Case **abated** 11-03-2024.
**Note:** `abated` is a status, not a disposal on merits. Make sure your
status enum carries it.

### Case 49 â€” G.R. 95/2022
JMFC Court No. 7. IPC 447. Convicted 28-08-2023, fine of Rs 2,000 only,
no custodial sentence. Closed.

### Case 50 â€” G.R. 445/2023
JMFC Court No. 3. IPC 379. **Acquitted** 14-02-2025; both eye-witnesses
turned hostile. Closed.

---

## Group G â€” Misc. cases (interlocutory matters)

These attach to a parent case rather than standing alone. They are the
reason the `rel_type` enum needs an `arises_in` value â€” in practice much
of the connected-matter graph is made of these, not of appeals.

### Case 41 â€” Misc. 92/2026
Bail application by Santosh Mahto, the accused in **Case 29** (G.R. 500/2025).
Filed 02-04-2026, **allowed 18-04-2026** on a bond of Rs 20,000 with two
sureties of the like amount.
`arises_in` â†’ Case 29

### Case 42 â€” Misc. 118/2025
Bail application by Lalu Yadav, the accused in **Case 33** (G.R. 410/2025).
Filed 28-10-2025, **rejected 14-11-2025**.
`arises_in` â†’ Case 33

### Case 43 â€” Misc. 44/2026
**Second** bail application by the same accused in Case 33, moved on a
change of circumstances. Filed 19-02-2026, **allowed 06-03-2026**.
`arises_in` â†’ Case 33 Â· `subsequent_to` â†’ Case 42
**Note:** Two interlocutory applications in the same parent case, one
rejected and one allowed, is a useful test of whether your timeline query
orders and distinguishes them correctly.

### Case 45 â€” Misc. 77/2024
Application for exemption from personal appearance by the accused in
**Case 22** (N.I. Act 145/2024). Filed 22-09-2024, **allowed 08-10-2024**.
`arises_in` â†’ Case 22

### Case 46 â€” Misc. 303/2025
Bail application by Shankar Rai, the accused in **Case 36** (G.R. 601/2025).
Filed 21-10-2025. **Pending.**
`arises_in` â†’ Case 36

---

## Group H â€” transfers, stays and long-pending matters

### Case 51 â€” G.R. 150/2021
JMFC Court No. 3 â†’ **transferred to JMFC Court No. 7** on 14-06-2023 on
administrative grounds following a redistribution of files. FIR 42/2021,
Begusarai Mufassil PS. IPC 379. Accused Umesh Paswan.
Filed 19-03-2021. Listed 38, adjourned 17. **Stage: prosecution evidence.**
Oldest pending matter in the dataset â€” 5 years and counting.
`transferred_to` â†’ records the court change
**Note:** A transfer changes `court_id` on the same case rather than
creating a new one. Decide now whether you model it as a column update
plus an audit-log row, or as two case rows linked by `transferred_to`.
The audit-log approach is cleaner and I'd recommend it.

### Case 52 â€” C.C. 40/2021
JMFC Court No. 1. IPC 406. Complainant Devendra Prasad.
Filed 08-02-2021. Listed 41, **adjourned 28** â€” accused repeatedly absent,
non-bailable warrant issued twice. **Stage: appearance of accused.**
Highest adjournment count in the dataset; use it to test the adjournment
analysis query.

### Case 53 â€” G.R. 222/2022
JMFC Court No. 4. FIR 81/2022, Matihani PS. IPC 325.
Proceedings **stayed** by order of the Patna High Court dated 11-09-2023 in
Cr. Misc. 3300/2023, pending disposal of a connected quashing petition.
**Status: stayed** Â· Last effective hearing 04-09-2023.
`stayed_by` â†’ Cr. Misc. 3300/2023, Patna High Court
**Note:** A stayed case is neither pending nor disposed. Your status enum
must carry it, and the deadline engine must skip stayed cases.

### Case 54 â€” N.I. Act 15/2022
JMFC Court No. 2. Cheque Rs 95,000, returned 04-01-2022.
Filed 11-02-2022. Listed 22, **adjourned 9, of which 6 were on account of
advocate strike**. **Stage: final arguments.**

### Case 55 â€” C.C. 112/2023 â†’ N.I. Act 240/2024
A complaint under s.138 N.I. Act was mistakenly instituted in the Complaint
Case register as C.C. 112/2023 on 14-06-2023. On 22-07-2024 the error was
noticed and the matter was **renumbered into the N.I. Act register** as
N.I. Act 240/2024, carrying forward all proceedings to date.
`converted_to` â†’ the new case number
**Status:** pending, at prosecution evidence
**Note:** Case-type conversion is a real relationship type that the eCourts
record format now captures. It is worth adding to `rel_type` because it is
the one link where two case numbers refer to the *same* underlying matter,
unlike an appeal where they refer to different proceedings. Your recursive
query will treat it like any other edge, which is correct, but your family
tree UI should probably render it differently.

---

## What this dataset exercises

| Feature | Covered by |
|---|---|
| Three-level appeal chain, no cycle | Cases 5 â†’ 14 â†’ 18 |
| Appeal chain with remand cycle | Cases 1 â†’ 11 â†’ 12 â†’ back to 1 |
| Second remand cycle | Cases 7 â†’ 16 â†’ back to 7 |
| Appeal against acquittal | Cases 4 â†’ 13, 7 â†’ 16 |
| Revision direct from trial court | Cases 8 â†’ 17 |
| FIR siblings, three-way | Cases 9, 10, 19 |
| Cross-case from the same incident | Case 20 |
| Interlocutory matters | Cases 41, 42, 43, 45, 46 |
| Repeat application in one parent case | Cases 42 and 43 |
| Case-type conversion | Case 55 |
| Transfer between courts | Case 51 |
| Stay by a superior court | Case 53 |
| All twelve lifecycle stages | Group E |
| Every disposal mode | Groups F and D |
| IPC / BNS statute boundary | Throughout |

## Schema implications to act on

1. **`rel_type` needs more values** than the six originally planned. Add at
   least `arises_in` (interlocutory), `converted_to` (register change) and
   `stayed_by`. Consider `subsequent_to` for repeat applications.
2. **`disposal_mode` is not the same as `status`.** Status is
   pending/disposed/stayed/abated/transferred; disposal mode is
   conviction/acquittal/compounded/dismissed-for-default/dismissed-at-cognizance.
   Two columns, not one.
3. **`provisions` needs `act_name`** so IPC and BNS sections coexist, and a
   case filed near the boundary may cite both.
4. **The deadline engine must skip stayed and abated cases**, or it will
   generate deadlines that can never expire.
5. **Transfers are an audit-log event, not a new case row.** Model the court
   change as an update to `cases.court_id` plus a `case_audit_log` entry.
