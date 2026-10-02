-- Aserciones de aislamiento multi-tenant y de la barrera de consentimiento.
-- Termina con error (exit != 0) si alguna falla.
\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@a.co'),
  ('00000000-0000-0000-0000-00000000000b', 'b@b.co');

insert into public.tenants (id, name) values
  ('10000000-0000-0000-0000-00000000000a', 'Tienda A'),
  ('10000000-0000-0000-0000-00000000000b', 'Tienda B');

insert into public.memberships (tenant_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'owner');

insert into public.phone_numbers (id, tenant_id, phone_number_id) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'pn-a'),
  ('20000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 'pn-b');

insert into public.contacts (id, tenant_id, wa_id, name) values
  ('30000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', '573000000001', 'Con opt-in'),
  ('30000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', '573000000002', 'Sin opt-in'),
  ('30000000-0000-0000-0000-0000000000a3', '10000000-0000-0000-0000-00000000000a', '573000000003', 'Dado de baja'),
  ('30000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b', '573000000009', 'Cliente de B');

insert into public.consents (tenant_id, contact_id, purpose, method, source_detail, granted_at) values
  ('10000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-0000000000a1', 'marketing', 'formulario_web', 'landing', now() - interval '1 day'),
  ('10000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-0000000000a3', 'marketing', 'formulario_web', 'landing', now() - interval '1 day');
update public.contacts set marketing_opted_out = true where id = '30000000-0000-0000-0000-0000000000a3';

insert into public.templates (id, tenant_id, name, body, requested_category) values
  ('40000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 'promo', 'Hola {{1}}', 'MARKETING');
insert into public.campaigns (id, tenant_id, phone_id, template_id, name) values
  ('50000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a',
   '20000000-0000-0000-0000-00000000000a', '40000000-0000-0000-0000-00000000000a', 'Octubre');

insert into public.webhook_events (source, idempotency_key, payload) values ('kapso', 'k1', '{}');

-- ── Como usuario A ──
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

do $$
begin
  if (select count(*) from public.contacts) <> 3 then raise exception 'A debería ver 3 contactos'; end if;
  if (select count(*) from public.tenants) <> 1 then raise exception 'A debería ver solo su tenant'; end if;
  if exists (select 1 from public.contacts where wa_id = '573000000009') then raise exception 'A ve contactos de B'; end if;
  if (select count(*) from public.phone_numbers) <> 1 then raise exception 'A debería ver 1 número'; end if;
  raise notice 'OK: A solo ve sus datos';
end $$;

do $$
begin
  begin
    insert into public.contacts (tenant_id, wa_id) values ('10000000-0000-0000-0000-00000000000b', '57399');
    raise exception 'FALLO: A pudo insertar en el tenant de B';
  exception when insufficient_privilege then
    raise notice 'OK: A no puede escribir en B';
  end;
end $$;

do $$
begin
  begin
    perform count(*) from public.webhook_events;
    raise exception 'FALLO: un usuario pudo leer webhook_events';
  exception when insufficient_privilege then
    raise notice 'OK: webhook_events cerrado a usuarios';
  end;
end $$;

do $$
declare n int;
begin
  update public.contacts set name = 'hack' where wa_id = '573000000009';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALLO: A modificó un contacto de B'; end if;
  raise notice 'OK: A no modifica datos de B';
end $$;

-- Barrera de consentimiento en campañas de marketing
insert into public.campaign_recipients (tenant_id, campaign_id, contact_id)
values ('10000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-0000000000a1');

do $$
begin
  begin
    insert into public.campaign_recipients (tenant_id, campaign_id, contact_id)
    values ('10000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-0000000000a2');
    raise exception 'FALLO: entró un contacto sin opt-in';
  exception when check_violation then
    raise notice 'OK: contacto sin opt-in bloqueado';
  end;
  begin
    insert into public.campaign_recipients (tenant_id, campaign_id, contact_id)
    values ('10000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-0000000000a3');
    raise exception 'FALLO: entró un contacto dado de baja';
  exception when check_violation then
    raise notice 'OK: contacto dado de baja bloqueado';
  end;
  insert into public.campaign_recipients (tenant_id, campaign_id, contact_id, status)
  values ('10000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-0000000000a2', 'omitido');
  raise notice 'OK: se puede registrar como omitido';
end $$;

-- Llaves foráneas cruzadas: A no puede enlazar su fila a datos de B.
do $$
begin
  begin
    insert into public.consents (tenant_id, contact_id, purpose, method, source_detail, granted_at)
    values ('10000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-0000000000b1', 'marketing', 'otro', 'x', now());
    raise exception 'FALLO: A creó un permiso sobre un contacto de B';
  exception when insufficient_privilege then
    raise notice 'OK: no se pueden cruzar llaves foráneas entre clientes';
  end;
end $$;

-- ── Como usuario B ──
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$
begin
  if (select count(*) from public.contacts) <> 1 then raise exception 'B debería ver 1 contacto'; end if;
  if (select count(*) from public.campaigns) <> 0 then raise exception 'B ve campañas de A'; end if;
  raise notice 'OK: B solo ve sus datos';
end $$;

-- ── Sin sesión ──
select set_config('request.jwt.claim.sub', '', false);
do $$
begin
  if (select count(*) from public.contacts) <> 0 then raise exception 'Sin sesión no debería ver nada'; end if;
  raise notice 'OK: sin sesión no ve nada';
end $$;

reset role;

-- ── Funciones de ingesta (como servidor) ──
do $$
declare n int;
begin
  perform public.ingest_message('pn-a', 'wamid.x1', 'inbound', 'received', '573111', 'Luis', 'text', 'Hola', now(), null, null, 'conv_k1');
  perform public.ingest_message('pn-a', 'wamid.x1', 'inbound', 'received', '573111', 'Luis', 'text', 'Hola', now(), null, null, 'conv_k1');
  perform public.ingest_message('pn-a', 'wamid.x2', 'inbound', 'received', '573111', 'Luis', 'text', 'Otra', now(), null, null, 'conv_k1');
  select count(*) into n from public.messages where wamid in ('wamid.x1', 'wamid.x2');
  if n <> 2 then raise exception 'FALLO: ingesta duplicó mensajes (%)', n; end if;
  select unread_count into n from public.conversations c join public.contacts k on k.id = c.contact_id where k.wa_id = '573111';
  if n <> 2 then raise exception 'FALLO: unread_count = % (esperado 2)', n; end if;
  if (select last_inbound_at from public.phone_numbers where phone_number_id = 'pn-a') is null then
    raise exception 'FALLO: no se registró last_inbound_at';
  end if;
  raise notice 'OK: ingesta idempotente y contador de no leídos';

  perform public.ingest_message('pn-a', 'wamid.x3', 'outbound', 'failed', '573111', null, 'text', 'x', now(), 131047, 'Re-engagement', 'conv_k1');
  if (select error_code from public.messages where wamid = 'wamid.x3') <> 131047 then raise exception 'FALLO: error_code'; end if;
  raise notice 'OK: envío fallido registrado con código de Meta';

  perform public.apply_marketing_preference('pn-a', '573000000001', true, 10, now());
  perform public.apply_marketing_preference('pn-a', '573000000001', false, 5, now());
  if not (select marketing_opted_out from public.contacts where wa_id = '573000000001' and tenant_id = '10000000-0000-0000-0000-00000000000a') then
    raise exception 'FALLO: un evento viejo (sequence 5) revirtió la baja';
  end if;
  if (select status from public.campaign_recipients where contact_id = '30000000-0000-0000-0000-0000000000a1') <> 'omitido' then
    raise exception 'FALLO: la baja no sacó al contacto de la campaña pendiente';
  end if;
  raise notice 'OK: bajas de marketing respetan el orden y sacan de campañas';

  begin
    update public.conversations set assigned_to = '00000000-0000-0000-0000-00000000000b'
     where tenant_id = '10000000-0000-0000-0000-00000000000a';
    raise exception 'FALLO: se asignó una conversación a alguien de otro equipo';
  exception when insufficient_privilege then
    raise notice 'OK: solo se asigna a miembros del equipo';
  end;
end $$;

select 'TODAS LAS ASERCIONES DE RLS PASARON' as resultado;
