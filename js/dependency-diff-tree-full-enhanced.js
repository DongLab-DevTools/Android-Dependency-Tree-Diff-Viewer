
/**
 * Gradle dependencies 트리 비교 (브라우저 전용)
 * - 기존(OLD) 트리를 "그대로" 출력하고, 각 라인 앞에 diff 기호만 붙임: ' ' 유지 / '-' 삭제 / '+' 추가·변경
 * - 좌표 비교는 path(부모/깊이)와 무관하게 group:artifact 또는 "project :..." 단위로 수행
 * - 버전 변경은 OLD 라인에 '-'를 붙여 출력 후, 같은 들여쓰기로 NEW 버전을 '+' 라인으로 바로 밑에 추가
 * - project 모듈도 동일 규칙으로 감지
 * - 트리 깊이가 바뀌어도(모듈 추가 등) 동일 좌표면 변경으로 보지 않음 → 가짜 변경 방지
 * - Gradle 하단의 "평탄(플랫) 요약 섹션"과 버전 없는 중복 라인은 자동 무시(특히 버전 없는 ↔ 버전 있는 가짜 변경 제거)
 * - 의존성 추가(OLD에 없고 NEW에만 있는 좌표)는 본문 끝에 "Added (only in after)" 섹션으로 정리
 *
 * 공개 API:
 *   window.dependencyTreeDiff(oldText, newText) -> string
 *   window.diffFiles(beforeFile, afterFile) -> Promise<string>
 */

/* ============================ Public API ============================ */


function dependencyTreeDiff(oldStr, newStr) {
    const oldNodesAll = parseDependencyLines(oldStr);
    const newNodesAll = parseDependencyLines(newStr);

    // 노이즈 정리(버전 없는 중복·평탄 요약 제거)
    const oldNodes = filterNoise(oldNodesAll);
    const newNodes = filterNoise(newNodesAll);

    // NEW 쪽 인덱스 준비
    const {
        versionsById: newVersionsById,
        pairSet: newPairSet,
        idSet: newIdSet
    } = buildIndexes(newNodes);

    const {
        versionsById: oldVersionsById,
        pairSet: oldPairSet,
        idSet: oldIdSet
    } = buildIndexes(oldNodes);

    // 1) 본문: 기존(OLD) 트리 원문 라인 그대로 출력 + 상태 마킹
    let out = "";
    for (const node of oldNodes) {
        const id = node.identity;
        const ver = node.version;
        const pairKey = id + "@" + ver;
        const existsSamePairInNew = newPairSet.has(pairKey);
        const existsIdInNew = newIdSet.has(id);

        if (existsSamePairInNew) {
            // 그대로 유지
            out += " " + node.line + "\n";
        } else if (!existsIdInNew) {
            // 통째로 사라짐
            out += "-" + node.line + "\n";
        } else {
            // 좌표는 존재하나 버전이 바뀜 -> OLD '-' 출력 후 NEW 버전(들) '+' 출력
            out += "-" + node.line + "\n";
            const newVers = Array.from(newVersionsById.get(id) || []);
            for (const nv of newVers) {
                if (nv === ver) continue; // 혹시 동일 버전 섞여 있으면 스킵
                out += "+" + synthesizeLine(node, id, nv) + "\n";
            }
        }
    }

    // 2) Added only in after: OLD에는 없고 NEW에만 있는 좌표들
    const addedLines = [];
    for (const [id, set] of newVersionsById.entries()) {
        if (oldIdSet.has(id)) continue; // 좌표 자체가 OLD에도 있으면 본문에서 처리됨
        for (const ver of set) {
            addedLines.push("+\\--- " + id + (ver ? ":" + ver : ""));
        }
    }
    if (addedLines.length) {
        out += "\n# Added (only in after)\n";
        // 보기 좋게 아이디 → 버전 순 정렬
        addedLines.sort((a, b) => a.localeCompare(b));
        out += addedLines.join("\n") + "\n";
    }

    return out.trimEnd();
}

async function diffFiles(beforeFile, afterFile) {
    const [oldStr, newStr] = await Promise.all([beforeFile.text(), afterFile.text()]);
    return dependencyTreeDiff(oldStr, newStr);
}

// 전역 노출
window.dependencyTreeDiff = dependencyTreeDiff;
window.diffFiles = diffFiles;

/* ============================ Internals ============================ */

// Gradle 라인 파싱: "+--- ...", "\--- ..." 만 수집
function parseDependencyLines(text) {
    const lines = (text || "").split(/\r\n|\n|\r/);
    const nodes = [];

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const idx = raw.indexOf("--- ");
        if (idx < 0) continue;                 // 트리 라인 아님
        // 브랜치 기호 앞쪽(들여쓰기 + '|' 등)을 그대로 유지
        const prefix = raw.substring(0, idx + 4); // e.g. "    |    +--- "
        const content = raw.substring(idx + 4);   // e.g. "group:artifact:1.2.3 (..)"

        // 들여쓰기의 깊이(가짜 변경 필터 힌트용)
        const depth = Math.floor(idx / 5);

        const { id, ver, isProject } = extractIdAndVersion(content);

        nodes.push({
            line: raw,         // 원문 라인 (diff 때 그대로 씀)
            prefix,            // 새 '+' 라인 합성용
            content,           // 좌표 텍스트
            identity: id,      // 비교 키 (group:artifact) 또는 "project :xxx"
            version: ver,      // "" 허용(프로젝트 모듈)
            isProject,
            depth,
        });
    }
    return nodes;
}

// 좌표/버전 정규화
function extractIdAndVersion(content) {
    let s = String(content || "").trim();

    // 괄호 주석류 제거: " ... (c)" / "(*)", "(n)" 등
    s = s.replace(/\s+\(.*\)$/u, "");

    // project 모듈은 버전 없음
    if (s.startsWith("project ")) {
        return { id: s, ver: "", isProject: true };
    }

    // 버전 전이: "a:b:1.0 -> 2.0" 형태면 -> 뒤 버전을 채택
    const arrow = s.indexOf(" -> ");
    if (arrow !== -1) {
        const left = s.substring(0, arrow).trim();     // a:b:1.0
        const right = s.substring(arrow + 4).trim();   // 2.0 ...
        const lastColon = left.lastIndexOf(":");
        const id = lastColon === -1 ? left : left.substring(0, lastColon);
        const ver = right.split(/\s+/)[0];             // 2.0
        return { id, ver, isProject: false };
    }

    // 일반: a:b:1.2.3
    const lastColon = s.lastIndexOf(":");
    if (lastColon === -1) {
        // 비정형 — 안전하게 전체를 id로
        return { id: s, ver: "", isProject: false };
    }
    const id = s.substring(0, lastColon);
    const ver = s.substring(lastColon + 1).split(/\s+/)[0];
    return { id, ver, isProject: false };
}

// 노이즈/중복 제거:
//  - 같은 좌표에 "버전 없는 라인"이 있으며, 어디든 "버전 있는 라인"이 존재하면 버전 없는 라인은 제거
//  - depth==0 에서 같은 (id,ver)가 이전에 한 번이라도 나오면(깊이 무관) 그 라인은 평탄 요약으로 간주하고 제거
//  - project 라인은 절대 제거하지 않음
function filterNoise(nodes) {
    const hasVersionById = new Map(); // id -> true(버전 존재 본 적 있음)
    for (const n of nodes) {
        if (!n.isProject && n.version) hasVersionById.set(n.identity, true);
    }

    const seenPair = new Set(); // id@ver, 이전 출현 여부(깊이 무관)
    const result = [];

    for (const n of nodes) {
        const id = n.identity;
        const ver = n.version;

        // (1) 버전 없는 라인 제거 (동일 좌표에 버전 라인이 하나라도 있으면)
        if (!n.isProject && !ver && hasVersionById.get(id)) {
            continue;
        }

        // (2) 평탄 요약 제거: 최상위(depth==0)에서 이미 동일 (id,ver) 본 적 있으면 drop
        const key = id + "@" + ver;
        if (n.depth === 0) {
            if (seenPair.has(key)) continue;
            seenPair.add(key);
        }

        result.push(n);
    }
    return result;
}

// 인덱스 구성
function buildIndexes(nodes) {
    const versionsById = new Map(); // id -> Set(versions)
    const pairSet = new Set();      // "id@ver"
    const idSet = new Set();      // Set(id)

    for (const n of nodes) {
        idSet.add(n.identity);
        const set = versionsById.get(n.identity) || new Set();
        set.add(n.version);
        versionsById.set(n.identity, set);
        pairSet.add(n.identity + "@" + n.version);
    }
    return { versionsById, pairSet, idSet };
}

// OLD 라인과 동일한 들여쓰기를 유지한 채 NEW 버전 라인 합성
function synthesizeLine(oldNode, id, version) {
    // oldNode.prefix는 "   |    +--- " 같은 트리 접두부까지 포함
    return oldNode.prefix + id + (version ? ":" + version : "");
}