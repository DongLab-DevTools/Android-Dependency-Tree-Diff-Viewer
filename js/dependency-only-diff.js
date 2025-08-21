// Kotlin: dependency-tree-diff 알고리즘을 브라우저 JS로 포팅 (수정 버전)
// 핵심 변경: 경로(트리) 기반 비교 -> "좌표:해결버전" 평탄화 비교

function dependencyTreeDiffFlattened(oldStr, newStr){
  const oldMap = buildResolvedMapFlattened(oldStr);   // { "group:artifact": "version" }
  const newMap = buildResolvedMapFlattened(newStr);

  const diff = diffMapsFlattened(oldMap, newMap);
  return formatReportFlattened(diff);
}

/** 문자열을 줄 단위로 */
function splitLinesFlattened(s){ return (s||"").split(/\r\n|\n|\r/); }

/** 한 줄 파싱: 트리 글리프/메타토큰 제거 후 좌표와 "해결된 버전" 추출 */
function parseLineToCoordinateFlattened(line){
  if (!line) return null;
  if (line.includes("project :")) return null; // 멀티모듈 항목은 제외

  // 트리 글리프/선두 부호 제거: "+---", "\---", "|    " 등
  const stripped = line
    .replace(/[|`]/g, "")
    .replace(/^[\s\\+\-]*\s*/g, "")
    .trim();

  // 빠른 거르기
  if (!stripped || stripped.indexOf(":") < 0) return null;
  if (stripped.startsWith("Extends") || stripped.startsWith("No dependencies")) return null;

  // 예) "com.a:b:1.0" 또는 "com.a:b:1.0 -> 2.0"
  // 버전 토큰은 공백/괄호 앞에서 끝남: "(c)", "(*)", "{strictly ...}" 등 무시
  const m = stripped.match(
    /^([a-zA-Z0-9_.\-]+):([a-zA-Z0-9_.\-]+):([^\s({]+)(?:\s*->\s*([^\s({]+))?/
  );
  if (!m) return null;

  const group = m[1];
  const artifact = m[2];
  const declaredVer = m[3];
  const arrowVer = m[4]; // 있으면 이것이 최종 해결 버전

  const key = `${group}:${artifact}`;
  const resolved = arrowVer || declaredVer;
  if (!resolved || resolved === "->") return null;

  return { key, resolved };
}

/** 전체 텍스트를 평탄화 맵으로 변환: { "g:a": "resolvedVersion" } */
function buildResolvedMapFlattened(text){
  const map = Object.create(null);
  for (const raw of splitLinesFlattened(text)){
    const p = parseLineToCoordinateFlattened(raw);
    if (!p) continue;
    // 동일 coords가 여러 번 나오면 "마지막(최종) 해결 버전"이 덮어쓰게 둠
    map[p.key] = p.resolved;
  }
  return map;
}

/** 두 맵 비교 */
function diffMapsFlattened(before, after){
  const beforeKeys = Object.keys(before);
  const afterKeys = Object.keys(after);
  const bset = new Set(beforeKeys);
  const aset = new Set(afterKeys);

  const added = [];
  const removed = [];
  const changed = [];

  for (const k of afterKeys){
    if (!bset.has(k)) added.push({ key:k, version: after[k] });
  }
  for (const k of beforeKeys){
    if (!aset.has(k)) removed.push({ key:k, version: before[k] });
  }
  for (const k of beforeKeys){
    if (aset.has(k) && before[k] !== after[k]){
      changed.push({ key:k, before: before[k], after: after[k] });
    }
  }

  // 보기 좋게 정렬
  added.sort((a,b)=>a.key.localeCompare(b.key));
  removed.sort((a,b)=>a.key.localeCompare(b.key));
  changed.sort((a,b)=>a.key.localeCompare(b.key));

  return { added, removed, changed };
}

/** 결과 문자열 포맷 (브라우저 콘솔/텍스트뷰 등에 그대로 표시 가능) */
function formatReportFlattened({ added, removed, changed }){
  const pad = (s, n) => (s + " ".repeat(n)).slice(0, n);
  let out = "";
  out += "=== Dependency Diff (flattened by resolved coordinates) ===\n\n";

  out += `# Added (${added.length})\n`;
  if (added.length === 0) {
    out += "  (none)\n\n";
  } else {
    for (const it of added) out += `  + ${pad(it.key, 55)} ${it.version}\n`;
    out += "\n";
  }

  out += `# Removed (${removed.length})\n`;
  if (removed.length === 0) {
    out += "  (none)\n\n";
  } else {
    for (const it of removed) out += `  - ${pad(it.key, 55)} ${it.version}\n`;
    out += "\n";
  }

  out += `# Changed (${changed.length})\n`;
  if (changed.length === 0) {
    out += "  (none)\n";
  } else {
    for (const it of changed){
      out += `  ~ ${pad(it.key, 55)} ${pad(it.before, 16)} -> ${it.after}\n`;
    }
  }
  return out;
}

/* ──────────────────────────────────────────────────────────────
   (참고) 기존 트리 기반 로직은 아래처럼 남겨두어도 되지만,
   더 이상 호출하지 않음. 필요 없으면 삭제해도 무방.
───────────────────────────────────────────────────────────────*/

class NodeFlattened{
  constructor(coordinate, versionInfo){ this.coordinate = coordinate; this.versionInfo = versionInfo; this.children = []; }
  toString(){ return `${this.coordinate}:${this.versionInfo}`; }
}

// 아래 함수들은 현재 미사용
function findDependencyPathsFlattened(){ return []; }
function buildTreeFlattened(){ return []; }
function pathsMinusFlattened(a,b){ return a; }
function treesEqualFlattened(){ return true; }
function appendNodeFlattened(){ return { out:"", nextIndent:"" }; }
function appendAddedFlattened(){ return ""; }
function appendRemovedFlattened(){ return ""; }
function appendDiffFlattened(){ return ""; }