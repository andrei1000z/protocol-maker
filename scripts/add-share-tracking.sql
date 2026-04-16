-- Add share links table
create table if not exists public.share_links (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  protocol_id uuid references public.protocols not null,
  slug text unique not null,
  view_count integer default 0,
  created_at timestamptz default now()
);

-- Add compliance tracking table
create table if not exists public.compliance_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  protocol_id uuid not null,
  item_type text not null,
  item_name text not null,
  date date not null,
  completed boolean default false,
  unique(user_id, item_type, item_name, date)
);

alter table public.share_links enable row level security;
alter table public.compliance_logs enable row level security;

create policy "share_links_select" on public.share_links for select using (auth.uid() = user_id);
create policy "share_links_insert" on public.share_links for insert with check (auth.uid() = user_id);
create policy "share_links_public" on public.share_links for select using (true);

create policy "compliance_select" on public.compliance_logs for select using (auth.uid() = user_id);
create policy "compliance_insert" on public.compliance_logs for insert with check (auth.uid() = user_id);
create policy "compliance_update" on public.compliance_logs for update using (auth.uid() = user_id);
create policy "compliance_upsert" on public.compliance_logs for insert with check (auth.uid() = user_id);
