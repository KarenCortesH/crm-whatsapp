import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createSupabaseServer } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const code = url.searchParams.get('code')
  // token_hash: enlace que no depende del navegador donde se pidió (p. ej. generado por el admin).
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const volver = url.searchParams.get('volver') ?? '/panel'
  const safe = volver.startsWith('/panel') ? volver : '/panel'

  if (code || (tokenHash && type)) {
    const supabase = await createSupabaseServer()
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ type: type!, token_hash: tokenHash! })
    if (!error) return NextResponse.redirect(new URL(safe, url.origin))
  }
  return NextResponse.redirect(new URL('/ingresar?error=enlace', url.origin))
}
