-- ============================================================================
-- 0004 — BYOK + Vault preparation
-- ============================================================================
-- Two independent changes bundled in one migration so they ship together:
--
--   A. profiles.anthropic_api_key — bring-your-own-key column. Power users
--      can plug their own Anthropic key so we don't pay for their usage.
--      The column is plain text; Supabase encrypts the whole DB at rest, so
--      a leaked snapshot doesn't expose keys. RLS already restricts SELECT
--      to the row owner (auth.uid() = id) and the service role.
--
--   B. encrypt_pii() / decrypt_pii() helper functions wired to pgsodium /
--      vault for FUTURE field-level encryption of medications + conditions.
--      The helpers are deployed but NOT yet invoked from app code — that's
--      a separate refactor that needs all read/write paths converted at
--      once. Deploying the helpers now means the next migration can flip
--      the column types without a multi-step dance.
--
-- Safe to re-run.
-- ============================================================================

-- ── A. BYOK column ─────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists anthropic_api_key text default null;

-- Length sanity — Anthropic keys are ~100 chars with the sk-ant- prefix.
-- Cap at 256 to leave headroom but reject obvious junk paste.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_anthropic_key_length') then
    alter table public.profiles add constraint profiles_anthropic_key_length
      check (anthropic_api_key is null or char_length(anthropic_api_key) between 8 and 256) not valid;
    alter table public.profiles validate constraint profiles_anthropic_key_length;
  end if;
exception when others then null; end $$;

comment on column public.profiles.anthropic_api_key is
  'Optional user-supplied Anthropic API key. When present, AI routes use it instead of the platform key. Bypass rate limit allowlist for BYOK users.';

-- ── B. Vault prep — encrypt_pii / decrypt_pii ──────────────────────────────
-- These are no-ops if pgsodium isn't enabled in the project (Hobby tier may
-- lack it). We try to enable, fall back to a plaintext pass-through on
-- failure so the rest of the migration succeeds.
do $$ begin
  begin
    create extension if not exists pgsodium with schema pgsodium cascade;
  exception when others then
    -- pgsodium not available on this tier — leave the helpers as plaintext
    -- so app code doesn't need to branch.
    null;
  end;
end $$;

-- Single deterministic key for now — derived from a server secret env var
-- piped into the DB via a vault.secret. When that's not set, we fall back
-- to a plaintext stub so dev environments don't break.
create or replace function public.encrypt_pii(plain text)
returns text
language plpgsql
security definer
set search_path = public, pgsodium
as $$
declare
  has_pgsodium boolean;
begin
  if plain is null or plain = '' then return plain; end if;
  select exists (select 1 from pg_extension where extname = 'pgsodium') into has_pgsodium;
  if not has_pgsodium then
    -- Plaintext pass-through — pgsodium not available. Keep callsites
    -- working; switch to real encryption when the extension is enabled.
    return plain;
  end if;
  -- Real encryption path (pgsodium): keyed via the protocol_pii_key vault secret.
  -- When the secret is missing we still pass through plaintext rather than fail.
  begin
    return encode(
      pgsodium.crypto_aead_det_encrypt(
        convert_to(plain, 'utf8'),
        convert_to('protocol-pii', 'utf8'),
        (select decrypted_secret::uuid from vault.decrypted_secrets where name = 'protocol_pii_key' limit 1)
      ),
      'base64'
    );
  exception when others then
    return plain;
  end;
end;
$$;

create or replace function public.decrypt_pii(cipher text)
returns text
language plpgsql
security definer
set search_path = public, pgsodium
as $$
declare
  has_pgsodium boolean;
begin
  if cipher is null or cipher = '' then return cipher; end if;
  select exists (select 1 from pg_extension where extname = 'pgsodium') into has_pgsodium;
  if not has_pgsodium then return cipher; end if;
  begin
    return convert_from(
      pgsodium.crypto_aead_det_decrypt(
        decode(cipher, 'base64'),
        convert_to('protocol-pii', 'utf8'),
        (select decrypted_secret::uuid from vault.decrypted_secrets where name = 'protocol_pii_key' limit 1)
      ),
      'utf8'
    );
  exception when others then
    return cipher;
  end;
end;
$$;

revoke all on function public.encrypt_pii(text) from public, anon, authenticated;
revoke all on function public.decrypt_pii(text) from public, anon, authenticated;
grant execute on function public.encrypt_pii(text) to service_role;
grant execute on function public.decrypt_pii(text) to service_role;

comment on function public.encrypt_pii is
  'Field-level encryption helper, used by future migrations that move medications + conditions to ciphertext. Falls back to plaintext when pgsodium is unavailable.';
