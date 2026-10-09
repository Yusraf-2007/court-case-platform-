// The twelve lifecycle stages of a criminal trial (DOMAIN.md), in order,
// with plain-language explanations for people who are not lawyers. The keys
// are the case_stage enum values (migration 004).
//
// These explanations describe the general course of a trial; they are not
// legal advice about any particular case.

export type StageKey =
  | "institution"
  | "registration"
  | "cognizance"
  | "issue_of_process"
  | "appearance_of_accused"
  | "framing_of_charge"
  | "prosecution_evidence"
  | "statement_of_accused"
  | "defence_evidence"
  | "final_arguments"
  | "judgment"
  | "disposal";

export const STAGES: { key: StageKey; numeral: string; title: string; plain: string }[] = [
  { key: "institution", numeral: "I", title: "Institution", plain: "The case is brought to court, by a police report or a private complaint." },
  { key: "registration", numeral: "II", title: "Registration", plain: "The court enters the case in its register and gives it a number." },
  { key: "cognizance", numeral: "III", title: "Cognizance", plain: "The magistrate examines the case and decides it should go ahead." },
  { key: "issue_of_process", numeral: "IV", title: "Summons", plain: "The court orders the accused to appear, by summons or warrant." },
  { key: "appearance_of_accused", numeral: "V", title: "Appearance", plain: "The accused comes before the court; bail is usually decided here." },
  { key: "framing_of_charge", numeral: "VI", title: "Charge", plain: "The court states the offences the accused will be tried for." },
  { key: "prosecution_evidence", numeral: "VII", title: "Prosecution evidence", plain: "Witnesses for the prosecution or complainant are examined." },
  { key: "statement_of_accused", numeral: "VIII", title: "Statement of accused", plain: "The accused is asked to explain the evidence against them." },
  { key: "defence_evidence", numeral: "IX", title: "Defence evidence", plain: "The accused may call witnesses and produce evidence." },
  { key: "final_arguments", numeral: "X", title: "Final arguments", plain: "Both sides argue their case before the judgment is written." },
  { key: "judgment", numeral: "XI", title: "Judgment", plain: "The court decides: conviction or acquittal." },
  { key: "disposal", numeral: "XII", title: "Disposal", plain: "The case is closed in this court. An appeal may follow." },
];

export const stageIndex = (key: string | null) => (key ? STAGES.findIndex((s) => s.key === key) : -1);
