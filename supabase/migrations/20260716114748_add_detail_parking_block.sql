update public.site_settings
set detail_layout = jsonb_set(
  detail_layout,
  '{rows}',
  (detail_layout -> 'rows') || jsonb_build_array(jsonb_build_object(
    'id', 'row_parking',
    'columns', 1,
    'enabled', true,
    'blocks', jsonb_build_array(jsonb_build_object(
      'type', 'parking',
      'title', 'ที่จอดรถ',
      'enabled', true,
      'hideWhenEmpty', true
    ))
  ))
)
where detail_layout ->> 'version' = '1'
  and jsonb_typeof(detail_layout -> 'rows') = 'array'
  and not jsonb_path_exists(detail_layout, '$.** ? (@.type == "parking")');

update public.site_settings
set detail_layout = jsonb_set(
  detail_layout,
  '{mainSplit,wideRows}',
  (detail_layout #> '{mainSplit,wideRows}') || jsonb_build_array(jsonb_build_object(
    'id', 'row_parking',
    'columns', 1,
    'enabled', true,
    'blocks', jsonb_build_array(jsonb_build_object(
      'type', 'parking',
      'title', 'ที่จอดรถ',
      'enabled', true,
      'hideWhenEmpty', true
    ))
  ))
)
where detail_layout ->> 'version' = '2'
  and jsonb_typeof(detail_layout #> '{mainSplit,wideRows}') = 'array'
  and not jsonb_path_exists(detail_layout, '$.** ? (@.type == "parking")');

notify pgrst, 'reload schema';
