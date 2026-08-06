/**
 * 업로드한 CSV 파일을 문자열로 읽는다.
 * 한국어 환경의 Excel은 "CSV"로 저장하면 UTF-8이 아니라 CP949로 쓴다.
 * file.text()는 무조건 UTF-8로 해석해 한글이 전부 치환문자(U+FFFD)가 되므로,
 * UTF-8로 엄격하게 읽어보고 실패할 때만 CP949(euc-kr)로 다시 읽는다.
 */
export async function readCsvFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  try {
    // fatal:true라야 깨진 바이트에서 예외가 난다. BOM은 자동으로 제거된다.
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    return new TextDecoder('euc-kr').decode(buffer)
  }
}

/**
 * CSV 전체를 한 번에 파싱한다.
 * 줄 단위로 먼저 자르면 큰따옴표로 감싼 값 안의 줄바꿈에서 행이 깨지므로,
 * 따옴표 상태를 보면서 줄바꿈까지 직접 처리한다.
 */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(current)
      current = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(current)
      current = ''
      rows.push(row)
      row = []
    } else {
      current += ch
    }
  }
  row.push(current)
  rows.push(row)
  // 빈 행을 여기서 버리면 행 번호가 밀려 오류 안내가 어긋나므로 그대로 두고 호출부에서 거른다.
  return rows.map((cells) => cells.map((cell) => cell.trim()))
}

// CSV 표준 규칙대로 큰따옴표로 감싼 값 안의 쉼표/줄바꿈/이스케이프된 큰따옴표를 처리
export function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      cells.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current)
  return cells.map((c) => c.trim())
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
