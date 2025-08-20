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
    readTxt(f, txt => { setText(txt); nameEl.textContent = f.name; setHas(true); enableCompare(); setError(""); });
  });
  dropEl.addEventListener('dragover', e => { e.preventDefault(); dropEl.style.borderColor = 'var(--primary-blue)'; dropEl.style.background = 'var(--primary-blue-light)'; });
  dropEl.addEventListener('dragleave', e => { e.preventDefault(); restoreDropVisual(dropEl); });
  dropEl.addEventListener('drop', e => {
    e.preventDefault();
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) { inputEl.files = e.dataTransfer.files; readTxt(f, txt => { setText(txt); nameEl.textContent = f.name; setHas(true); enableCompare(); setError(""); }); }
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
    // diffCore.js의 dependencyTreeDiff 사용
    const diff = dependencyTreeDiff(oldText, newText);
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
  setError(""); enableCompare();
  restoreDropVisual(dropOld); restoreDropVisual(dropNew);
});