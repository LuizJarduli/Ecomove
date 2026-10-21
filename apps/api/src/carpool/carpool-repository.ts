import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

export const carpoolSessionStatusSchema = z.enum(["OPEN", "COMPLETED", "CANCELLED"]);
export type CarpoolSessionStatusDto = z.infer<typeof carpoolSessionStatusSchema>;

export const carpoolParticipantDtoSchema = z.object({
  commuterId: z.string(),
  joinedAt: z.string(),
});

export const carpoolSessionDtoSchema = z.object({
  id: z.string(),
  driverId: z.string(),
  joinCode: z.string().length(4),
  status: carpoolSessionStatusSchema,
  createdAt: z.string(),
  participants: z.array(carpoolParticipantDtoSchema),
});
export type CarpoolSessionDto = z.infer<typeof carpoolSessionDtoSchema>;

export class CarpoolDomainError extends Error {
  constructor(
    readonly statusCode: 400 | 404 | 409,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const JOIN_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function generateJoinCode(): string {
  const bytes = randomBytes(4);
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += JOIN_CODE_ALPHABET[bytes[i]! % JOIN_CODE_ALPHABET.length];
  }
  return code;
}

export class CarpoolRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createSession(driverId: string): Promise<CarpoolSessionDto> {
    let joinCode = generateJoinCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await this.prisma.carpoolSession.findUnique({ where: { joinCode } });
      if (!existing) break;
      joinCode = generateJoinCode();
    }

    const session = await this.prisma.carpoolSession.create({
      data: {
        driverId,
        joinCode,
        status: "OPEN",
        participants: {
          create: {
            commuterId: driverId,
          },
        },
      },
      include: {
        participants: {
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    return this.toDto(session);
  }

  async joinByCode(commuterId: string, rawJoinCode: string): Promise<CarpoolSessionDto> {
    const joinCode = rawJoinCode.trim().toUpperCase();
    const session = await this.prisma.carpoolSession.findUnique({
      where: { joinCode },
      include: { participants: true },
    });

    if (!session) {
      throw new CarpoolDomainError(404, "CARPOOL_NOT_FOUND", "Sessão de carona não encontrada para o código informado.");
    }
    if (session.status !== "OPEN") {
      throw new CarpoolDomainError(400, "CARPOOL_CLOSED", "Esta sessão de carona já foi encerrada.");
    }
    if (session.driverId === commuterId) {
      throw new CarpoolDomainError(
        400,
        "DRIVER_CANNOT_SELF_JOIN",
        "O motorista não pode ingressar na própria carona como passageiro.",
      );
    }

    const alreadyJoined = session.participants.some((p) => p.commuterId === commuterId);
    if (!alreadyJoined) {
      await this.prisma.carpoolParticipant.create({
        data: {
          sessionId: session.id,
          commuterId,
        },
      });
    }

    const updated = await this.prisma.carpoolSession.findUniqueOrThrow({
      where: { id: session.id },
      include: {
        participants: {
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    return this.toDto(updated);
  }

  private toDto(session: {
    id: string;
    driverId: string;
    joinCode: string;
    status: CarpoolSessionStatusDto;
    createdAt: Date;
    participants: Array<{ commuterId: string; joinedAt: Date }>;
  }): CarpoolSessionDto {
    return carpoolSessionDtoSchema.parse({
      id: session.id,
      driverId: session.driverId,
      joinCode: session.joinCode,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      participants: session.participants.map((p) => ({
        commuterId: p.commuterId,
        joinedAt: p.joinedAt.toISOString(),
      })),
    });
  }
}
