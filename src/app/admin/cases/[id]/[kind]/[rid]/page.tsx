import type { Metadata } from "next";

import { RecordPage } from "../record-page";

export const metadata: Metadata = { title: "Edit · Admin" };
export const dynamic = "force-dynamic";

export default async function EditRecordPage({ params }: { params: Promise<{ id: string; kind: string; rid: string }> }) {
  const { id, kind, rid } = await params;
  return <RecordPage id={id} kind={kind} rid={rid} />;
}
