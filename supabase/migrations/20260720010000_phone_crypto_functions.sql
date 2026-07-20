-- 10-1장: 전화번호 해시/암호화 함수 (Edge Function 전용, service_role만 실행 가능)

create or replace function public.hash_phone(phone text, secret text)
returns text
language sql
security definer
set search_path = extensions, public
as $$
  select encode(hmac(phone, secret, 'sha256'), 'hex');
$$;

create or replace function public.encrypt_phone(phone text, enc_key text)
returns bytea
language sql
security definer
set search_path = extensions, public
as $$
  select pgp_sym_encrypt(phone, enc_key);
$$;

create or replace function public.decrypt_phone(phone_encrypted bytea, enc_key text)
returns text
language sql
security definer
set search_path = extensions, public
as $$
  select pgp_sym_decrypt(phone_encrypted, enc_key);
$$;

-- anon/authenticated는 절대 호출 불가 (프론트엔드에서 직접 호출 차단),
-- Edge Function이 사용하는 service_role만 실행 가능
revoke all on function public.hash_phone(text, text) from public, anon, authenticated;
revoke all on function public.encrypt_phone(text, text) from public, anon, authenticated;
revoke all on function public.decrypt_phone(bytea, text) from public, anon, authenticated;

grant execute on function public.hash_phone(text, text) to service_role;
grant execute on function public.encrypt_phone(text, text) to service_role;
grant execute on function public.decrypt_phone(bytea, text) to service_role;
