import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

export const partnerDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  address: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
});
export type PartnerDto = z.infer<typeof partnerDtoSchema>;

export const rewardDtoSchema = z.object({
  id: z.string(),
  partnerId: z.string(),
  partnerName: z.string(),
  partnerCategory: z.string(),
  title: z.string(),
  description: z.string(),
  costEcoPoints: z.number().int(),
  stock: z.number().int(),
  isActive: z.boolean(),
  createdAt: z.string(),
});
export type RewardDto = z.infer<typeof rewardDtoSchema>;

export const redemptionStatusSchema = z.enum(["ACTIVE", "USED", "EXPIRED"]);
export type RedemptionStatusDto = z.infer<typeof redemptionStatusSchema>;

export const redemptionDtoSchema = z.object({
  id: z.string(),
  commuterId: z.string(),
  rewardId: z.string(),
  rewardTitle: z.string(),
  partnerName: z.string(),
  voucherCode: z.string(),
  costEcoPoints: z.number().int(),
  status: redemptionStatusSchema,
  expiresAt: z.string(),
  usedAt: z.string().nullable(),
  expiredAt: z.string().nullable(),
  createdAt: z.string(),
});
export type RedemptionDto = z.infer<typeof redemptionDtoSchema>;

export const createPartnerInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(80),
  address: z.string().trim().optional(),
});

export const createRewardInputSchema = z.object({
  partnerId: z.string().min(1),
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().min(2).max(400),
  costEcoPoints: z.number().int().positive(),
  stock: z.number().int().min(0),
  isActive: z.boolean().optional(),
});

export const updateRewardInputSchema = z.object({
  title: z.string().trim().min(2).max(140).optional(),
  description: z.string().trim().min(2).max(400).optional(),
  costEcoPoints: z.number().int().positive().optional(),
  stock: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const VOUCHER_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (ADR-0003)

export class RewardDomainError extends Error {
  constructor(
    readonly statusCode: 400 | 404 | 409,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const VOUCHER_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function generateVoucherCode(): string {
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += VOUCHER_ALPHABET[bytes[i]! % VOUCHER_ALPHABET.length];
  }
  return code;
}

export class RewardRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createPartner(input: z.infer<typeof createPartnerInputSchema>): Promise<PartnerDto> {
    const partner = await this.prisma.partner.create({
      data: {
        name: input.name,
        category: input.category,
        address: input.address ?? null,
      },
    });
    return partnerDtoSchema.parse({
      ...partner,
      createdAt: partner.createdAt.toISOString(),
    });
  }

  async createReward(input: z.infer<typeof createRewardInputSchema>): Promise<RewardDto> {
    const partner = await this.prisma.partner.findUnique({ where: { id: input.partnerId } });
    if (!partner) {
      throw new RewardDomainError(404, "PARTNER_NOT_FOUND", "Parceiro não encontrado.");
    }
    const reward = await this.prisma.reward.create({
      data: {
        partnerId: input.partnerId,
        title: input.title,
        description: input.description,
        costEcoPoints: input.costEcoPoints,
        stock: input.stock,
        isActive: input.isActive ?? true,
      },
      include: { partner: true },
    });
    return this.toRewardDto(reward);
  }

  async updateReward(
    rewardId: string,
    input: z.infer<typeof updateRewardInputSchema>,
  ): Promise<RewardDto> {
    const existing = await this.prisma.reward.findUnique({ where: { id: rewardId } });
    if (!existing) {
      throw new RewardDomainError(404, "REWARD_NOT_FOUND", "Recompensa não encontrada.");
    }
    const updated = await this.prisma.reward.update({
      where: { id: rewardId },
      data: {
        title: input.title,
        description: input.description,
        costEcoPoints: input.costEcoPoints,
        stock: input.stock,
        isActive: input.isActive,
      },
      include: { partner: true },
    });
    return this.toRewardDto(updated);
  }

  async listActiveRewards(): Promise<RewardDto[]> {
    const rewards = await this.prisma.reward.findMany({
      where: { isActive: true, partner: { isActive: true } },
      include: { partner: true },
      orderBy: [{ costEcoPoints: "asc" }, { createdAt: "desc" }],
    });
    return rewards.map((r) => this.toRewardDto(r));
  }

  async redeemReward(commuterId: string, rewardId: string): Promise<RedemptionDto> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Commuter" WHERE id = ${commuterId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "Reward" WHERE id = ${rewardId} FOR UPDATE`;

      const commuter = await tx.commuter.findUnique({ where: { id: commuterId } });
      if (!commuter) {
        throw new RewardDomainError(404, "COMMUTER_NOT_FOUND", "Usuário não encontrado.");
      }

      const reward = await tx.reward.findUnique({
        where: { id: rewardId },
        include: { partner: true },
      });
      if (!reward || !reward.isActive) {
        throw new RewardDomainError(404, "REWARD_NOT_FOUND", "Recompensa indisponível.");
      }
      if (reward.stock <= 0) {
        throw new RewardDomainError(
          400,
          "INSUFFICIENT_STOCK",
          "Estoque esgotado para esta recompensa.",
        );
      }
      if (commuter.ecoPointsBalance < reward.costEcoPoints) {
        throw new RewardDomainError(
          400,
          "INSUFFICIENT_BALANCE",
          "Saldo de EcoPoints insuficiente para resgatar esta recompensa.",
        );
      }

      const voucherCode = generateVoucherCode();
      const expiresAt = new Date(Date.now() + VOUCHER_TTL_MS);

      await tx.reward.update({
        where: { id: reward.id },
        data: { stock: { decrement: 1 } },
      });

      await tx.commuter.update({
        where: { id: commuter.id },
        data: { ecoPointsBalance: { decrement: reward.costEcoPoints } },
      });

      const redemption = await tx.redemption.create({
        data: {
          commuterId: commuter.id,
          rewardId: reward.id,
          voucherCode,
          costEcoPoints: reward.costEcoPoints,
          status: "ACTIVE",
          expiresAt,
        },
        include: {
          reward: { include: { partner: true } },
        },
      });

      await tx.pointTransaction.create({
        data: {
          commuterId: commuter.id,
          amount: -reward.costEcoPoints,
          reason: "REWARD_REDEEMED",
          redemptionId: redemption.id,
        },
      });

      return this.toRedemptionDto(redemption);
    });
  }

  async useRedemption(commuterId: string, redemptionId: string): Promise<RedemptionDto> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.redemption.findUnique({
        where: { id: redemptionId },
        include: { reward: { include: { partner: true } } },
      });
      if (!existing || existing.commuterId !== commuterId) {
        throw new RewardDomainError(404, "REDEMPTION_NOT_FOUND", "Voucher não encontrado.");
      }
      if (existing.status !== "ACTIVE") {
        throw new RewardDomainError(
          400,
          "INVALID_REDEMPTION_STATUS",
          `Voucher não está ativo (status atual: ${existing.status}).`,
        );
      }

      const updated = await tx.redemption.update({
        where: { id: redemptionId },
        data: {
          status: "USED",
          usedAt: new Date(),
        },
        include: { reward: { include: { partner: true } } },
      });
      return this.toRedemptionDto(updated);
    });
  }

  async listByCommuter(commuterId: string): Promise<RedemptionDto[]> {
    const redemptions = await this.prisma.redemption.findMany({
      where: { commuterId },
      include: { reward: { include: { partner: true } } },
      orderBy: { createdAt: "desc" },
    });
    return redemptions.map((r) => this.toRedemptionDto(r));
  }

  async sweepExpiredRedemptions(now: Date = new Date()): Promise<{ refundedCount: number }> {
    const expiredCandidates = await this.prisma.redemption.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: { lt: now },
      },
      select: { id: true },
    });

    let refundedCount = 0;
    for (const candidate of expiredCandidates) {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Redemption" WHERE id = ${candidate.id} FOR UPDATE`;
        const redemption = await tx.redemption.findUnique({ where: { id: candidate.id } });
        if (!redemption || redemption.status !== "ACTIVE" || redemption.expiresAt >= now) {
          return;
        }

        await tx.redemption.update({
          where: { id: redemption.id },
          data: {
            status: "EXPIRED",
            expiredAt: now,
          },
        });

        await tx.reward.update({
          where: { id: redemption.rewardId },
          data: { stock: { increment: 1 } },
        });

        await tx.commuter.update({
          where: { id: redemption.commuterId },
          data: { ecoPointsBalance: { increment: redemption.costEcoPoints } },
        });

        await tx.pointTransaction.create({
          data: {
            commuterId: redemption.commuterId,
            amount: redemption.costEcoPoints,
            reason: "REDEMPTION_EXPIRED_REFUND",
            redemptionId: redemption.id,
          },
        });

        refundedCount += 1;
      });
    }

    return { refundedCount };
  }

  private toRewardDto(reward: {
    id: string;
    partnerId: string;
    title: string;
    description: string;
    costEcoPoints: number;
    stock: number;
    isActive: boolean;
    createdAt: Date;
    partner: { name: string; category: string };
  }): RewardDto {
    return rewardDtoSchema.parse({
      id: reward.id,
      partnerId: reward.partnerId,
      partnerName: reward.partner.name,
      partnerCategory: reward.partner.category,
      title: reward.title,
      description: reward.description,
      costEcoPoints: reward.costEcoPoints,
      stock: reward.stock,
      isActive: reward.isActive,
      createdAt: reward.createdAt.toISOString(),
    });
  }

  private toRedemptionDto(redemption: {
    id: string;
    commuterId: string;
    rewardId: string;
    voucherCode: string;
    costEcoPoints: number;
    status: RedemptionStatusDto;
    expiresAt: Date;
    usedAt: Date | null;
    expiredAt: Date | null;
    createdAt: Date;
    reward: { title: string; partner: { name: string } };
  }): RedemptionDto {
    return redemptionDtoSchema.parse({
      id: redemption.id,
      commuterId: redemption.commuterId,
      rewardId: redemption.rewardId,
      rewardTitle: redemption.reward.title,
      partnerName: redemption.reward.partner.name,
      voucherCode: redemption.voucherCode,
      costEcoPoints: redemption.costEcoPoints,
      status: redemption.status,
      expiresAt: redemption.expiresAt.toISOString(),
      usedAt: redemption.usedAt ? redemption.usedAt.toISOString() : null,
      expiredAt: redemption.expiredAt ? redemption.expiredAt.toISOString() : null,
      createdAt: redemption.createdAt.toISOString(),
    });
  }
}
