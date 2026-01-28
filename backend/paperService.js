const { discoverDrivePdfs } = require("./driveDiscovery");
const { logger } = require("../utils/logger");

/**
 * Internal in-memory registry
 * DO NOT reassign this array – mutate only
 */
const PAPERS = [];

/**
 * Normalize date string to ISO (YYYY-MM-DD)
 * Input expected: DD-MM-YYYY
 */
function toIsoDate(ddmmyyyy) {
    const [dd, mm, yyyy] = ddmmyyyy.split("-");
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Sort papers newest → oldest
 */
function sortByDateDesc(a, b) {
    return b.isoDate.localeCompare(a.isoDate);
}

/**
 * Refresh papers from Google Drive
 * - Keeps only latest 30
 * - Mutates PAPERS array (important)
 */
async function refreshPapers() {
    logger.info("PAPERS", "Refreshing papers from Google Drive...");

    const files = await discoverDrivePdfs();
    // Expected shape:
    // [{ id, name: "01-01-2026.pdf", webContentLink }]

    const parsed = files
        .map(file => {
            const match = file.name.match(/^(\d{2}-\d{2}-\d{4})\.pdf$/);
            if (!match) return null;

            const ddmmyyyy = match[1];
            return {
                date: ddmmyyyy,
                isoDate: toIsoDate(ddmmyyyy),
                pdfUrl: file.webContentLink
            };
        })
        .filter(Boolean)
        .sort(sortByDateDesc)
        .slice(0, 30); // HARD LIMIT

    PAPERS.length = 0;
    PAPERS.push(...parsed);

    logger.info("PAPERS", `Loaded ${PAPERS.length} papers`);
}

/**
 * PUBLIC API
 */

function getTodayPaper() {
    if (!PAPERS.length) throw new Error("No papers available");
    return PAPERS[0];
}

function getPaperByDate(inputDate) {
    // Accepts YYYY-MM-DD or DD-MM-YYYY
    const iso =
        inputDate.includes("-") && inputDate.length === 10
            ? inputDate.includes(inputDate[2]) // naive but safe here
                ? toIsoDate(inputDate)
                : inputDate
            : inputDate;

    const paper = PAPERS.find(p => p.isoDate === iso);
    if (!paper) throw new Error(`Paper not found for ${inputDate}`);
    return paper;
}

function listPapers({ page = 1, pageSize = 12 } = {}) {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
        papers: PAPERS.slice(start, end),
        total: PAPERS.length,
        page,
        pageSize
    };
}

function getPdfUrlForDate(date) {
    return getPaperByDate(date).pdfUrl;
}

module.exports = {
    refreshPapers,
    getTodayPaper,
    getPaperByDate,
    listPapers,
    getPdfUrlForDate
};
