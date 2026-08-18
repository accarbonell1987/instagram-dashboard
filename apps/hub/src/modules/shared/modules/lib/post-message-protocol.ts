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
  // Only a panel-mounted module needs this: inside the settings layout the
  // frame is sized by its content, and nothing outside the iframe can measure
  // it. Bounded by the host — a module with a runaway layout must not be able
  // to grow the page without limit.
  z.object({ type: z.literal('corehub.module.v1.resize'), height: z.number().positive() }),
]);

export type HubToModule = z.infer<typeof HubToModuleSchema>;
export type ModuleToHub = z.infer<typeof ModuleToHubSchema>;
