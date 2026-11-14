-- 005-T003 (FR-013, research R5): approval is the only thing that writes a roadmap, and it writes
-- only these two columns. Column-level, so name, slug and team stay unwritable by the service.
GRANT UPDATE (document, version) ON roadmap TO roadmap_app;
