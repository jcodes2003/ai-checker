create table if not exists public.reflection_prompts (
  id bigserial primary key,
  question text not null,
  rubric text,
  created_at timestamptz not null default now()
);

create table if not exists public.reflection_submissions (
  id bigserial primary key,
  prompt_id bigint references public.reflection_prompts(id) on delete set null,
  student_id_number text not null,
  student_section text not null,
  student_name text not null,
  question text not null,
  rubric text,
  student_answer text not null,
  evaluation jsonb not null,
  score integer,
  band text,
  created_at timestamptz not null default now()
);

create index if not exists reflection_prompts_created_at_idx
  on public.reflection_prompts (created_at desc);

create index if not exists reflection_submissions_created_at_idx
  on public.reflection_submissions (created_at desc);

create index if not exists reflection_submissions_student_name_idx
  on public.reflection_submissions (student_name);

create index if not exists reflection_submissions_student_id_number_idx
  on public.reflection_submissions (student_id_number);

create index if not exists reflection_submissions_student_section_idx
  on public.reflection_submissions (student_section);

create index if not exists reflection_submissions_prompt_id_idx
  on public.reflection_submissions (prompt_id);

create unique index if not exists reflection_submissions_prompt_student_id_unique
  on public.reflection_submissions (prompt_id, student_id_number);

alter table public.reflection_prompts enable row level security;
alter table public.reflection_submissions enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert on public.reflection_prompts to anon, authenticated;
grant select, insert on public.reflection_submissions to anon, authenticated;
grant usage, select, update on all sequences in schema public to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reflection_prompts'
      and policyname = 'Allow classroom read prompts'
  ) then
    create policy "Allow classroom read prompts"
      on public.reflection_prompts
      for select
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reflection_prompts'
      and policyname = 'Allow classroom insert prompts'
  ) then
    create policy "Allow classroom insert prompts"
      on public.reflection_prompts
      for insert
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reflection_submissions'
      and policyname = 'Allow classroom read submissions'
  ) then
    create policy "Allow classroom read submissions"
      on public.reflection_submissions
      for select
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reflection_submissions'
      and policyname = 'Allow classroom insert submissions'
  ) then
    create policy "Allow classroom insert submissions"
      on public.reflection_submissions
      for insert
      with check (true);
  end if;
end $$;
