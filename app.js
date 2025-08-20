let oldText = "", newText = "";

const fileOld   = document.getElementById('file-old');
const fileNew   = document.getElementById('file-new');
const dropOld   = document.getElementById('drop-old');
const dropNew   = document.getElementById('drop-new');
const nameOld   = document.getElementById('name-old');
const nameNew   = document.getElementById('name-new');

const btnCompare = document.getElementById('btn-compare');
const btnLabel   = document.getElementById('btn-label');
const spinner    = document.getElementById('spinner');
const btnReset   = document.getElementById('btn-reset');
const btnCopy    = document.getElementById('btn-copy');

const resultCard = document.getElementById('result-card');
const codeDiff   = document.getElementById('code-diff');
const errorBox   = document.getElementById('error');

const noticeEl = document.getElementById('notice');
const guideSection = document.getElementById('guide-deptree');

const guideToggle = document.querySelector('#guide-deptree .guide-toggle');
const guideContent = document.querySelector('#guide-deptree .guide-content');

/* ===== 큰 파일 판별 기준 (1MB / 15000줄 / 섹션 5000줄) ===== */
const MAX_BYTES = 1 * 1024 * 1024;      // 1MB
const MAX_LINES = 15000;                // 전체 라인 수
const MAX_DEP_SECTION_LINES = 5000;     // 의존성 섹션 라인 수

// 초기엔 숨김
errorBox.classList.add('hidden');

function byteSize(str) {
  return new Blob([str || ""]).size;
}

function countLines(str) {
  if (!str) return 0;
  let n = 1, idx = -1;
  while ((idx = str.indexOf('\n', idx + 1)) !== -1) n++;
  return n;
}

function countDependencySectionLines(str) {
  if (!str) return 0;
  const lines = str.split(/\r\n|\n|\r/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('+--- ') || l.startsWith('\\---')) { start = i; break; }
  }
  if (start === -1) return 0;
  let count = 0;
  for (let i = start; i < lines.length; i++) {
    const l = lines[i];
    if (l.length === 0) break;
    count++;
  }
  return count;
}
function shouldWarn(text) {
  if (!text) return false;
  if (byteSize(text) > MAX_BYTES) return true;
  if (countLines(text) > MAX_LINES) return true;
  if (countDependencySectionLines(text) > MAX_DEP_SECTION_LINES) return true;
  return false;
}
function updateNotice() {
  const warn = shouldWarn(oldText) || shouldWarn(newText);
  noticeEl.classList.toggle('hidden', !warn);
}

function setError(msg){
  errorBox.textContent = msg || "";
  // 메시지가 있으면 표시, 없으면 숨김 (notice와 동일한 hidden 토글)
  errorBox.classList.toggle('hidden', !msg);
}

function enableCompare(){ btnCompare.disabled = !(oldText && newText); }
function restoreDropVisual(el){ el.style.borderColor = ""; el.style.background = ""; }

/* ✅ 파일 형식 검증: .txt 또는 MIME = text/plain */
function isTxtFile(file){
  if (!file) return false;
  if (file.type === "text/plain") return true;          // 가장 신뢰도 높음
  const name = (file.name || "").toLowerCase();
  return name.endsWith(".txt");                          // 일부 브라우저는 type이 빈 문자열인 경우가 있어 확장자 보조
}

function readTxt(file, onLoad){
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => onLoad(e.target.result || "");
  reader.onerror = () => setError("파일을 읽는 중 오류가 발생했습니다.");
  reader.readAsText(file);
}

function wireDropArea(dropEl, inputEl, nameEl, setText){
  const setHas = has => dropEl.classList.toggle('has-file', !!has);

  // input 선택 업로드
  inputEl.addEventListener('change', () => {
    const f = inputEl.files && inputEl.files[0];
    if (!f) return;
    if (!isTxtFile(f)) {
      setError("텍스트 파일(.txt)만 업로드 가능합니다.");
      inputEl.value = "";
      nameEl.textContent = "";
      setHas(false);
      return;
    }
    readTxt(f, txt => {
      setText(txt);
      nameEl.textContent = f.name;
      setHas(true);
      enableCompare();
      setError("");
      updateNotice();
    });
  });

  // 드래그&드롭 업로드
  dropEl.addEventListener('dragover', e => {
    e.preventDefault();
    dropEl.style.borderColor = 'var(--primary-blue)';
    dropEl.style.background = 'var(--primary-blue-light)';
    // e.dataTransfer.dropEffect = 'copy'; // (선택) UX 힌트
  });
  dropEl.addEventListener('dragleave', e => { e.preventDefault(); restoreDropVisual(dropEl); });
  dropEl.addEventListener('drop', e => {
    e.preventDefault();
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) { restoreDropVisual(dropEl); return; }

    if (!isTxtFile(f)) {
      setError("텍스트 파일(.txt)만 업로드 가능합니다.");
      restoreDropVisual(dropEl);
      return; // ❌ 잘못된 형식은 무시
    }

    // 올바른 형식만 처리
    inputEl.files = e.dataTransfer.files; // 선택 업로드와 동일 상태로 맞춰줌
    readTxt(f, txt => {
      setText(txt);
      nameEl.textContent = f.name;
      setHas(true);
      enableCompare();
      setError("");
      updateNotice();
    });
    restoreDropVisual(dropEl);
  });
}

wireDropArea(dropOld, fileOld, nameOld, txt => oldText = txt);
wireDropArea(dropNew, fileNew, nameNew, txt => newText = txt);

// 비교 실행
btnCompare.addEventListener('click', async () => {
  setError("");
  btnCompare.disabled = true; 
  btnLabel.textContent = "비교 중..."; 
  resultCard.style.display = "block";
  guideSection.style.display = "none"; // 결과 있을 땐 가이드 숨김
  spinner.style.display = "inline-block";
  codeDiff.textContent = "";

  try{
    await new Promise(r => setTimeout(r, 120));
    const diff = dependencyTreeDiff(oldText, newText); // dependency-diff.js의 함수
    codeDiff.textContent = diff || "변경사항이 없습니다.";
    Prism.highlightElement(codeDiff);
    resultCard.style.display = "block";
    resultCard.scrollIntoView({behavior:"smooth"});
  }catch(e){
    setError("비교 중 오류가 발생했습니다: " + (e.message || e));
  }finally{
    btnLabel.textContent = "비교하기"; spinner.style.display = "none"; enableCompare();
  }
});

btnCopy.addEventListener('click', async () => {
  try{
    await navigator.clipboard.writeText(codeDiff.textContent || "");
  const old = btnCopy.textContent; btnCopy.textContent = "복사 완료!";
    setTimeout(()=> btnCopy.textContent = old, 1400);
  }catch{ setError("클립보드 복사에 실패했습니다."); }
});

btnReset.addEventListener('click', () => {
  oldText = ""; newText = "";
  fileOld.value = ""; fileNew.value = "";
  nameOld.textContent = ""; nameNew.textContent = "";
  dropOld.classList.remove('has-file'); dropNew.classList.remove('has-file');
  resultCard.style.display = "none";
  codeDiff.textContent = "";
  guideSection.style.display = "block"; // 결과 없으니 가이드 노출

  setError("");
  enableCompare();
  restoreDropVisual(dropOld);
  restoreDropVisual(dropNew);
  updateNotice(); // 리셋 시 공지 갱신
});

guideToggle.addEventListener('click', () => {
  const expanded = guideToggle.getAttribute('aria-expanded') === 'true';
  guideToggle.setAttribute('aria-expanded', !expanded);
  guideContent.style.display = expanded ? 'none' : 'block';
});

// 초기 상태에서도 일관성 있게
updateNotice();