import { gradeAnswer, parseBibleRef, CORRECT_THRESHOLD, PARTIAL_THRESHOLD } from './grading.ts'

let pass = 0
let fail = 0
const failures: string[] = []

function expect(label: string, type: string, user: string, answer: string, keywords: string, want: 'correct' | 'partial' | 'wrong') {
  const got = gradeAnswer(type, user, answer, keywords)
  if (got.verdict === want) {
    pass++
  } else {
    fail++
    failures.push(`✗ ${label}\n    입력="${user}" 정답="${answer}" → ${got.verdict} (${got.score}) / 기대=${want}`)
  }
}

console.log('=== 성경문제: 구 형식으로 저장된 정답 (기존 버그의 핵심) ===')
expect('구형식 저장 + 안내대로 입력', 'bible', '히브리서 11:1', '히브리서;11;1', '', 'correct')
expect('구형식 저장 + 구형식 입력', 'bible', '히브리서;11;1', '히브리서;11;1', '', 'correct')
expect('구형식 저장 + 장절 한글', 'bible', '히브리서 11장 1절', '히브리서;11;1', '', 'correct')

console.log('=== 성경문제: 표기 변형 흡수 ===')
expect('약칭', 'bible', '히 11:1', '히브리서 11:1', '', 'correct')
expect('장절 한글표기', 'bible', '히브리서 11장 1절', '히브리서 11:1', '', 'correct')
expect('공백 없음', 'bible', '히브리서11:1', '히브리서 11:1', '', 'correct')
expect('콜론 주변 공백', 'bible', '히브리서 11 : 1', '히브리서 11:1', '', 'correct')
expect('쉼표 구분', 'bible', '히브리서 11,1', '히브리서 11:1', '', 'correct')
expect('영문 약어', 'bible', 'Heb 11:1', '히브리서 11:1', '', 'correct')
expect('영문 full', 'bible', 'Hebrews 11:1', '히브리서 11:1', '', 'correct')
expect('제N장 N절', 'bible', '히브리서 제11장 1절', '히브리서 11:1', '', 'correct')
expect('요한일서 약칭', 'bible', '요일 3:16', '요한일서 3:16', '', 'correct')
expect('1 John 표기', 'bible', '1 John 3:16', '요한일서 3:16', '', 'correct')
expect('고린도전서 약칭', 'bible', '고전 13:4', '고린도전서 13:4', '', 'correct')
expect('계시록 별칭', 'bible', '계 21:4', '요한계시록 21:4', '', 'correct')
expect('오타 보정(히브리소)', 'bible', '히브리소 11:1', '히브리서 11:1', '', 'correct')

console.log('=== 성경문제: 부분점수 ===')
expect('책+장 맞고 절 틀림', 'bible', '히브리서 11:3', '히브리서 11:1', '', 'partial')
expect('책만 맞음', 'bible', '히브리서 9:3', '히브리서 11:1', '', 'wrong')
expect('완전 다른 책', 'bible', '창세기 1:1', '히브리서 11:1', '', 'wrong')
expect('구절 범위 안에 들어옴', 'bible', '히브리서 11:2', '히브리서 11:1-3', '', 'correct')
expect('구절 범위 밖', 'bible', '히브리서 11:9', '히브리서 11:1-3', '', 'partial')
expect('빈 답', 'bible', '', '히브리서 11:1', '', 'wrong')

console.log('=== 단답형: 띄어쓰기/문장부호/조사 ===')
expect('완전일치', 'short', '바라는 것들의 실상', '바라는 것들의 실상', '', 'correct')
expect('띄어쓰기 없음', 'short', '바라는것들의실상', '바라는 것들의 실상', '', 'correct')
expect('마침표', 'short', '바라는 것들의 실상.', '바라는 것들의 실상', '', 'correct')
expect('조사 붙음', 'short', '바라는 것들의 실상이다', '바라는 것들의 실상', '', 'correct')
expect('존댓말 어미', 'short', '바라는 것들의 실상입니다', '바라는 것들의 실상', '', 'correct')
expect('중복 공백', 'short', '바라는  것들의   실상', '바라는 것들의 실상', '', 'correct')
expect('따옴표 포함', 'short', '"바라는 것들의 실상"', '바라는 것들의 실상', '', 'correct')
expect('한 글자 오타', 'short', '바라는 것들의 실장', '바라는 것들의 실상', '', 'correct')

console.log('=== 단답형: 키워드 부분점수 ===')
expect('키워드 전부 포함', 'short', '믿음은 바라는 것들의 실상이요 보이지 않는 것들의 증거', '바라는 것들의 실상', '실상;증거', 'correct')
expect('키워드 절반만', 'short', '보이지 않는 것들의 증거', '바라는 것들의 실상', '실상;증거', 'partial')
expect('키워드 하나도 없음', 'short', '전혀 다른 내용', '바라는 것들의 실상', '실상;증거', 'wrong')

console.log('=== 단답형: 오탐 방지 ===')
expect('완전히 다른 답', 'short', '노아의 방주', '바라는 것들의 실상', '', 'wrong')
expect('짧은 정답 오타는 불인정', 'short', '밑음', '믿음', '', 'wrong')
expect('짧은 정답 정확일치', 'short', '믿음', '믿음', '', 'correct')
expect('짧은 정답+조사', 'short', '믿음은', '믿음', '', 'correct')
expect('숫자 정답 불일치', 'short', '11', '1', '', 'wrong')
expect('숫자 정답 일치', 'short', '12', '12', '', 'correct')
expect('빈 답', 'short', '', '믿음', '', 'wrong')

console.log('=== 객관식 ===')
expect('정답 번호', 'mcq', '2', '2', '', 'correct')
expect('오답 번호', 'mcq', '3', '2', '', 'wrong')

console.log('\n=== 파서 출력 확인 ===')
for (const raw of ['히브리서;11;1', '히브리서 11:1', '히 11장 1절', '1 John 3:16', '창세기 1']) {
  console.log(`  "${raw}" →`, JSON.stringify(parseBibleRef(raw)))
}

console.log(`\n임계값: 정답 >= ${CORRECT_THRESHOLD}, 부분정답 >= ${PARTIAL_THRESHOLD}`)
console.log(`\n결과: ${pass} passed, ${fail} failed`)
if (failures.length) {
  console.log('\n실패 목록:')
  for (const line of failures) console.log('  ' + line)
  process.exit(1)
}
