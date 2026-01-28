const { discoverDrivePdfs, getDiscoveredPapers, getLastRefreshedAt } = require("./driveDiscovery");
const { logger } = require("../utils/logger");

// Auto refresh interval: 30–60 minutes per requirements (default 30).
const REFRESH_INTERVAL_MS = Number(process.env.PAPERS_REFRESH_INTERVAL_MS || 30 * 60 * 1000);
let refreshTimer = null;

async function initPapers() {
    // Initial warm cache before server starts accepting traffic.
    await discoverDrivePdfs();

    // Periodic refresh in background (frontend never blocks on Drive).
    if (!refreshTimer) {
        refreshTimer = setInterval(() => {
            discoverDrivePdfs().catch(err => logger.error("PAPERS", "Auto-refresh failed", err));
        }, REFRESH_INTERVAL_MS);
        refreshTimer.unref?.(); // allow process to exit naturally
        logger.info("PAPERS", `Auto-refresh scheduled every ${Math.round(REFRESH_INTERVAL_MS / 60000)} minutes`);
    }
}

function listPapers() {
    return getDiscoveredPapers();
}

function getPaperByDate(dateIso) {
    return getDiscoveredPapers().find(p => p.date === dateIso) || null;
}

function getTodayPaper() {
    // Strict requirement: Today’s paper = newest available in Drive (by filename date), not "system date".
    const papers = getDiscoveredPapers();
    return papers.length ? papers[0] : null;
}

function getCalendarMonth(year, month) {
    // month is 1-based in API: 1..12
    const mm = String(month).padStart(2, "0");
    const prefix = `${year}-${mm}-`;

    return getDiscoveredPapers().filter(p => p.date.startsWith(prefix));
}

function getMeta() {
    return {
        lastRefreshedAt: getLastRefreshedAt()
            ? getLastRefreshedAt().toISOString()
            : null
    };
}

module.exports = {
    initPapers,
    listPapers,
    getPaperByDate,
    getTodayPaper,
    getCalendarMonth,
    getMeta
};