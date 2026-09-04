// PS171 Privacy Agent — WXT Popup Logic

document.addEventListener("DOMContentLoaded", async () => {
  const btnScan = document.getElementById("btn-scan") as HTMLButtonElement;
  const btnClear = document.getElementById("btn-clear") as HTMLButtonElement;
  const btnTestLab = document.getElementById("btn-test-lab") as HTMLButtonElement;

  const statFace = document.getElementById("stat-face") as HTMLElement;
  const statPwd = document.getElementById("stat-pwd") as HTMLElement;
  const statPii = document.getElementById("stat-pii") as HTMLElement;
  const statText = document.getElementById("stat-text") as HTMLElement;

  const statLatency = document.getElementById("stat-latency") as HTMLElement;
  const statDevice = document.getElementById("stat-device") as HTMLElement;
  const statusText = document.getElementById("status-text") as HTMLElement;

  const previewPanel = document.getElementById("preview-panel") as HTMLElement;
  const previewImg = document.getElementById("preview-img") as HTMLImageElement;
  const previewCount = document.getElementById("preview-count") as HTMLElement;

  const sliderConf = document.getElementById("slider-conf") as HTMLInputElement;
  const valConf = document.getElementById("val-conf") as HTMLElement;

  const chkFace = document.getElementById("chk-face") as HTMLInputElement;
  const chkPwd = document.getElementById("chk-pwd") as HTMLInputElement;
  const chkPii = document.getElementById("chk-pii") as HTMLInputElement;
  const chkText = document.getElementById("chk-text") as HTMLInputElement;

  // Load saved settings
  const stored = await chrome.storage.local.get([
    "maskStyle",
    "confThreshold",
    "enabledClasses"
  ]);

  if (stored.confThreshold) {
    sliderConf.value = Math.round(stored.confThreshold * 100).toString();
    valConf.textContent = `${sliderConf.value}%`;
  }

  if (stored.maskStyle) {
    const radio = document.querySelector(`input[name="maskStyle"][value="${stored.maskStyle}"]`) as HTMLInputElement;
    if (radio) radio.checked = true;
  }

  if (stored.enabledClasses) {
    chkFace.checked = stored.enabledClasses.face !== false;
    chkPwd.checked = stored.enabledClasses.password_field !== false;
    chkPii.checked = stored.enabledClasses.pii_field !== false;
    chkText.checked = stored.enabledClasses.sensitive_text !== false;
  }

  // Update slider display & persist
  sliderConf.addEventListener("input", () => {
    valConf.textContent = `${sliderConf.value}%`;
    chrome.storage.local.set({ confThreshold: parseInt(sliderConf.value, 10) / 100 });
  });

  document.querySelectorAll('input[name="maskStyle"]').forEach((r) => {
    r.addEventListener("change", (e) => {
      const val = (e.target as HTMLInputElement).value;
      chrome.storage.local.set({ maskStyle: val });
    });
  });

  const saveCheckboxes = () => {
    chrome.storage.local.set({
      enabledClasses: {
        face: chkFace.checked,
        password_field: chkPwd.checked,
        pii_field: chkPii.checked,
        sensitive_text: chkText.checked,
      },
    });
  };

  [chkFace, chkPwd, chkPii, chkText].forEach((c) => c.addEventListener("change", saveCheckboxes));

  // Diagnostic Test Lab Launcher
  btnTestLab.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "OPEN_TEST_LAB" });
  });

  // Clear masks
  btnClear.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "CLEAR_TAB_MASKS" }, () => {
      statFace.textContent = "0";
      statPwd.textContent = "0";
      statPii.textContent = "0";
      statText.textContent = "0";
      previewPanel.classList.add("hidden");
      statusText.textContent = "Cleared";
    });
  });

  // Scan & Protect Tab
  btnScan.addEventListener("click", async () => {
    const selectedMask = (document.querySelector('input[name="maskStyle"]:checked') as HTMLInputElement)?.value || "blur";
    const confThreshold = parseInt(sliderConf.value, 10) / 100;

    const settings = {
      maskStyle: selectedMask,
      confThreshold: confThreshold,
      enabledClasses: {
        face: chkFace.checked,
        password_field: chkPwd.checked,
        pii_field: chkPii.checked,
        sensitive_text: chkText.checked,
      },
    };

    // UI Loading state
    btnScan.disabled = true;
    btnScan.innerHTML = `<span class="btn-icon"></span><span class="btn-text">Scanning Screen...</span>`;
    statusText.textContent = "Scanning...";

    try {
      chrome.runtime.sendMessage({ action: "CAPTURE_AND_DETECT", settings }, (response) => {
        btnScan.disabled = false;
        btnScan.innerHTML = `<span class="btn-icon">[FAST]</span><span class="btn-text">Scan & Protect Tab</span>`;

        if (!response || !response.success) {
          statusText.textContent = "Error";
          alert(response?.error || "Detection failed. Ensure active page is accessible.");
          return;
        }

        const data = response.data;
        statusText.textContent = "Shield Active";

        // Count detections
        const counts = { face: 0, password_field: 0, pii_field: 0, sensitive_text: 0 };
        (data.detections || []).forEach((d: any) => {
          if (counts[d.class_name as keyof typeof counts] !== undefined) {
            counts[d.class_name as keyof typeof counts]++;
          }
        });

        statFace.textContent = counts.face.toString();
        statPwd.textContent = counts.password_field.toString();
        statPii.textContent = counts.pii_field.toString();
        statText.textContent = counts.sensitive_text.toString();

        statLatency.textContent = `${data.client_duration_ms || data.inference_ms || 18} ms`;
        statDevice.textContent = data.device || "WXT Native";

        if (data.screenshot_preview) {
          previewImg.src = data.screenshot_preview;
          previewCount.textContent = `${data.detections?.length || 0} detections`;
          previewPanel.classList.remove("hidden");
        }
      });
    } catch (err: any) {
      btnScan.disabled = false;
      btnScan.innerHTML = `<span class="btn-icon">[FAST]</span><span class="btn-text">Scan & Protect Tab</span>`;
      statusText.textContent = "Error";
      alert(err.message || "Failed to trigger scan");
    }
  });
});
