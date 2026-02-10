require("dotenv").config();

const express = require("express");
const cors = require("cors");
const papersRoutes = require("./src/routes/papers.routes");
const { initPapers } = require("./src/services/paperService");
const { logger } = require("./src/utils/logger");

const app = express();

app.use(cors({
    origin: [
        "https://eelokacms-production-b811.up.railway.app",
        "https://eelokacms-production.up.railway.app"
    ],
    methods: ["GET"],
}));
// Railway Health Check & Root Route
app.get("/", (req, res) => res.status(200).send("Backend is running"));
app.get("/health", (req, res) => res.status(200).json({ status: "OK" }));

app.use("/api", papersRoutes);

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
    logger.info("SERVER", `Backend running on port ${PORT}`);

    // Background sync - runs after server is listening
    initPapers()
        .then(() => logger.info("DRIVE", "Initial sync complete"))
        .catch(err => logger.error("DRIVE", err.message));
});