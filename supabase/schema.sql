-- =============================================================================
-- TshirtSolution — Supabase schema
-- Runs in the SAME Supabase project as RAMCRM, so every object is prefixed
-- `tsh_` to avoid colliding with RAMCRM's public.customers / public.requirements
-- / public.line_items / public.oems / public.requirement_oems / public.oem_shipments.
--
-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query).
-- Safe to re-run: tables use IF NOT EXISTS, policies are dropped before re-creation.
--
-- Design rules (matches RAMCRM/TECH-STACK.md and AGENTS.md):
--   * Money is integer PAISE (never a float), currency fixed to INR.
--   * Validation lives in the database: an invalid order is rejected and saved nowhere.
--   * Pricing is computed in the database, never trusted from the browser.
--   * Tables are closed to anon/authenticated; the Next.js server uses the
--     service-role key server-side only.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. CATALOGUE  (one shirt style, its colours, sizes and bulk price tiers)
-- -----------------------------------------------------------------------------
create table if not exists public.tsh_styles (
  id                    uuid primary key default gen_random_uuid(),
  slug                  text not null unique,
  name                  text not null check (btrim(name) <> ''),
  description           text,
  print_area_width_px   integer not null default 240 check (print_area_width_px  > 0),
  print_area_height_px  integer not null default 320 check (print_area_height_px > 0),
  retail_price_paise    integer not null check (retail_price_paise > 0),
  active                boolean not null default true,
  created_at            timestamptz not null default now()
);

create table if not exists public.tsh_colours (
  id        uuid primary key default gen_random_uuid(),
  style_id  uuid not null references public.tsh_styles(id) on delete cascade,
  name      text not null check (btrim(name) <> ''),
  hex       text not null check (hex ~ '^#[0-9A-Fa-f]{6}$'),
  active    boolean not null default true,
  unique (style_id, name)
);

create table if not exists public.tsh_sizes (
  id          uuid primary key default gen_random_uuid(),
  style_id    uuid not null references public.tsh_styles(id) on delete cascade,
  code        text not null check (btrim(code) <> ''),
  label       text not null check (btrim(label) <> ''),
  sort_order  integer not null default 0,
  active      boolean not null default true,
  unique (style_id, code)
);

-- Bulk pricing: the unit price for a given total quantity of shirts.
-- The row with the highest min_quantity that is <= the order quantity wins.
create table if not exists public.tsh_price_tiers (
  id                uuid primary key default gen_random_uuid(),
  style_id          uuid not null references public.tsh_styles(id) on delete cascade,
  min_quantity      integer not null check (min_quantity >= 1),
  unit_price_paise  integer not null check (unit_price_paise > 0),
  unique (style_id, min_quantity)
);

-- -----------------------------------------------------------------------------
-- 2. ORDERS  (one design per order: a single print area; size lines carry qty)
-- -----------------------------------------------------------------------------
create table if not exists public.tsh_orders (
  id                uuid primary key default gen_random_uuid(),
  order_code        text not null unique,
  order_type        text not null check (order_type in ('b2c','b2b')),
  style_id          uuid not null references public.tsh_styles(id),
  colour_id         uuid not null references public.tsh_colours(id),
  customer_name     text not null check (btrim(customer_name) <> ''),
  customer_email    text not null check (customer_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  customer_phone    text not null check (length(btrim(customer_phone)) >= 7),
  company_name      text,
  design_text       text,
  design_colour     text,
  design_font       text,
  design_logo_path  text,
  design_x          numeric not null default 0,
  design_y          numeric not null default 0,
  design_scale      numeric not null default 1 check (design_scale > 0),
  total_quantity    integer not null default 0 check (total_quantity >= 0),
  total_paise       integer not null default 0 check (total_paise >= 0),
  status            text not null default 'new' check (status in ('new','in_production','done','cancelled')),
  created_at        timestamptz not null default now(),

  -- B2B orders must carry the company name.
  constraint tsh_b2b_needs_company
    check (order_type <> 'b2b' or length(btrim(coalesce(company_name,''))) > 0),
  -- Every order must carry something printable: text or a logo.
  constraint tsh_design_needs_something
    check (length(btrim(coalesce(design_text,''))) > 0 or design_logo_path is not null)
);

create table if not exists public.tsh_order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.tsh_orders(id) on delete cascade,
  size_id           uuid not null references public.tsh_sizes(id),
  quantity          integer not null check (quantity >= 1),
  unit_price_paise  integer not null check (unit_price_paise > 0),
  line_total_paise  integer not null check (line_total_paise > 0),
  unique (order_id, size_id)
);

create index if not exists tsh_order_items_order_id_idx on public.tsh_order_items(order_id);
create index if not exists tsh_orders_created_at_idx    on public.tsh_orders(created_at desc);

-- -----------------------------------------------------------------------------
-- 3. tsh_get_catalogue()  — the customer page's read
-- -----------------------------------------------------------------------------
create or replace function public.tsh_get_catalogue()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'styles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'slug', s.slug,
        'name', s.name,
        'description', s.description,
        'print_area_width_px', s.print_area_width_px,
        'print_area_height_px', s.print_area_height_px,
        'retail_price_paise', s.retail_price_paise,
        'colours', coalesce((
          select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'hex', c.hex) order by c.name)
          from public.tsh_colours c where c.style_id = s.id and c.active), '[]'::jsonb),
        'sizes', coalesce((
          select jsonb_agg(jsonb_build_object('id', z.id, 'code', z.code, 'label', z.label) order by z.sort_order)
          from public.tsh_sizes z where z.style_id = s.id and z.active), '[]'::jsonb),
        'price_tiers', coalesce((
          select jsonb_agg(jsonb_build_object('min_quantity', t.min_quantity, 'unit_price_paise', t.unit_price_paise)
                           order by t.min_quantity)
          from public.tsh_price_tiers t where t.style_id = s.id), '[]'::jsonb)
      ) order by s.name)
      from public.tsh_styles s where s.active), '[]'::jsonb)
  );
$$;

-- -----------------------------------------------------------------------------
-- 4. tsh_place_order()  — validates, prices from the database, and saves
-- -----------------------------------------------------------------------------
create or replace function public.tsh_place_order(payload jsonb)
returns table (order_id uuid, order_code text, total_quantity integer, total_paise integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type       text;
  v_style      public.tsh_styles;
  v_colour     public.tsh_colours;
  v_name       text;
  v_email      text;
  v_phone      text;
  v_company    text;
  v_text       text;
  v_logo       text;
  v_x          numeric;
  v_y          numeric;
  v_scale      numeric;
  v_qty_total  integer := 0;
  v_unit       integer;
  v_total      integer := 0;
  v_order_id   uuid;
  v_code       text;
  v_item       jsonb;
  v_size_id    uuid;
  v_qty        integer;
begin
  v_type    := lower(coalesce(payload->>'order_type',''));
  v_name    := btrim(coalesce(payload->>'customer_name',''));
  v_email   := btrim(coalesce(payload->>'customer_email',''));
  v_phone   := btrim(coalesce(payload->>'customer_phone',''));
  v_company := nullif(btrim(coalesce(payload->>'company_name','')), '');
  v_text    := nullif(btrim(coalesce(payload->>'design_text','')), '');
  v_logo    := nullif(btrim(coalesce(payload->>'design_logo_path','')), '');
  v_x       := coalesce((payload->>'design_x')::numeric, 0);
  v_y       := coalesce((payload->>'design_y')::numeric, 0);
  v_scale   := coalesce((payload->>'design_scale')::numeric, 1);

  -- Required fields.
  if v_type not in ('b2c','b2b') then
    raise exception 'order_type must be b2c or b2b';
  end if;
  if v_name = '' or v_email = '' or v_phone = '' then
    raise exception 'customer_name, customer_email and customer_phone are required';
  end if;
  if v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'customer_email is not a valid email';
  end if;
  if v_type = 'b2b' and v_company is null then
    raise exception 'company_name is required for a B2B order';
  end if;
  if v_text is null and v_logo is null then
    raise exception 'a design is required: provide design_text or design_logo_path';
  end if;
  if v_scale <= 0 then
    raise exception 'design_scale must be greater than zero';
  end if;

  -- Style must exist and be active.
  select * into v_style from public.tsh_styles
    where id = (payload->>'style_id')::uuid and active;
  if not found then
    raise exception 'unknown or inactive shirt style';
  end if;

  -- Colour must belong to that style.
  select * into v_colour from public.tsh_colours
    where id = (payload->>'colour_id')::uuid and style_id = v_style.id and active;
  if not found then
    raise exception 'colour does not belong to the selected style';
  end if;

  -- At least one size line.
  if jsonb_typeof(payload->'items') <> 'array' or jsonb_array_length(payload->'items') = 0 then
    raise exception 'items must be a non-empty array of {size_id, quantity}';
  end if;

  -- Validate every line and total the quantity.
  for v_item in select * from jsonb_array_elements(payload->'items') loop
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    if v_qty < 1 then
      raise exception 'each item needs quantity >= 1';
    end if;
    v_size_id := (v_item->>'size_id')::uuid;
    if not exists (
      select 1 from public.tsh_sizes
      where id = v_size_id and style_id = v_style.id and active
    ) then
      raise exception 'size % does not belong to the selected style', v_size_id;
    end if;
    v_qty_total := v_qty_total + v_qty;
  end loop;

  -- B2C is exactly one shirt in one size.
  if v_type = 'b2c' and (jsonb_array_length(payload->'items') <> 1 or v_qty_total <> 1) then
    raise exception 'a B2C order is one shirt in one size';
  end if;

  -- Price from the database, never from the client.
  if v_type = 'b2c' then
    v_unit := v_style.retail_price_paise;
  else
    select min(unit_price_paise) into v_unit from public.tsh_price_tiers
      where style_id = v_style.id and min_quantity <= v_qty_total;
    if v_unit is null then
      v_unit := v_style.retail_price_paise;  -- no bulk tier reached: retail
    end if;
  end if;

  v_code := 'TS-' || to_char(now(),'YYMMDD') || '-' ||
            upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 6));

  insert into public.tsh_orders (
    order_code, order_type, style_id, colour_id,
    customer_name, customer_email, customer_phone, company_name,
    design_text, design_colour, design_font, design_logo_path,
    design_x, design_y, design_scale,
    total_quantity, total_paise
  ) values (
    v_code, v_type, v_style.id, v_colour.id,
    v_name, v_email, v_phone, v_company,
    v_text, nullif(payload->>'design_colour',''), nullif(payload->>'design_font',''), v_logo,
    v_x, v_y, v_scale,
    v_qty_total, 0
  ) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(payload->'items') loop
    v_qty     := (v_item->>'quantity')::integer;
    v_size_id := (v_item->>'size_id')::uuid;
    insert into public.tsh_order_items (order_id, size_id, quantity, unit_price_paise, line_total_paise)
    values (v_order_id, v_size_id, v_qty, v_unit, v_unit * v_qty);
    v_total := v_total + v_unit * v_qty;
  end loop;

  update public.tsh_orders set total_paise = v_total where id = v_order_id;

  return query select v_order_id, v_code, v_qty_total, v_total;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. LOCK THE TABLES DOWN
--    Same project as RAMCRM. RLS is ON with no anon/authenticated policies,
--    so only the service-role key (server-side only) can read or write.
-- -----------------------------------------------------------------------------
alter table public.tsh_styles       enable row level security;
alter table public.tsh_colours      enable row level security;
alter table public.tsh_sizes        enable row level security;
alter table public.tsh_price_tiers  enable row level security;
alter table public.tsh_orders       enable row level security;
alter table public.tsh_order_items  enable row level security;

revoke all on function public.tsh_get_catalogue()   from public;
revoke all on function public.tsh_place_order(jsonb) from public;

-- -----------------------------------------------------------------------------
-- 6. STORAGE BUCKET for uploaded logos (prefixed to avoid RAMCRM collisions)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('tsh-logos', 'tsh-logos', true)
on conflict (id) do nothing;

drop policy if exists "tsh public read logos" on storage.objects;
create policy "tsh public read logos"
on storage.objects for select
to public
using (bucket_id = 'tsh-logos');

-- -----------------------------------------------------------------------------
-- 7. SEED  the one shirt style, colours, sizes and bulk tiers
-- -----------------------------------------------------------------------------
insert into public.tsh_styles (slug, name, description, print_area_width_px, print_area_height_px, retail_price_paise)
values ('classic-tee', 'Classic Cotton Tee', '180 GSM combed cotton, unisex fit.', 240, 320, 49900)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  print_area_width_px = excluded.print_area_width_px,
  print_area_height_px = excluded.print_area_height_px,
  retail_price_paise = excluded.retail_price_paise;

with s as (select id from public.tsh_styles where slug = 'classic-tee')
insert into public.tsh_colours (style_id, name, hex)
select s.id, v.name, v.hex from s, (values
  ('White',       '#FFFFFF'),
  ('Black',       '#111111'),
  ('Navy',        '#1E3A5F'),
  ('Royal Blue',  '#2563EB'),
  ('Red',         '#DC2626'),
  ('Heather Grey','#9CA3AF')
) as v(name, hex)
on conflict (style_id, name) do update set hex = excluded.hex;

with s as (select id from public.tsh_styles where slug = 'classic-tee')
insert into public.tsh_sizes (style_id, code, label, sort_order)
select s.id, v.code, v.label, v.ord from s, (values
  ('S',  'Small',   1),
  ('M',  'Medium',  2),
  ('L',  'Large',   3),
  ('XL', 'X-Large', 4),
  ('XXL','XX-Large',5)
) as v(code, label, ord)
on conflict (style_id, code) do update set label = excluded.label, sort_order = excluded.sort_order;

with s as (select id from public.tsh_styles where slug = 'classic-tee')
insert into public.tsh_price_tiers (style_id, min_quantity, unit_price_paise)
select s.id, v.min_quantity, v.unit_price_paise from s, (values
  (1,   49900),
  (10,  44900),
  (25,  39900),
  (50,  34900),
  (100, 29900)
) as v(min_quantity, unit_price_paise)
on conflict (style_id, min_quantity) do update set unit_price_paise = excluded.unit_price_paise;

-- -----------------------------------------------------------------------------
-- 8. PROVE IT (optional smoke test — uncomment, run, then delete the rows)
-- -----------------------------------------------------------------------------
-- select public.tsh_place_order(jsonb_build_object(
--   'order_type','b2c',
--   'style_id',   (select id from public.tsh_styles where slug='classic-tee'),
--   'colour_id',  (select id from public.tsh_colours where name='Black'
--                   and style_id=(select id from public.tsh_styles where slug='classic-tee')),
--   'customer_name','Test Buyer','customer_email','test@example.com','customer_phone','9876543210',
--   'design_text','HELLO','design_x',10,'design_y',10,'design_scale',1.2,
--   'items', jsonb_build_array(jsonb_build_object(
--     'size_id',(select id from public.tsh_sizes where code='M'
--                  and style_id=(select id from public.tsh_styles where slug='classic-tee')),
--     'quantity',1))
-- ));
-- -- Expect one row: TS-... , total_quantity 1, total_paise 49900
-- -- Clean up:
-- -- delete from public.tsh_orders where customer_email = 'test@example.com';

-- =============================================================================
-- After running this, put the two server-side values in TshirtSolution/.env.local:
--   NEXT_PUBLIC_SUPABASE_URL=...
--   SUPABASE_SERVICE_ROLE_KEY=...   (server only — never exposed to the browser)
-- =============================================================================
