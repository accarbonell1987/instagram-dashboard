Actualiza el contexto del proyecto basándote en los cambios recientes.

1. Revisa los últimos cambios:
   - `git log --oneline -15` para ver los commits recientes
   - `git diff HEAD~3 --stat` para ver qué archivos cambiaron
   - Lee el contenido de los archivos más significativos que cambiaron

2. Evalúa si hubo cambios arquitectónicos en:
   - Nuevos módulos, servicios o capas
   - Cambios en dependencias (package.json)
   - Nuevos patrones de código introducidos
   - Cambios en la estructura de directorios
   - Nuevas integraciones externas

3. Actualiza SOLO las secciones afectadas en `.claude/context/ARCHITECTURE.md` y `.claude/context/PATTERNS.md`. No reescribas secciones que siguen siendo válidas.

4. Añade una entrada al final de `.claude/context/ARCHITECTURE.md` en la sección `## Changelog`:
   ```
   ### [FECHA HOY] — [descripción del cambio en 1 línea]
   - Qué cambió arquitectónicamente
   - Archivos/módulos afectados
   ```
   (Crea la sección ## Changelog si no existe)

5. Actualiza la fecha "Última actualización" en los archivos modificados.

Sé quirúrgico: solo toca lo que realmente cambió. Un sync-context que reescribe todo es peor que uno que no hace nada.
