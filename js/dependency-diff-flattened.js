/**
 * Gradle dependencies 요약(Flattened) 출력
 * - 좌표별 resolved 버전만 비교하여 요약 형태로 표시
 *
 * Public:
 *   window.dependencyTreeDiffFlattened(oldText, newText) -> string
 *   window.diffFilesFlattened(beforeFile, afterFile) -> Promise<string>
 */

function dependencyTreeDiffFlattened(oldStr, newStr){
  const oldMap = buildResolvedMapFlattened(oldStr);   // { "group:artifact": "version" }
  const newMap = buildResolvedMapFlattened(newStr);

  const diff = diffMapsFlattened(oldMap, newMap);
  return formatReportFlattened(diff);
}

async function diffFilesFlattened(beforeFile, afterFile){
  const [oldStr, newStr] = await Promise.all([beforeFile.text(), afterFile.text()]);
  return dependencyTreeDiffFlattened(oldStr, newStr);
}

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

function splitLinesFlattened(s){ return (s||"").split(/\r\n|\n|\r/); }

function parseLineToCoordinateFlattened(line){
  if (!line) return null;

  // 트리 글리프/선두 부호 제거: "+---", "\---", "|    " 등
  const stripped = line
    .replace(/[|`]/g, "")
    .replace(/^[\s\\+\-]*\s*/g, "")
    .trim();

  // 빠른 거르기
  if (!stripped || stripped.startsWith("Extends") || stripped.startsWith("No dependencies")) {
    return null;
  }

  // 1) project 모듈 처리: key=원문("project :a:b"), version=구분 토큰
  if (/^project\s*:/.test(stripped)) {
    return { key: stripped, resolved: "(project)" };
  }

  // 2) 좌표 처리: "g:a:1.0" 또는 "g:a:1.0 -> 2.0"
  const m = stripped.match(
    /^([a-zA-Z0-9_.\-]+):([a-zA-Z0-9_.\-]+):([^\s({]+)(?:\s*->\s*([^\s({]+))?/
  );
  if (!m) return null;

  const group = m[1];
  const artifact = m[2];
  const declaredVer = m[3];
  const arrowVer = m[4];

  const key = `${group}:${artifact}`;
  const resolved = arrowVer || declaredVer;
  if (!resolved || resolved === "->") return null;

  return { key, resolved };
}

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

  added.sort((a,b)=>a.key.localeCompare(b.key));
  removed.sort((a,b)=>a.key.localeCompare(b.key));
  changed.sort((a,b)=>a.key.localeCompare(b.key));

  return { added, removed, changed };
}

function formatReportFlattened({ added, removed, changed }){
  const pad = (s, n) => (s + " ".repeat(n)).slice(0, Math.max(n, s.length));
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

// 전역 노출 (Flattened 함수만)
window.dependencyTreeDiffFlattened = dependencyTreeDiffFlattened;
window.diffFilesFlattened = diffFilesFlattened;