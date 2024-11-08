const express = require("express");
const router = express.Router();
const analyzeController = require("../controllers/analyzeController");

router.post("/analyze", analyzeController.analyzeContent);
router.post("/screenshot", analyzeController.captureScreenshot);

module.exports = router;
