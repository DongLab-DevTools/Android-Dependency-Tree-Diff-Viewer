/**
 * Gradle dependencies 요약(Flattened) 출력
 * - 좌표별 resolved 버전만 비교하여 요약 형태로 표시
 *
 * Public:
 *   window.dependencyTreeDiffFlattened(oldText, newText) -> string
 *   window.diffFilesFlattened(beforeFile, afterFile) -> Promise<string>
 */

function dependencyTreeDiffFlattened(oldStr, newStr){
  // 1) 플래튼드 맵 비교 (기존 로직)
  const oldMap = buildResolvedMapFlattened(oldStr);   // { "group:artifact": "version" }
  const newMap = buildResolvedMapFlattened(newStr);
  const diff = diffMapsFlattened(oldMap, newMap);

  // 2) 전체 트리 diff에서 실제 변경된 의존성 추출
  //    (트리 구조 변경으로 인한 추가/삭제도 감지)
  if (typeof dependencyTreeDiffEnhanced === 'function') {
    const fullDiff = dependencyTreeDiffEnhanced(oldStr, newStr);
    const treeChanges = extractChangesFromFullDiff(fullDiff, oldMap, newMap);

    // 트리 변경사항을 기존 diff에 병합
    mergeDiffResults(diff, treeChanges);
  }

  // 3) 새로운 모듈의 하위 의존성들도 추가하되,
  //    "전체 이전 그래프에 없던 좌표"만 추가
  const additionalDepsTree = findModuleDependenciesWithStructure(oldStr, newStr, diff, oldMap);

  return formatReportFlattenedWithTree(diff, additionalDepsTree);
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

// 전체 트리 diff 결과에서 변경사항 추출
function extractChangesFromFullDiff(fullDiff, oldMap, newMap) {
  const lines = fullDiff.split(/\r?\n/);
  const added = new Map(); // key -> version
  const removed = new Map(); // key -> version

  for (const line of lines) {
    // 공백으로 시작하는 라인(변경 없음)은 무시
    if (!line.startsWith('+') && !line.startsWith('-')) continue;

    const isAdded = line.startsWith('+');
    const parsed = parseLineToCoordinateFlattened(line.substring(1)); // +/- 제거
    if (!parsed || !parsed.key) continue;

    // project 의존성은 제외 (이미 다른 로직에서 처리)
    if (parsed.key.startsWith('project :')) continue;

    const { key, resolved } = parsed;

    // ✅ 핵심: 전역적으로 새로 추가되거나 제거된 것만 포함
    const inOld = Object.prototype.hasOwnProperty.call(oldMap, key);
    const inNew = Object.prototype.hasOwnProperty.call(newMap, key);

    if (isAdded) {
      // + 라인 중 전역적으로 새로운 것만 (before 전체에 없던 의존성)
      if (!removed.has(key) && !inOld) {
        added.set(key, resolved);
      }
    } else {
      // - 라인 중 전역적으로 제거된 것만 (after 전체에 없는 의존성)
      if (!added.has(key) && !inNew) {
        removed.set(key, resolved);
      }
    }
  }

  return { added, removed };
}

// 트리 변경사항을 기존 diff 결과에 병합
function mergeDiffResults(diff, treeChanges) {
  const existingAdded = new Set(diff.added.map(item => item.key));
  const existingRemoved = new Set(diff.removed.map(item => item.key));
  const existingChanged = new Set(diff.changed.map(item => item.key));

  // 트리에서 추가된 항목 중 아직 diff에 없는 것만 추가
  for (const [key, version] of treeChanges.added.entries()) {
    if (!existingAdded.has(key) && !existingChanged.has(key)) {
      // 혹시 removed에 있으면 changed로 변경
      if (existingRemoved.has(key)) {
        const removedItem = diff.removed.find(item => item.key === key);
        if (removedItem) {
          diff.changed.push({
            key,
            before: removedItem.version,
            after: version
          });
          diff.removed = diff.removed.filter(item => item.key !== key);
        }
      } else {
        diff.added.push({ key, version });
      }
    }
  }

  // 트리에서 삭제된 항목 중 아직 diff에 없는 것만 추가
  for (const [key, version] of treeChanges.removed.entries()) {
    if (!existingRemoved.has(key) && !existingChanged.has(key)) {
      // 혹시 added에 있으면 changed로 변경
      if (existingAdded.has(key)) {
        const addedItem = diff.added.find(item => item.key === key);
        if (addedItem) {
          diff.changed.push({
            key,
            before: version,
            after: addedItem.version
          });
          diff.added = diff.added.filter(item => item.key !== key);
        }
      } else {
        diff.removed.push({ key, version });
      }
    }
  }

  // 재정렬
  diff.added.sort((a,b) => a.key.localeCompare(b.key));
  diff.removed.sort((a,b) => a.key.localeCompare(b.key));
  diff.changed.sort((a,b) => a.key.localeCompare(b.key));
}

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

// 새로운 모듈의 하위 의존성 찾기 (트리 구조 유지)
// oldMap을 받아서 "전역적으로 신규"만 Added 확장
function findModuleDependenciesWithStructure(oldStr, newStr, diff, oldMap) {
  const modulesTrees = [];
  const addedModules = diff.added.filter(
    item => item.version === "(project)" && item.key.startsWith("project :")
  );
  if (addedModules.length === 0) return modulesTrees;

  const newLines = newStr.split(/\r?\n/);

  for (const module of addedModules) {
    const moduleName = module.key;
    let moduleLineIndex = -1;
    let moduleDepth = -1;

    for (let i = 0; i < newLines.length; i++) {
      const line = newLines[i];
      if (line.includes("--- " + moduleName)) {
        moduleLineIndex = i;
        // 정확한 depth 계산: +--- 또는 \--- 앞의 들여쓰기 부분 측정
        const match = line.match(/^([| ]*)[+\\]--- /);
        if (match) {
          moduleDepth = match[1].length / 5;
        } else {
          moduleDepth = 0;
        }
        break;
      }
    }
    if (moduleLineIndex === -1) continue;

    const moduleTree = { moduleName, dependencies: [] };

    for (let i = moduleLineIndex + 1; i < newLines.length; i++) {
      const line = newLines[i];

      // 정확한 depth 계산
      const match = line.match(/^([| ]*)[+\\]--- /);
      if (!match) continue;

      const currentDepth = match[1].length / 5;
      if (currentDepth <= moduleDepth) break;

      const parsed = parseLineToCoordinateFlattened(line);
      if (!parsed || !parsed.key || parsed.key.startsWith("project :")) continue;

      // ✅ 핵심 필터:
      // - 전역 before(=oldMap)에 없던 좌표만 추가
      // - 이미 diff.added에 들어간 좌표는 중복 방지
      const globallyNew = !Object.prototype.hasOwnProperty.call(oldMap, parsed.key);
      const alreadyInAdded = diff.added.some(existing => existing.key === parsed.key);

      if (globallyNew && !alreadyInAdded) {
        moduleTree.dependencies.push({
          originalLine: line,
          key: parsed.key,
          version: parsed.resolved,
          depth: currentDepth - moduleDepth
        });
      }
    }

    if (moduleTree.dependencies.length > 0) {
      modulesTrees.push(moduleTree);
    }
  }
  return modulesTrees;
}

// 트리 구조를 포함한 포맷 함수
function formatReportFlattenedWithTree(diff, modulesTrees) {
  const pad = (s, n) => (s + " ".repeat(n)).slice(0, Math.max(n, s.length));
  let out = "";
  out += "=== Dependency Diff (flattened by resolved coordinates) ===\n\n";

  // Added 섹션 (기존 로직 + 모듈 트리)
  const totalAdded = diff.added.length + modulesTrees.reduce((sum, tree) => sum + tree.dependencies.length, 0);
  out += `# Added (${totalAdded})\n`;
  
  if (totalAdded === 0) {
    out += "  (none)\n\n";
  } else {
    // 기존 플래튼드 추가 항목들
    for (const it of diff.added) {
      out += `  + ${pad(it.key, 55)} ${it.version}\n`;
    }
    
    // 모듈 트리들 (들여쓰기 포함)
    for (const tree of modulesTrees) {
      for (const dep of tree.dependencies) {
        const indent = "  " + "  ".repeat(dep.depth); // 기본 2칸 + depth별 추가
        out += `${indent}+ ${pad(dep.key, 55 - indent.length + 2)} ${dep.version}\n`;
      }
    }
    out += "\n";
  }

  // Removed 섹션 (기존 로직 그대로)
  out += `# Removed (${diff.removed.length})\n`;
  if (diff.removed.length === 0) {
    out += "  (none)\n\n";
  } else {
    for (const it of diff.removed) out += `  - ${pad(it.key, 55)} ${it.version}\n`;
    out += "\n";
  }

  // Changed 섹션 (기존 로직 그대로)
  out += `# Changed (${diff.changed.length})\n`;
  if (diff.changed.length === 0) {
    out += "  (none)\n";
  } else {
    for (const it of diff.changed){
      out += `  ~ ${pad(it.key, 55)} ${pad(it.before, 16)} -> ${it.after}\n`;
    }
  }
  return out;
}

// 전역 노출 (Flattened 함수만)
window.dependencyTreeDiffFlattened = dependencyTreeDiffFlattened;
window.diffFilesFlattened = diffFilesFlattened;