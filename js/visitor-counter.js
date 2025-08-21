(async () => {
    const WORKSPACE = "android-dependency-diff-viewer";
    const TOTAL_KEY = "android-dependency-diff-viewer-counter";
    const totalEl = document.getElementById("total-count");

    const parseCount = (j) =>
        (typeof j?.value === "number") ? j.value :
            (typeof j?.data?.up_count === "number") ? j.data.up_count : 0;

    async function getTotal() {
        const res = await fetch(`https://api.counterapi.dev/v2/${WORKSPACE}/${TOTAL_KEY}/up`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return parseCount(await res.json());
    }

    try {
        const total = await getTotal();
        totalEl.textContent = total.toLocaleString();
    } catch (e) {
        console.error("Total counter error:", e);
        totalEl.textContent = "Error";
    }
})();