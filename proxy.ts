import { type NextRequest, NextResponse } from 'next/server'

export async function proxy(request: NextRequest) {
  // No interceptar rutas de API
  return NextResponse.next({ request })
}

export const config = {
  matcher: [
    // Excluir estáticos, imágenes Y rutas de API
    '/((?!_next/static|_next/image|api/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
