create table if not exists problem_comments (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references problems(id) on delete cascade,
  author_id uuid not null references users(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 2000),
  parent_comment_id uuid references problem_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists problem_comments_problem_idx on problem_comments(problem_id, created_at);
alter table problem_comments enable row level security;
