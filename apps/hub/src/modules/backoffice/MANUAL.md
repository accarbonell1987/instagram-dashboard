# Manual de Usuario — Backoffice

## ¿Qué es el Backoffice?

El Backoffice es el panel de administración de la plataforma Corehub, accesible exclusivamente para usuarios con rol **SuperAdmin** (admin@corehub.com). Desde acá se gestionan módulos, planes y tenants a nivel plataforma.

---

## Acceso

1. Iniciá sesión con tu cuenta SuperAdmin en `http://localhost:3001/login`
2. Una vez autenticado, vas a ver un ícono 📊 **Backoffice** en el header (junto a ⚙️ Settings)
3. Hacé clic para entrar

> ⚠️ Solo los usuarios con rol `SuperAdmin` ven este enlace. Si no lo ves, tu cuenta no tiene el rol necesario.

---

## Navegación

El backoffice tiene 3 secciones, accesibles desde la barra lateral izquierda:

| Sección | URL | ¿Qué gestiona? |
|---------|-----|----------------|
| **Módulos** | `/backoffice/modules` | CRUD de módulos del sistema |
| **Planes** | `/backoffice/plans` | CRUD de planes de suscripción |
| **Tenants** | `/backoffice/tenants` | Listado y gestión de organizaciones |

---

## Módulos

Los módulos son funcionalidades que pueden ser asignadas a planes y activadas/desactivadas por tenant.

### Listar módulos
Al entrar ves una tabla con todos los módulos registrados:
- **ID**: identificador único del módulo (ej: `billing`, `reports`)
- **Nombre**: nombre descriptivo
- **Estado**: 🟢 Activo o 🔴 Inactivo

Si no hay módulos, se muestra un mensaje con la opción de crear el primero.

### Crear un módulo
1. Clic en **"Crear Módulo"**
2. Completá el formulario:
   - **ID** *: código único (sin espacios, ej: `analytics`)
   - **Nombre** *: nombre visible (ej: `Analytics`)
   - **Descripción**: breve descripción del módulo
   - **URL por defecto** *: ruta del módulo (ej: `/analytics`)
3. Clic en **Guardar**

### Editar un módulo
1. Clic en el ícono ✏️ en la fila del módulo
2. Modificá nombre y/o descripción (el ID y URL no se editan)
3. Clic en **Guardar**

### Eliminar un módulo
1. Clic en el ícono 🗑 en la fila del módulo
2. Confirmá en el diálogo de confirmación
3. Si el módulo está asignado a planes activos, el sistema rechazará la eliminación y mostrará un mensaje de error

---

## Planes

Los planes definen los precios y características de suscripción disponibles para los tenants.

### Listar planes
- **Filtros**: [Todos] [Activos] [Archivados]
- Columnas: Nombre, Precio, Ciclo, Cantidad de Tenants, Estado, Acciones

### Crear un plan
1. Clic en **"Crear Plan"**
2. Completá:
   - **Nombre** *: ej: `Enterprise`
   - **Descripción**: detalle del plan
   - **Precio** *: monto (0 = gratuito)
   - **Moneda** *: código ISO (ej: `PYG`, `USD`)
   - **Ciclo de facturación** *: `month` (mensual) o `year` (anual)
3. Clic en **Guardar**

### Editar un plan
1. Clic en ✏️ en la fila del plan
2. Modificá los campos necesarios
3. Clic en **Guardar**

### Archivar un plan
- Solo disponible para planes **activos** (🟢)
- Clic en 📦 → confirmar
- El plan queda como **archivado** (◻). Los tenants que ya lo usan **mantienen el acceso**.

### Reactivar un plan
- Solo disponible para planes **archivados** (◻)
- Clic en 🔄 **Reactivar** (ícono verde) en la columna de acciones
- El plan vuelve a estado 🟢 Activo y aparece en los filtros correspondientes

---

## Tenants

Gestión de todas las organizaciones registradas en la plataforma.

### Buscar y filtrar
- **Búsqueda**: escribí en el campo de texto y presioná Enter o clic en **Buscar**
- **Estado**: filtrá por Todos, Activos, Suspendidos o Pendientes

### Listado
Tabla paginada (20 por página) con:
- **Nombre** de la organización
- **Plan** asignado
- **Estado**: 🟢 Activo, 🟡 Pendiente, 🔴 Suspendido
- **Cantidad de usuarios**

### Ver detalle
Clic en cualquier fila para abrir el panel de detalle con:
- Nombre, slug, estado, plan, cantidad de usuarios, fecha de creación

### Cambiar estado
Desde el panel de detalle:
- **Activar**: cambia un tenant suspendido o pendiente a activo
- **Suspender**: suspende un tenant activo. ⚠️ **Todos los usuarios del tenant perderán sus sesiones activas.**

> El cambio de estado se refleja inmediatamente en el panel de detalle **y en la tabla principal**.

---

## Manejo de errores

| Error | Causa | Qué hacer |
|-------|-------|-----------|
| "Acceso denegado" | Tu rol no es SuperAdmin | Verificá que tu cuenta tenga el rol correcto |
| 409 Conflict al crear | Ya existe un módulo/plan con ese ID/nombre | Usá otro identificador |
| 409 Conflict al eliminar | El módulo está asignado a planes activos | Desasignalo de los planes primero |
| Error de validación (422) | Datos incorrectos en el formulario | Revisá los campos marcados en rojo |
| "No autorizado" (401) | Sesión expirada | Volvé a iniciar sesión |

---

## Atajos de teclado

| Tecla | Acción |
|-------|--------|
| `Enter` | Enviar búsqueda en tenants / submit formulario |
| `Escape` | Cerrar diálogos modales |
| `Tab` | Navegar entre campos de formulario |
