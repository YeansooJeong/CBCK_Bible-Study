import { useState } from 'react'

const sections: Array<{ title: string; body: string[] }> = [
  {
    title: '처음 오셨나요?',
    body: [
      '맨 처음 화면에서 휴대전화 번호를 "-" 없이 숫자만 넣고 "다음"을 눌러주세요.',
      '앞으로 쓰실 비밀번호를 8자 이상으로 정해주세요. 다음부터는 이 비밀번호로 들어오시면 됩니다.',
    ],
  },
  {
    title: '로그인은 어떻게 하나요?',
    body: [
      '휴대전화 번호를 넣고 "다음"을 누른 뒤, 비밀번호를 입력하면 됩니다.',
      '비밀번호가 기억나지 않으시면 신학원 카카오톡 단체방에 문의해 주세요.',
    ],
  },
  {
    title: '문제가 안 불러와지거나 오류가 날 때',
    body: [
      '"과목을 불러오지 못했습니다" 같은 문구가 보이면, 대부분 로그인이 만료되었거나 인터넷 연결이 잠시 불안정한 경우예요.',
      '로그인이 만료되면 자동으로 로그인 화면으로 이동합니다. 다시 로그인해 주세요. 한 번 로그인하면 30일 동안 유지됩니다.',
      '"네트워크 연결이 불안정합니다"가 보이면 연결을 확인한 뒤 "다시 시도"를 눌러주세요.',
      '그래도 계속 같은 화면이 나오면, 화면에 뜬 문구를 그대로 신학원 카카오톡 단체방에 알려주세요.',
    ],
  },
  {
    title: '휴대전화 홈 화면에 추가해보세요',
    body: [
      '아이폰(사파리): 화면 아래쪽 공유 버튼(네모 안에 위쪽 화살표 모양)을 누른 뒤, 아래로 내려서 "홈 화면에 추가"를 누르고 "추가"를 눌러주세요.',
      '안드로이드(크롬): 화면 오른쪽 위 점 세 개(⋮) 메뉴를 누른 뒤 "홈 화면에 추가" 또는 "앱 설치"를 눌러주세요.',
      '한 번 추가해두면 다음부터는 인터넷 앱을 거치지 않고 홈 화면의 아이콘만 눌러서 바로 들어올 수 있어 훨씬 편리해요.',
      '카카오톡 같은 앱에서 링크로 열면 로그인이 그 앱에만 따로 저장되어 자주 풀릴 수 있어요. 홈 화면 아이콘으로 들어오시면 로그인이 훨씬 오래 유지됩니다.',
    ],
  },
  {
    title: '이 사이트는 어떻게 작동하나요?',
    body: [
      '이 사이트는 AI가 문제를 만들어주는 곳이 아니에요. 함께 공부하는 분들이 직접 만든 문제를 서로 나누어 푸는 곳입니다.',
      '그래서 문제를 만들어 올려주시는 분이 없으면, 풀 수 있는 문제도 늘어나지 않아요. 배운 내용을 문제로 만들어 나누어 주시면 다른 분들에게 큰 도움이 됩니다.',
    ],
  },
  {
    title: '오늘의 학습 (문제 풀기)',
    body: [
      '홈 화면에서 "오늘의 학습 시작"을 누르면 문제가 하나씩 나와요.',
      '시작하기 전에 과목·회차와 함께 문제 유형(객관식·단답형·성경문제)도 원하는 것만 골라 풀 수 있어요.',
      '문제를 읽고 답을 고르거나 적은 뒤 "답안 확인"을 누르면 맞았는지 바로 알려드려요.',
      '답을 정답과 똑같이 적지 않아도 괜찮아요. 띄어쓰기나 조사가 달라도, 성경 구절을 "히브리서 11:1"이나 "히 11장 1절"처럼 다르게 적어도 정답으로 인정됩니다. 일부만 맞으면 부분 점수를 드려요.',
      '"이전 문제"를 누르면 방금 푼 문제로 돌아가 다시 볼 수 있어요.',
      '다 풀고 나면 몇 개를 맞혔는지 결과를 보여드립니다.',
    ],
  },
  {
    title: '플래시카드로 복습하기',
    body: [
      '"플래시카드로 복습"을 누르면 채점 없이 가볍게 문제만 훑어볼 수 있어요.',
      '질문을 보고 "정답 보기"를 누르면 답과 함께 출처(어느 강의 어디쯤인지)도 보여드려요. "알고 있었어요" 또는 "몰랐어요" 중 편한 쪽을 눌러주세요.',
      '"이전 카드"를 누르면 앞 카드로 돌아가 다시 볼 수 있어요.',
      '몰랐던 문제는 모아두었다가 나중에 다시 볼 수 있어요.',
    ],
  },
  {
    title: '문제 만들기',
    body: [
      '"새 문제 만들기"를 누르면 내가 배운 내용으로 직접 문제를 만들 수 있어요.',
      '문제 종류(4지선다·단답형·성경문제) 중 하나를 고르고, 질문과 정답을 적으면 됩니다.',
      '회차는 차수와 상관없이 전체 강의 순번을 숫자로 적어주세요. 2차 1강을 듣고 계시다면 "9"처럼 적으시면 됩니다.',
      '단답형은 "인정 키워드"를 세미콜론(;)으로 나눠 적어두면, 답을 조금 다르게 적어도 그 비율만큼 점수를 받을 수 있어요.',
    ],
  },
  {
    title: '북마크(즐겨찾기)',
    body: [
      '문제 풀이와 플래시카드 화면 오른쪽 위에 있는 별표(★) 버튼을 누르면 그 문제를 북마크할 수 있어요. 다시 누르면 해제됩니다.',
      '플래시카드에서는 다 끝난 뒤 "모르는 문제"만 한 번에 북마크할 수도 있어요.',
      '홈 화면의 "북마크한 문제"에서 언제든 다시 찾아볼 수 있습니다.',
    ],
  },
  {
    title: '더 궁금한 점이 있으신가요?',
    body: ['신학원 카카오톡 단체방에 편하게 올려주세요.'],
  },
  {
    title: '사이트 운영 안내',
    body: [
      '이 사이트는 영리 목적이 아니라, 신학원생들의 학습을 돕기 위해 개인이 만든 사이트입니다.',
      '그래서 오류 수정이나 기능 개선이 더딜 수 있고, 사정에 따라 운영이 종료될 수도 있는 점 양해 부탁드립니다.',
    ],
  },
]

const HELP_DISMISSED_KEY = 'cbck_help_dismissed'

export function HelpButton() {
  const [open, setOpen] = useState(() => localStorage.getItem(HELP_DISMISSED_KEY) !== 'true')
  const [dontShowAgain, setDontShowAgain] = useState(false)

  function openHelp() {
    setDontShowAgain(false)
    setOpen(true)
  }

  function close() {
    if (dontShowAgain) localStorage.setItem(HELP_DISMISSED_KEY, 'true')
    setOpen(false)
  }

  return (
    <>
      <button type="button" className="help-trigger" onClick={openHelp} aria-label="도움말 보기">?</button>
      {open && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
          <section className="quiz-modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
            <button type="button" className="modal-close" aria-label="닫기" onClick={close}>×</button>
            <h2 id="help-title">이용 안내</h2>
            <div className="help-body">
              {sections.map((section) => (
                <div className="help-section" key={section.title}>
                  <h3>{section.title}</h3>
                  {section.body.map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </div>
              ))}
            </div>
            <label className="help-dismiss">
              <input type="checkbox" checked={dontShowAgain} onChange={(event) => setDontShowAgain(event.target.checked)} />
              다시 보지 않기
            </label>
          </section>
        </div>
      )}
    </>
  )
}
