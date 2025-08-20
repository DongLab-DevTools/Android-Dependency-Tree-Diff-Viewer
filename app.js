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

/* ===== 큰 파일 판별 기준 (1MB / 30000줄 / 섹션 10000줄) ===== */
const MAX_BYTES = 1 * 1024 * 1024;          // 1MB
const MAX_LINES = 15000;                 // 전체 라인 수
const MAX_DEP_SECTION_LINES = 5000;     // 의존성 섹션 라인 수

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
  errorBox.style.display = msg ? "block" : "none";
}
function enableCompare(){ btnCompare.disabled = !(oldText && newText); }
function restoreDropVisual(el){ el.style.borderColor = ""; el.style.background = ""; }

function readTxt(file, onLoad){
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => onLoad(e.target.result || "");
  reader.onerror = () => setError("파일을 읽는 중 오류가 발생했습니다.");
  reader.readAsText(file);
}

function wireDropArea(dropEl, inputEl, nameEl, setText){
  const setHas = has => dropEl.classList.toggle('has-file', !!has);

  inputEl.addEventListener('change', () => {
    const f = inputEl.files && inputEl.files[0];
    if (!f) return;
    readTxt(f, txt => {
      setText(txt);
      nameEl.textContent = f.name;
      setHas(true);
      enableCompare();
      setError("");
      updateNotice(); // 선택 업로드 시 공지 갱신
    });
  });

  dropEl.addEventListener('dragover', e => {
    e.preventDefault();
    dropEl.style.borderColor = 'var(--primary-blue)';
    dropEl.style.background = 'var(--primary-blue-light)';
  });
  dropEl.addEventListener('dragleave', e => { e.preventDefault(); restoreDropVisual(dropEl); });
  dropEl.addEventListener('drop', e => {
    e.preventDefault();
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) {
      inputEl.files = e.dataTransfer.files;
      readTxt(f, txt => {
        setText(txt);
        nameEl.textContent = f.name;
        setHas(true);
        enableCompare();
        setError("");
        updateNotice(); // 드롭 업로드 시 공지 갱신 (보완됨)
      });
    }
    restoreDropVisual(dropEl);
  });
}

wireDropArea(dropOld, fileOld, nameOld, txt => oldText = txt);
wireDropArea(dropNew, fileNew, nameNew, txt => newText = txt);

// 비교 실행
btnCompare.addEventListener('click', async () => {
  setError("");
  btnCompare.disabled = true; btnLabel.textContent = "비교 중..."; spinner.style.display = "inline-block";
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
  resultCard.style.display = "none"; codeDiff.textContent = "";
  setError("");
  enableCompare();
  restoreDropVisual(dropOld);
  restoreDropVisual(dropNew);
  updateNotice(); // 리셋 시 공지 숨김
});

// 초기 상태에서도 일관성 있게
updateNotice();