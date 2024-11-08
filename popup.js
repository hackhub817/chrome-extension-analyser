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

async function analyzeWebsite(screenshotimg) {
  try {
    updateUIState("analyzing");

    // Get the screenshot from storage
    const { reportData } = await chrome.storage.local.get("reportData");
    const screenshot = reportData?.screenshot;

    if (!screenshot) {
      throw new Error("Screenshot not found");
    }

    console.log("screenshotimg", screenshot);
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
    console.log("data", data);

    if (!response.ok) {
      throw new Error(
        `Analysis API Error: ${
          typeof data.error === "object"
            ? JSON.stringify(data.error)
            : data.error || "Unknown error"
        }`
      );
    }

    // Store the complete report data
    console.log(
      "businessAnalysis",
      data.businessAnalysis,
      "uiuxAnalysis",
      data.uiuxAnalysis
    );
    await chrome.storage.local.set({
      reportData: {
        businessAnalysis: data.businessAnalysis,
        uiuxAnalysis: data.uiuxAnalysis,
      },
    });

    updateUIState("complete");

    return {
      businessAnalysis: data.businessAnalysis,
      uiuxAnalysis: data.uiuxAnalysis,
    };
  } catch (error) {
    console.error("Analysis failed:", error);
    updateUIState("screenshot");
    throw error;
  }
}

async function displayReport(data) {
  try {
    await chrome.storage.local.set({
      reportData: {
        businessAnalysis: data.businessAnalysis,
        uiuxAnalysis: data.uiuxAnalysis,
        screenshot: screenshot,
      },
    });

    chrome.tabs.create({ url: chrome.runtime.getURL("report.html") });
  } catch (error) {
    console.error("Error creating report:", error);
    throw error;
  }
}

async function captureScreenshot() {
  try {
    console.log("captureScreenshot function called");
    updateUIState("capturing");

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    console.log("Current tab:", tab);

    if (!tab || !tab.url) {
      throw new Error("No active tab found");
    }

    const serverUrl = "http://localhost:3000/api/screenshot";
    console.log("Sending request to:", serverUrl);

    const response = await fetch(serverUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: tab.url }),
    });

    console.log("Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Screenshot failed: ${errorText}`);
    }

    const data = await response.json();
    console.log("Screenshot data received");
    const screenshot = `data:image/png;base64,${data.screenshot}`;
    // Store the screenshot
    await chrome.storage.local.set({
      reportData: {
        screenshot: screenshot,
      },
    });

    // Update UI
    const screenshotPreview = document.getElementById("screenshotPreview");
    if (screenshotPreview) {
      screenshotPreview.src = screenshot;
      screenshotPreview.style.display = "block";
    }

    updateUIState("screenshot");
    return screenshot;
  } catch (error) {
    console.error("Screenshot capture failed:", error);
    updateUIState("error");
    showError(`Screenshot failed: ${error.message}`);
    throw error;
  }
}

function showError(message) {
  console.error("Error:", message);
  const errorElement = document.getElementById("error-message");
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = "block";
    setTimeout(() => {
      errorElement.style.display = "none";
    }, 5000);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM Content Loaded");

  const actionButton = document.getElementById("actionButton");
  if (!actionButton) {
    console.error("Action button not found!");
    return;
  }

  console.log("Action button found");

  actionButton.addEventListener("click", async () => {
    console.log("Action button clicked");

    try {
      const buttonText = actionButton.querySelector(".button-text");
      if (!buttonText) {
        console.error("Button text element not found");
        return;
      }

      console.log("Current button text:", buttonText.textContent);

      if (buttonText.textContent === "Analyze") {
        console.log("Starting screenshot capture...");
        const screenshot = await captureScreenshot();

        if (screenshot) {
          console.log("Screenshot captured, starting analysis...");
          const analysis = await analyzeWebsite(screenshot);
          if (analysis) {
            updateUIState("complete");
          }
        }
      } else if (buttonText.textContent === "View Report") {
        await chrome.tabs.create({ url: "report.html" });
      }
    } catch (error) {
      console.error("Process failed:", error);
      showError("Failed to process the website");
    }
  });

  const closeButton = document.getElementById("closeButton");
  if (closeButton) {
    closeButton.addEventListener("click", () => {
      window.close();
    });
  }
});
