// Kotlin: dependency-tree-diff 알고리즘을 브라우저 JS로 포팅

function dependencyTreeDiffOriginal(oldStr, newStr){
  const oldPaths = findDependencyPathsOriginal(oldStr);
  const newPaths = findDependencyPathsOriginal(newStr);
  const removedTree = buildTreeOriginal(pathsMinusOriginal(oldPaths, newPaths));
  const addedTree   = buildTreeOriginal(pathsMinusOriginal(newPaths, oldPaths));
  return appendDiffOriginal(removedTree, addedTree, "");
}

function splitLinesOriginal(s){ return (s||"").split(/\r\n|\n|\r/); }

// 원본 findDependencyPaths
function findDependencyPathsOriginal(text){
  const linesAll = splitLinesOriginal(text);

  // dropWhile { !startsWith("+--- ") && !startsWith("\---") }
  let start = -1;
  for (let i=0;i<linesAll.length;i++){
    const l = linesAll[i];
    if (l.startsWith("+--- ") || l.startsWith("\\---")) { start = i; break; }
  }
  if (start === -1) return []; // 의존성 섹션이 없음

  const afterStart = linesAll.slice(start);

  // takeWhile { it.isNotEmpty() }
  let end = afterStart.findIndex(l => l.length === 0);
  const dependencyLines = (end === -1 ? afterStart : afterStart.slice(0, end));

  const paths = [];
  const stack = [];
  for (const dependencyLine of dependencyLines){
    const coordinateStart = dependencyLine.indexOf("--- ");
    if (coordinateStart <= 0) { throw new Error("Unable to find coordinate delimiter: " + dependencyLine); }
    const coordinates = dependencyLine.substring(coordinateStart + 4);

    const coordinateDepth = Math.floor(coordinateStart / 5);
    if (stack.length > coordinateDepth){
      // 현재 브랜치 저장
      paths.push(stack.slice());
      // 깊이에 맞춰 pop
      for (let i=coordinateDepth; i<stack.length; i++) stack.pop();
    }
    stack.push(coordinates);
  }

  // 마지막 경로도 잊지 말고 저장
  if (stack.length) paths.push(stack.slice());

  return paths; // Array<List<String>>
}

class NodeOriginal{
  constructor(coordinate, versionInfo){ this.coordinate = coordinate; this.versionInfo = versionInfo; this.children = []; }
  toString(){ return `${this.coordinate}:${this.versionInfo}`; }
}

// 원본 buildTree
function buildTreeOriginal(paths){
  const root = [];
  for (const path of paths){
    let nodes = root;
    for (const nodeStr of path){
      const lastColon = nodeStr.lastIndexOf(':');
      const coordinate = nodeStr.substring(0, lastColon);
      const versionInfo = nodeStr.substring(lastColon + 1);

      let found = null;
      for (const n of nodes){
        if (n.coordinate === coordinate && n.versionInfo === versionInfo){ found = n; break; }
      }
      if (found){
        nodes = found.children;
      } else {
        const nn = new NodeOriginal(coordinate, versionInfo);
        nodes.push(nn);
        nodes = nn.children;
      }
    }
  }
  return root;
}

// Set<List<String>> 차집합과 동일한 효과
function pathsMinusOriginal(a, b){
  const key = p => p.join("\u0001");
  const bset = new Set(b.map(key));
  return a.filter(p => !bset.has(key(p)));  // ✅ Fixed: key(p) 호출 추가
}

function treesEqualOriginal(a, b){
  if (a.length !== b.length) return false;
  for (let i=0;i<a.length;i++){
    const x=a[i], y=b[i];
    if (x.coordinate !== y.coordinate || x.versionInfo !== y.versionInfo) return false;
    if (!treesEqualOriginal(x.children, y.children)) return false;
  }
  return true;
}

// 원본 append 계열
function appendNodeOriginal(diffChar, indent, item, last){
  let out = "";
  out += diffChar;
  out += indent;
  out += (last ? "\\" : "+");
  out += "--- ";
  out += String(item);
  out += "\n";
  const carryChar = last ? ' ' : '|';
  const nextIndent = indent + carryChar + "    ";
  return { out, nextIndent };
}

function appendAddedOriginal(node, indent, last){
  const { out, nextIndent } = appendNodeOriginal('+', indent, node, last);
  return out + appendDiffOriginal([], node.children, nextIndent);
}
function appendRemovedOriginal(node, indent, last){
  const { out, nextIndent } = appendNodeOriginal('-', indent, node, last);
  return out + appendDiffOriginal(node.children, [], nextIndent);
}

function appendDiffOriginal(oldTree, newTree, indent){
  let out = "";
  let oldIndex = 0, newIndex = 0;
  while (oldIndex < oldTree.length && newIndex < newTree.length){
    const oldNode = oldTree[oldIndex];
    const newNode = newTree[newIndex];
    if (oldNode.coordinate === newNode.coordinate){
      if (oldNode.versionInfo === newNode.versionInfo){
        const last = (oldIndex === oldTree.length - 1) && (newIndex === newTree.length - 1);
        const r = appendNodeOriginal(' ', indent, oldNode, last);
        out += r.out;
        out += appendDiffOriginal(oldNode.children, newNode.children, r.nextIndent);
      }else{
        // 최적화: 자식이 동일하면 생략
        const childrenChanged = !treesEqualOriginal(oldNode.children, newNode.children);
        const rOld = appendNodeOriginal('-', indent, oldNode, (oldIndex === oldTree.length - 1));
        out += rOld.out;
        if (childrenChanged) out += appendDiffOriginal(oldNode.children, [], rOld.nextIndent);
        const rNew = appendNodeOriginal('+', indent, newNode, (newIndex === newTree.length - 1));
        out += rNew.out;
        if (childrenChanged) out += appendDiffOriginal([], newNode.children, rOld.nextIndent);
      }
      oldIndex++; newIndex++;
    } else if (oldNode.coordinate < newNode.coordinate){
      out += appendRemovedOriginal(oldNode, indent, (oldIndex === oldTree.length - 1));
      oldIndex++;
    } else {
      out += appendAddedOriginal(newNode, indent, (newIndex === newTree.length - 1));
      newIndex++;
    }
  }
  for (let i=oldIndex;i<oldTree.length;i++) out += appendRemovedOriginal(oldTree[i], indent, (i === oldTree.length - 1));
  for (let i=newIndex;i<newTree.length;i++) out += appendAddedOriginal(newTree[i], indent, (i === newTree.length - 1));
  return out;
}