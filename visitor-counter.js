
(async () => {
    const WORKSPACE = "android-dependency-diff-viewer";
    const TOTAL_KEY = "android-dependency-diff-viewer-counter";
    const TODAY_KEY = "daily-" + new Date().toISOString().slice(0, 10);

    const totalEl = document.getElementById("total-count");
    const todayEl = document.getElementById("today-count");

    // API 응답 파서 (data.up_count 또는 value 대응)
    const parseCount = (j) =>
        (typeof j?.value === "number") ? j.value
            : (typeof j?.data?.up_count === "number") ? j.data.up_count
                : 0;

    // 한 카운터에 대해: 세션 중복이면 GET, 없으면 UP → GET 404면 UP으로 폴백
    async function ensureCount(counterKey, sessionKey) {
        const already = sessionStorage.getItem(sessionKey) === "1";
        const op = already ? "get" : "up";
        let res = await fetch(`https://api.counterapi.dev/v2/${WORKSPACE}/${counterKey}/${op}`);
        if (!res.ok && res.status === 404 && op === "get") {
            // 아직 생성되지 않았던 경우 → up으로 생성
            res = await fetch(`https://api.counterapi.dev/v2/${WORKSPACE}/${counterKey}/up`);
        }
        const json = await res.json();
        if (!already) sessionStorage.setItem(sessionKey, "1");
        return parseCount(json);
    }

    try {
        const [total, today] = await Promise.all([
            ensureCount(TOTAL_KEY, `hit:${WORKSPACE}:${TOTAL_KEY}`),
            ensureCount(TODAY_KEY, `hit:${WORKSPACE}:${TODAY_KEY}`)
        ]);

        totalEl.textContent = total.toLocaleString();
        todayEl.textContent = today.toLocaleString();
    } catch (e) {
        console.error("Counter error:", e);
        totalEl.textContent = "Error";
        todayEl.textContent = "Error";
    }
})();