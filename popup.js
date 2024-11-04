let screenshot = null;
let analysis = null;

function updateUIState(state) {
  const loadingContainer = document.getElementById("loadingContainer");
  const screenshotContainer = document.getElementById("screenshotContainer");
  const analyzingContainer = document.getElementById("analyzingContainer");
  const actionButton = document.getElementById("actionButton");

  switch (state) {
    case "loading":
      loadingContainer.style.display = "flex";
      screenshotContainer.style.display = "none";
      analyzingContainer.style.display = "none";
      actionButton.disabled = true;
      actionButton.textContent = "Analyze";
      actionButton.classList.remove("view-report");
      break;

    case "screenshot":
      loadingContainer.style.display = "none";
      screenshotContainer.style.display = "block";
      analyzingContainer.style.display = "none";
      actionButton.disabled = false;
      actionButton.textContent = "Analyze";
      actionButton.classList.add("analyze");
      break;

    case "analyzing":
      loadingContainer.style.display = "none";
      screenshotContainer.style.display = "block";
      analyzingContainer.style.display = "block";
      actionButton.disabled = true;
      actionButton.textContent = "Analysing...";
      break;

    case "complete":
      loadingContainer.style.display = "none";
      screenshotContainer.style.display = "block";
      analyzingContainer.style.display = "none";
      actionButton.disabled = false;
      actionButton.textContent = "View Report";
      actionButton.classList.remove("analyze");
      actionButton.classList.add("view-report");
      break;
  }
}

async function captureScreenshot() {
  try {
    updateUIState("loading");

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab) {
      throw new Error("No active tab found");
    }

    // First inject html2canvas
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["lib/html2canvas.min.js"],
    });

    // Execute the screenshot capture
    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        return new Promise((resolve, reject) => {
          if (typeof html2canvas === "undefined") {
            reject("html2canvas not found");
            return;
          }

          const element = document.documentElement;
          const options = {
            scale: 1,
            logging: true,
            useCORS: true,
            allowTaint: true,
            foreignObjectRendering: true,
            removeContainer: true,
            backgroundColor: "#ffffff",
            scrollX: 0,
            scrollY: -window.scrollY,
          };

          html2canvas(element, options)
            .then((canvas) => {
              try {
                const dataUrl = canvas.toDataURL("image/png");
                resolve(dataUrl);
              } catch (err) {
                reject("Failed to convert canvas to data URL: " + err);
              }
            })
            .catch((err) => {
              reject("html2canvas failed: " + err);
            });
        });
      },
    });

    if (!result || !result[0]) {
      throw new Error("Screenshot capture failed - no result");
    }

    screenshot = result[0].result;
    if (!screenshot) {
      throw new Error("Screenshot data is empty");
    }

    // Show the preview
    const previewImg = document.getElementById("screenshotPreview");
    previewImg.src = screenshot;
    updateUIState("screenshot");

    return screenshot;
  } catch (error) {
    console.error("Screenshot capture failed:", error);
    throw error;
  }
}

async function analyzeWebsite(screenshot) {
  try {
    updateUIState("analyzing");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000); // 50 second timeout

    const response = await fetch(
      "https://chrome-extension-analyse-api.vercel.app/api/analyze",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ screenshot }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Analysis API Error: ${
          typeof data.error === "object"
            ? JSON.stringify(data.error)
            : data.error || "Unknown error"
        }`
      );
    }

    if (!data.businessAnalysis || !data.uiuxAnalysis) {
      throw new Error("Invalid response format from server");
    }

    updateUIState("complete");

    return {
      businessAnalysis: data.businessAnalysis,
      uiuxAnalysis: data.uiuxAnalysis,
    };
  } catch (error) {
    console.error("Analysis failed:", error);
    updateUIState("screenshot"); // Reset UI state on error

    if (error.name === "AbortError") {
      throw new Error("Analysis request timed out. Please try again.");
    }

    throw error;
  }
}

async function displayReport(data) {
  try {
    const reportHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Analysis Report</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            display: flex;
            min-height: 100vh;
          }

          .report-container {
            flex: 1;
            padding: 24px;
            max-height: 100vh;
            overflow-y: auto;
            background-color: #f5f5f5;
          }

          .screenshot-container {
            flex: 1;
            height: 916px;
            overflow-y: auto;
            border-left: 1px solid #ddd;
            background-color: white;
          }

          .analysis-box {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 16px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }

          .analysis-box h2 {
            color: #333;
            margin-top: 0;
            margin-bottom: 16px;
            padding-bottom: 8px;
            border-bottom: 2px solid #4CAF50;
          }

          .analysis-content {
            white-space: pre-wrap;
            line-height: 1.6;
            color: #444;
          }

          .copy-button {
            position: fixed;
            bottom: 24px;
            left: 24px;
            padding: 12px 24px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }

          .copy-button:hover {
            background-color: #45a049;
            transform: translateY(-2px);
          }

          .screenshot-preview {
            width: 100%;
            height: auto;
            display: block;
          }

          .success-toast {
            position: fixed;
            bottom: 24px;
            right: 24px;
            padding: 12px 24px;
            background-color: #4CAF50;
            color: white;
            border-radius: 8px;
            display: none;
            animation: fadeIn 0.3s ease;
          }

          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        </style>
      </head>
      <body>
        <div class="report-container">
          <div class="analysis-box">
            <h2>Business Goals and Content Analysis</h2>
            <div id="businessAnalysis" class="analysis-content">${data.businessAnalysis}</div>
          </div>

          <div class="analysis-box">
            <h2>UI/UX Analysis and Optimizations</h2>
            <div id="uiuxAnalysis" class="analysis-content">${data.uiuxAnalysis}</div>
          </div>

          <button id="copyButton" class="copy-button">Copy to Clipboard</button>
        </div>

        <div class="screenshot-container">
          <img id="screenshotPreview" class="screenshot-preview" src="${screenshot}" alt="Website Screenshot">
        </div>

        <div id="toast" class="success-toast">Copied to clipboard!</div>

        <script>
          document.getElementById('copyButton').addEventListener('click', async () => {
            const businessAnalysis = document.getElementById('businessAnalysis').innerText;
            const uiuxAnalysis = document.getElementById('uiuxAnalysis').innerText;
            const fullReport = \`Business Goals and Content Analysis\n\n\${businessAnalysis}\n\nUI/UX Analysis and Optimizations\n\n\${uiuxAnalysis}\`;
            
            try {
              await navigator.clipboard.writeText(fullReport);
              const toast = document.getElementById('toast');
              toast.style.display = 'block';
              setTimeout(() => {
                toast.style.display = 'none';
              }, 3000);
            } catch (err) {
              console.error('Failed to copy:', err);
            }
          });
        </script>
      </body>
    </html>
    `;

    const blob = new Blob([reportHTML], { type: "text/html" });
    const reportUrl = URL.createObjectURL(blob);
    chrome.tabs.create({ url: reportUrl });
  } catch (error) {
    console.error("Error creating report:", error);
    throw error;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Popup initialized");

  // Start screenshot capture immediately when popup opens
  try {
    await captureScreenshot();
  } catch (error) {
    console.error("Initial screenshot failed:", error);
  }

  // Add click handler for action button
  const actionButton = document.getElementById("actionButton");
  actionButton.addEventListener("click", async () => {
    try {
      if (actionButton.textContent === "Analyze") {
        analysis = await analyzeWebsite(screenshot);
      } else if (actionButton.textContent === "View Report") {
        await displayReport(analysis);
      }
    } catch (error) {
      console.error("Process failed:", error);
    }
  });
});
