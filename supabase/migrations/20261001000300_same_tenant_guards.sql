-- La RLS valida el tenant_id de la fila, pero no que sus llaves foráneas apunten al mismo tenant.
-- Estos triggers impiden enlazar filas de otro cliente (p. ej. una nota en una conversación ajena).

create function public.assert_same_tenant(p_table regclass, p_id uuid, p_tenant uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
begin
  if p_id is null then return; end if;
  execute format('select tenant_id from %s where id = $1', p_table) into v_tenant using p_id;
  if v_tenant is distinct from p_tenant then
    raise exception 'Referencia a % de otro cliente', p_table using errcode = 'insufficient_privilege';
  end if;
end
$$;

create function public.guard_same_tenant() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  pair text;
  col text;
  tbl text;
  v_id uuid;
begin
  -- TG_ARGV: pares "columna:tabla"
  foreach pair in array TG_ARGV loop
    col := split_part(pair, ':', 1);
    tbl := split_part(pair, ':', 2);
    execute format('select ($1).%I', col) into v_id using new;
    perform public.assert_same_tenant(tbl::regclass, v_id, new.tenant_id);
  end loop;
  return new;
end
$$;

create trigger guard_conversations before insert or update on public.conversations
  for each row execute function public.guard_same_tenant('phone_id:public.phone_numbers', 'contact_id:public.contacts');
create trigger guard_messages before insert or update on public.messages
  for each row execute function public.guard_same_tenant('phone_id:public.phone_numbers', 'conversation_id:public.conversations', 'contact_id:public.contacts');
create trigger guard_consents before insert or update on public.consents
  for each row execute function public.guard_same_tenant('contact_id:public.contacts');
create trigger guard_conversation_tags before insert or update on public.conversation_tags
  for each row execute function public.guard_same_tenant('conversation_id:public.conversations', 'tag_id:public.tags');
create trigger guard_notes before insert or update on public.notes
  for each row execute function public.guard_same_tenant('conversation_id:public.conversations');
create trigger guard_campaigns before insert or update on public.campaigns
  for each row execute function public.guard_same_tenant('phone_id:public.phone_numbers', 'template_id:public.templates');
create trigger guard_campaign_recipients before insert or update on public.campaign_recipients
  for each row execute function public.guard_same_tenant('campaign_id:public.campaigns', 'contact_id:public.contacts');
create trigger guard_template_predictions before insert or update on public.template_predictions
  for each row execute function public.guard_same_tenant('template_id:public.templates');
create trigger guard_health_snapshots before insert or update on public.health_snapshots
  for each row execute function public.guard_same_tenant('phone_id:public.phone_numbers');
create trigger guard_alerts before insert or update on public.alerts
  for each row execute function public.guard_same_tenant('phone_id:public.phone_numbers');

-- Asignar solo a miembros del mismo tenant.
create function public.guard_assignee() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.assigned_to is not null and not exists (
    select 1 from public.memberships where tenant_id = new.tenant_id and user_id = new.assigned_to
  ) then
    raise exception 'Solo puedes asignar a alguien de tu equipo' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;
create trigger guard_conversation_assignee before insert or update of assigned_to on public.conversations
  for each row execute function public.guard_assignee();

revoke all on function public.assert_same_tenant from public, anon, authenticated;
