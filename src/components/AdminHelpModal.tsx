import { useState } from 'react'

type Variant = 'super' | 'general'

function getSections(variant: Variant): Array<{ title: string; body: string[] }> {
  const sections: Array<{ title: string; body: string[] }> = []

  if (variant === 'super') {
    sections.push({
      title: '기수는 어떻게 등록하나요?',
      body: [
        '"기수 등록" 카드에서 기수명, 간사 이름, 반장 이름, 킹제임스 성경 출판연도를 입력하면 새 기수가 만들어집니다.',
        '기수 목록에서 "수정"으로 정보를 바꾸거나 "삭제"로 지울 수 있어요. 단, 그 기수에 신학원생이 남아있으면 삭제할 수 없습니다.',
      ],
    })
  }

  sections.push({
    title: variant === 'super' ? '신학원생은 어떻게 등록하나요?' : '기수를 선택하고 신학원생을 등록하려면?',
    body: [
      ...(variant === 'general' ? ['화면 상단에서 기수를 선택하면 그 기수의 신학원생 목록이 보입니다.'] : []),
      '이름과 전화번호를 입력해 한 명씩 등록하거나, CSV 파일로 여러 명을 한 번에 등록할 수 있어요.',
      '등록된 신학원생은 처음 로그인할 때 본인 확인(이름, 출판연도)을 거쳐 스스로 비밀번호를 설정합니다.',
    ],
  })

  sections.push({
    title: '신학원생 정보를 고치거나 삭제하려면?',
    body: [
      '"수정"으로 이름이나 소속 기수를 바꿀 수 있어요.',
      '"비밀번호 초기화"를 누르면 그 신학원생은 대기중 상태로 돌아가 다음 로그인 때 처음처럼 본인 확인을 다시 거치게 됩니다.',
      '"삭제"를 누르면 신학원생과 그 학생이 만든 문제·프로젝트가 함께 삭제되니 신중하게 사용해 주세요.',
    ],
  })

  if (variant === 'super') {
    sections.push({
      title: '다른 신학원생에게 관리 권한을 줄 수 있나요?',
      body: [
        '신학원생 목록에서 "Admin 지정"을 누르면 그 신학원생이 일반 관리자가 되어 "관리" 메뉴에서 신학원생·과목·문제를 관리할 수 있게 됩니다.',
        '단, 기수 생성·삭제, 전화번호 조회, 관리자 비밀번호 변경은 super admin(본인)만 할 수 있어요.',
        '"Admin 해제"를 누르면 다시 일반 신학원생으로 되돌아갑니다.',
      ],
    })
    sections.push({
      title: '신학원생 전화번호는 어떻게 확인하나요?',
      body: [
        '신학원생 목록에서 "보기"를 누르면 전화번호를 확인할 수 있어요.',
        '조회할 때마다 화면 맨 아래 "개인정보 접근 이력"에 누가 언제 조회했는지 기록이 남습니다.',
      ],
    })
  } else {
    sections.push({
      title: '기수 생성이나 전화번호 조회도 할 수 있나요?',
      body: ['아니요. 기수 생성·삭제와 신학원생 전화번호 조회는 super admin만 할 수 있는 기능이에요. 필요하면 super admin에게 요청해 주세요.'],
    })
  }

  sections.push({
    title: '과목은 어떻게 만드나요?',
    body: ['"과목 관리"에서 새 과목(예: 창세기)을 만들고 총 회차 수를 정할 수 있어요. 신학원생들은 이 과목을 기준으로 문제를 등록하고 학습합니다.'],
  })

  sections.push({
    title: '신학원생이 만든 문제를 손봐야 할 때는요?',
    body: [
      '"문제 관리"에서 문제를 검색하거나 종류·과목별로 걸러볼 수 있어요.',
      '문제 내용이나 정답이 잘못된 경우 직접 수정하거나 삭제할 수 있습니다.',
    ],
  })

  if (variant === 'super') {
    sections.push({
      title: '관리자 비밀번호는 어떻게 바꾸나요?',
      body: ['우측 상단 "비밀번호 변경" 버튼을 누르면 본인(super admin)의 로그인 비밀번호를 바꿀 수 있어요.'],
    })
  }

  return sections
}

export function ManageAdminHelpButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="secondary-button" onClick={() => setOpen(true)}>
        관리자 도움말
      </button>
      {open && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="quiz-modal help-modal" role="dialog" aria-modal="true" aria-labelledby="manage-help-title">
            <button type="button" className="modal-close" aria-label="닫기" onClick={() => setOpen(false)}>×</button>
            <h2 id="manage-help-title">관리자 사용 안내</h2>
            <div className="help-body">
              {getSections('general').map((section) => (
                <div className="help-section" key={section.title}>
                  <h3>{section.title}</h3>
                  {section.body.map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  )
}

export function SuperAdminHelpButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="whitespace-nowrap rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
      >
        관리자 도움말
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-5 backdrop-blur-sm"
          onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="super-admin-help-title"
            className="relative max-h-[85svh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-neutral-900"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="닫기"
              className="absolute right-4 top-3 text-2xl leading-none text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            >
              ×
            </button>
            <h2 id="super-admin-help-title" className="mb-4 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              관리자 사용 안내
            </h2>
            <div className="flex flex-col gap-5">
              {getSections('super').map((section) => (
                <div key={section.title} className="border-l-4 border-accent pl-3">
                  <h3 className="mb-1.5 text-[15px] font-bold text-neutral-900 dark:text-neutral-50">{section.title}</h3>
                  {section.body.map((line, index) => (
                    <p key={index} className="mb-1.5 text-sm leading-relaxed text-neutral-600 last:mb-0 dark:text-neutral-400">
                      {line}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
