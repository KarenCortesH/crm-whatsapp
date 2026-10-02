-- Tiempo real para la bandeja (Supabase Realtime respeta RLS en postgres_changes).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.conversations, public.notes;
  end if;
end $$;
