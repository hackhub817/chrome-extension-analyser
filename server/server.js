const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const { analyzeContent } = require("./controllers/analyzeController");

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, ".env") });

// Debug log to check if API key is loaded
console.log(
  "API Key status:",
  process.env.OPENAI_API_KEY ? "Present" : "Missing"
);

// Verify API key is loaded
if (!process.env.OPENAI_API_KEY) {
  console.error("ERROR: OPENAI_API_KEY is not set in .env file");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Analysis endpoint
app.get("/", (req, res) => {
  res.send("Hello World");
});
app.post("/api/analyze", analyzeContent);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
console.log("Environment variables:", {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ? "Present" : "Missing",
  PORT: process.env.PORT,
});
app;
