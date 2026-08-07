import { Hono } from 'hono';

import type { ModulesService } from '../../services/modules.service.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createModulesRoutes(modulesService: ModulesService): Hono<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes = new Hono<any>();

  // GET /modules — module ids this tenant/user is entitled to for this
  // product. The web uses this to decide which of its own sections to render.
  routes.get('/modules', async (c) => {
    const tenant = c.get('tenant');
    const { tenantId, userId } = tenant;

    const moduleIds = await modulesService.getAccessibleModuleIds(tenantId, userId);

    return c.json({ success: true, data: { moduleIds } }, 200);
  });

  return routes;
}
