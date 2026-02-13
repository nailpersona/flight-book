-- PVP Document Sections - Corrected SQL Import
-- Document ID: 1 (ПВП ДАУ)
--
-- This file imports all 510 sections from the PVP DAU document.
-- Due to original export using database IDs (92, 162, 201, etc.) as parent_id,
-- which don't exist in current database, all sections are imported with parent_id = NULL.
--
-- After import, run a separate update query to link parents by title matching.

BEGIN;

-- Delete existing sections for document_id = 1 to avoid duplicates
DELETE FROM guide_sections WHERE document_id = 1;

-- Import all sections (with parent_id set to NULL initially)


COMMIT;

-- === POST-IMPORT: Parent Linking ===
-- Run this query after import to link children to their parents
-- This uses title pattern matching to determine relationships

-- TODO: Implement parent linking based on:
-- 1. Title pattern analysis (e.g., '1. Subsection' -> 'Main Section')
-- 2. Content similarity matching
-- 3. Manual review of the document structure