Realiza un análisis arquitectónico completo de este proyecto y actualiza los archivos de contexto en `.claude/context/`.

Usa el agente **architecture-oracle** para explorar todo el codebase. El agente debe:

1. Mapear la estructura completa de carpetas y archivos clave
2. Identificar el stack tecnológico (framework, lenguaje, dependencias principales con versiones)
3. Entender la arquitectura: capas, módulos, servicios, componentes principales y sus relaciones
4. Extraer patrones reales del código: convenciones de nombrado, estructura de archivos por tipo, patrones de diseño, manejo de errores
5. Identificar flujos principales de la aplicación (los 2-3 más importantes)
6. Documentar integraciones externas (APIs, bases de datos, servicios de terceros)
7. Listar variables de entorno requeridas (de .env.example o inferidas del código)

Escribe los resultados en estos archivos con este formato:

### `.claude/context/ARCHITECTURE.md`
```markdown
# Arquitectura: [nombre]
> Última actualización: [FECHA HOY]

## Visión general
[2-3 frases: qué es, qué hace, para quién]

## Estructura de directorios
[árbol con descripción de cada carpeta clave]

## Capas de la arquitectura
[cada capa: nombre, responsabilidad, qué contiene, relación con otras capas]

## Módulos / Features principales
[lista de módulos con descripción breve: qué hace, archivos clave]

## Flujos principales
[los 2-3 flujos más importantes: paso a paso desde entrada hasta salida]

## Puntos de entrada
[archivos que arrancan la aplicación, con descripción]

## Integraciones externas
[APIs, DBs, servicios externos: nombre, propósito, cómo se usa]

## Decisiones arquitectónicas notables
[Por qué se eligió X sobre Y, si se puede inferir]
```

### `.claude/context/PATTERNS.md`
```markdown
# Patrones del proyecto: [nombre]
> Última actualización: [FECHA HOY]

## Convenciones de nombrado
[descubiertas del codebase real, con ejemplos]

## Estructura por tipo de artefacto
[cómo se estructura un módulo, servicio, componente — con ejemplo real de archivo]

## Patrones de diseño en uso
[los que realmente aparecen, con ejemplo de dónde]

## Manejo de errores
[cómo se manejan en este proyecto]

## Patrones de testing
[qué tests existen, qué framework, cómo se nombran]

## Patrones de imports
[rutas absolutas vs relativas, barrel files, aliases]

## Anti-patrones identificados
[inconsistencias o problemas que conviene evitar]
```

### `.claude/context/STACK.md`
```markdown
# Stack: [nombre]
> Última actualización: [FECHA HOY]

## Runtime
[Node.js versión, etc.]

## Lenguaje
[TypeScript versión, configuración strict, etc.]

## Frameworks principales
| Framework | Versión | Propósito |
|-----------|---------|-----------|
| ... | ... | ... |

## Dependencias clave
| Dependencia | Versión | Por qué se usa |
|-------------|---------|----------------|
| ... | ... | ... |

## Herramientas de desarrollo
[testing, linting, formatting, bundling]

## Scripts disponibles
| Script | Descripción |
|--------|-------------|
| ... | ... |

## Variables de entorno
| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| ... | ... | ... |
```

Al finalizar, actualiza la sección "Convenciones específicas de este proyecto" en el `CLAUDE.md` raíz con las convenciones más importantes que descubriste.

Muestra un resumen de los hallazgos más relevantes en la conversación.
