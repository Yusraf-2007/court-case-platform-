import type { Metadata } from "next";

import { RecordPage } from "../record-page";

export const metadata: Metadata = { title: "Add · Admin" };
export const dynamic = "force-dynamic";

export default async function NewRecordPage({ params }: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await params;
  return <RecordPage id={id} kind={kind} rid={null} />;
}
