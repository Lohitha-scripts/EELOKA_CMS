const express = require("express");
const cors = require("cors");
const papersRoutes = require("./src/routes/papers.routes");
const { initPapers } = require("./src/services/paperService");
const { logger } = require("./src/utils/logger");

const app = express();
app.use(cors());

app.use("/api", papersRoutes);

initPapers().then(() => {
    app.listen(3001, () => {
        logger.info("SERVER", "Backend running on http://localhost:3001");
    });
});