import { serve } from '@hono/node-server';
import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { config } from './config.js';
import { createRepositories } from './lib/create-repositories.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestId } from './middleware/request-id.js';
import { createHealthRoutes } from './routes/health/health.routes.js';
import { createPartyRoutes } from './routes/parties/parties.routes.js';
import { createRoleRoutes } from './routes/roles/roles.routes.js';
import { createUserRoutes } from './routes/users/users.routes.js';
import { PartyService } from './services/party.service.js';
import { RoleService } from './services/role.service.js';
import { UserService } from './services/user.service.js';

// Lazy-load PrismaClient only when needed (avoids DB connection on memory/file modes)
async function bootstrap() {
  let prisma;
  if (config.DATA_SOURCE === 'prisma') {
    const { prisma: prismaClient } = await import('@core/database');
    prisma = prismaClient;
  }

  // Composition root — wire all dependencies
  const repositories = createRepositories(config, prisma);

  const userService = new UserService(repositories.users);
  const roleService = new RoleService(repositories.roles);
  const partyService = new PartyService(repositories.parties);

  const app = new OpenAPIHono();

  // Middleware
  app.use('*', logger());
  app.use('*', cors({ origin: config.CORS_ORIGIN }));
  app.use('*', requestId);

  // Routes
  app.route('/health', createHealthRoutes());
  app.route('/api/users', createUserRoutes(userService));
  app.route('/api/roles', createRoleRoutes(roleService));
  app.route('/api/parties', createPartyRoutes(partyService));

  // Root info endpoint
  app.get('/', (c) => {
    return c.json({
      name: 'core-api',
      version: '0.0.0',
      dataSource: config.DATA_SOURCE,
      docs: '/docs',
    });
  });

  // OpenAPI spec
  app.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
      title: 'CORE API',
      version: '0.0.0',
      description: 'Enterprise API template with Party, User, and Role management.',
    },
    servers: [
      {
        url: `http://localhost:${String(config.PORT)}`,
        description: 'Development',
      },
    ],
  });

  // Swagger UI
  app.get('/docs', swaggerUI({ url: '/openapi.json' }));

  // Global error handler (must be last)
  app.onError(errorHandler);

  serve({ fetch: app.fetch, port: config.PORT });
  console.log(`Server running on port ${String(config.PORT)} [data source: ${config.DATA_SOURCE}]`);
  console.log(`API docs: http://localhost:${String(config.PORT)}/docs`);
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
