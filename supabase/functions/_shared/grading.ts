// 채점 엔진. 외부 의존성 없이 순수 문자열 연산만 사용한다(Deno/Node 양쪽에서 동작).
//
// 설계 요지
// - 성경문제(bible)는 "책·장·절"이라는 구조화된 데이터이므로 유사도가 아니라 파싱으로 채점한다.
//   덕분에 저장 형식이 구형("히브리서;11;1")이든 신형("히브리서 11:1")이든 동일하게 처리된다.
// - 단답형(short)만 문자 유사도를 쓰되, 짧은 정답일수록 기준을 높여 오탐(거짓 정답)을 막는다.
// - 모든 채점 결과는 0~1 사이 점수로 나오고 임계값으로 정답/부분정답/오답을 가른다.

export const CORRECT_THRESHOLD = 0.8
// 인정 키워드 2개 중 1개(=0.5)를 맞힌 경우까지 부분점수로 인정하기 위한 값이다.
export const PARTIAL_THRESHOLD = 0.5

export type Verdict = 'correct' | 'partial' | 'wrong'

export interface GradeResult {
  score: number
  isCorrect: boolean
  verdict: Verdict
}

/* ------------------------------------------------------------------ */
/* 정규화                                                              */
/* ------------------------------------------------------------------ */

// 채점 대상에서 제거할 문장부호. 한글 문장부호와 따옴표류를 포함한다.
const PUNCTUATION = /[.,!?"'`~^*_\-–—()[\]{}<>「」『』《》〈〉·・:;/\\|+=]/g

/** NFKC 정규화 + 소문자화 + 문장부호 제거 + 공백 단일화. */
export function normalizeText(raw: string): string {
  return raw
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(PUNCTUATION, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 띄어쓰기 편차를 없앤 비교용 문자열. 한국어는 띄어쓰기 변동이 커서 별도로 비교한다. */
export function stripSpaces(value: string): string {
  return value.replace(/\s+/g, '')
}

// 어절 끝에서 떼어낼 조사·어미. 긴 것부터 시도해야 "에서"가 "에"로 잘리지 않는다.
const PARTICLES = [
  '이라고', '라고', '이에요', '예요', '입니다', '이었다', '였습니다', '였다', '이다',
  '에서', '에게', '으로', '까지', '부터', '보다', '처럼', '같이', '이며', '하고',
  '은', '는', '이', '가', '을', '를', '의', '에', '와', '과', '도', '만', '로', '며', '고', '요', '임', '다',
]

/**
 * 어절 끝의 조사·어미를 제거한다.
 * 과도한 제거를 막기 위해 2글자 이상 남을 때만 자르고, 어절당 최대 2회까지만 반복한다.
 * (형태소 분석기 없이 규칙만으로 "믿음이다" → "믿음" 수준을 노린다.)
 */
export function stripParticles(value: string): string {
  return value
    .split(' ')
    .map((word) => {
      let token = word
      for (let pass = 0; pass < 2; pass++) {
        const hit = PARTICLES.find((p) => token.length - p.length >= 2 && token.endsWith(p))
        if (!hit) break
        token = token.slice(0, -hit.length)
      }
      return token
    })
    .join(' ')
}

/* ------------------------------------------------------------------ */
/* 문자열 유사도                                                        */
/* ------------------------------------------------------------------ */

function bigrams(value: string): string[] {
  const grams: string[] = []
  for (let i = 0; i < value.length - 1; i++) grams.push(value.slice(i, i + 2))
  return grams
}

/** Dice 계수(문자 bigram 기준). 어순이 바뀌어도 비교적 안정적이라 한국어에 잘 맞는다. */
export function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  const left = bigrams(a)
  const right = bigrams(b)
  const pool = new Map<string, number>()
  for (const gram of left) pool.set(gram, (pool.get(gram) ?? 0) + 1)
  let hits = 0
  for (const gram of right) {
    const remaining = pool.get(gram) ?? 0
    if (remaining > 0) {
      hits++
      pool.set(gram, remaining - 1)
    }
  }
  return (2 * hits) / (left.length + right.length)
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1)
    cur[0] = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = cur
  }
  return prev[b.length]
}

/** 편집거리를 0~1로 정규화. 오타 한두 글자에 강하다. */
export function levenshteinRatio(a: string, b: string): number {
  const longest = Math.max(a.length, b.length)
  if (!longest) return 0
  return 1 - levenshtein(a, b) / longest
}

/* ------------------------------------------------------------------ */
/* 성경 66권 별칭                                                       */
/* ------------------------------------------------------------------ */

// 개신교 66권. CBCK(사랑침례교회)는 독립침례교회이므로 개역/한글킹제임스 계열 표기를 기준으로 하고,
// 표준 약칭·구철자·영문명(KJV 약어 포함)을 별칭으로 함께 받는다.
const BOOK_TABLE: ReadonlyArray<readonly [string, ...string[]]> = [
  ['창세기', '창', 'genesis', 'gen', 'ge'],
  ['출애굽기', '출', '출애급기', '탈출기', 'exodus', 'exod', 'ex'],
  ['레위기', '레', 'leviticus', 'lev'],
  ['민수기', '민', 'numbers', 'num'],
  ['신명기', '신', 'deuteronomy', 'deut', 'dt'],
  ['여호수아', '수', '여호수아기', 'joshua', 'josh'],
  ['사사기', '삿', 'judges', 'judg'],
  ['룻기', '룻', 'ruth', 'ru'],
  ['사무엘상', '삼상', '사무엘기상', '1사무엘', 'first samuel', '1 samuel', '1samuel', '1sam', '1sa'],
  ['사무엘하', '삼하', '사무엘기하', '2사무엘', 'second samuel', '2 samuel', '2samuel', '2sam', '2sa'],
  ['열왕기상', '왕상', '1열왕기', 'first kings', '1 kings', '1kings', '1kgs', '1ki'],
  ['열왕기하', '왕하', '2열왕기', 'second kings', '2 kings', '2kings', '2kgs', '2ki'],
  ['역대상', '대상', '역대기상', 'first chronicles', '1 chronicles', '1chronicles', '1chr', '1ch'],
  ['역대하', '대하', '역대기하', 'second chronicles', '2 chronicles', '2chronicles', '2chr', '2ch'],
  ['에스라', '스', 'ezra', 'ezr'],
  ['느헤미야', '느', 'nehemiah', 'neh'],
  ['에스더', '에', 'esther', 'esth'],
  ['욥기', '욥', 'job'],
  ['시편', '시', '시', 'psalms', 'psalm', 'ps'],
  ['잠언', '잠', 'proverbs', 'prov', 'pr'],
  ['전도서', '전', 'ecclesiastes', 'eccl', 'ec'],
  ['아가', '아', '아가서', 'song of solomon', 'song of songs', 'song', 'sos'],
  ['이사야', '사', 'isaiah', 'isa'],
  ['예레미야', '렘', 'jeremiah', 'jer'],
  ['예레미야애가', '애', '애가', 'lamentations', 'lam'],
  ['에스겔', '겔', '에제키엘', 'ezekiel', 'ezek'],
  ['다니엘', '단', 'daniel', 'dan'],
  ['호세아', '호', 'hosea', 'hos'],
  ['요엘', '욜', 'joel'],
  ['아모스', '암', 'amos'],
  ['오바댜', '옵', 'obadiah', 'obad'],
  ['요나', '욘', 'jonah', 'jon'],
  ['미가', '미', 'micah', 'mic'],
  ['나훔', '나', 'nahum', 'nah'],
  ['하박국', '합', 'habakkuk', 'hab'],
  ['스바냐', '습', 'zephaniah', 'zeph'],
  ['학개', '학', 'haggai', 'hag'],
  ['스가랴', '슥', 'zechariah', 'zech'],
  ['말라기', '말', 'malachi', 'mal'],
  ['마태복음', '마', '마태', 'matthew', 'matt', 'mt'],
  ['마가복음', '막', '마가', 'mark', 'mk'],
  ['누가복음', '눅', '누가', 'luke', 'lk'],
  ['요한복음', '요', '요한', 'john', 'jn'],
  ['사도행전', '행', '행전', 'acts', 'ac'],
  ['로마서', '롬', '로마', 'romans', 'rom'],
  ['고린도전서', '고전', '1고린도', 'first corinthians', '1 corinthians', '1corinthians', '1cor', '1co'],
  ['고린도후서', '고후', '2고린도', 'second corinthians', '2 corinthians', '2corinthians', '2cor', '2co'],
  ['갈라디아서', '갈', '갈라디아', 'galatians', 'gal'],
  ['에베소서', '엡', '에베소', 'ephesians', 'eph'],
  ['빌립보서', '빌', '빌립보', 'philippians', 'phil', 'php'],
  ['골로새서', '골', '골로새', 'colossians', 'col'],
  ['데살로니가전서', '살전', '1데살로니가', 'first thessalonians', '1 thessalonians', '1thessalonians', '1thess', '1th'],
  ['데살로니가후서', '살후', '2데살로니가', 'second thessalonians', '2 thessalonians', '2thessalonians', '2thess', '2th'],
  ['디모데전서', '딤전', '1디모데', 'first timothy', '1 timothy', '1timothy', '1tim', '1ti'],
  ['디모데후서', '딤후', '2디모데', 'second timothy', '2 timothy', '2timothy', '2tim', '2ti'],
  ['디도서', '딛', '디도', 'titus', 'tit'],
  ['빌레몬서', '몬', '빌레몬', 'philemon', 'phlm', 'phm'],
  ['히브리서', '히', '히브리', 'hebrews', 'heb'],
  ['야고보서', '약', '야고보', 'james', 'jas'],
  ['베드로전서', '벧전', '1베드로', 'first peter', '1 peter', '1peter', '1pet', '1pe'],
  ['베드로후서', '벧후', '2베드로', 'second peter', '2 peter', '2peter', '2pet', '2pe'],
  ['요한일서', '요일', '1요한', 'first john', '1 john', '1john', '1jn', '1jo'],
  ['요한이서', '요이', '2요한', 'second john', '2 john', '2john', '2jn', '2jo'],
  ['요한삼서', '요삼', '3요한', 'third john', '3 john', '3john', '3jn', '3jo'],
  ['유다서', '유', '유다', 'jude', 'jud'],
  ['요한계시록', '계', '계시록', '요한묵시록', '묵시록', 'revelation', 'revelations', 'rev', 're'],
]

/** 별칭 비교용 키. 공백·마침표를 없애 "1 Cor." 같은 표기를 흡수한다. */
function bookKey(raw: string): string {
  return raw.normalize('NFKC').toLocaleLowerCase().replace(/[\s.]/g, '')
}

const BOOK_LOOKUP: Map<string, string> = (() => {
  const lookup = new Map<string, string>()
  for (const entry of BOOK_TABLE) {
    const canonical = entry[0]
    for (const alias of entry) {
      const key = bookKey(alias)
      if (key && !lookup.has(key)) lookup.set(key, canonical)
    }
  }
  return lookup
})()

/** 책 이름을 정경 이름으로 변환. 별칭에 없으면 3글자 이상일 때만 유사도로 보정한다. */
export function normalizeBookName(raw: string): string | null {
  const key = bookKey(raw)
  if (!key) return null
  const direct = BOOK_LOOKUP.get(key)
  if (direct) return direct
  if (key.length < 3) return null
  let best: string | null = null
  let bestScore = 0
  for (const [alias, canonical] of BOOK_LOOKUP) {
    if (alias.length < 3) continue
    const score = diceCoefficient(key, alias)
    if (score > bestScore) {
      bestScore = score
      best = canonical
    }
  }
  return bestScore >= 0.7 ? best : null
}

/* ------------------------------------------------------------------ */
/* 성경 구절 파싱                                                       */
/* ------------------------------------------------------------------ */

export interface BibleRef {
  book: string
  chapter: number
  verse: number | null
  endVerse: number | null
}

/**
 * 다양한 표기의 성경 구절을 {책, 장, 절}로 파싱한다.
 * 지원: "히브리서;11;1" · "히브리서 11:1" · "히브리서 11장 1절" · "히 11:1" · "Heb 11:1" · "히브리서 11:1-3"
 */
export function parseBibleRef(raw: string): BibleRef | null {
  if (!raw) return null
  let text = raw.normalize('NFKC').replace(/\s+/g, ' ').trim()
  if (!text) return null
  text = text.replace(/제\s*(\d+)\s*([장절])/g, '$1$2')

  const build = (book: string, chapter: string, verse?: string | null, endVerse?: string | null): BibleRef | null => {
    const canonical = normalizeBookName(book)
    if (!canonical) return null
    return {
      book: canonical,
      chapter: Number(chapter),
      verse: verse != null && verse !== '' ? Number(verse) : null,
      endVerse: endVerse != null && endVerse !== '' ? Number(endVerse) : null,
    }
  }

  // 구 형식: "히브리서;11;1"
  const legacy = text.match(/^(.+?)\s*;\s*(\d+)\s*;\s*(\d+)(?:\s*[-~–—]\s*(\d+))?$/)
  if (legacy) return build(legacy[1], legacy[2], legacy[3], legacy[4])

  // 일반 형식: "책 11:1", "책 11장 1절", "책 11,1"
  const full = text.match(/^(.*?)\s*(\d+)\s*(?:장|[:：.,])\s*(\d+)\s*절?(?:\s*[-~–—]\s*(\d+)\s*절?)?$/)
  if (full) return build(full[1], full[2], full[3], full[4])

  // 장만 있는 형식: "책 11", "책 11장"
  const chapterOnly = text.match(/^(.*?)\s*(\d+)\s*장?$/)
  if (chapterOnly) return build(chapterOnly[1], chapterOnly[2], null, null)

  return null
}

function verseMatches(user: BibleRef, expected: BibleRef): boolean {
  if (expected.verse == null) return true
  if (user.verse == null) return false
  const expectedStart = expected.verse
  const expectedEnd = expected.endVerse ?? expected.verse
  const userStart = user.verse
  const userEnd = user.endVerse ?? user.verse
  // 정확히 같은 범위이거나, 출제자가 범위로 냈고 학습자 답이 그 안에 들어오면 인정한다.
  return userStart >= expectedStart && userEnd <= expectedEnd
}

/**
 * 성경문제 채점. 책 0.4 / 장 0.3 / 절 0.3 배점으로 부분점수를 준다.
 * 셋 다 맞으면 1.0, 책+장만 맞으면 0.7(부분정답), 책만 맞으면 0.4(오답)이다.
 */
export function gradeBible(userAnswer: string, expectedAnswer: string): number {
  const expected = parseBibleRef(expectedAnswer)
  // 출제 정답 자체가 구절 형식이 아니면 일반 텍스트로 채점한다.
  if (!expected) return gradeShort(userAnswer, expectedAnswer, '')
  const user = parseBibleRef(userAnswer)
  if (!user) return 0

  const bookOk = user.book === expected.book
  const chapterOk = user.chapter === expected.chapter
  const verseOk = verseMatches(user, expected)
  if (bookOk && chapterOk && verseOk) return 1

  let score = 0
  if (bookOk) score += 0.4
  if (chapterOk) score += 0.3
  if (verseOk && expected.verse != null) score += 0.3
  return Math.min(score, 0.79) // 부분점수가 정답 임계값을 넘지 않도록 잠근다.
}

/* ------------------------------------------------------------------ */
/* 단답형 채점                                                          */
/* ------------------------------------------------------------------ */

function parseKeywords(raw: string): string[] {
  return String(raw ?? '')
    .split(/[;,]/)
    .map((value) => normalizeText(value))
    .filter(Boolean)
}

/**
 * 단답형 채점. 아래를 모두 계산해 가장 높은 점수를 채택한다.
 *  1) 정규화 완전일치 / 띄어쓰기 무시 일치 → 1.0
 *  2) 조사·어미 제거 후 일치 → 0.95
 *  3) 인정 키워드 포함률 (기존의 "전부 포함" 방식을 비율로 완화)
 *  4) 문자 유사도(Dice bigram, 편집거리)
 * 짧은 정답일수록 유사도 기준을 높여 오탐을 막는다.
 */
export function gradeShort(userAnswer: string, expectedAnswer: string, keywords: string): number {
  const user = normalizeText(userAnswer)
  const expected = normalizeText(expectedAnswer)
  if (!user || !expected) return 0

  if (user === expected) return 1

  const userTight = stripSpaces(user)
  const expectedTight = stripSpaces(expected)
  if (userTight === expectedTight) return 1

  // 숫자만으로 된 정답은 유사도를 적용하지 않는다(1과 11이 비슷하게 잡히는 것을 막는다).
  if (/^\d+$/.test(expectedTight)) return userTight === expectedTight ? 1 : 0

  if (stripSpaces(stripParticles(user)) === stripSpaces(stripParticles(expected))) return 0.95

  const keywordList = parseKeywords(keywords)
  let coverage = 0
  if (keywordList.length > 0) {
    const matched = keywordList.filter((keyword) => userTight.includes(stripSpaces(keyword))).length
    coverage = matched / keywordList.length
  }

  let similarity = Math.max(
    diceCoefficient(userTight, expectedTight),
    levenshteinRatio(userTight, expectedTight),
  )

  // 길이 적응형 보정: 정답이 짧으면 한 글자 차이의 비중이 과도하게 커진다.
  const length = expectedTight.length
  if (length <= 2) similarity = 0
  else if (length <= 4) similarity = similarity >= 0.85 ? similarity : similarity * 0.6

  return Math.min(1, Math.max(coverage, similarity))
}

/* ------------------------------------------------------------------ */
/* 진입점                                                              */
/* ------------------------------------------------------------------ */

export function toVerdict(score: number): Verdict {
  if (score >= CORRECT_THRESHOLD) return 'correct'
  if (score >= PARTIAL_THRESHOLD) return 'partial'
  return 'wrong'
}

/** 문제 유형에 맞는 채점기를 골라 0~1 점수와 판정을 돌려준다. */
export function gradeAnswer(
  type: string,
  userAnswer: string,
  expectedAnswer: string,
  keywords: string | null | undefined,
): GradeResult {
  let score: number
  if (type === 'mcq') {
    // 객관식은 보기 번호를 버튼으로 고르므로 완전일치가 정확하다.
    score = normalizeText(userAnswer) === normalizeText(expectedAnswer) ? 1 : 0
  } else if (type === 'bible') {
    score = gradeBible(userAnswer, expectedAnswer)
  } else {
    score = gradeShort(userAnswer, expectedAnswer, keywords ?? '')
  }
  const rounded = Math.round(Math.min(1, Math.max(0, score)) * 1000) / 1000
  const verdict = toVerdict(rounded)
  return { score: rounded, isCorrect: verdict === 'correct', verdict }
}
