create index if not exists listings_active_sort_property_idx
  on public.listings (sort_order, property_id)
  where is_active;

create index if not exists listing_facilities_listing_id_idx
  on public.listing_facilities (listing_id);
