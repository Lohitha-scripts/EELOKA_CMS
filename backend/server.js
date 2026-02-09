require("dotenv").config();

const express = require("express");
const cors = require("cors");
const papersRoutes = require("./src/routes/papers.routes");
const { initPapers } = require("./src/services/paperService");
const { logger } = require("./src/utils/logger");

const app = express();
app.use(cors());

app.use("/api", papersRoutes);

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
    logger.info("SERVER", `Backend running on port ${PORT}`);
});

// background sync
initPapers()
    .then(() => logger.info("DRIVE", "Initial sync complete"))
    .catch(err => logger.error("DRIVE", err.message));