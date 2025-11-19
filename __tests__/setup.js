/**
 * Jest 테스트 환경 설정
 */
const fs = require('fs');

// window 객체 모의 (브라우저 환경 시뮬레이션)
global.window = global;

// JS 파일 로드
const enhancedCode = fs.readFileSync('./js/dependency-diff-tree-full-enhanced.js', 'utf8');
const flattenedCode = fs.readFileSync('./js/dependency-diff-flattened.js', 'utf8');
const onlyDiffCode = fs.readFileSync('./js/dependency-only-diff.js', 'utf8');

eval(enhancedCode);
eval(flattenedCode);
eval(onlyDiffCode);

// 전역 함수로 export
global.dependencyTreeDiffEnhanced = dependencyTreeDiffEnhanced;
global.dependencyTreeDiffFlattened = dependencyTreeDiffFlattened;
global.dependencyOnlyDiff = dependencyOnlyDiff;
