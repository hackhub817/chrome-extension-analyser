let screenshot = null;
let analysis = null;

function updateUIState(state) {
  const loadingContainer = document.getElementById("loadingContainer");
  const screenshotContainer = document.getElementById("screenshotContainer");
  const actionButton = document.getElementById("actionButton");
  const buttonText = actionButton?.querySelector(".button-text");
  const analyzingGif = actionButton?.querySelector(".analyzing-gif");

  if (!loadingContainer || !screenshotContainer || !actionButton) {
    console.error("Required DOM elements not found");
    return;
  }

  switch (state) {
    case "loading":
      loadingContainer.style.display = "flex";
      screenshotContainer.style.display = "none";
      actionButton.disabled = true;
      if (buttonText) buttonText.textContent = "Analyze";
      if (analyzingGif) analyzingGif.style.display = "none";
      actionButton.classList.remove("analyzing", "view-report");
      break;

    case "screenshot":
      loadingContainer.style.display = "none";
      screenshotContainer.style.display = "block";
      actionButton.disabled = false;
      if (buttonText) buttonText.textContent = "Analyze";
      if (analyzingGif) analyzingGif.style.display = "none";
      actionButton.classList.remove("analyzing", "view-report");
      break;

    case "analyzing":
      loadingContainer.style.display = "none";
      screenshotContainer.style.display = "block";
      actionButton.disabled = true;
      if (buttonText) buttonText.textContent = "Analysing...";
      if (analyzingGif) analyzingGif.style.display = "inline-block";
      actionButton.classList.add("analyzing");
      actionButton.classList.remove("view-report");
      break;

    case "complete":
      loadingContainer.style.display = "none";
      screenshotContainer.style.display = "block";
      actionButton.disabled = false;
      if (buttonText) buttonText.textContent = "View Report";
      if (analyzingGif) analyzingGif.style.display = "none";
      actionButton.classList.remove("analyzing");
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

    const response = await fetch(
      "https://chrome-extension-analyser.onrender.com/api/analyze",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ screenshot }),
      }
    );

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
    throw error;
  }
}

async function displayReport(data) {
  try {
    // Store the data in chrome.storage
    await chrome.storage.local.set({
      reportData: {
        businessAnalysis: data.businessAnalysis,
        uiuxAnalysis: data.uiuxAnalysis,
        screenshot: screenshot,
      },
    });

    // Open report.html in a new tab
    chrome.tabs.create({ url: chrome.runtime.getURL("report.html") });
  } catch (error) {
    console.error("Error creating report:", error);
    throw error;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Popup initialized");

  try {
    await captureScreenshot();
  } catch (error) {
    console.error("Initial screenshot failed:", error);
  }

  const actionButton = document.getElementById("actionButton");
  actionButton.addEventListener("click", async () => {
    try {
      const buttonText = actionButton.querySelector(".button-text");
      if (buttonText.textContent === "Analyze") {
        analysis = await analyzeWebsite(screenshot);
      } else if (buttonText.textContent === "View Report") {
        await displayReport(analysis);
      }
    } catch (error) {
      console.error("Process failed:", error);
    }
  });

  // Add close button handler
  document.getElementById("closeButton").addEventListener("click", () => {
    window.close();
  });
});
