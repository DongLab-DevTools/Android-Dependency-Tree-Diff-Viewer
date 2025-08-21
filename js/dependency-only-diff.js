/**
 * Gradle dependencies "변경된 부분만" 트리 출력
 * - 전체 트리는 출력하지 않고, 변경/삭제/추가 라인만 트리 접두부를 보존해 보여줌
 * - 좌표 비교는 깊이 무관(group:artifact 또는 "project :...") / 경로 이동은 변경 아님
 * - 버전 변경: OLD('-') 한 줄 출력 후, 같은 들여쓰기로 NEW('+') 줄 바로 밑에 추가
 * - 평탄 요약/버전 없는 중복 라인 자동 무시
 *
 * Public:
 *   window.dependencyOnlyDiff(oldText, newText) -> string
 *   window.diffFilesOnly(beforeFile, afterFile) -> Promise<string>
 *   window.dependencyTreeDiffFlattened(oldText, newText) -> string
 *   window.diffFilesFlattened(beforeFile, afterFile) -> Promise<string>
 */

/* ============================ Public API ============================ */

function dependencyOnlyDiff(oldStr, newStr) {
  const oldNodesAll = parseDependencyLines(oldStr);
  const newNodesAll = parseDependencyLines(newStr);

  // 노이즈 제거 (평탄 요약, 버전없는 중복)
  const oldNodes = filterNoise(oldNodesAll);
  const newNodes = filterNoise(newNodesAll);

  // 인덱스
  const oldIdx = buildIndexes(oldNodes);
  const newIdx = buildIndexes(newNodes);

  let out = "";

  // 1) 삭제/버전변경 (OLD 기준으로 훑음)
  for (const node of oldNodes) {
    const id = node.identity;
    const ver = node.version;

    const inNewSamePair = newIdx.pairSet.has(id + "@" + ver);
    if (inNewSamePair) continue; // 변경 없음 → 출력하지 않음

    const existsIdInNew = newIdx.idSet.has(id);
    if (!existsIdInNew) {
      // 통째로 삭제
      out += "-" + node.line + "\n";
      continue;
    }

    // 버전 변경: OLD('-') + NEW('+')
    out += "-" + node.line + "\n";
    const newVers = Array.from(newIdx.versionsById.get(id) || []);
    for (const nv of newVers) {
      if (nv === ver) continue;
      out += "+" + synthesizeLine(node, id, nv) + "\n";
    }
  }

  // 2) Added only in after (OLD엔 없고 NEW에만)
  const addedPairs = [];
  for (const [id, vers] of newIdx.versionsById.entries()) {
    if (oldIdx.idSet.has(id)) continue; // 동일 좌표가 OLD에도 있으면 위에서 처리됨(버전 변경/무시)
    const sampleNode = newIdx.firstNodeById.get(id); // 접두부 복원용
    const prefix = sampleNode ? sampleNode.prefix : "+--- ";
    for (const ver of vers) {
      // 접두부가 있으면 원래 트리 느낌 유지, 없으면 표준 "+--- " 사용
      const body = id + (ver ? ":" + ver : "");
      addedPairs.push(prefix + body);
    }
  }

  if (addedPairs.length) {
    out += "\n# Added (only in after)\n";
    // 보기 좋게 정렬
    addedPairs.sort((a, b) => a.localeCompare(b));
    for (const l of addedPairs) out += l + "\n";
  }

  return out.trimEnd();
}

async function diffFilesOnly(beforeFile, afterFile) {
  const [oldStr, newStr] = await Promise.all([beforeFile.text(), afterFile.text()]);
  return dependencyOnlyDiff(oldStr, newStr);
}

/* ============================ Flattened(요약) – resolved 좌표 기준 ============================ */

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

// 전역 노출
window.dependencyOnlyDiff = dependencyOnlyDiff;
window.diffFilesOnly = diffFilesOnly;
window.dependencyTreeDiffFlattened = dependencyTreeDiffFlattened;
window.diffFilesFlattened = diffFilesFlattened;

/* ============================ Internals ============================ */

// Gradle 라인 파싱: "+--- ...", "\--- ..." 만 수집
function parseDependencyLines(text) {
  const lines = (text || "").split(/\r\n|\n|\r/);
  const nodes = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const idx = raw.indexOf("--- ");
    if (idx < 0) continue; // 트리 라인 아님

    const prefix = raw.substring(0, idx + 4); // "│   +--- " 포함
    const content = raw.substring(idx + 4);

    const depth = Math.floor(idx / 5);
    const { id, ver, isProject } = extractIdAndVersion(content);

    nodes.push({
      line: raw,   // 전체 라인(원문) — 접두부 포함
      prefix,      // 새 라인 합성용
      content,     // 좌표 텍스트
      identity: id,
      version: ver,
      isProject,
      depth,
    });
  }
  return nodes;
}

// 좌표/버전 정규화 (project, "->" 버전 전이, 괄호 주석 제거)
function extractIdAndVersion(content) {
  let s = String(content || "").trim();
  s = s.replace(/\s+$begin:math:text$.*$end:math:text$$/u, ""); // "(...)" 꼬리 제거

  // project 라인
  if (s.startsWith("project ")) {
    return { id: s, ver: "", isProject: true };
  }

  // 버전 전이 "a:b:1.0 -> 2.0"
  const arrow = s.indexOf(" -> ");
  if (arrow !== -1) {
    const left = s.substring(0, arrow).trim();
    const right = s.substring(arrow + 4).trim();
    const lastColon = left.lastIndexOf(":");
    const id = lastColon === -1 ? left : left.substring(0, lastColon);
    const ver = right.split(/\s+/)[0];
    return { id, ver, isProject: false };
  }

  // 일반 "a:b:1.2.3"
  const lastColon = s.lastIndexOf(":");
  if (lastColon === -1) {
    return { id: s, ver: "", isProject: false }; // 방어
  }
  const id = s.substring(0, lastColon);
  const ver = s.substring(lastColon + 1).split(/\s+/)[0];
  return { id, ver, isProject: false };
}

// 노이즈 제거
// - 같은 좌표(id)에 "버전 없는 라인"이 있고, 어디든 "버전 있는 라인"이 있으면 버전 없는 라인은 제거
// - depth==0 에서 중복 (id@ver)은 평탄 요약으로 보고 제거
// - project 라인은 보존(버전 없음 정상)
function filterNoise(nodes) {
  const hasVersionById = new Map();
  for (const n of nodes) {
    if (!n.isProject && n.version) hasVersionById.set(n.identity, true);
  }

  const seenPairAtTop = new Set();
  const result = [];

  for (const n of nodes) {
    const id = n.identity;
    const ver = n.version;

    if (!n.isProject && !ver && hasVersionById.get(id)) continue;

    const key = id + "@" + ver;
    if (n.depth === 0) {
      if (seenPairAtTop.has(key)) continue;
      seenPairAtTop.add(key);
    }

    result.push(n);
  }
  return result;
}

// 인덱스 구성
function buildIndexes(nodes) {
  const versionsById = new Map(); // id -> Set(versions)
  const pairSet = new Set();      // "id@ver"
  const idSet = new Set();        // Set(id)
  const firstNodeById = new Map();// id -> 최초 관측 노드(접두부 재사용용)

  for (const n of nodes) {
    idSet.add(n.identity);

    if (!firstNodeById.has(n.identity)) {
      firstNodeById.set(n.identity, n);
    }

    const set = versionsById.get(n.identity) || new Set();
    set.add(n.version);
    versionsById.set(n.identity, set);

    pairSet.add(n.identity + "@" + n.version);
  }
  return { versionsById, pairSet, idSet, firstNodeById };
}

// OLD의 접두부(prefix)를 그대로 사용해 NEW 버전을 합성
function synthesizeLine(oldNode, id, version) {
  return oldNode.prefix + id + (version ? ":" + version : "");
}