-- Supabase's "automatic RLS" project option adds public.rls_auto_enable(), a
-- SECURITY DEFINER function used by an event trigger. Nothing should call it
-- over the Data API, so remove execute from the API roles.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
