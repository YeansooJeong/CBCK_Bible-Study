create table if not exists problem_bookmarks (
  user_id uuid not null references users(id) on delete cascade,
  problem_id uuid not null references problems(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, problem_id)
);
alter table problem_bookmarks enable row level security;
