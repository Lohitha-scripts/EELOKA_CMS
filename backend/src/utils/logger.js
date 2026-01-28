const logger = {
  info(scope, msg) {
    console.log(`[INFO] [${scope}] ${msg}`);
  },
  warn(scope, msg) {
    console.warn(`[WARN] [${scope}] ${msg}`);
  },
  error(scope, msg) {
    console.error(`[ERROR] [${scope}] ${msg}`);
  }
};

module.exports = { logger };