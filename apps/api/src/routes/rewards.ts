import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Role } from "../auth/actor.js";
import {
  createPartnerInputSchema,
  createRewardInputSchema,
  partnerDtoSchema,
  redemptionDtoSchema,
  RewardDomainError,
  rewardDtoSchema,
  updateRewardInputSchema,
  type RewardRepository,
} from "../rewards/reward-repository.js";

const idParamsSchema = z.object({
  id: z.string().min(1),
});

const rewardsListResponseSchema = z.object({
  rewards: z.array(rewardDtoSchema),
});

const redemptionsListResponseSchema = z.object({
  redemptions: z.array(redemptionDtoSchema),
});

export function registerRewardRoutes(app: FastifyInstance, repo: RewardRepository) {
  app.post(
    "/v1/manager/partners",
    { config: { requiresAuth: true, requiresRole: Role.MobilityManager } },
    async (request, reply) => {
      const parsed = createPartnerInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "INVALID_BODY", message: "Dados de parceiro inválidos." });
      }
      const partner = await repo.createPartner(parsed.data);
      return reply.code(201).send(partnerDtoSchema.parse(partner));
    },
  );

  app.post(
    "/v1/manager/rewards",
    { config: { requiresAuth: true, requiresRole: Role.MobilityManager } },
    async (request, reply) => {
      const parsed = createRewardInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "INVALID_BODY", message: "Dados de recompensa inválidos." });
      }
      try {
        const reward = await repo.createReward(parsed.data);
        return reply.code(201).send(rewardDtoSchema.parse(reward));
      } catch (error) {
        if (error instanceof RewardDomainError) {
          return reply.code(error.statusCode).send({ error: error.code, message: error.message });
        }
        throw error;
      }
    },
  );

  app.patch(
    "/v1/manager/rewards/:id",
    { config: { requiresAuth: true, requiresRole: Role.MobilityManager } },
    async (request, reply) => {
      const parsedParams = idParamsSchema.safeParse(request.params);
      const parsedBody = updateRewardInputSchema.safeParse(request.body);
      if (!parsedParams.success || !parsedBody.success) {
        return reply.code(400).send({ error: "INVALID_BODY", message: "Dados de atualização inválidos." });
      }
      try {
        const updated = await repo.updateReward(parsedParams.data.id, parsedBody.data);
        return reply.code(200).send(rewardDtoSchema.parse(updated));
      } catch (error) {
        if (error instanceof RewardDomainError) {
          return reply.code(error.statusCode).send({ error: error.code, message: error.message });
        }
        throw error;
      }
    },
  );

  app.get(
    "/v1/rewards",
    { config: { requiresAuth: true } },
    async () => {
      const rewards = await repo.listActiveRewards();
      return rewardsListResponseSchema.parse({ rewards });
    },
  );

  app.post(
    "/v1/rewards/:id/redeem",
    { config: { requiresAuth: true, requiresRole: Role.Commuter } },
    async (request, reply) => {
      const parsedParams = idParamsSchema.safeParse(request.params);
      if (!parsedParams.success || !request.actor || request.actor.role !== Role.Commuter) {
        return reply.code(400).send({ error: "INVALID_PARAMS", message: "ID inválido." });
      }
      try {
        const redemption = await repo.redeemReward(request.actor.id, parsedParams.data.id);
        return reply.code(201).send(redemptionDtoSchema.parse(redemption));
      } catch (error) {
        if (error instanceof RewardDomainError) {
          return reply.code(error.statusCode).send({ error: error.code, message: error.message });
        }
        throw error;
      }
    },
  );

  app.get(
    "/v1/redemptions/me",
    { config: { requiresAuth: true, requiresRole: Role.Commuter } },
    async (request, reply) => {
      if (!request.actor || request.actor.role !== Role.Commuter) {
        return reply.code(403).send({ error: "FORBIDDEN", message: "Acesso restrito." });
      }
      const redemptions = await repo.listByCommuter(request.actor.id);
      return redemptionsListResponseSchema.parse({ redemptions });
    },
  );

  app.post(
    "/v1/redemptions/:id/use",
    { config: { requiresAuth: true, requiresRole: Role.Commuter } },
    async (request, reply) => {
      const parsedParams = idParamsSchema.safeParse(request.params);
      if (!parsedParams.success || !request.actor || request.actor.role !== Role.Commuter) {
        return reply.code(400).send({ error: "INVALID_PARAMS", message: "ID inválido." });
      }
      try {
        const updated = await repo.useRedemption(request.actor.id, parsedParams.data.id);
        return reply.code(200).send(redemptionDtoSchema.parse(updated));
      } catch (error) {
        if (error instanceof RewardDomainError) {
          return reply.code(error.statusCode).send({ error: error.code, message: error.message });
        }
        throw error;
      }
    },
  );

  app.post(
    "/v1/manager/redemptions/sweep-expired",
    { config: { requiresAuth: true, requiresRole: Role.MobilityManager } },
    async () => {
      return repo.sweepExpiredRedemptions();
    },
  );
}
