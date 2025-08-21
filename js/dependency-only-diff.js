/**
 * Gradle dependencies - "변경된 부분만" 트리 출력
 * - 이동은 변경 아님(동일 좌표+버전이면 전역으로 매칭하여 무시)
 * - 버전 변경: "-"(old) 다음 줄에 "+"(new)
 * - 추가/삭제는 해당 위치의 접두부(가지선, 들여쓰기) 그대로 유지
 * - 평탄 요약/버전 없는 중복 라인은 필터링
 *
 * Public:
 *   window.dependencyOnlyDiff(oldText, newText) -> string
 *   window.diffFilesOnly(beforeFile, afterFile) -> Promise<string>
 */

function dependencyOnlyDiff(oldStr, newStr) {
  // 전체 출력 결과를 먼저 얻기
  const fullDiff = dependencyTreeDiffEnhanced(oldStr, newStr);
  
  // 변경되지 않은 라인(' '로 시작)만 제거하고 나머지는 유지
  return fullDiff
    .split(/\r?\n/)
    .filter(line => !line.startsWith(' '))  // ' '로 시작하지 않는 라인만 유지
    .join('\n')
    .trim();
}

async function diffFilesOnly(beforeFile, afterFile) {
  const [oldStr, newStr] = await Promise.all([beforeFile.text(), afterFile.text()]);
  return dependencyOnlyDiff(oldStr, newStr);
}

window.dependencyOnlyDiff = dependencyOnlyDiff;
window.diffFilesOnly = diffFilesOnly;

