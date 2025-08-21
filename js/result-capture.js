// 비교 결과 캡쳐 
// ===== 스크린샷 저장 =====
const btnScreenshot = document.getElementById("btn-screenshot");
const captureArea = document.getElementById("capture-area");

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
    // 우선 html2canvas 시도
    const dataUrl = await captureWithHtml2Canvas(captureArea);
    downloadDataUrl(dataUrl, "dependency-diff.png");
  } catch (e1) {
    console.warn("html2canvas 실패, dom-to-image-more로 폴백:", e1);
    try {
      const dataUrl = await captureWithDomToImage(captureArea);
      downloadDataUrl(dataUrl, "dependency-diff.png");
    } catch (e2) {
      console.error("스크린샷 생성 실패:", e2);
      setError("스크린샷 생성에 실패했습니다. 브라우저를 새로고침 후 다시 시도해 주세요.");
    }
  }
});