// 성경문제 정답 표시용 포맷터. 저장 형식은 두 가지가 혼재한다:
// - 구 형식(세미콜론): "히브리서;11;1"
// - 신 형식(콜론): "히브리서 11:1"
// 채점은 저장된 원문 그대로 비교하므로 이 함수는 화면 표시에만 사용하고 저장값 자체는 바꾸지 않는다.
export function formatBibleAnswer(raw: string): string {
  const semicolon = raw.match(/^(.+);\s*(\d+)\s*;\s*(\d+)$/)
  if (semicolon) return `${semicolon[1].trim()} ${semicolon[2]}장 ${semicolon[3]}절`
  const colon = raw.match(/^(.+?)\s+(\d+)\s*:\s*(\d+)$/)
  if (colon) return `${colon[1].trim()} ${colon[2]}장 ${colon[3]}절`
  return raw
}
