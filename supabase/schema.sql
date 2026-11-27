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

-- ------------------------------------------------------------------- amcs ---
-- Annual maintenance. Naveen Airtech supplies a machine and then services it
-- for a year at a time; this is what is covered, when the year is up, and who
-- to remind before it lapses.
--
-- The dates are text, in the dotted form the counter types and every bill
-- prints ("26.11.2027"). Nothing is queried by date range — the list is read
-- whole and compared in the browser — so a real date column would only mean
-- converting at both ends.
--
-- amount is nullable on purpose: some contracts are priced between the firm
-- and the customer and the figure never reaches the website.
create table if not exists public.amcs (
  id               text primary key,
  company_id       text,
  company_name     text        not null default '',
  equipment        text        not null default '',
  product_id       text,
  invoice_no       text        not null default '',
  serial_no        text        not null default '',
  start_date       text        not null default '',
  end_date         text        not null default '',
  amount           numeric,
  notes            text        not null default '',
  active           boolean     not null default true,
  last_reminded_at timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists amcs_end_idx     on public.amcs (end_date);
create index if not exists amcs_company_idx on public.amcs (company_id);

alter table public.amcs enable row level security;

drop policy if exists amcs_rw on public.amcs;
create policy amcs_rw on public.amcs for all to authenticated using (true) with check (true);
