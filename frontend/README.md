# CRM Multi-tenant para Agencias de Seguros

## Fase 0 - Fundación Completada

Sistema de gestión de clientes (CRM) diseñado específicamente para agencias de seguros, con arquitectura multi-tenant que permite a cada agencia tener su propia instancia aislada.

### Stack Tecnológico

- **Frontend**: Next.js 14 (App Router)
- **Backend/DB**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Estilos**: Tailwind CSS + Shadcn/UI
- **Validaciones**: Zod + React Hook Form
- **Lenguaje**: TypeScript estricto (sin uso de 'any')

---

## 🚀 Configuración Inicial

### Paso 1: Ejecutar Migraciones en Supabase

1. Ve a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard)
2. Navega a **SQL Editor** en el menú lateral
3. Copia todo el contenido del archivo `/supabase/migrations/00000_foundation.sql`
4. Pégalo en el editor SQL
5. Haz clic en **Run** para ejecutar

Esto creará:
- Tabla `tenants` (agencias)
- Tabla `users` (usuarios del sistema)
- Tabla `user_roles` (roles adicionales)
- Tabla `invitations` (invitaciones)
- Tabla `audit_logs` (auditoría)
- Políticas RLS para seguridad multi-tenant
- Funciones auxiliares para JWT claims

### Paso 2: Configurar Variables de Entorno

Las variables ya están configuradas en `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

### Paso 3: Iniciar la Aplicación

```bash
cd frontend
yarn install
yarn dev
```

La aplicación estará disponible en `http://localhost:3000`

---

## 📁 Estructura del Proyecto

```
/app/frontend/
├── src/
│   ├── app/                    # App Router de Next.js
│   │   ├── (auth)/            # Rutas de autenticación
│   │   │   ├── login/         # Página de inicio de sesión
│   │   │   └── registro/      # Registro de nueva agencia
│   │   ├── (tenant)/          # Rutas protegidas del tenant
│   │   │   └── dashboard/     # Dashboard principal
│   │   ├── (superadmin)/      # Rutas de superadmin
│   │   ├── (portal)/          # Portal del cliente
│   │   └── sin-organizacion/  # Página para usuarios sin tenant
│   │
│   ├── components/
│   │   └── ui/                # Componentes Shadcn/UI
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       └── spinner.tsx
│   │
│   ├── lib/
│   │   ├── context/
│   │   │   └── TenantContext.tsx   # Provider de contexto del tenant
│   │   ├── supabase/
│   │   │   ├── client.ts           # Cliente para browser
│   │   │   ├── server.ts           # Cliente para server components
│   │   │   ├── admin.ts            # Cliente con service role
│   │   │   └── database.types.ts   # Tipos de la DB
│   │   ├── types/
│   │   │   └── index.ts            # Tipos globales y schemas Zod
│   │   └── utils/
│   │       └── cn.ts               # Utility para clases
│   │
│   └── middleware.ts              # Middleware de autenticación
│
└── supabase/
    ├── migrations/
    │   └── 00000_foundation.sql   # Migración base de datos
    └── functions/
        └── auth-hook/             # Edge Function para JWT claims
            └── index.ts
```

---

## 🔐 Sistema de Autenticación y Roles

### Roles Disponibles

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| `superadmin` | Administrador del sistema | Acceso total a todos los tenants |
| `admin` | Administrador de agencia | Gestión completa de su agencia |
| `senior_agent` | Agente senior | Permisos extendidos |
| `agent` | Agente estándar | Operaciones básicas |
| `readonly` | Solo lectura | Consulta de información |

### Row Level Security (RLS)

Todas las tablas tienen RLS habilitado para garantizar aislamiento entre tenants:

- Los usuarios solo pueden ver/modificar datos de su tenant
- El `tenant_id` se valida automáticamente en cada query
- El superadmin bypasa las restricciones de tenant

---

## 🛠️ Módulos Planificados

- [x] **Módulo 00**: Fundación (completado)
- [ ] **Módulo 01**: Clientes y Pólizas
- [ ] **Módulo 02**: Pipeline de Ventas
- [ ] **Módulo 03**: Siniestros
- [ ] **Módulo 04**: Reportes
- [ ] **Módulo 05**: Facturación
- [ ] **Módulo 06**: Automatizaciones
- [ ] **Módulo 07**: Portal del Cliente
- [ ] **Módulo 08**: Configuración Visual
- [ ] **Módulo 09**: Comparativos con IA
- [ ] **Módulo 10**: Planes y Pagos
- [ ] **Módulo 11**: Super Admin

---

## 📝 Próximos Pasos

Después de ejecutar las migraciones:

1. **Registrar una agencia**: Ve a `/registro` y crea tu primera agencia
2. **Verificar email**: Confirma tu cuenta desde el correo
3. **Iniciar sesión**: Accede al dashboard
4. **Continuar con Módulo 01**: Implementar gestión de clientes y pólizas

---

## 🔧 Configuración del Auth Hook (Opcional)

Para que los claims del JWT se actualicen automáticamente después del login:

1. Instala Supabase CLI: `npm install -g supabase`
2. Despliega la función: `supabase functions deploy auth-hook`
3. Configura el webhook en Supabase Dashboard:
   - Ve a **Database > Webhooks**
   - Crea un nuevo webhook para la tabla `auth.users`
   - Eventos: INSERT, UPDATE
   - URL: `https://tu-proyecto.supabase.co/functions/v1/auth-hook`

---

## 📄 Licencia

Proyecto privado - Todos los derechos reservados.
