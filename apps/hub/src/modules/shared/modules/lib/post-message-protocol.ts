import { z } from 'zod';

// ─── Hub → Module messages ─────────────────────────────────────────────────────

export const HubToModuleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('corehub.hub.v1.token'), token: z.string() }),
  z.object({ type: z.literal('corehub.hub.v1.signOut') }),
]);

// ─── Module → Hub messages ─────────────────────────────────────────────────────

export const ModuleToHubSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('corehub.module.v1.ready') }),
  z.object({ type: z.literal('corehub.module.v1.requestToken') }),
  z.object({ type: z.literal('corehub.module.v1.error'), message: z.string() }),
]);

export type HubToModule = z.infer<typeof HubToModuleSchema>;
export type ModuleToHub = z.infer<typeof ModuleToHubSchema>;
