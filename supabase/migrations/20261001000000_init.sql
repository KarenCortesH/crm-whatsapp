-- Esquema inicial multi-tenant del CRM. Cada fila de negocio lleva tenant_id y RLS.
create extension if not exists pgcrypto;

create type public.member_role as enum ('owner', 'agent');

-- ───────────────────────── Tenants y equipo ─────────────────────────
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kapso_customer_id text unique,
  monthly_spend_cap_usd numeric(10, 2),
  alert_email text,
  alert_whatsapp text,
  created_at timestamptz not null default now()
);

create table public.memberships (
  tenant_id uuid not null references public.tenants on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role public.member_role not null default 'agent',
  display_name text,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

create function public.is_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m where m.tenant_id = t and m.user_id = auth.uid())
$$;

create function public.is_owner(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id = t and m.user_id = auth.uid() and m.role = 'owner'
  )
$$;

-- ───────────────────────── Canal (números) ─────────────────────────
create table public.phone_numbers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants on delete cascade,
  phone_number_id text not null unique,
  waba_id text,
  display_phone_number text,
  verified_name text,
  is_coexistence boolean not null default false,
  quality_rating text,
  throughput_tier text,
  messaging_limit text,
  connection_status text,
  last_inbound_at timestamptz,
  last_webhook_at timestamptz,
  created_at timestamptz not null default now()
);
create index phone_numbers_tenant_idx on public.phone_numbers (tenant_id);

create table public.setup_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants on delete cascade,
  kapso_setup_link_id text not null unique,
  url text not null,
  status text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Eventos crudos: se guardan antes de procesar (idempotencia + auditoría). Solo service_role.
create table public.webhook_events (
  id bigint generated always as identity primary key,
  source text not null check (source in ('kapso', 'meta')),
  idempotency_key text not null unique,
  event_type text,
  phone_number_id text,
  tenant_id uuid references public.tenants on delete set null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);
create index webhook_events_pending_idx on public.webhook_events (received_at) where processed_at is null;

create table public.health_snapshots (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants on delete cascade,
  phone_id uuid not null references public.phone_numbers on delete cascade,
  color text not null check (color in ('verde', 'amarillo', 'rojo')),
  quality_rating text,
  throughput_tier text,
  messaging text,
  findings jsonb not null default '[]',
  headline text not null,
  checked_at timestamptz not null default now()
);
create index health_snapshots_phone_idx on public.health_snapshots (phone_id, checked_at desc);

create table public.alerts (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants on delete cascade,
  phone_id uuid references public.phone_numbers on delete cascade,
  source text not null check (source in ('meta', 'numero', 'nosotros', 'consumo', 'campana')),
  severity text not null check (severity in ('aviso', 'critico')),
  title text not null,
  body text not null,
  dedupe_key text not null,
  channels text[] not null default '{}',
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, dedupe_key)
);

-- ───────────────────────── Contactos y consentimiento ─────────────────────────
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants on delete cascade,
  wa_id text not null,
  name text,
  marketing_opted_out boolean not null default false,
  marketing_pref_sequence bigint not null default 0,
  marketing_pref_changed_at timestamptz,
  blocked_reports int not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, wa_id)
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants on delete cascade,
  contact_id uuid not null references public.contacts on delete cascade,
  purpose text not null check (purpose in ('marketing', 'utilidad')),
  method text not null check (method in ('formulario_web', 'mensaje_whatsapp', 'presencial', 'importacion', 'otro')),
  source_detail text not null,
  evidence text,
  recorded_by uuid references auth.users on delete set null,
  granted_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index consents_contact_idx on public.consents (contact_id, purpose);

create function public.has_marketing_consent(c uuid) returns boolean
language sql stable set search_path = public as $$
  select exists (
    select 1 from public.consents k
    where k.contact_id = c and k.purpose = 'marketing' and k.revoked_at is null and k.granted_at <= now()
  ) and not coalesce((select marketing_opted_out from public.contacts where id = c), true)
$$;

-- ───────────────────────── Bandeja ─────────────────────────
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants on delete cascade,
  phone_id uuid not null references public.phone_numbers on delete cascade,
  contact_id uuid not null references public.contacts on delete cascade,
  kapso_conversation_id text unique,
  status text not null default 'abierta' check (status in ('abierta', 'pendiente', 'cerrada')),
  assigned_to uuid references auth.users on delete set null,
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  last_message_preview text,
  unread_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (phone_id, contact_id)
);
create index conversations_tenant_idx on public.conversations (tenant_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants on delete cascade,
  phone_id uuid not null references public.phone_numbers on delete cascade,
  conversation_id uuid references public.conversations on delete cascade,
  contact_id uuid references public.contacts on delete set null,
  wamid text not null unique,
  direction text not null check (direction in ('inbound', 'outbound')),
  msg_type text not null,
  body text,
  status text not null,
  error_code int,
  error_title text,
  pricing_category text,
  billable boolean,
  sent_by uuid references auth.users on delete set null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, sent_at);
create index messages_billing_idx on public.messages (tenant_id, sent_at) where billable;

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants on delete cascade,
  name text not null,
  color text not null default '#64748b',
  unique (tenant_id, name)
);

create table public.conversation_tags (
  tenant_id uuid not null references public.tenants on delete cascade,
  conversation_id uuid not null references public.conversations on delete cascade,
  tag_id uuid not null references public.tags on delete cascade,
  primary key (conversation_id, tag_id)
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants on delete cascade,
  conversation_id uuid not null references public.conversations on delete cascade,
  author_id uuid references auth.users on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants on delete cascade,
  shortcut text not null,
  body text not null,
  unique (tenant_id, shortcut)
);

-- ───────────────────────── Plantillas y calificador ─────────────────────────
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants on delete cascade,
  name text not null,
  language text not null default 'es',
  body text not null,
  requested_category text not null check (requested_category in ('UTILITY', 'MARKETING', 'AUTHENTICATION')),
  meta_template_id text unique,
  meta_category text,
  status text not null default 'BORRADOR',
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name, language)
);

create table public.template_predictions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants on delete cascade,
  template_id uuid references public.templates on delete set null,
  body_text text not null,
  provider text not null,
  model text,
  p_utility numeric(4, 3) not null,
  p_marketing numeric(4, 3) not null,
  p_authentication numeric(4, 3) not null,
  verdict text not null check (verdict in ('utilidad', 'marketing', 'autenticacion', 'dudosa')),
  marketing_phrases jsonb not null default '[]',
  suggested_rewrite text,
  final_meta_category text,
  created_at timestamptz not null default now()
);
create index template_predictions_template_idx on public.template_predictions (template_id);

-- ───────────────────────── Campañas ─────────────────────────
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants on delete cascade,
  phone_id uuid not null references public.phone_numbers on delete cascade,
  template_id uuid not null references public.templates on delete restrict,
  name text not null,
  status text not null default 'borrador'
    check (status in ('borrador', 'enviando', 'pausada', 'completada', 'cancelada')),
  risk_score int,
  risk_report jsonb,
  batch_size int not null default 50 check (batch_size between 1 and 1000),
  paused_reason text,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants on delete cascade,
  campaign_id uuid not null references public.campaigns on delete cascade,
  contact_id uuid not null references public.contacts on delete cascade,
  batch_no int not null default 0,
  status text not null default 'pendiente' check (status in ('pendiente', 'enviado', 'fallido', 'omitido')),
  wamid text,
  error text,
  unique (campaign_id, contact_id)
);

-- Barrera dura: nadie entra a una campaña de marketing sin opt-in vigente ni con baja.
create function public.enforce_campaign_consent() returns trigger
language plpgsql set search_path = public as $$
declare
  cat text;
begin
  select t.requested_category into cat
  from public.campaigns c join public.templates t on t.id = c.template_id
  where c.id = new.campaign_id;
  if cat = 'MARKETING' and new.status in ('pendiente', 'enviado') and not public.has_marketing_consent(new.contact_id) then
    raise exception 'El contacto % no tiene consentimiento de marketing vigente', new.contact_id
      using errcode = 'check_violation';
  end if;
  return new;
end
$$;

create trigger campaign_recipients_consent
before insert or update of status on public.campaign_recipients
for each row execute function public.enforce_campaign_consent();

create table public.spend_alerts_sent (
  tenant_id uuid not null references public.tenants on delete cascade,
  period text not null,
  threshold int not null check (threshold in (50, 80, 100)),
  sent_at timestamptz not null default now(),
  primary key (tenant_id, period, threshold)
);

-- Tarifas de Meta por categoría y país (USD por mensaje entregado). Las carga el admin.
create table public.meta_rates (
  id bigint generated always as identity primary key,
  country_code text not null,
  category text not null check (category in ('marketing', 'utility', 'authentication', 'service')),
  usd_per_message numeric(10, 5) not null,
  effective_from date not null,
  unique (country_code, category, effective_from)
);

-- ───────────────────────── RLS ─────────────────────────
alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
alter table public.phone_numbers enable row level security;
alter table public.setup_links enable row level security;
alter table public.webhook_events enable row level security;
alter table public.health_snapshots enable row level security;
alter table public.alerts enable row level security;
alter table public.contacts enable row level security;
alter table public.consents enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.tags enable row level security;
alter table public.conversation_tags enable row level security;
alter table public.notes enable row level security;
alter table public.quick_replies enable row level security;
alter table public.templates enable row level security;
alter table public.template_predictions enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_recipients enable row level security;
alter table public.spend_alerts_sent enable row level security;
alter table public.meta_rates enable row level security;

create policy tenants_select on public.tenants for select to authenticated using (public.is_member(id));
create policy tenants_update on public.tenants for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));

create policy memberships_select on public.memberships for select to authenticated using (public.is_member(tenant_id));
create policy memberships_owner_write on public.memberships for all to authenticated
  using (public.is_owner(tenant_id)) with check (public.is_owner(tenant_id));

create policy meta_rates_read on public.meta_rates for select to authenticated using (true);

-- Lectura para miembros en tablas que solo escribe el servidor.
do $$
declare t text;
begin
  foreach t in array array['phone_numbers', 'setup_links', 'health_snapshots', 'spend_alerts_sent', 'template_predictions'] loop
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated using (public.is_member(tenant_id))', t);
  end loop;
end $$;

create policy alerts_select on public.alerts for select to authenticated using (public.is_member(tenant_id));
create policy alerts_mark_read on public.alerts for update to authenticated
  using (public.is_member(tenant_id)) with check (public.is_member(tenant_id));

-- Lectura y escritura completas para miembros en tablas operativas.
do $$
declare t text;
begin
  foreach t in array array['contacts', 'consents', 'conversations', 'messages', 'tags', 'conversation_tags',
                           'notes', 'quick_replies', 'templates', 'campaigns', 'campaign_recipients'] loop
    execute format(
      'create policy %1$s_member on public.%1$s for all to authenticated
         using (public.is_member(tenant_id)) with check (public.is_member(tenant_id))', t);
  end loop;
end $$;

-- webhook_events: sin políticas → solo service_role (que salta RLS).

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public.webhook_events from authenticated;
grant usage, select on all sequences in schema public to authenticated;
