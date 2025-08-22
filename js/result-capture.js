// 비교 결과 캡쳐 
// ===== 스크린샷 저장 =====
const btnScreenshotCapture = document.getElementById("btn-screenshot");

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

  const canvas = await html2canvas(captureContainer, {
    backgroundColor: "#ffffff",
    scale: window.devicePixelRatio > 1 ? 2 : 1, // 고해상도
    useCORS: true,
    logging: false
  });

  // 임시 요소 제거
  document.body.removeChild(captureContainer);

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

// 이벤트 리스너는 app.js에서 처리하므로 제거