-- Índice complementar da V52
create index if not exists idx_stage_finish_plans_updated_by
  on public.stage_finish_plans(updated_by);
