begin read only;

select 'exact_slug' collision_type, slug collision_value, array_agg(id order by id) retailer_ids
from public.retailers where nullif(btrim(slug),'') is not null group by slug having count(*) > 1
union all
select 'normalized_slug',replace(lower(btrim(slug)),'_','-'),array_agg(id order by id)
from public.retailers where nullif(btrim(slug),'') is not null
group by replace(lower(btrim(slug)),'_','-') having count(*) > 1
union all
select 'canonical_website_origin',lower(substring(btrim(website) from '^(https?://[^/?#]+)')),array_agg(id order by id)
from public.retailers where btrim(website) ~* '^https?://[^/?#]+'
group by lower(substring(btrim(website) from '^(https?://[^/?#]+)')) having count(*) > 1
union all
select 'normalized_name',lower(regexp_replace(btrim(name),'\s+',' ','g')),array_agg(id order by id)
from public.retailers where nullif(btrim(name),'') is not null
group by lower(regexp_replace(btrim(name),'\s+',' ','g')) having count(*) > 1
order by collision_type,collision_value;

rollback;
