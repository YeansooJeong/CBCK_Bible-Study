-- session_answers.problem_id에 on delete cascade가 빠져 있어서, 퀴즈로 한 번이라도
-- 풀린 문제는 삭제 시 외래키 제약 위반으로 조용히 실패하던 버그 수정.
-- (다른 problem_id 참조 테이블: problem_comments, problem_bookmarks, problem_shares는
-- 이미 on delete cascade로 생성되어 있었음)
alter table session_answers drop constraint if exists session_answers_problem_id_fkey;
alter table session_answers
  add constraint session_answers_problem_id_fkey
  foreign key (problem_id) references problems(id) on delete cascade;
