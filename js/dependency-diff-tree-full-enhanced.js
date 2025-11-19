/**
 * Gradle dependencies 트리 비교 (브라우저 전용, 전체 트리 + 변경 표시)
 * - 두 트리를 병합해 모든 노드를 출력하고, 앞에 diff 기호만 부여:
 *   ' ' 유지 / '-' 삭제 / '+' 추가 / 버전변경은 '-' old 다음 줄에 '+' new
 * - 좌표 비교는 path/깊이 무관하게 group:artifact 또는 "project :..." 기준
 * - 경로만 바뀐 이동은 변경 아님(동일 좌표 & 버전이면 ' ')
 * - 평탄 요약/버전 없는 중복 라인 제거
 *
 * Public:
 *   window.dependencyTreeDiffEnhanced(oldText, newText) -> string
 *   window.diffFilesEnhanced(beforeFile, afterFile) -> Promise<string>
 */

/* ============================ Public API ============================ */

function dependencyTreeDiffEnhanced(oldStr, newStr) {
  const oldNodesAll = parseDependencyLinesEnhanced(oldStr);
  const newNodesAll = parseDependencyLinesEnhanced(newStr);

  const oldNodes = filterNoiseEnhanced(oldNodesAll);
  const newNodes = filterNoiseEnhanced(newNodesAll);

  const oldTree = buildTreeEnhanced(oldNodes);
  const newTree = buildTreeEnhanced(newNodes);

  return mergeAndFormat(oldTree, newTree).trimEnd();
}

async function diffFilesEnhanced(beforeFile, afterFile) {
  const [oldStr, newStr] = await Promise.all([beforeFile.text(), afterFile.text()]);
  return dependencyTreeDiffEnhanced(oldStr, newStr);
}

window.dependencyTreeDiffEnhanced = dependencyTreeDiffEnhanced;
window.diffFilesEnhanced = diffFilesEnhanced;

/* ============================ Internals ============================ */

// 파싱: 한 줄에 대한 메타
function parseDependencyLinesEnhanced(text) {
  const lines = (text || "").split(/\r\n|\n|\r/);
  const nodes = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    // +--- 또는 \--- 패턴 찾기 (정확한 depth 계산을 위해)
    const match = raw.match(/^([| ]*)[+\\]--- (.+)$/);
    if (!match) continue;

    const indentPart = match[1];  // "+--- " 앞의 들여쓰기 부분
    const content = match[2];      // 의존성 정보

    // depth 계산: 들여쓰기는 5칸 단위 ("|    " 또는 "     ")
    const depth = indentPart.length / 5;

    // 정수가 아니면 잘못된 형식이므로 건너뜀
    if (depth !== Math.floor(depth)) continue;

    const { id, ver, isProject } = extractIdAndVersionEnhanced(content);

    // prefix 재구성: 들여쓰기 + "+--- " 또는 "\--- "
    const connector = raw.includes('+---') ? '+--- ' : '\\--- ';
    const prefix = indentPart + connector;

    nodes.push({
      line: raw,        // 원문 전체 (접두부 포함)
      prefix,           // 접두부 (새 줄 합성용)
      content,          // 좌표 텍스트
      identity: id,     // group:artifact 또는 "project :xxx"
      version: ver,     // "" 허용 (project)
      isProject,
      depth,
    });
  }
  return nodes;
}

// 좌표/버전 정규화
function extractIdAndVersionEnhanced(content) {
  let s = String(content || "").trim();
  s = s.replace(/\s+\(.*\)$/u, ""); // 꼬리 주석 제거

  if (s.startsWith("project ")) {
    return { id: s, ver: "", isProject: true };
  }

  const arrow = s.indexOf(" -> ");
  if (arrow !== -1) {
    const left = s.substring(0, arrow).trim();
    const right = s.substring(arrow + 4).trim();
    const lastColon = left.lastIndexOf(":");
    const id = lastColon === -1 ? left : left.substring(0, lastColon);
    const ver = right.split(/\s+/)[0];
    return { id, ver, isProject: false };
  }

  const lastColon = s.lastIndexOf(":");
  if (lastColon === -1) {
    return { id: s, ver: "", isProject: false };
  }
  const id = s.substring(0, lastColon);
  const ver = s.substring(lastColon + 1).split(/\s+/)[0];
  return { id, ver, isProject: false };
}

// 노이즈 제거 (평탄 요약/버전없는 중복)
function filterNoiseEnhanced(nodes) {
  const hasVersionById = new Map();
  for (const n of nodes) {
    if (!n.isProject && n.version) hasVersionById.set(n.identity, true);
  }

  const seenTop = new Set();
  const result = [];

  for (const n of nodes) {
    if (!n.isProject && !n.version && hasVersionById.get(n.identity)) continue;

    const key = n.identity + "@" + n.version;
    if (n.depth === 0) {
      if (seenTop.has(key)) continue;
      seenTop.add(key);
    }
    result.push(n);
  }
  return result;
}

// 트리 구성 (각 노드는 line/prefix/identity/version/children)
function buildTreeEnhanced(parsed) {
  const root = [];
  const stack = []; // 각 depth의 마지막 노드

  for (const n of parsed) {
    // stack을 깊이에 맞게 정리
    while (stack.length > n.depth) stack.pop();

    const node = {
      identity: n.identity,
      version: n.version,
      line: n.line,
      prefix: n.prefix,
      children: [],
    };

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }
  return root;
}

// 병합 출력: NEW 순서를 기준으로 끼워넣기
function mergeAndFormat(oldChildren, newChildren) {
  let out = "";

  // OLD 인덱스: 같은 부모의 자식들에서 좌표별 목록(원래 순서 유지)
  const oldById = new Map(); // id -> [nodes...]
  for (const o of oldChildren) {
    if (!oldById.has(o.identity)) oldById.set(o.identity, []);
    oldById.get(o.identity).push(o);
  }
  const usedOld = new Set(); // 매칭/소비된 OLD 노드

  // 1) NEW 순서대로 훑으면서 그 자리에 출력
  for (const n of newChildren) {
    const candidates = oldById.get(n.identity) || [];

    // 동일 버전 우선 매칭
    let same = null, sameIdx = -1;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (usedOld.has(c)) continue;
      if (c.version === n.version) { same = c; sameIdx = i; break; }
    }

    if (same) {
      usedOld.add(same);
      // 유지: OLD 라인을 NEW의 자리에서 출력
      out += " " + same.line + "\n";
      out += mergeAndFormat(same.children, n.children);
      continue;
    }

    // 좌표만 같고 버전 다른 경우(버전 변경)
    let diff = null, diffIdx = -1;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (usedOld.has(c)) continue;
      // 동일 좌표 → 버전 변경으로 간주
      diff = c; diffIdx = i; break;
    }

    if (diff) {
      usedOld.add(diff);
      out += "-" + diff.line + "\n";
      out += "+" + n.line + "\n";
      out += mergeAndFormat(diff.children, n.children);
      continue;
    }

    // OLD에 대응 좌표 자체가 없음 → NEW 순수 추가 (그 자리에서 + 서브트리 전체)
    out += emitSubtree(n, "+");
  }

  // 2) NEW에 없어서 매칭 안 된 OLD 노드들 → 삭제
  for (const o of oldChildren) {
    if (usedOld.has(o)) continue;
    out += emitSubtree(o, "-");
  }

  return out;
}

// 서브트리 일괄 출력 (기호 고정)
function emitSubtree(node, sign) {
  let out = sign + node.line + "\n";
  for (const ch of node.children) {
    out += emitSubtree(ch, sign);
  }
  return out;
}