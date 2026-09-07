# ⚽ Amigo Invisible · Fulbito

Aplicación de amigo invisible para intercambiar camisetas de fútbol, con autenticación por enlace mágico de Supabase y sorteos privados.

## Stack

- Next.js 16
- React 19
- Supabase Auth + PostgreSQL + RLS
- Supabase SSR con callback PKCE

## Variables de entorno

Copiá `.env.example` a `.env.local` para desarrollo:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ypfyhmpajhsvscgljytz.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICABLE
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

En Vercel usá la URL pública de la aplicación, por ejemplo:

```env
NEXT_PUBLIC_SITE_URL=https://tu-app.vercel.app
```

La aplicación también cae automáticamente a `window.location.origin` si `NEXT_PUBLIC_SITE_URL` no está definida, pero Supabase igualmente debe tener esa URL registrada como Redirect URL.

## Supabase Auth

En **Authentication → URL Configuration** configurá:

- Site URL: la URL pública de producción.
- Redirect URL: `https://tu-app.vercel.app/auth/callback`
- Para pruebas locales: `http://localhost:3000/auth/callback`

El email mágico vuelve a `/auth/callback`, donde el código se canjea por la sesión antes de volver a la app.

## Ejecutar

```bash
npm install
npm run dev
```

Para producción:

```bash
npm run build
npm start
```

## Datos y privacidad

Las asignaciones se entregan mediante una función segura. Cada participante puede consultar únicamente su propio resultado. El organizador puede consultar el progreso general del evento, pero no los cruces.

La migración `supabase/migrations/20260906_secure_event_helpers.sql` contiene los RPC auxiliares utilizados por la interfaz.
