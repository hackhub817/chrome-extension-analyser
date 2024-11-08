const OpenAI = require("openai");
const dotenv = require("dotenv");
const path = require("path");
const puppeteer = require("puppeteer");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error("OpenAI API key not found in environment variables");
}

const openai = new OpenAI({
  apiKey: apiKey,
});

// Add new endpoint for screenshot capture
exports.captureScreenshot = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url, { waitUntil: "networkidle0" });

    const screenshot = await page.screenshot({
      encoding: "base64",
      fullPage: true,
    });

    await browser.close();

    res.json({
      success: true,
      screenshot: screenshot,
    });
  } catch (error) {
    console.error("Screenshot error:", error);
    res.status(500).json({ error: "Failed to capture screenshot" });
  }
};

// Keep existing analyze endpoint unchanged
exports.analyzeContent = async (req, res) => {
  try {
    if (!req.body.screenshot) {
      return res.status(400).json({
        error: "Screenshot data is required",
      });
    }

    const { screenshot } = req.body;

    const [businessAnalysisResponse, uiuxAnalysisResponse] = await Promise.all([
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are an expert content analyzer and marketer with 10+ years of experience.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this website's content and define the business objective. Focus on:
                1. Primary business goals
                2. Target audience
                3. Content effectiveness
                4. Value proposition
                5. Call-to-actions`,
              },
              {
                type: "image_url",
                image_url: {
                  url: screenshot,
                },
              },
            ],
          },
        ],
        max_tokens: 4096,
      }),

      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are a highly critical UI/UX designer with 10+ years of experience.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this website's UI/UX design. Focus on:
                1. Visual hierarchy
                2. Navigation and user flow
                3. Layout effectiveness
                4. Call-to-action placement
                5. Mobile responsiveness
                6. Accessibility`,
              },
              {
                type: "image_url",
                image_url: {
                  url: screenshot,
                },
              },
            ],
          },
        ],
        max_tokens: 4096,
      }),
    ]);

    return res.status(200).json({
      businessAnalysis: businessAnalysisResponse.choices[0].message.content,
      uiuxAnalysis: uiuxAnalysisResponse.choices[0].message.content,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    return res.status(500).json({
      error: error.message || "An internal server error occurred",
    });
  }
};
