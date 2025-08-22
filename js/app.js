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
const codeDiffOnlyDiff = document.getElementById('code-diff-only-diff');
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
  codeDiffOnlyDiff.textContent = "";
  codeDiffFlattened.textContent = "";

  try{
    await new Promise(r => setTimeout(r, 120));
    
    // 각 탭별로 다른 diff 함수 호출
    const diffEnhanced = dependencyTreeDiffEnhanced(oldText, newText);
    const diffOnlyDiff = dependencyOnlyDiff(oldText, newText);
    const diffFlattened = dependencyTreeDiffFlattened(oldText, newText);
    
    codeDiffEnhanced.textContent = diffEnhanced || "변경사항이 없습니다.";
    codeDiffOnlyDiff.textContent = diffOnlyDiff || "변경사항이 없습니다.";
    codeDiffFlattened.textContent = diffFlattened || "변경사항이 없습니다.";
    
    // 각 요소에 대해 Prism 하이라이팅 적용
    Prism.highlightElement(codeDiffEnhanced);
    Prism.highlightElement(codeDiffOnlyDiff);
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
  codeDiffOnlyDiff.textContent = "";
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
const btnScreenshotApp = document.getElementById("btn-screenshot");
const captureAreaEnhanced = document.getElementById("capture-area-enhanced");
const captureAreaOnlyDiff = document.getElementById("capture-area-only-diff");
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

  console.log('캡쳐 대상 요소:', el);
  console.log('요소 내용:', el.textContent?.slice(0, 100));

  const canvas = await html2canvas(el, {
    backgroundColor: "#ffffff",
    scale: 2, // 고해상도
    useCORS: true,
    logging: true,
    allowTaint: false,
    height: el.scrollHeight,
    width: el.scrollWidth
  });

  console.log('캔버스 크기:', canvas.width, 'x', canvas.height);
  
  // 날짜/시간 헤더를 캔버스에 직접 그리기
  const finalCanvas = document.createElement('canvas');
  const ctx = finalCanvas.getContext('2d');
  
  const headerHeight = 80;
  finalCanvas.width = canvas.width;
  finalCanvas.height = canvas.height + headerHeight;
  
  // 배경 그리기
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
  
  // 헤더 텍스트 그리기
  const now = new Date();
  const dateString = now.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit',
    weekday: 'long'
  });
  const timeString = now.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  ctx.fillStyle = '#6b7684';
  ctx.font = '28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Android Dependency Tree Diff Viewer', finalCanvas.width / 2, 35);
  ctx.fillText(`${dateString} ${timeString}`, finalCanvas.width / 2, 65);
  
  // 원본 캔버스 그리기
  ctx.drawImage(canvas, 0, headerHeight);

  return finalCanvas.toDataURL("image/png");
}

async function captureWithDomToImage(el) {
  await new Promise(requestAnimationFrame);
  
  // 캡쳐 영역을 감싸는 컨테이너 생성
  const captureContainer = document.createElement('div');
  captureContainer.style.cssText = `
    background: #ffffff;
    padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  // 날짜/시간 헤더 추가
  const dateHeader = document.createElement('div');
  const now = new Date();
  const dateString = now.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long'
  });
  const timeString = now.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  dateHeader.innerHTML = `
    <div style="text-align: center; margin-bottom: 20px; color: #6b7684; font-size: 14px;">
      Android Dependency Tree Diff Viewer<br>
      ${dateString} ${timeString}
    </div>
  `;

  // 캡쳐 영역 복제
  const clonedArea = el.cloneNode(true);
  
  captureContainer.appendChild(dateHeader);
  captureContainer.appendChild(clonedArea);
  
  // 임시로 body에 추가 (화면에 보이지 않게)
  captureContainer.style.position = 'absolute';
  captureContainer.style.left = '-9999px';
  document.body.appendChild(captureContainer);

  const dataUrl = await window.domtoimage.toPng(captureContainer, {
    bgcolor: "#ffffff",
    quality: 1,
    cacheBust: true,
    style: {
      // hover 효과/트랜지션이 이미지에 섞이지 않도록
      transition: "none",
      animation: "none"
    }
  });

  // 임시 요소 제거
  document.body.removeChild(captureContainer);

  return dataUrl;
}

btnScreenshotApp?.addEventListener("click", async () => {
  try {
    // 현재 활성화된 탭의 캡쳐 영역 선택
    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab) {
      alert('현재 선택된 탭을 찾을 수 없습니다.');
      return;
    }
    
    const activeCaptureArea = activeTab.querySelector('.code-wrap');
    if (!activeCaptureArea) {
      alert('스크린샷을 찍을 영역을 찾을 수 없습니다.');
      return;
    }
    
    // 내용이 있는지 확인
    const codeElement = activeCaptureArea.querySelector('code');
    if (!codeElement || !codeElement.textContent.trim()) {
      alert('비교 결과가 없습니다. 먼저 파일을 업로드하고 비교해주세요.');
      return;
    }
    
    console.log('캡쳐 시작...');
    console.log('캡쳐 영역:', activeCaptureArea);
    console.log('코드 내용 길이:', codeElement.textContent.length);
    
    const activeTabName = activeTab.id.replace('tab-', '');
    
    // dom-to-image 라이브러리 시도
    if (typeof window.domtoimage !== 'undefined') {
      console.log('dom-to-image 사용');
      try {
        const dataUrl = await window.domtoimage.toPng(activeCaptureArea, {
          bgcolor: '#ffffff',
          quality: 1,
          cacheBust: true,
          style: {
            transform: 'scale(1)',
            transformOrigin: 'top left'
          }
        });
        
        console.log('domtoimage DataURL 길이:', dataUrl.length);
        
        if (dataUrl.length > 100) {
          // 날짜/시간 헤더를 추가한 최종 캔버스 생성
          const img = new Image();
          img.onload = () => {
            const finalCanvas = document.createElement('canvas');
            const ctx = finalCanvas.getContext('2d');
            
            const headerHeight = 60;
            finalCanvas.width = img.width;
            finalCanvas.height = img.height + headerHeight;
            
            // 배경 그리기
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
            
            // 헤더 텍스트 그리기
            const now = new Date();
            const dateString = now.toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              weekday: 'long'
            });
            const timeString = now.toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });
            
            ctx.fillStyle = '#6b7684';
            ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Android Dependency Tree Diff Viewer', finalCanvas.width / 2, 25);
            ctx.fillText(`${dateString} ${timeString}`, finalCanvas.width / 2, 45);
            
            // 원본 이미지 그리기
            ctx.drawImage(img, 0, headerHeight);
            
            const finalDataUrl = finalCanvas.toDataURL("image/png");
            const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}-${String(now.getSeconds()).padStart(2,'0')}`;
            const filename = `dependency-diff-${activeTabName}-${dateStr}.png`;
            
            downloadDataUrl(finalDataUrl, filename);
            console.log('dom-to-image로 다운로드 완료');
          };
          img.src = dataUrl;
          return;
        }
      } catch (e) {
        console.warn('dom-to-image 실패:', e);
      }
    }
    
    // html2canvas 재시도 (taint 방지 옵션)
    if (typeof html2canvas === 'function') {
      console.log('html2canvas 재시도');
      try {
        const canvas = await html2canvas(activeCaptureArea, {
          backgroundColor: "#ffffff",
          scale: 1,
          useCORS: false,
          allowTaint: false,
          logging: false,
          ignoreElements: (element) => {
            // 외부 이미지나 iframe 등 제외
            return element.tagName === 'IMG' || element.tagName === 'IFRAME';
          }
        });
        
        console.log('html2canvas 재시도 캔버스:', canvas.width, 'x', canvas.height);
        
        // 새로운 캔버스에 헤더와 함께 그리기
        const finalCanvas = document.createElement('canvas');
        const ctx = finalCanvas.getContext('2d');
        
        const headerHeight = 60;
        finalCanvas.width = canvas.width;
        finalCanvas.height = canvas.height + headerHeight;
        
        // 배경 그리기
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
        
        // 헤더 텍스트 그리기
        const now = new Date();
        const dateString = now.toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          weekday: 'long'
        });
        const timeString = now.toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        
        ctx.fillStyle = '#6b7684';
        ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Android Dependency Tree Diff Viewer', finalCanvas.width / 2, 25);
        ctx.fillText(`${dateString} ${timeString}`, finalCanvas.width / 2, 45);
        
        // 원본 캔버스 그리기
        ctx.drawImage(canvas, 0, headerHeight);
        
        const dataUrl = finalCanvas.toDataURL("image/png");
        console.log('html2canvas 재시도 DataURL 길이:', dataUrl.length);
        
        if (dataUrl.length > 100) {
          const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}-${String(now.getSeconds()).padStart(2,'0')}`;
          const filename = `dependency-diff-${activeTabName}-${dateStr}.png`;
          
          downloadDataUrl(dataUrl, filename);
          console.log('html2canvas 재시도로 다운로드 완료');
          return;
        }
      } catch (e) {
        console.warn('html2canvas 재시도 실패:', e);
      }
    }
    
    // 최후 수단: 텍스트 기반 캔버스
    console.log('최후 수단: 텍스트 기반 캔버스');
    alert('파일이 너무 커서 캡쳐가 불가합니다. 텍스트 기반으로 생성하겠습니다.');
    
    // 기존 텍스트 기반 로직...
    const textContent = codeElement.textContent;
    const lines = textContent.split('\n');
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const fontSize = 12;
    const lineHeight = fontSize * 1.4;
    const padding = 20;
    
    ctx.font = `${fontSize}px 'Monaco', 'Menlo', 'Ubuntu Mono', monospace`;
    
    const maxLineWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
    canvas.width = maxLineWidth + (padding * 2);
    canvas.height = (lines.length * lineHeight) + (padding * 2) + 60;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const now = new Date();
    const dateString = now.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long'
    });
    const timeString = now.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    ctx.fillStyle = '#6b7684';
    ctx.font = `14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Android Dependency Tree Diff Viewer', canvas.width / 2, 25);
    ctx.fillText(`${dateString} ${timeString}`, canvas.width / 2, 45);
    
    ctx.fillStyle = '#000000';
    ctx.font = `${fontSize}px 'Monaco', 'Menlo', 'Ubuntu Mono', monospace`;
    ctx.textAlign = 'left';
    
    lines.forEach((line, index) => {
      const y = 70 + (index * lineHeight);
      
      if (line.startsWith('+')) {
        ctx.fillStyle = '#22863a';
      } else if (line.startsWith('-')) {
        ctx.fillStyle = '#d73a49';
      } else if (line.startsWith('@')) {
        ctx.fillStyle = '#6f42c1';
      } else {
        ctx.fillStyle = '#24292e';
      }
      
      ctx.fillText(line, padding, y);
    });
    
    const dataUrl = canvas.toDataURL("image/png");
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}-${String(now.getSeconds()).padStart(2,'0')}`;
    const filename = `dependency-diff-${activeTabName}-${dateStr}.png`;
    
    downloadDataUrl(dataUrl, filename);
  } catch (error) {
    console.error("스크린샷 오류:", error);
    alert("스크린샷 생성 중 문제가 발생했습니다. 다시 시도해주세요.");
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