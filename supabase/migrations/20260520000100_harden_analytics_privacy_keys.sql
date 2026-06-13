-- FREED aggregate analytics privacy-key hardening.
-- Adds the normalized JSON-key guard to existing Supabase projects that
-- already applied the initial backend core migration.

create or replace function public.freed_jsonb_has_forbidden_normalized_keys(payload jsonb, forbidden_keys text[])
returns boolean
language plpgsql
immutable
as $function$
declare
  normalized_key text;
  child_value jsonb;
begin
  if payload is null then
    return false;
  end if;

  if jsonb_typeof(payload) = 'object' then
    for normalized_key, child_value in
      select regexp_replace(lower(entry.item_key), '[^a-z0-9]', '', 'g'), entry.item_value
      from jsonb_each(payload) as entry(item_key, item_value)
    loop
      if normalized_key = any(forbidden_keys) then
        return true;
      end if;
      if public.freed_jsonb_has_forbidden_normalized_keys(child_value, forbidden_keys) then
        return true;
      end if;
    end loop;
  elsif jsonb_typeof(payload) = 'array' then
    for child_value in
      select entry.item_value from jsonb_array_elements(payload) as entry(item_value)
    loop
      if public.freed_jsonb_has_forbidden_normalized_keys(child_value, forbidden_keys) then
        return true;
      end if;
    end loop;
  end if;

  return false;
end;
$function$;

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'recovery_analytics_events_no_raw_payload_keys'
      and conrelid = 'public.recovery_analytics_events'::regclass
  ) then
    alter table public.recovery_analytics_events
      add constraint recovery_analytics_events_no_raw_payload_keys check (
        not public.freed_jsonb_has_forbidden_normalized_keys(snapshot, array[
          'attempts',
          'attempthistory',
          'relapserecords',
          'dailycheckins',
          'dailyhabits',
          'reflection',
          'reflections',
          'privatereflection',
          'note',
          'notes',
          'privatenotes',
          'privatejournal',
          'contact',
          'contacts',
          'supportcircle',
          'supportcontacts',
          'accountability',
          'accountabilitycontacts',
          'messagetemplate',
          'phone',
          'phonenumber',
          'email',
          'emailaddress',
          'useremail',
          'url',
          'urls',
          'rawurl',
          'rawhost',
          'host',
          'hostname',
          'hosts',
          'domain',
          'domains',
          'browsinghistory',
          'browserhistory',
          'visitedurl',
          'conversationtranscript',
          'transcript',
          'transcripts',
          'token',
          'accesstoken',
          'refreshtoken',
          'idtoken',
          'authtoken',
          'jwt',
          'apikey',
          'secret',
          'servicerolekey',
          'purchasetoken',
          'rawpurchasetoken',
          'googlepurchasetoken',
          'receipt',
          'receipts',
          'receiptdata',
          'rawreceipt',
          'iosreceipt',
          'appstorereceipt',
          'transactionreceipt'
        ])
      );
  end if;
end;
$migration$;
