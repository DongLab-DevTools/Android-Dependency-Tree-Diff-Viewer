// js/result-markdown-download.js
(function () {
    const btn = document.getElementById('btn-md-download');
    if (!btn) return;

    const nameOldEl = document.getElementById('name-old');
    const nameNewEl = document.getElementById('name-new');

    function nowStamp() {
        const d = new Date();
        const pad = n => String(n).padStart(2, '0');
        return (
            d.getFullYear() +
            '-' + pad(d.getMonth() + 1) +
            '-' + pad(d.getDate()) +
            '_' + pad(d.getHours()) +
            '-' + pad(d.getMinutes()) +
            '-' + pad(d.getSeconds())
        );
    }

    function sanitize(s) {
        return (s || '').replace(/[\\/:*?"<>|]+/g, '_').trim();
    }

    function buildMarkdown(diffText) {
        const beforeName = sanitize(nameOldEl?.textContent || 'before.txt');
        const afterName = sanitize(nameNewEl?.textContent || 'after.txt');
        const generated = new Date().toISOString();

        const header =
            `# Dependency Tree Diff

- Generated: ${generated}
- Files: \`${beforeName}\` ⇄ \`${afterName}\`

`;

        const body = (diffText || '').replace(/\r\n/g, '\n');
        return header + '```diff\n' + body + '\n```' + '\n';
    }

    function download(filename, content) {
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    function flash(btn, text, ms = 1400) {
        const old = btn.textContent;
        btn.textContent = text;
        setTimeout(() => (btn.textContent = old), ms);
    }

    btn.addEventListener('click', () => {
        // 즉시 로딩 표시
        const spinner = document.getElementById('spinner-md');
        const btnText = document.getElementById('btn-md-text');
        const originalBtnText = btnText.textContent;
        
        spinner.style.display = "inline-block";
        btn.disabled = true;
        btnText.textContent = "생성 중...";
        
        // UI 업데이트를 위한 지연 후 처리
        setTimeout(() => {
            try {
                // 현재 활성화된 탭의 코드 영역 찾기
                const activeTab = document.querySelector('.tab-content.active');
                const codeEl = activeTab ? activeTab.querySelector('code') : null;
                
                if (!codeEl) {
                    // 로딩 해제
                    spinner.style.display = "none";
                    btn.disabled = false;
                    btnText.textContent = originalBtnText;
                    
                    flash(btn, '활성 탭을 찾을 수 없어요');
                    return;
                }
                
                const raw = codeEl.textContent || '';
                if (!raw.trim()) {
                    // 로딩 해제
                    spinner.style.display = "none";
                    btn.disabled = false;
                    btnText.textContent = originalBtnText;
                    
                    flash(btn, '내용이 없어요');
                    return;
                }
                
                const md = buildMarkdown(raw);
                const fname = `dependency-diff-${nowStamp()}.md`;
                download(fname, md);
                
                // 로딩 해제
                spinner.style.display = "none";
                btn.disabled = false;
                btnText.textContent = originalBtnText;
                
                flash(btn, '다운로드 완료!');
            } catch (e) {
                console.error(e);
                
                // 로딩 해제
                spinner.style.display = "none";
                btn.disabled = false;
                btnText.textContent = originalBtnText;
                
                flash(btn, '다운로드 실패');
            }
        }, 50);
    });
})();