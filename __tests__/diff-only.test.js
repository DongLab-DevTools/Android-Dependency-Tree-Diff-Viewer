/**
 * 변경사항만 보기 (Only Diff) 테스트
 */
const fs = require('fs');
const { loadAllTestCases, loadTestCaseContent } = require('./test-cases-loader');
require('./setup');

describe('변경사항만 보기 (Only Diff)', () => {
  const testCases = loadAllTestCases();

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

        test('결과가 생성되어야 함', () => {
          const result = dependencyOnlyDiff(before, after);
          expect(result).toBeTruthy();
        });

        test('공백으로 시작하는 라인이 없어야 함', () => {
          const result = dependencyOnlyDiff(before, after);
          const lines = result.split('\n').filter(l => l.trim());

          const spaceLines = lines.filter(l => l.startsWith(' '));
          expect(spaceLines.length).toBe(0);
        });

        test('+/- 라인만 포함되어야 함', () => {
          const result = dependencyOnlyDiff(before, after);
          const lines = result.split('\n').filter(l => l.trim());

          lines.forEach(line => {
            expect(line.startsWith('+') || line.startsWith('-')).toBe(true);
          });
        });

        test('전체 diff보다 라인 수가 적거나 같아야 함', () => {
          const fullResult = dependencyTreeDiffEnhanced(before, after);
          const onlyResult = dependencyOnlyDiff(before, after);

          const fullLines = fullResult.split('\n').length;
          const onlyLines = onlyResult.split('\n').length;

          expect(onlyLines).toBeLessThanOrEqual(fullLines);
        });
      });
    });
  });

  describe('필터링 로직 검증', () => {
    test('동일한 입력은 빈 결과를 반환해야 함', () => {
      if (testCases.length === 0) return;

      const content = loadTestCaseContent(testCases[0]);
      const result = dependencyOnlyDiff(content.before, content.before);
      const lines = result.split('\n').filter(l => l.trim());

      expect(lines.length).toBe(0);
    });

    test('간단한 변경사항이 올바르게 필터링되어야 함', () => {
      const before = '+--- androidx.core:core:1.0.0 -> 1.9.0';
      const after = '+--- androidx.core:core:1.0.0 -> 1.13.0';

      const result = dependencyOnlyDiff(before, after);

      expect(result).toContain('-');
      expect(result).toContain('+');
      expect(result).not.toContain(' +---'); // 공백으로 시작하는 라인 없음
    });

    test('변경사항이 없으면 공백 라인이 제거되어야 함', () => {
      if (testCases.length === 0) return;

      // 첫 번째 테스트 케이스로 검증
      const content = loadTestCaseContent(testCases[0]);
      const result = dependencyOnlyDiff(content.before, content.after);

      // 공백으로 시작하는 unchanged 라인이 없는지 확인
      const lines = result.split('\n').filter(l => l.trim());
      const unchangedLines = lines.filter(l => l.startsWith(' '));

      expect(unchangedLines.length).toBe(0);
    });
  });

  describe('엣지 케이스', () => {
    test('빈 입력은 빈 결과를 반환해야 함', () => {
      const result = dependencyOnlyDiff('', '');
      expect(result).toBe('');
    });

    test('완전히 다른 입력은 삭제와 추가로만 표시되어야 함', () => {
      const before = '+--- com.example:library:1.0.0';
      const after = '+--- com.other:package:2.0.0';

      const result = dependencyOnlyDiff(before, after);
      const lines = result.split('\n').filter(l => l.trim());

      expect(lines.length).toBe(2);
      expect(lines.some(l => l.startsWith('-'))).toBe(true);
      expect(lines.some(l => l.startsWith('+'))).toBe(true);
      expect(lines.some(l => l.startsWith(' '))).toBe(false);
    });
  });

  describe('케이스별 특성 검증', () => {
    test('버전 변경 케이스 - +/- 라인만 있어야 함', () => {
      const versionCase = testCases.find(tc =>
        tc.name.toLowerCase().includes('version') ||
        tc.name.toLowerCase().includes('change')
      );

      if (versionCase) {
        const content = loadTestCaseContent(versionCase);
        const result = dependencyOnlyDiff(content.before, content.after);
        const lines = result.split('\n').filter(l => l.trim());

        expect(lines.length).toBeGreaterThan(0);
        lines.forEach(line => {
          expect(line.startsWith('+') || line.startsWith('-')).toBe(true);
        });
      }
    });

    test('라이브러리 추가 케이스 - + 라인이 있어야 함', () => {
      const addCase = testCases.find(tc =>
        tc.name.toLowerCase().includes('addition') ||
        tc.name.toLowerCase().includes('add')
      );

      if (addCase) {
        const content = loadTestCaseContent(addCase);
        const result = dependencyOnlyDiff(content.before, content.after);

        expect(result).toContain('+');
      }
    });

    test('라이브러리 제거 케이스 - - 라인이 있어야 함', () => {
      const removeCase = testCases.find(tc =>
        tc.name.toLowerCase().includes('removal') ||
        tc.name.toLowerCase().includes('remove')
      );

      if (removeCase) {
        const content = loadTestCaseContent(removeCase);
        const result = dependencyOnlyDiff(content.before, content.after);

        expect(result).toContain('-');
      }
    });
  });
});
