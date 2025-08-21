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
const codeDiffEnhanced = document.getElementById('code-diff-enhanced');
const codeDiffOriginal = document.getElementById('code-diff-original');
const codeDiffFlattened = document.getElementById('code-diff-flattened');
const errorBox   = document.getElementById('error');

// 탭 관련 요소들
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

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
  codeDiffEnhanced.textContent = "";
  codeDiffOriginal.textContent = "";
  codeDiffFlattened.textContent = "";

  try{
    await new Promise(r => setTimeout(r, 120));
    
    // 각 탭별로 다른 diff 함수 호출
    const diffEnhanced = dependencyTreeDiffEnhanced(oldText, newText);
    const diffOriginal = dependencyTreeDiffOriginal(oldText, newText);
    const diffFlattened = dependencyTreeDiffFlattened(oldText, newText);
    
    codeDiffEnhanced.textContent = diffEnhanced || "변경사항이 없습니다.";
    codeDiffOriginal.textContent = diffOriginal || "변경사항이 없습니다.";
    codeDiffFlattened.textContent = diffFlattened || "변경사항이 없습니다.";
    
    // 각 요소에 대해 Prism 하이라이팅 적용
    Prism.highlightElement(codeDiffEnhanced);
    Prism.highlightElement(codeDiffOriginal);
    Prism.highlightElement(codeDiffFlattened);
    
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
    // 현재 활성화된 탭의 내용을 복사
    const activeTab = document.querySelector('.tab-content.active');
    const activeCode = activeTab.querySelector('code');
    await navigator.clipboard.writeText(activeCode.textContent || "");
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
  codeDiffEnhanced.textContent = "";
  codeDiffOriginal.textContent = "";
  codeDiffFlattened.textContent = "";
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


// 비교 결과 캡쳐 
// ===== 스크린샷 저장 =====
const btnScreenshot = document.getElementById("btn-screenshot");
const captureAreaEnhanced = document.getElementById("capture-area-enhanced");
const captureAreaOriginal = document.getElementById("capture-area-original");
const captureAreaFlattened = document.getElementById("capture-area-flattened");

// 유틸: 다운로드
function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function captureWithHtml2Canvas(el) {
  // 렌더 안정화(프리즘 하이라이트 직후 등): 한 프레임 대기
  await new Promise(requestAnimationFrame);
  if (typeof html2canvas !== "function") {
    throw new Error("html2canvas not loaded");
  }
  const canvas = await html2canvas(el, {
    backgroundColor: window.matchMedia("(prefers-color-scheme: dark)").matches ? "#111827" : "#ffffff",
    scale: window.devicePixelRatio > 1 ? 2 : 1, // 고해상도
    useCORS: true,
    logging: false
  });
  return canvas.toDataURL("image/png");
}

async function captureWithDomToImage(el) {
  await new Promise(requestAnimationFrame);
  const dataUrl = await window.domtoimage.toPng(el, {
    bgcolor: window.matchMedia("(prefers-color-scheme: dark)").matches ? "#111827" : "#ffffff",
    quality: 1,
    cacheBust: true,
    style: {
      // hover 효과/트랜지션이 이미지에 섞이지 않도록
      transition: "none",
      animation: "none"
    }
  });
  return dataUrl;
}

btnScreenshot?.addEventListener("click", async () => {
  try {
    // 현재 활성화된 탭의 캡쳐 영역 선택
    const activeTab = document.querySelector('.tab-content.active');
    const activeCaptureArea = activeTab.querySelector('.code-wrap');
    const activeTabName = activeTab.id.replace('tab-', '');
    
    // 우선 html2canvas 시도
    const dataUrl = await captureWithHtml2Canvas(activeCaptureArea);
    downloadDataUrl(dataUrl, `dependency-diff-${activeTabName}.png`);
  } catch (e1) {
    console.warn("html2canvas 실패, dom-to-image-more로 폴백:", e1);
    try {
      const activeTab = document.querySelector('.tab-content.active');
      const activeCaptureArea = activeTab.querySelector('.code-wrap');
      const activeTabName = activeTab.id.replace('tab-', '');
      
      const dataUrl = await captureWithDomToImage(activeCaptureArea);
      downloadDataUrl(dataUrl, `dependency-diff-${activeTabName}.png`);
    } catch (e2) {
      console.error("스크린샷 생성 실패:", e2);
      setError("스크린샷 생성에 실패했습니다. 브라우저를 새로고침 후 다시 시도해 주세요.");
    }
  }
});

// 탭 이벤트 리스너 추가
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetTab = btn.getAttribute('data-tab');
    
    // 모든 탭 버튼에서 active 제거
    tabBtns.forEach(b => b.classList.remove('active'));
    // 모든 탭 컨텐츠에서 active 제거
    tabContents.forEach(content => content.classList.remove('active'));
    
    // 클릭된 탭 버튼과 해당 컨텐츠에 active 추가
    btn.classList.add('active');
    document.getElementById(`tab-${targetTab}`).classList.add('active');
  });
});

// 초기 상태에서도 일관성 있게
updateNotice();