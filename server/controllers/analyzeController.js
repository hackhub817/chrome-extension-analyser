const OpenAI = require("openai");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables again to ensure availability
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error("OpenAI API key not found in environment variables");
}

// Create OpenAI instance with explicit API key
const openai = new OpenAI({
  apiKey: apiKey, // Explicitly pass the API key
});

exports.analyzeContent = async (req, res) => {
  try {
    const { screenshot } = req.body;

    // Business Analysis
    const businessAnalysisResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an expert content analyzer and marketer with 10+ years of experience. You are highly critical and are frustrated by the poor state of content in today's time.",
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
              5. Call-to-actions
              
              Provide specific recommendations for content optimization.`,
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
    });

    const businessGoal = businessAnalysisResponse.choices[0].message.content;

    // UI/UX Analysis
    const uiuxAnalysisResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a highly critical and detail oriented ui/ux designer with 10+ years of experience.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this website's UI/UX design considering this business goal: ${businessGoal}
              
              Focus on:
              1. Visual hierarchy
              2. Navigation and user flow
              3. Layout effectiveness
              4. Call-to-action placement
              5. Mobile responsiveness
              6. Accessibility
              
              Provide specific, tactical UI/UX improvement recommendations.`,
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
    });

    res.json({
      businessAnalysis: businessAnalysisResponse.choices[0].message.content,
      uiuxAnalysis: uiuxAnalysisResponse.choices[0].message.content,
    });
  } catch (error) {
    console.error("Analysis error:", error);
    res.status(500).json({ error: error.message });
  }
};
