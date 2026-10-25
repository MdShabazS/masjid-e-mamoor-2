-- Read-only QR Storage inventory for an operator with database access.
-- Review rows older than 24 hours. Never delete storage.objects through SQL.
-- A listed object may belong to an in-flight retry; investigate before using
-- the Storage API to remove it.
with inventory as (
  select
    o.name as asset_path,
    o.created_at as object_created_at,
    a.verified_at,
    exists (
      select 1 from public.payment_qr_versions q
      where q.asset_path = o.name
    ) as has_version
  from storage.objects o
  left join app_private.qr_assets a on a.asset_path = o.name
  where o.bucket_id = 'qr-private'
), candidates as (
  select
    case
      when verified_at is null then 'unregistered_object'
      else 'registered_without_version'
    end as finding,
    asset_path,
    object_created_at,
    verified_at,
    greatest(object_created_at, verified_at) as last_relevant_at
  from inventory
  where not has_version
  union all
  select
    'registered_missing_object' as finding,
    a.asset_path,
    null::timestamptz as object_created_at,
    a.verified_at,
    a.verified_at as last_relevant_at
  from app_private.qr_assets a
  where not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'qr-private' and o.name = a.asset_path
  )
)
select finding, asset_path, object_created_at, verified_at, last_relevant_at
from candidates
where last_relevant_at < now() - interval '24 hours'
order by last_relevant_at, finding, asset_path;
