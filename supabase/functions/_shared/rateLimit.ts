// deno-lint-ignore-file no-explicit-any

// 단순 고정 윈도우 카운터. IP당 최근 windowSeconds 동안 maxAttempts회 초과 시 false 반환.
export async function checkRateLimit(
  supabase: any,
  key: string,
  maxAttempts: number,
  windowSeconds: number,
): Promise<boolean> {
  const now = Date.now()
  const { data } = await supabase.from('rate_limits').select('count, window_start').eq('key', key).maybeSingle()

  if (!data || now - new Date(data.window_start).getTime() > windowSeconds * 1000) {
    await supabase.from('rate_limits').upsert({ key, count: 1, window_start: new Date(now).toISOString() })
    return true
  }

  if (data.count >= maxAttempts) return false

  await supabase.from('rate_limits').update({ count: data.count + 1 }).eq('key', key)
  return true
}

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown'
}
