-- =============================================================================
-- Naveen Airtech — Billing : database schema
--
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> Run.
-- =============================================================================

-- --------------------------------------------------------------- products ---
create table if not exists public.products (
  id          text primary key,
  name        text        not null,
  hsn         text        not null,
  unit        text        not null default '',
  per         text        not null default '',
  rate        numeric     not null default 0,
  gst_rate    numeric     not null default 18,
  kind        text        not null default 'goods' check (kind in ('goods', 'service')),
  active      boolean     not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists products_name_idx on public.products (lower(name));
create index if not exists products_hsn_idx  on public.products (hsn);

-- -------------------------------------------------------------- companies ---
create table if not exists public.companies (
  id            text primary key,
  name          text        not null,
  address_lines jsonb       not null default '[]'::jsonb,
  gstin         text        not null default '',
  state         text        not null,
  phone         text,
  email         text,
  active        boolean     not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists companies_name_idx on public.companies (lower(name));

-- --------------------------------------------------------------- invoices ---
-- The buyer and the line items are stored as a snapshot on the invoice itself:
-- a bill printed last year must keep showing the address and prices it was
-- printed with, even after the company or the catalogue is edited.
create table if not exists public.invoices (
  id            text primary key,
  invoice_no    text        not null,
  meta          jsonb       not null,
  buyer         jsonb       not null,
  items         jsonb       not null,
  tax_mode      text        not null check (tax_mode in ('intra', 'inter')),
  tax_mode_auto boolean     not null default true,
  grand_total   numeric     not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists invoices_created_idx on public.invoices (created_at desc);
create index if not exists invoices_no_idx      on public.invoices (invoice_no);

-- --------------------------------------------------------------- settings ---
-- One row, key = 'seller', holding the firm's own printed block.
create table if not exists public.settings (
  key        text primary key,
  value      jsonb       not null,
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- Row Level Security
--
-- The anon key ships inside the browser bundle, so anyone with the site URL
-- holds it. These policies therefore require a signed-in user: create one
-- account for the shop under Authentication -> Users, and sign in from the app.
-- =============================================================================

alter table public.products  enable row level security;
alter table public.companies enable row level security;
alter table public.invoices  enable row level security;
alter table public.settings  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['products', 'companies', 'invoices', 'settings'] loop
    execute format('drop policy if exists %I on public.%I', t || '_rw', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_rw', t
    );
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- LOCAL TESTING ONLY — uncomment to let the un-authenticated anon key read and
-- write. Never leave this on for a site that is reachable from the internet.
-- -----------------------------------------------------------------------------
-- do $$
-- declare t text;
-- begin
--   foreach t in array array['products', 'companies', 'invoices', 'settings'] loop
--     execute format('drop policy if exists %I on public.%I', t || '_anon', t);
--     execute format(
--       'create policy %I on public.%I for all to anon using (true) with check (true)',
--       t || '_anon', t
--     );
--   end loop;
-- end $$;
