-- 27/09/2026 : théâtres, opéras, cinémas sortis de « museum » vers « show ».
-- Même règle que TYPES dans scripts/ingest-places.py (show avant museum).
update places set place_type='show' where place_type='museum' and array_to_string(categories,' ') ~ '(Theater|Performing Arts|Opera|Cinema)';
