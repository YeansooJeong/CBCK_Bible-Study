import { useState } from 'react'

// 개인정보 보관·파기 고지. 페이지 맨 아래에 작게 두고, 자세한 내용은 눌러서 본다.
// 여기 적은 내용과 실제 동작(purge_expired_users, withdraw-account)이 어긋나면 안 된다.
const RETENTION = [
  {
    title: '수집하는 개인정보',
    body: [
      '이름, 휴대전화번호, 기수, 비밀번호를 수집합니다. 휴대전화번호는 암호화하여 저장하고, 비밀번호는 복원할 수 없는 형태로 저장합니다.',
      '이용 과정에서 학습 기록(풀이 이력, 북마크)과 작성하신 문제·댓글이 저장됩니다.',
    ],
  },
  {
    title: '보관 기간',
    body: [
      '계정을 활성화하신 경우: 마지막 접속일부터 1년',
      '가입 후 활성화하지 않으신 경우: 등록일부터 1년',
      '기간이 지나면 매일 자동으로 개인정보를 파기합니다.',
    ],
  },
  {
    title: '파기 방법과 예외',
    body: [
      '보관 기간이 지나거나 탈퇴하시면 휴대전화번호·비밀번호·표시 이름·기수와 학습 기록을 지웁니다.',
      '다만 함께 공부하는 분들의 학습 자료를 지키기 위해, 작성하신 문제와 댓글은 남습니다. 이 자료의 작성자를 확인하고 관리(수정·삭제)할 수 있도록 이름은 관리자만 볼 수 있는 형태로 보관합니다.',
      '작성하신 문제의 삭제를 원하시면 신학원 카카오톡 단체방으로 요청해 주세요.',
    ],
  },
  {
    title: '이용자의 권리',
    body: [
      '언제든지 홈 화면의 설정(⚙)에서 학습 기록을 삭제하거나 회원 탈퇴를 하실 수 있습니다.',
      '본인의 개인정보 열람·정정·삭제를 원하시면 신학원 카카오톡 단체방으로 요청해 주세요.',
    ],
  },
]

export function PrivacyNotice() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <footer className="privacy-footer">
        <span>개인정보는 마지막 접속일(미활성 계정은 등록일)부터 1년간 보관 후 파기됩니다.</span>
        <button type="button" onClick={() => setOpen(true)}>개인정보 보관·파기 안내</button>
      </footer>
      {open && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="quiz-modal help-modal" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
            <button type="button" className="modal-close" aria-label="닫기" onClick={() => setOpen(false)}>×</button>
            <h2 id="privacy-title">개인정보 보관·파기 안내</h2>
            <div className="help-body">
              {RETENTION.map((section) => (
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
