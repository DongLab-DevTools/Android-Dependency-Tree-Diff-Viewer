/**
 * 테스트 케이스 자동 로더
 * testcase 디렉토리의 모든 before/after 쌍을 자동으로 찾아서 로드
 */
const fs = require('fs');
const path = require('path');

/**
 * testcase 디렉토리에서 모든 before/after 쌍을 찾아서 반환
 * @returns {Array} 테스트 케이스 배열
 */
function loadAllTestCases() {
  const testcaseDir = path.join(__dirname, '..', 'testcase');

  if (!fs.existsSync(testcaseDir)) {
    console.warn('testcase 디렉토리를 찾을 수 없습니다:', testcaseDir);
    return [];
  }

  const files = fs.readdirSync(testcaseDir, { recursive: true });
  const beforeFiles = files.filter(f =>
    typeof f === 'string' && f.endsWith('_before.txt')
  );

  const testCases = [];

  beforeFiles.forEach(beforeFile => {
    const baseName = beforeFile.replace('_before.txt', '');
    const afterFile = beforeFile.replace('_before.txt', '_after.txt');

    const beforePath = path.join(testcaseDir, beforeFile);
    const afterPath = path.join(testcaseDir, afterFile);

    // after 파일이 존재하는지 확인
    if (fs.existsSync(afterPath)) {
      // 케이스 이름 추출 (경로에서)
      const caseName = baseName
        .replace(/^case\d+_/, '') // case1_, case2_ 등 제거
        .replace(/_/g, ' ')       // 언더스코어를 공백으로
        .replace(/\//g, ' / ')    // 슬래시 주변 공백
        .trim();

      testCases.push({
        name: caseName || baseName,
        baseName: baseName,
        beforePath: beforePath,
        afterPath: afterPath,
        beforeFile: beforeFile,
        afterFile: afterFile
      });
    } else {
      console.warn(`⚠️  ${beforeFile}에 대응하는 after 파일이 없습니다: ${afterFile}`);
    }
  });

  // 이름순으로 정렬
  testCases.sort((a, b) => a.baseName.localeCompare(b.baseName));

  return testCases;
}

/**
 * 테스트 케이스 내용 로드
 * @param {Object} testCase - loadAllTestCases()로 얻은 테스트 케이스 객체
 * @returns {Object} { before: string, after: string }
 */
function loadTestCaseContent(testCase) {
  return {
    before: fs.readFileSync(testCase.beforePath, 'utf8'),
    after: fs.readFileSync(testCase.afterPath, 'utf8')
  };
}

/**
 * 테스트 케이스 요약 정보 출력
 */
function printTestCasesSummary() {
  const cases = loadAllTestCases();
  console.log(`\n📦 발견된 테스트 케이스: ${cases.length}개\n`);
  cases.forEach((tc, idx) => {
    console.log(`  ${idx + 1}. ${tc.name}`);
    console.log(`     Before: ${tc.beforeFile}`);
    console.log(`     After:  ${tc.afterFile}`);
  });
  console.log();
}

module.exports = {
  loadAllTestCases,
  loadTestCaseContent,
  printTestCasesSummary
};
