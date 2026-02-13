-- PVP Document Sections - Parent Linking Script
-- Run this AFTER importing all sections
-- This updates parent_id based on title patterns

BEGIN;

-- Link children to parents by title matching
-- TODO: Customize these queries based on actual imported section IDs

-- Example: Link subsections to '2. Забезпечення польотів'
-- UPDATE guide_sections SET parent_id = (
--   SELECT id FROM guide_sections WHERE title = '2. Забезпечення польотів' AND document_id = 1 LIMIT 1
-- ) WHERE document_id = 1 AND title LIKE '1. %' AND title LIKE '%метеоролог%';

COMMIT;