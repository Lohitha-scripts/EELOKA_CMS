const axios = require("axios");
const { google } = require("googleapis");
const { logger } = require("../utils/logger");

const DRIVE_API_KEY = process.env.DRIVE_API_KEY;
const FOLDER_ID = process.env.DRIVE_FOLDER_ID;


const DRIVE_API_URL = "https://www.googleapis.com/drive/v3/files";

const MAX_PAPERS = 30;

// Cache is the ONLY data source for all API responses (Drive is source of truth; cache is performance layer).
let cachedPapers = [];
let lastRefreshedAt = null;
let refreshInFlight = null;

function parsePaperFromFilename(file) {
    // Expected: DD-MM-YYYY.pdf
    const match = file.name.match(/^(\d{2})-(\d{2})-(\d{4})\.pdf$/);
    if (!match) return null;

    const isoDate = `${match[3]}-${match[2]}-${match[1]}`;

    return {
        date: isoDate, // YYYY-MM-DD (used as canonical key)
        displayDate: `${match[1]}-${match[2]}-${match[3]}`, // DD-MM-YYYY (matches filename w/o extension)
        fileId: file.id,
        pdfUrl: `https://drive.google.com/uc?export=download&id=${file.id}`
    };
}

function sortByDateDesc(a, b) {
    return b.date.localeCompare(a.date);
}

function getDriveAuthedClientIfConfigured() {
    // Retention requires delete permission => needs OAuth / Service Account with Drive scope.
    // Supported configuration:
    // - GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json  (recommended)
    // - GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
    try {
        const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
        const auth = new google.auth.GoogleAuth({
            credentials: json ? JSON.parse(json) : undefined,
            scopes: ["https://www.googleapis.com/auth/drive"]
        });
        // If neither env is set, GoogleAuth will still exist but will fail when requesting a token.
        return google.drive({ version: "v3", auth });
    } catch (e) {
        logger.error("DRIVE", "Invalid GOOGLE_SERVICE_ACCOUNT_JSON; retention deletions will fail.", e);
        return null;
    }
}

async function listFolderPdfs() {
    // Listing can be done with API key (fast + simple), so keep it even if auth isn't configured.
    const res = await axios.get(DRIVE_API_URL, {
        params: {
            key: DRIVE_API_KEY,
            q: `'${FOLDER_ID}' in parents and mimeType='application/pdf' and trashed=false`,
            // createdTime isn't the source of truth for "today"; filename date is.
            fields: "files(id,name,createdTime)",
            pageSize: 1000
        }
    });
    return res.data.files || [];
}

async function deleteFilesFromDrive(fileIds) {
    if (!fileIds.length) return;

    const drive = getDriveAuthedClientIfConfigured();
    if (!drive) throw new Error("Drive client not configured for deletes");

    // Execute sequentially to be gentle on quota and simplify error handling.
    for (const fileId of fileIds) {
        try {
            await drive.files.delete({ fileId });
            logger.info("RETENTION", `Deleted old PDF from Drive: ${fileId}`);
        } catch (e) {
            // Do not abort entire refresh if one delete fails; log and continue.
            logger.error("RETENTION", `Failed deleting fileId=${fileId}`, e);
        }
    }
}

/**
 * Discover PDFs from Drive, then:
 * - Parse dates strictly from filenames (DD-MM-YYYY.pdf)
 * - Sort by date (newest first)
 * - Enforce MAX_PAPERS retention by deleting the oldest from Drive
 * - Cache results in memory for fast API responses
 */
async function discoverDrivePdfs() {
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = (async () => {
        logger.info("DRIVE", "Refreshing papers cache from Google Drive");

        const files = await listFolderPdfs();

        const parsed = files
            .map(parsePaperFromFilename)
            .filter(Boolean)
            .sort(sortByDateDesc);

        // Retention: keep only the latest MAX_PAPERS in Drive itself.
        const toKeep = parsed.slice(0, MAX_PAPERS);
        const toDelete = parsed.slice(MAX_PAPERS);

        if (toDelete.length > 0) {
            logger.info(
                "RETENTION",
                `Enforcing max ${MAX_PAPERS} papers: deleting ${toDelete.length} old PDFs from Drive`
            );

            // If auth isn't configured, we can't satisfy the strict retention requirement.
            // We still serve only MAX_PAPERS to the UI, but we log loudly so it gets fixed.
            try {
                await deleteFilesFromDrive(toDelete.map(p => p.fileId));
            } catch (e) {
                logger.error(
                    "RETENTION",
                    "Retention deletion requires Drive OAuth/service-account credentials. " +
                        "Set GOOGLE_APPLICATION_CREDENTIALS (recommended) or GOOGLE_SERVICE_ACCOUNT_JSON.",
                    e
                );
            }
        }

        cachedPapers = toKeep;
        lastRefreshedAt = new Date();

        logger.info("DRIVE", `Cache loaded: ${cachedPapers.length} papers`);
    })().finally(() => {
        refreshInFlight = null;
    });

    return refreshInFlight;
}

function getDiscoveredPapers() {
    return cachedPapers;
}

function getLastRefreshedAt() {
    return lastRefreshedAt;
}

module.exports = {
    discoverDrivePdfs,
    getDiscoveredPapers,
    getLastRefreshedAt,
    MAX_PAPERS
};
