// js/result-markdown-download.js
(function () {
    const btn = document.getElementById('btn-md-download');
    const codeEl = document.getElementById('code-diff');
    if (!btn || !codeEl) return;

    const nameOldEl = document.getElementById('name-old');
    const nameNewEl = document.getElementById('name-new');

    function nowStamp() {
        const d = new Date();
        const pad = n => String(n).padStart(2, '0');
        return (
            d.getFullYear() +
            pad(d.getMonth() + 1) +
            pad(d.getDate()) +
            '-' +
            pad(d.getHours()) +
            pad(d.getMinutes()) +
            pad(d.getSeconds())
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
        const raw = codeEl.textContent || '';
        if (!raw.trim()) {
            flash(btn, '내용이 없어요');
            return;
        }
        const md = buildMarkdown(raw);
        const fname = `dependency-diff-${nowStamp()}.md`;
        try {
            download(fname, md);
            flash(btn, '다운로드 완료!');
        } catch (e) {
            console.error(e);
            flash(btn, '다운로드 실패');
        }
    });
})();