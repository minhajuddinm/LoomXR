-- LoomXR MVP foundation: all tables, RLS, grants, pgvector, storage buckets.
--
-- Access model
--   authenticated  business users. Explicit grants + RLS restrict every row to the
--                  owning business. Billing columns are not grantable, so a user
--                  cannot raise their own quota.
--   anon           no grants at all. Customers never talk to the Data API; the
--                  Next.js server uses the secret key on their behalf.
--   service_role   server only. Bypasses RLS.

create extension if not exists vector with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Businesses
-- ---------------------------------------------------------------------------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan text check (plan in ('starter', 'growth', 'scale')),
  subscription_status text not null default 'none',
  monthly_generation_quota integer not null default 0 check (monthly_generation_quota >= 0),
  period_generations_used integer not null default 0 check (period_generations_used >= 0),
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Products and their onboarding data
-- ---------------------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  shape text not null check (shape in ('box', 'cylinder')),
  -- box
  width_mm numeric(8, 2) check (width_mm > 0),
  height_mm numeric(8, 2) check (height_mm > 0),
  depth_mm numeric(8, 2) check (depth_mm > 0),
  -- cylinder
  diameter_mm numeric(8, 2) check (diameter_mm > 0),
  label_width_mm numeric(8, 2) check (label_width_mm > 0),
  label_height_mm numeric(8, 2) check (label_height_mm > 0),
  circumference_mm numeric(8, 2) check (circumference_mm > 0),
  brand_name text,
  mandatory_text text,
  brand_colours text[] not null default '{}',
  logo_path text,
  dieline_path text,
  base_price_cents integer check (base_price_cents >= 0),
  premium_price_cents integer check (premium_price_cents >= 0),
  currency text not null default 'CAD' check (char_length(currency) = 3),
  allow_custom_content boolean not null default false,
  public_slug text not null unique
    default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  targets_path text,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_premium_not_below_base
    check (premium_price_cents is null or base_price_cents is null
           or premium_price_cents >= base_price_cents)
);

create index products_business_id_idx on public.products (business_id);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function private.set_updated_at();

create table public.product_faces (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  face text not null check (face in ('front', 'back', 'left', 'right', 'top', 'bottom', 'label')),
  photo_path text not null,
  target_index integer check (target_index >= 0),
  created_at timestamptz not null default now(),
  unique (product_id, face)
);

create table public.product_briefs (
  product_id uuid primary key references public.products (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger product_briefs_set_updated_at
  before update on public.product_briefs
  for each row execute function private.set_updated_at();

create table public.prompt_templates (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  template text not null,
  slots text[] not null default '{}',
  edited_by_business boolean not null default false,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  unique (product_id, version)
);

-- ---------------------------------------------------------------------------
-- Ownership helpers (used by RLS policies below).
-- SECURITY INVOKER: they read through the caller's own RLS on businesses/products.
-- ---------------------------------------------------------------------------

create or replace function private.owns_business(bid uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = bid and b.owner_user_id = (select auth.uid())
  );
$$;

create or replace function private.owns_product(pid uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.products p
    join public.businesses b on b.id = p.business_id
    where p.id = pid and b.owner_user_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_business(uuid) from public;
revoke all on function private.owns_product(uuid) from public;
grant execute on function private.owns_business(uuid) to authenticated, service_role;
grant execute on function private.owns_product(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Customer sessions (anonymous, server-only)
-- ---------------------------------------------------------------------------

create table public.customer_sessions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  token_hash text not null unique,
  answers jsonb not null default '{}'::jsonb,
  consented_at timestamptz,
  rounds_used integer not null default 0 check (rounds_used >= 0),
  ip_hash text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index customer_sessions_product_id_idx on public.customer_sessions (product_id);
create index customer_sessions_expires_at_idx on public.customer_sessions (expires_at);
create index customer_sessions_ip_hash_created_idx on public.customer_sessions (ip_hash, created_at);

create table public.custom_content (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.customer_sessions (id) on delete cascade,
  text_content text,
  image_path text,
  moderation jsonb,
  retained boolean not null default false,
  created_at timestamptz not null default now()
);

create index custom_content_session_id_idx on public.custom_content (session_id);

create table public.generation_rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.customer_sessions (id) on delete cascade,
  round_number integer not null check (round_number >= 1),
  filled_prompt text not null,
  created_at timestamptz not null default now(),
  unique (session_id, round_number)
);

-- Designs outlive the session once purchased, so round_id is nullable and the
-- link is cut (not cascaded) when the session is cleaned up.
create table public.designs (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references public.generation_rounds (id) on delete set null,
  product_id uuid not null references public.products (id) on delete cascade,
  seed bigint,
  model text,
  artwork_path text,
  composite_paths jsonb not null default '{}'::jsonb,
  embedding extensions.vector(512),
  phash bit(64),
  status text not null default 'active'
    check (status in ('active', 'selected', 'purchased', 'locked', 'discarded')),
  created_at timestamptz not null default now(),
  expires_at timestamptz default (now() + interval '24 hours')
);

create index designs_round_id_idx on public.designs (round_id);
create index designs_product_id_idx on public.designs (product_id);
create index designs_expires_at_idx on public.designs (expires_at) where expires_at is not null;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null unique references public.designs (id) on delete restrict,
  business_id uuid not null references public.businesses (id) on delete cascade,
  order_code text not null unique,
  status text not null default 'selected'
    check (status in ('selected', 'purchased', 'receipt_confirmed')),
  base_price_cents integer not null,
  premium_price_cents integer not null,
  currency text not null,
  selected_at timestamptz not null default now(),
  purchased_at timestamptz,
  receipt_confirmed_at timestamptz
);

create index orders_business_id_idx on public.orders (business_id, selected_at desc);

create table public.locked_designs (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null unique references public.designs (id) on delete restrict,
  filled_prompt text not null,
  seed bigint,
  embedding extensions.vector(512) not null,
  phash bit(64) not null,
  artwork_path text not null,
  locked_at timestamptz not null default now()
);

create index locked_designs_embedding_idx
  on public.locked_designs using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Operational tables (server-only)
-- ---------------------------------------------------------------------------

create table public.usage_events (
  id bigint generated always as identity primary key,
  provider text not null,
  model text,
  operation text not null,
  units numeric not null default 1,
  cost_usd numeric(12, 6) not null default 0,
  business_id uuid references public.businesses (id) on delete set null,
  session_id uuid references public.customer_sessions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index usage_events_created_at_idx on public.usage_events (created_at);
create index usage_events_business_id_idx on public.usage_events (business_id);
create index usage_events_session_id_idx on public.usage_events (session_id);

create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value) values
  ('similarity_threshold', '0.92'::jsonb),
  ('phash_max_distance', '6'::jsonb),
  ('max_rounds', '3'::jsonb),
  ('designs_per_round', '3'::jsonb),
  ('image_model', '"black-forest-labs/FLUX.2-dev"'::jsonb);

-- ---------------------------------------------------------------------------
-- Stripe subscription sync (called by the webhook with the secret key).
-- Resets the usage counter only when a new billing period starts.
-- ---------------------------------------------------------------------------

create or replace function public.apply_subscription_state(
  p_business_id uuid,
  p_stripe_customer_id text,
  p_stripe_subscription_id text,
  p_plan text,
  p_status text,
  p_quota integer,
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated integer;
begin
  update public.businesses b
  set stripe_customer_id = coalesce(p_stripe_customer_id, b.stripe_customer_id),
      stripe_subscription_id = p_stripe_subscription_id,
      plan = p_plan,
      subscription_status = p_status,
      monthly_generation_quota = p_quota,
      period_generations_used = case
        when p_period_start is not null
             and b.current_period_start is distinct from p_period_start then 0
        else b.period_generations_used
      end,
      current_period_start = p_period_start,
      current_period_end = p_period_end
  where b.id = p_business_id;
  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

revoke all on function public.apply_subscription_state(uuid, text, text, text, text, integer, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_subscription_state(uuid, text, text, text, text, integer, timestamptz, timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- Grants. Start from nothing, then grant exactly what each role needs.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- businesses: owner reads everything, may set only the name. Billing columns
-- are written by the Stripe webhook alone.
grant select on public.businesses to authenticated;
grant insert (owner_user_id, name) on public.businesses to authenticated;
grant update (name) on public.businesses to authenticated;

grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.product_faces to authenticated;
grant select, insert, update, delete on public.product_briefs to authenticated;
grant select, insert, update, delete on public.prompt_templates to authenticated;

-- Read-only for the business; state changes go through server routes.
grant select on public.orders to authenticated;
grant select on public.designs to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.businesses enable row level security;
alter table public.products enable row level security;
alter table public.product_faces enable row level security;
alter table public.product_briefs enable row level security;
alter table public.prompt_templates enable row level security;
alter table public.customer_sessions enable row level security;
alter table public.custom_content enable row level security;
alter table public.generation_rounds enable row level security;
alter table public.designs enable row level security;
alter table public.orders enable row level security;
alter table public.locked_designs enable row level security;
alter table public.usage_events enable row level security;
alter table public.stripe_events enable row level security;
alter table public.app_settings enable row level security;

create policy businesses_select_own on public.businesses
  for select to authenticated
  using (owner_user_id = (select auth.uid()));

create policy businesses_insert_own on public.businesses
  for insert to authenticated
  with check (owner_user_id = (select auth.uid()));

create policy businesses_update_own on public.businesses
  for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

create policy products_select_own on public.products
  for select to authenticated
  using ((select private.owns_business(business_id)));

create policy products_insert_own on public.products
  for insert to authenticated
  with check ((select private.owns_business(business_id)));

create policy products_update_own on public.products
  for update to authenticated
  using ((select private.owns_business(business_id)))
  with check ((select private.owns_business(business_id)));

create policy products_delete_own on public.products
  for delete to authenticated
  using ((select private.owns_business(business_id)));

create policy product_faces_all_own on public.product_faces
  for all to authenticated
  using ((select private.owns_product(product_id)))
  with check ((select private.owns_product(product_id)));

create policy product_briefs_all_own on public.product_briefs
  for all to authenticated
  using ((select private.owns_product(product_id)))
  with check ((select private.owns_product(product_id)));

create policy prompt_templates_all_own on public.prompt_templates
  for all to authenticated
  using ((select private.owns_product(product_id)))
  with check ((select private.owns_product(product_id)));

create policy orders_select_own on public.orders
  for select to authenticated
  using ((select private.owns_business(business_id)));

create policy designs_select_own on public.designs
  for select to authenticated
  using ((select private.owns_product(product_id)));

-- customer_sessions, custom_content, generation_rounds, locked_designs,
-- usage_events, stripe_events, app_settings: RLS on, no policies, no grants.
-- Only the server (service_role) can touch them.

-- ---------------------------------------------------------------------------
-- Storage: three private buckets. Business users manage files under
-- product-assets/<business_id>/...; the other two are server-only.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('product-assets', 'product-assets', false, 20971520),
  ('designs', 'designs', false, 20971520),
  ('custom-content', 'custom-content', false, 10485760)
on conflict (id) do nothing;

create policy product_assets_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'product-assets'
    and (storage.foldername(name))[1] in (
      select b.id::text from public.businesses b
      where b.owner_user_id = (select auth.uid())
    )
  );

create policy product_assets_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-assets'
    and (storage.foldername(name))[1] in (
      select b.id::text from public.businesses b
      where b.owner_user_id = (select auth.uid())
    )
  );

create policy product_assets_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-assets'
    and (storage.foldername(name))[1] in (
      select b.id::text from public.businesses b
      where b.owner_user_id = (select auth.uid())
    )
  )
  with check (
    bucket_id = 'product-assets'
    and (storage.foldername(name))[1] in (
      select b.id::text from public.businesses b
      where b.owner_user_id = (select auth.uid())
    )
  );

create policy product_assets_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-assets'
    and (storage.foldername(name))[1] in (
      select b.id::text from public.businesses b
      where b.owner_user_id = (select auth.uid())
    )
  );
