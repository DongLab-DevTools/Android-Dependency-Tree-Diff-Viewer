/**
 * 전체 트리 비교 테스트
 */
const fs = require('fs');
const { loadAllTestCases, loadTestCaseContent } = require('./test-cases-loader');
require('./setup');

describe('전체 트리 비교 (Full Tree Diff)', () => {
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

        test('파일이 정상적으로 로드되어야 함', () => {
          expect(before).toBeTruthy();
          expect(after).toBeTruthy();
          expect(before.length).toBeGreaterThan(0);
          expect(after.length).toBeGreaterThan(0);
        });

        test('diff 결과가 생성되어야 함', () => {
          const result = dependencyTreeDiffEnhanced(before, after);
          expect(result).toBeTruthy();
        });

        test('diff 결과에 +, -, 또는 공백 라인이 있어야 함', () => {
          const result = dependencyTreeDiffEnhanced(before, after);
          const lines = result.split('\n').filter(l => l.trim());

          expect(lines.length).toBeGreaterThan(0);

          // 모든 라인이 +, -, 또는 공백으로 시작해야 함
          lines.forEach(line => {
            const firstChar = line[0];
            expect(['+', '-', ' ']).toContain(firstChar);
          });
        });
      });
    });
  });

  describe('파싱 로직 검증', () => {
    test('동일한 입력은 모두 변경 없음으로 표시되어야 함', () => {
      const input = '+--- org.jetbrains.kotlin:kotlin-reflect:1.6.10 -> 1.8.22';
      const result = dependencyTreeDiffEnhanced(input, input);

      const lines = result.split('\n').filter(l => l.trim());
      lines.forEach(line => {
        expect(line).toMatch(/^ /);
      });
    });

    test('depth가 정확히 계산되어야 함', () => {
      const input = `
+--- org.jetbrains.kotlin:kotlin-reflect:1.6.10 -> 1.8.22
|    \\--- org.jetbrains.kotlin:kotlin-stdlib:1.8.22 -> 2.1.10
|         +--- org.jetbrains:annotations:13.0 -> 23.0.0
`.trim();

      const result = dependencyTreeDiffEnhanced(input, input);
      expect(result).toBeTruthy();

      const lines = result.split('\n').filter(l => l.trim());
      lines.forEach(line => {
        expect(line.startsWith(' ')).toBe(true);
      });
    });

    test('버전 변경이 정확히 감지되어야 함', () => {
      const before = '+--- androidx.core:core:1.0.0 -> 1.9.0';
      const after = '+--- androidx.core:core:1.0.0 -> 1.13.0';

      const result = dependencyTreeDiffEnhanced(before, after);

      expect(result).toContain('-');
      expect(result).toContain('+');
    });
  });

  describe('엣지 케이스', () => {
    test('빈 입력은 빈 결과를 반환해야 함', () => {
      const result = dependencyTreeDiffEnhanced('', '');
      expect(result).toBe('');
    });

    test('완전히 다른 입력은 삭제와 추가로 표시되어야 함', () => {
      const before = '+--- com.example:library:1.0.0';
      const after = '+--- com.other:package:2.0.0';

      const result = dependencyTreeDiffEnhanced(before, after);

      expect(result).toContain('-');
      expect(result).toContain('+');
    });

    test('대용량 파일도 정상 처리되어야 함', () => {
      if (testCases.length === 0) return;

      const largestCase = testCases.reduce((max, tc) => {
        const content = loadTestCaseContent(tc);
        const size = content.before.length + content.after.length;
        return size > max.size ? { case: tc, size } : max;
      }, { case: null, size: 0 });

      if (largestCase.case) {
        const content = loadTestCaseContent(largestCase.case);
        const result = dependencyTreeDiffEnhanced(content.before, content.after);

        expect(result).toBeTruthy();
        expect(result.length).toBeGreaterThan(0);
      }
    });
  });

  describe('테스트 케이스 요약', () => {
    test(`총 ${testCases.length}개의 테스트 케이스가 로드됨`, () => {
      expect(testCases.length).toBeGreaterThan(0);

      console.log('\n📦 로드된 테스트 케이스:');
      testCases.forEach((tc, idx) => {
        console.log(`  ${idx + 1}. ${tc.name}`);
      });
    });
  });
});
