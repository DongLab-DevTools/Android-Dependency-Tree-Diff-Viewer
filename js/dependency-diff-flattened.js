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

  // 2) 새로운 모듈의 하위 의존성들도 추가 (트리 구조 유지)
  const additionalDepsTree = findModuleDependenciesWithStructure(oldStr, newStr, diff);
  
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
function findModuleDependenciesWithStructure(oldStr, newStr, diff) {
  const modulesTrees = [];
  
  // Added에서 project 모듈들만 찾기
  const addedModules = diff.added.filter(item => 
    item.version === "(project)" && item.key.startsWith("project :")
  );
  
  if (addedModules.length === 0) return modulesTrees;
  
  // NEW 텍스트에서 각 모듈의 하위 의존성들 찾기
  const newLines = newStr.split(/\r?\n/);
  
  for (const module of addedModules) {
    const moduleName = module.key; // "project :trost:feature:soundplayer"
    
    // 모듈 라인 찾기
    let moduleLineIndex = -1;
    let moduleDepth = -1;
    
    for (let i = 0; i < newLines.length; i++) {
      const line = newLines[i];
      if (line.includes("--- " + moduleName)) {
        moduleLineIndex = i;
        const idx = line.indexOf("--- ");
        moduleDepth = Math.floor(idx / 5);
        break;
      }
    }
    
    if (moduleLineIndex === -1) continue;
    
    const moduleTree = {
      moduleName: moduleName,
      dependencies: []
    };
    
    // 모듈 하위의 의존성들 수집 (원본 라인 그대로)
    for (let i = moduleLineIndex + 1; i < newLines.length; i++) {
      const line = newLines[i];
      const idx = line.indexOf("--- ");
      
      if (idx < 0) continue; // 의존성 라인이 아님
      
      const currentDepth = Math.floor(idx / 5);
      
      // 모듈보다 깊이가 깊지 않으면 모듈 범위 벗어남
      if (currentDepth <= moduleDepth) break;
      
      // 의존성 라인을 그대로 저장 (들여쓰기 포함)
      const parsed = parseLineToCoordinateFlattened(line);
      
      if (parsed && parsed.key && !parsed.key.startsWith("project :")) {
        // 중복 체크 (이미 Added에 있는지)
        const isDuplicate = diff.added.some(existing => existing.key === parsed.key);
        if (!isDuplicate) {
          moduleTree.dependencies.push({
            originalLine: line,
            key: parsed.key,
            version: parsed.resolved,
            depth: currentDepth - moduleDepth // 모듈로부터의 상대적 깊이
          });
        }
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