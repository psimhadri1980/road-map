-- 012-T001: the service may add a roadmap (with its version 1). It still cannot change or remove one
-- except through the existing column grants; roadmap_version already allows INSERT (V8).
GRANT INSERT ON roadmap TO roadmap_app;
