const express = require("express");
const router = express.Router();
const axios = require("axios");
const paperService = require("../services/paperService");

router.get("/papers", (req, res) => {
    res.json({ success: true, data: paperService.listPapers(), meta: paperService.getMeta() });
});

router.get("/papers/today", (req, res) => {
    res.json({ success: true, data: paperService.getTodayPaper() });
});

router.get("/calendar/:year/:month", (req, res) => {
    const year = Number(req.params.year);
    const month = Number(req.params.month);

    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return res.status(400).json({ success: false, error: "Invalid year/month" });
    }

    res.json({ success: true, data: paperService.getCalendarMonth(year, month) });
});

router.get("/papers/:date", (req, res) => {
    const paper = paperService.getPaperByDate(req.params.date);
    if (!paper) {
        return res.status(404).json({ success: false });
    }
    res.json({ success: true, data: paper });
});

router.get("/papers/:date/pdf", (req, res) => {
    const paper = paperService.getPaperByDate(req.params.date);
    if (!paper) return res.sendStatus(404);

    // IMPORTANT:
    // Do NOT redirect to Drive for in-app PDF.js viewing, because Drive blocks cross-origin XHR/fetch.
    // Instead, proxy the bytes through this backend endpoint (same-origin for the frontend).
    axios
        .get(paper.pdfUrl, { responseType: "arraybuffer" })
        .then(r => {
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `inline; filename="${paper.displayDate}.pdf"`);
            res.send(Buffer.from(r.data));
        })
        .catch(() => res.sendStatus(502));
});

// Landing-page previews (backend-generated endpoints, per requirement).
// These URLs are used directly in <img src="..."> so they must never show broken icons.
router.get("/papers/:date/preview", (req, res) => {
    const paper = paperService.getPaperByDate(req.params.date);
    if (!paper) return res.sendStatus(404);
    // Drive thumbnail endpoint works well as a preview image.
    res.redirect(`https://drive.google.com/thumbnail?id=${paper.fileId}&sz=w1200`);
});

router.get("/papers/:date/thumbnail", (req, res) => {
    const paper = paperService.getPaperByDate(req.params.date);
    if (!paper) return res.sendStatus(404);
    res.redirect(`https://drive.google.com/thumbnail?id=${paper.fileId}&sz=w300`);
});

module.exports = router;