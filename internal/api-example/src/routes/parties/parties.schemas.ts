import { z } from "@hono/zod-openapi";

import type { Party } from "../../domain/party.js";
import { paginatedResponseSchema } from "../../lib/shared-schemas.js";

export const PartySchema = z
  .object({
    id: z.string().openapi({ example: "party-001" }),
    type: z
      .enum(["person", "organization"])
      .openapi({ example: "person" }),
    displayName: z.string().openapi({ example: "Alice Smith" }),
    email: z
      .string()
      .email()
      .optional()
      .openapi({ example: "alice@example.com" }),
    phone: z.string().optional().openapi({ example: "+1-555-0101" }),
    createdAt: z
      .string()
      .datetime()
      .openapi({ example: "2026-01-01T00:00:00.000Z" }),
    updatedAt: z
      .string()
      .datetime()
      .openapi({ example: "2026-01-01T00:00:00.000Z" }),
  })
  .openapi("Party");

export const CreatePartySchema = z
  .object({
    type: z.enum(["person", "organization"]).openapi({ example: "person" }),
    displayName: z
      .string()
      .min(1)
      .max(255)
      .openapi({ example: "Alice Smith" }),
    email: z
      .string()
      .email()
      .optional()
      .openapi({ example: "alice@example.com" }),
    phone: z.string().max(50).optional().openapi({ example: "+1-555-0101" }),
  })
  .openapi("CreateParty");

export const UpdatePartySchema = z
  .object({
    type: z
      .enum(["person", "organization"])
      .optional()
      .openapi({ example: "person" }),
    displayName: z
      .string()
      .min(1)
      .max(255)
      .optional()
      .openapi({ example: "Alice Smith" }),
    email: z
      .string()
      .email()
      .optional()
      .openapi({ example: "alice@example.com" }),
    phone: z.string().max(50).optional().openapi({ example: "+1-555-0101" }),
  })
  .openapi("UpdateParty");

export const PartyResponseSchema = z
  .object({
    success: z.literal(true),
    data: PartySchema,
  })
  .openapi("PartyResponse");

export const PartiesListResponseSchema = paginatedResponseSchema(
  PartySchema,
  "PartiesListResponse",
);

export function partyToDTO(party: Party) {
  return {
    id: party.id,
    type: party.type,
    displayName: party.displayName,
    email: party.email,
    phone: party.phone,
    createdAt: party.createdAt.toISOString(),
    updatedAt: party.updatedAt.toISOString(),
  };
}
