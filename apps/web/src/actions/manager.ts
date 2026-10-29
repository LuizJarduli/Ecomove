"use server";

import { revalidatePath } from "next/cache";
import {
  createPartnerAndReward,
  generateManagerInsight,
  reviewTripStatus,
  sweepExpiredRedemptions,
  updateHazardStatus,
  type InsightProvider,
  type MobilityInsightItem,
} from "@/lib/api";
import { requireSession } from "@/lib/dal";

export async function moderateHazardAction(
  hazardId: string,
  status: "APPROVED" | "REJECTED" | "RESOLVED",
) {
  const session = await requireSession();
  if (session.status !== "manager") throw new Error("Acesso negado.");
  await updateHazardStatus(session.token, hazardId, status);
  revalidatePath("/painel");
}

export async function moderateTripAction(
  tripId: string,
  status: "VALIDATED" | "REJECTED",
  rejectionReason?: string,
) {
  const session = await requireSession();
  if (session.status !== "manager") throw new Error("Acesso negado.");
  await reviewTripStatus(session.token, tripId, status, rejectionReason);
  revalidatePath("/painel");
}

export async function createRewardCatalogAction(formData: FormData) {
  const session = await requireSession();
  if (session.status !== "manager") throw new Error("Acesso negado.");

  const partnerName = String(formData.get("partnerName") ?? "").trim();
  const partnerCategory = String(formData.get("partnerCategory") ?? "").trim();
  const partnerAddress = String(formData.get("partnerAddress") ?? "").trim() || undefined;
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const costEcoPoints = Number(formData.get("costEcoPoints") ?? 25);
  const stock = Number(formData.get("stock") ?? 10);

  if (!partnerName || !partnerCategory || !title || !description) {
    return;
  }

  await createPartnerAndReward(session.token, {
    partnerName,
    partnerCategory,
    partnerAddress,
    title,
    description,
    costEcoPoints,
    stock,
  });
  revalidatePath("/painel");
}

export async function sweepExpiredVouchersAction(): Promise<{ refundedCount: number }> {
  const session = await requireSession();
  if (session.status !== "manager") throw new Error("Acesso negado.");
  const res = await sweepExpiredRedemptions(session.token);
  revalidatePath("/painel");
  return res;
}

export async function generateInsightAction(
  provider: InsightProvider,
  institutionalOnly: boolean,
): Promise<MobilityInsightItem> {
  const session = await requireSession();
  if (session.status !== "manager") throw new Error("Acesso negado.");
  const insight = await generateManagerInsight(session.token, provider, institutionalOnly);
  revalidatePath("/painel");
  return insight;
}
