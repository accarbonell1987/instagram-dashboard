import { http, HttpResponse } from 'msw';

const BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:8080';

export const modulesHandlers = [
  // GET /tenants/current/modules — list accessible modules for the current tenant
  http.get(`${BASE}/tenants/current/modules`, () => {
    return HttpResponse.json({
      modules: [
        {
          id: 'buscador-app',
          name: 'Buscador de Clientes',
          description: 'Consulta y gestión de información de clientes',
          defaultUrl: process.env['NEXT_PUBLIC_MODULE_URL_BUSCADOR_APP'] ?? 'http://localhost:3010',
          source: 'plan',
        },
        {
          id: 'facturacion-app',
          name: 'Facturación Electrónica',
          description: 'Emisión y control de facturas electrónicas',
          defaultUrl:
            process.env['NEXT_PUBLIC_MODULE_URL_FACTURACION_APP'] ?? 'http://localhost:3011',
          source: 'plan',
        },
        {
          id: 'rrhh-app',
          name: 'Recursos Humanos',
          description: 'Gestión de personal y nómina',
          defaultUrl: process.env['NEXT_PUBLIC_MODULE_URL_RRHH_APP'] ?? 'http://localhost:3012',
          source: 'override',
        },
      ],
    });
  }),
];
