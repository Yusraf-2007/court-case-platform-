import "server-only";

import { buildStages, type StageEvent } from "@/lib/case-stages";
import { runQuery } from "@/lib/queries";

export type CaseDetail = {
  id: string; // bigint arrives as a string
  case_no: string;
  case_type: string;
  case_type_name: string;
  is_appellate: boolean;
  disposed_by: "judgment" | "order";
  court: string;
  court_level: string;
  stage: string | null;
  status: string;
  disposal_mode: string | null;
  filed_on: Date | null;
  registered_on: Date | null;
  disposed_on: Date | null;
  fir_police_station: string | null;
  fir_number: number | null;
  fir_year: number | null;
  fir_date: Date | null;
  times_listed: number | null;
  times_adjourned: number | null;
};

export type TimelineEntry = {
  entry_date: Date;
  entry_type: "hearing" | "order";
  kind: string;
  detail: string;
  next_date: Date | null;
  judge: string | null;
  is_final: boolean | null;
  is_synthetic: boolean;
  entry_id: string;
};

export type Advocate = { name: string; enrolment: string | null; capacity: string };

export type Party = {
  id: string;
  role: string;
  kind: "individual" | "organisation" | "state";
  full_name: string;
  relation: string | null;
  relative_name: string | null;
  address: string | null;
  district: string | null;
  through_name: string | null;
  advocates: Advocate[];
};

export type Section = { act_name: string; section: string; title: string | null; is_dropped: boolean };

// Route params are untrusted text: only a plain positive integer is a case id.
export function parseCaseId(raw: string): number | null {
  if (!/^[1-9]\d{0,15}$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

export async function getCase(id: number) {
  const [rows, timeline, parties, sections, stageEvents] = await Promise.all([
    runQuery<CaseDetail>("case_detail", [id]),
    runQuery<TimelineEntry>("case_timeline", [id]),
    runQuery<Party>("case_parties", [id]),
    runQuery<Section>("case_sections", [id]),
    runQuery<StageEvent>("case_stages", [id]),
  ]);
  if (rows.length === 0) return null;
  const detail = rows[0];
  return {
    detail,
    timeline: [...timeline],
    parties: [...parties],
    sections: [...sections],
    stages: buildStages(detail, [...stageEvents]),
  };
}
