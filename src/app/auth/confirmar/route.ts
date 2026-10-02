import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const code = url.searchParams.get('code')
  const volver = url.searchParams.get('volver') ?? '/panel'
  const safe = volver.startsWith('/panel') ? volver : '/panel'

  if (code) {
    const supabase = await createSupabaseServer()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(safe, url.origin))
  }
  return NextResponse.redirect(new URL('/ingresar?error=enlace', url.origin))
}
