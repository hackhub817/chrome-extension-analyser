document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Get the stored data
    const { reportData } = await chrome.storage.local.get("reportData");

    // Populate the content
    document.getElementById("businessAnalysis").textContent =
      reportData.businessAnalysis;
    document.getElementById("uiuxAnalysis").textContent =
      reportData.uiuxAnalysis;
    document.getElementById("screenshotPreview").src = reportData.screenshot;

    // Add copy functionality to all copy buttons
    const copyButtons = document.querySelectorAll(".copy-button");
    copyButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        // Get the closest analysis box and its content
        const analysisBox = button.closest(".analysis-box");
        const content =
          analysisBox.querySelector(".analysis-content").textContent;
        const title = analysisBox.querySelector("h2").textContent;

        const formattedContent = `
${title}
----------------------------------------
${content}`;

        try {
          await navigator.clipboard.writeText(formattedContent);
          showToast("Content copied to clipboard!");
        } catch (err) {
          console.error("Clipboard API failed:", err);
          // Fallback to execCommand
          const textarea = document.createElement("textarea");
          textarea.value = formattedContent;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          textarea.select();

          try {
            document.execCommand("copy");
            showToast("Content copied to clipboard!");
          } catch (err) {
            console.error("Copy failed:", err);
            showToast("Failed to copy content");
          }
          document.body.removeChild(textarea);
        }
      });
    });
  } catch (error) {
    console.error("Error loading report:", error);
  }
});

function showToast(message) {
  const toast = document.getElementById("toast");
  if (toast) {
    toast.textContent = message;
    toast.style.display = "block";
    setTimeout(() => {
      toast.style.display = "none";
    }, 3000);
  }
}
