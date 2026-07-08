---
title: "Arquitectura de @core/core"
description: "Vision general, capas y principios de diseno del paquete de servicios"
order: 5
date: 2026-02-13
readTime: 8 min
---

# Arquitectura de @core/core

`@core/core` es el paquete que gestiona la comunicacion HTTP, autenticacion y servicios de negocio. Su diseno se basa en **composicion sobre herencia**, **inyeccion de dependencias** y **separacion estricta de capas**.

## Diagrama de capas

```
┌─────────────────────────────────────────┐
│              React Layer                │
│   createServicesStore · useServices     │
├─────────────────────────────────────────┤
│            Services Layer               │
│   CrudService<T> · createCoreServices   │
├─────────────────────────────────────────┤
│              HTTP Layer                 │
│   HttpService · createHttpClient        │
│   authInterceptor · errorInterceptor    │
├─────────────────────────────────────────┤
│              Auth Layer                 │
│   Token · AuthStrategy                  │
│   OAuthStrategy · ApiAuthStrategy       │
├─────────────────────────────────────────┤
│            Config / Errors              │
│   apiUrls · env · ServiceError          │
└─────────────────────────────────────────┘
```

## Capas en detalle

### Config (`@core/core/config`)

Utilidades para construir URLs de API y leer variables de entorno de forma tipada.

### Errors (`@core/core/errors`)

`ServiceError` estandariza todos los errores HTTP. Ofrece getters semanticos como `isUnauthorized`, `isNotFound`, `isNetworkError` para que los consumidores no dependan de codigos numericos.

### Auth (`@core/core/auth`)

Sistema de autenticacion basado en el patron **Strategy**:

- **`AuthStrategy`** — Interfaz con `requestToken()` y `refreshToken()`
- **`OAuthStrategy`** — Implementa OAuth2 client_credentials + refresh_token
- **`ApiAuthStrategy`** — Implementa login/refresh con email/password
- **`Token`** — Gestiona el ciclo de vida del token (almacenamiento, expiracion, refresh deduplicado)
- **`ITokenProvider`** — Contrato publico que usan los interceptores

### HTTP (`@core/core/http`)

- **`HttpService`** — Clase base con metodos protegidos (`get`, `post`, `put`, `patch`, `delete`). Un solo nivel de herencia.
- **`createHttpClient()`** — Factory que crea una instancia de Axios pre-configurada con interceptores de auth y error.
- **`authInterceptor`** — Inyecta el Bearer token en cada request
- **`errorInterceptor`** — Intenta refresh en 401, convierte errores a `ServiceError`

### Services (`@core/core/services`)

- **`CrudService<T, TCreate, TUpdate>`** — Servicio generico con CRUD + filter. Los servicios de dominio lo extienden cuando necesitan metodos adicionales.
- **`createCoreServices()`** — **Composition Root**. Unico punto donde se ensamblan las dependencias concretas. Retorna `CoreServices` con `tokenProvider`, `httpClient`, y `createService<T>()`.

### React (`@core/core/react`)

- **`createServicesStore()`** — Factory que crea un store Zustand con `useServices()` y `useServicesStore()`.
- Patron: crear una instancia global, inicializar con `store.getState().initialize(coreServices)`, consumir con hooks.

## Principios de diseno

### Strategy Pattern (Auth)

Cada protocolo de autenticacion se encapsula en una estrategia independiente. `Token` no sabe si usa OAuth o API simple — solo conoce la interfaz `AuthStrategy`.

### Composition Root

`createCoreServices()` es el unico lugar donde se crean instancias concretas. Todo lo demas depende de interfaces. Esto facilita testing y permite cambiar implementaciones sin afectar consumidores.

### Single-level Inheritance

`HttpService` → `CrudService<T>` → (servicio de dominio). Maximo un nivel de herencia para evitar la fragilidad de jerarquias profundas.

### Dependency Injection via Factories

En lugar de un contenedor DI, las dependencias se inyectan via constructores y factories. Esto mantiene el codigo simple y testeable.

## Exports del paquete

| Import path | Contenido |
|---|---|
| `@core/core` | Todo (re-export de todas las capas) |
| `@core/core/http` | HttpService, createHttpClient, interceptors |
| `@core/core/auth` | Token, strategies, tipos |
| `@core/core/services` | CrudService, createCoreServices, tipos |
| `@core/core/config` | apiUrls, env |
| `@core/core/errors` | ServiceError |
| `@core/core/react` | createServicesStore |
| `@core/core/mocks` | createMockAdapter, usersMock |
