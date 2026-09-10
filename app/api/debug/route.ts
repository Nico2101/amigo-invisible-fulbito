import { NextResponse } from 'next/server'
import * as store from '@/lib/store'

// GET /api/debug — Ver estado del store en memoria (solo para desarrollo)
export async function GET() {
  const storeState = store.debugGetAll()

  console.log('[API /api/debug] Estado actual del store:')
  console.log('  Eventos:', storeState.eventCount)
  console.log('  Códigos:', storeState.codes)

  return NextResponse.json(storeState)
}
