# Amigo Invisible · Fulbito

Aplicación Next.js + Supabase para organizar intercambios secretos de camisetas.

## Incluye

- Login por magic link con Supabase Auth.
- Callback PKCE en `/auth/callback`.
- Sesión con cookies y renovación mediante `proxy.ts`.
- Creación de eventos y acceso por código.
- 3 preferencias privadas por participante.
- Sorteo secreto mediante RPC.
- Resultado individual con preferencias del destinatario.
- Interfaz responsive pensada para móvil y escritorio.

## Variables de entorno

Copiá `.env.example` a `.env.local` y completá:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ypfyhmpajhsvscgljytz.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

En producción, `NEXT_PUBLIC_SITE_URL` debe ser la URL pública de tu app.

## Supabase Auth

En Authentication → URL Configuration configurá como Site URL la URL pública de producción y agregá también:

- `https://TU-DOMINIO/auth/callback`
- `http://localhost:3000/auth/callback`

El enlace de email generado por la app apunta a `/auth/callback` y usa PKCE.

## Desarrollo

```bash
npm install
npm run dev
```

## Base de datos

La carpeta `supabase/migrations/` contiene la migración de RPCs seguros usada por esta versión para:

- encontrar un evento por código sin exponer eventos al público;
- consultar el progreso de preferencias del organizador;
- obtener la asignación propia y las preferencias del destinatario sin abrir acceso global.
