import { http, HttpResponse } from 'msw';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

const IG_MODULES = [
  {
    id: 'ig-basic-metrics',
    name: 'Métricas Básicas',
    description: 'Panel de métricas, crecimiento y demografía',
    defaultUrl: 'http://localhost:3010',
    source: 'plan',
    subModules: [],
  },
  {
    id: 'ig-publications',
    name: 'Publicaciones',
    description: 'Gestioná y analizá tus publicaciones',
    defaultUrl: 'http://localhost:3010',
    source: 'plan',
    subModules: [],
  },
  {
    id: 'ig-ai-agent',
    name: 'Agente IA',
    description: 'Asistente inteligente para crecer en Instagram',
    defaultUrl: 'http://localhost:3010',
    source: 'plan',
    subModules: [
      {
        id: 'ig-ai-chat',
        name: 'Chat - Agente de Crecimiento',
        description: 'Conversá con el agente IA',
        defaultUrl: 'http://localhost:3010',
        source: 'plan',
      },
      {
        id: 'ig-ai-suggestions',
        name: 'Sugerencias de Contenido',
        description: 'Ideas de contenido generadas por IA',
        defaultUrl: 'http://localhost:3010',
        source: 'plan',
      },
      {
        id: 'ig-ai-carousels',
        name: 'Carousels - Creación con IA',
        description: 'Creá carousels con inteligencia artificial',
        defaultUrl: 'http://localhost:3010',
        source: 'plan',
      },
    ],
  },
];

export const modulesHandlers = [
  // GET /tenants/current/admin-sections — settings screens products contribute
  http.get(`${BASE}/tenants/current/admin-sections`, () =>
    HttpResponse.json({
      sections: [
        {
          key: 'linked-accounts',
          label: 'Cuentas de Instagram',
          description: 'Las cuentas vinculadas de tu organización y quién las tiene tomadas.',
          productId: 'instagram-dashboard',
          productName: 'Dashboard Instagram',
          productUrl: 'http://localhost:3010',
          path: '/admin/linked-accounts',
          moduleId: null,
        },
      ],
    }),
  ),

  http.get(`${BASE}/tenants/current/products`, () => {
    return HttpResponse.json({
      products: [
        {
          id: 'instagram-dashboard',
          name: 'Dashboard Instagram',
          description: 'Panel de análisis y métricas de Instagram',
          modules: IG_MODULES,
        },
      ],
    });
  }),

  http.get(`${BASE}/tenants/current/modules`, () => {
    return HttpResponse.json({
      modules: [
        {
          id: 'ig-basic-metrics',
          name: 'Métricas Básicas',
          description: 'Panel de métricas, crecimiento y demografía',
          defaultUrl: 'http://localhost:3010',
          source: 'plan',
          parentId: null,
        },
        {
          id: 'ig-publications',
          name: 'Publicaciones',
          description: 'Gestioná y analizá tus publicaciones',
          defaultUrl: 'http://localhost:3010',
          source: 'plan',
          parentId: null,
        },
        {
          id: 'ig-ai-agent',
          name: 'Agente IA',
          description: 'Asistente inteligente para crecer en Instagram',
          defaultUrl: 'http://localhost:3010',
          source: 'plan',
          parentId: null,
        },
        {
          id: 'ig-ai-chat',
          name: 'Chat - Agente de Crecimiento',
          description: 'Conversá con el agente IA',
          defaultUrl: 'http://localhost:3010',
          source: 'plan',
          parentId: 'ig-ai-agent',
        },
        {
          id: 'ig-ai-suggestions',
          name: 'Sugerencias de Contenido',
          description: 'Ideas de contenido generadas por IA',
          defaultUrl: 'http://localhost:3010',
          source: 'plan',
          parentId: 'ig-ai-agent',
        },
        {
          id: 'ig-ai-carousels',
          name: 'Carousels - Creación con IA',
          description: 'Creá carousels con inteligencia artificial',
          defaultUrl: 'http://localhost:3010',
          source: 'plan',
          parentId: 'ig-ai-agent',
        },
      ],
    });
  }),
];
