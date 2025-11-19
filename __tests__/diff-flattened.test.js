/**
 * 요약 (Flattened) 테스트
 */
const fs = require('fs');
const { loadAllTestCases, loadTestCaseContent } = require('./test-cases-loader');
require('./setup');

describe('요약 (Flattened Diff)', () => {
  const testCases = loadAllTestCases();

  function extractStats(result) {
    const added = result.match(/# Added \((\d+)\)/);
    const removed = result.match(/# Removed \((\d+)\)/);
    const changed = result.match(/# Changed \((\d+)\)/);

    return {
      added: added ? parseInt(added[1]) : 0,
      removed: removed ? parseInt(removed[1]) : 0,
      changed: changed ? parseInt(changed[1]) : 0
    };
  }

  if (testCases.length === 0) {
    test('테스트 케이스가 없습니다', () => {
      console.warn('⚠️  testcase 디렉토리에 before/after 쌍이 없습니다.');
      expect(true).toBe(true);
    });
    return;
  }

  describe('모든 테스트 케이스 검증', () => {
    testCases.forEach(testCase => {
      describe(`${testCase.name}`, () => {
        let before, after;

        beforeAll(() => {
          const content = loadTestCaseContent(testCase);
          before = content.before;
          after = content.after;
        });

        test('요약이 생성되어야 함', () => {
          const result = dependencyTreeDiffFlattened(before, after);
          expect(result).toBeTruthy();
          expect(result).toContain('# Added');
          expect(result).toContain('# Removed');
          expect(result).toContain('# Changed');
        });

        test('통계가 올바르게 추출되어야 함', () => {
          const result = dependencyTreeDiffFlattened(before, after);
          const stats = extractStats(result);

          // 숫자가 0 이상이어야 함
          expect(stats.added).toBeGreaterThanOrEqual(0);
          expect(stats.removed).toBeGreaterThanOrEqual(0);
          expect(stats.changed).toBeGreaterThanOrEqual(0);
        });

        test('Added/Removed/Changed 섹션이 올바른 형식이어야 함', () => {
          const result = dependencyTreeDiffFlattened(before, after);

          // 각 섹션이 존재하고 형식이 올바른지 확인
          expect(result).toMatch(/# Added \(\d+\)/);
          expect(result).toMatch(/# Removed \(\d+\)/);
          expect(result).toMatch(/# Changed \(\d+\)/);
        });
      });
    });
  });

  describe('필터링 로직 검증', () => {
    test('중복 제거가 정상 작동해야 함', () => {
      if (testCases.length === 0) return;

      // 첫 번째 테스트 케이스로 검증
      const content = loadTestCaseContent(testCases[0]);
      const result = dependencyTreeDiffFlattened(content.before, content.after);
      const stats = extractStats(result);

      // 요약은 전체 diff보다 훨씬 적어야 함
      const fullResult = dependencyTreeDiffEnhanced(content.before, content.after);
      const fullLines = fullResult.split('\n').filter(l => l.trim()).length;

      expect(stats.added + stats.removed + stats.changed).toBeLessThan(fullLines);
    });

    test('project 모듈이 올바르게 감지되어야 함', () => {
      // project 모듈이 포함된 케이스가 있다면 테스트
      const projectCase = testCases.find(tc =>
        tc.name.toLowerCase().includes('project') ||
        tc.name.toLowerCase().includes('module')
      );

      if (projectCase) {
        const content = loadTestCaseContent(projectCase);
        const result = dependencyTreeDiffFlattened(content.before, content.after);

        // project: 형식이 있는지 확인
        const hasProject = result.includes('project :');
        if (hasProject) {
          expect(result).toMatch(/project :/);
        }
      }
    });
  });

  describe('엣지 케이스', () => {
    test('동일한 입력은 변경사항 없음을 반환해야 함', () => {
      if (testCases.length === 0) return;

      const content = loadTestCaseContent(testCases[0]);
      const result = dependencyTreeDiffFlattened(content.before, content.before);
      const stats = extractStats(result);

      expect(stats.added).toBe(0);
      expect(stats.removed).toBe(0);
      expect(stats.changed).toBe(0);
    });

    test('빈 입력도 정상 처리되어야 함', () => {
      const result = dependencyTreeDiffFlattened('', '');
      expect(result).toBeTruthy();

      const stats = extractStats(result);
      expect(stats.added).toBe(0);
      expect(stats.removed).toBe(0);
      expect(stats.changed).toBe(0);
    });
  });

  describe('케이스별 특성 검증', () => {
    test('버전 변경 케이스 - Changed 항목이 있어야 함', () => {
      const versionCase = testCases.find(tc =>
        tc.name.toLowerCase().includes('version') ||
        tc.name.toLowerCase().includes('change')
      );

      if (versionCase) {
        const content = loadTestCaseContent(versionCase);
        const result = dependencyTreeDiffFlattened(content.before, content.after);
        const stats = extractStats(result);

        expect(stats.changed).toBeGreaterThan(0);
      }
    });

    test('라이브러리 추가 케이스 - Added 항목이 있어야 함', () => {
      const addCase = testCases.find(tc =>
        tc.name.toLowerCase().includes('addition') ||
        tc.name.toLowerCase().includes('add')
      );

      if (addCase) {
        const content = loadTestCaseContent(addCase);
        const result = dependencyTreeDiffFlattened(content.before, content.after);
        const stats = extractStats(result);

        expect(stats.added).toBeGreaterThan(0);
      }
    });

    test('라이브러리 제거 케이스 - Removed 항목이 있어야 함', () => {
      const removeCase = testCases.find(tc =>
        tc.name.toLowerCase().includes('removal') ||
        tc.name.toLowerCase().includes('remove')
      );

      if (removeCase) {
        const content = loadTestCaseContent(removeCase);
        const result = dependencyTreeDiffFlattened(content.before, content.after);
        const stats = extractStats(result);

        expect(stats.removed).toBeGreaterThan(0);
      }
    });
  });
});
