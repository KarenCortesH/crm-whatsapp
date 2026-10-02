-- Funciones atómicas de ingesta, invocadas por el servidor (service_role) desde los webhooks.

create function public.ingest_message(
  p_phone_number_id text,
  p_wamid text,
  p_direction text,
  p_status text,
  p_contact_wa_id text,
  p_contact_name text,
  p_msg_type text,
  p_body text,
  p_sent_at timestamptz,
  p_error_code int,
  p_error_title text,
  p_kapso_conversation_id text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_phone public.phone_numbers;
  v_contact uuid;
  v_conv uuid;
  v_msg uuid;
  v_new boolean;
begin
  select * into v_phone from public.phone_numbers where phone_number_id = p_phone_number_id;
  if not found then
    raise exception 'Número % no registrado', p_phone_number_id using errcode = 'no_data_found';
  end if;

  update public.phone_numbers
     set last_webhook_at = now(),
         last_inbound_at = case when p_direction = 'inbound' then greatest(coalesce(last_inbound_at, p_sent_at), p_sent_at) else last_inbound_at end
   where id = v_phone.id;

  if p_contact_wa_id is null then
    return null;
  end if;

  insert into public.contacts (tenant_id, wa_id, name)
  values (v_phone.tenant_id, p_contact_wa_id, p_contact_name)
  on conflict (tenant_id, wa_id) do update set name = coalesce(public.contacts.name, excluded.name)
  returning id into v_contact;

  insert into public.conversations (tenant_id, phone_id, contact_id, kapso_conversation_id)
  values (v_phone.tenant_id, v_phone.id, v_contact, p_kapso_conversation_id)
  on conflict (phone_id, contact_id) do update
    set kapso_conversation_id = coalesce(public.conversations.kapso_conversation_id, excluded.kapso_conversation_id)
  returning id into v_conv;

  insert into public.messages (tenant_id, phone_id, conversation_id, contact_id, wamid, direction, msg_type, body, status,
                               error_code, error_title, sent_at)
  values (v_phone.tenant_id, v_phone.id, v_conv, v_contact, p_wamid, p_direction, p_msg_type, p_body, p_status,
          p_error_code, p_error_title, p_sent_at)
  on conflict (wamid) do update
    set status = excluded.status,
        error_code = coalesce(excluded.error_code, public.messages.error_code),
        error_title = coalesce(excluded.error_title, public.messages.error_title),
        body = coalesce(public.messages.body, excluded.body)
  returning id, (xmax = 0) into v_msg, v_new;

  if v_new then
    update public.conversations
       set last_message_at = greatest(coalesce(last_message_at, p_sent_at), p_sent_at),
           last_message_preview = left(coalesce(p_body, '[' || p_msg_type || ']'), 140),
           last_inbound_at = case when p_direction = 'inbound' then p_sent_at else last_inbound_at end,
           unread_count = case when p_direction = 'inbound' then unread_count + 1 else unread_count end,
           status = case when p_direction = 'inbound' and status = 'cerrada' then 'abierta' else status end
     where id = v_conv;
  end if;

  return v_msg;
end
$$;

-- Aplica un cambio de preferencia de marketing respetando el orden (sequence) de Kapso.
create function public.apply_marketing_preference(
  p_phone_number_id text,
  p_wa_id text,
  p_stopped boolean,
  p_sequence bigint,
  p_occurred_at timestamptz
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
  v_rows int;
begin
  select tenant_id into v_tenant from public.phone_numbers where phone_number_id = p_phone_number_id;
  if v_tenant is null then
    raise exception 'Número % no registrado', p_phone_number_id using errcode = 'no_data_found';
  end if;

  insert into public.contacts (tenant_id, wa_id, marketing_opted_out, marketing_pref_sequence, marketing_pref_changed_at)
  values (v_tenant, p_wa_id, p_stopped, p_sequence, p_occurred_at)
  on conflict (tenant_id, wa_id) do update
    set marketing_opted_out = excluded.marketing_opted_out,
        marketing_pref_sequence = excluded.marketing_pref_sequence,
        marketing_pref_changed_at = excluded.marketing_pref_changed_at
    where public.contacts.marketing_pref_sequence < excluded.marketing_pref_sequence;
  get diagnostics v_rows = row_count;

  if p_stopped then
    update public.campaign_recipients r
       set status = 'omitido', error = 'Baja de marketing'
      from public.contacts c
     where c.tenant_id = v_tenant and c.wa_id = p_wa_id and r.contact_id = c.id and r.status = 'pendiente';
  end if;

  return v_rows > 0;
end
$$;

revoke all on function public.ingest_message from public, authenticated, anon;
revoke all on function public.apply_marketing_preference from public, authenticated, anon;
grant execute on function public.ingest_message to service_role;
grant execute on function public.apply_marketing_preference to service_role;
