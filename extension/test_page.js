document.addEventListener("DOMContentLoaded", async () => {
  const statusBadge = document.getElementById("status-badge");
  const logOutput = document.getElementById("log-output");
  const btnTestReal = document.getElementById("btn-test-real");
  const btnTestSynthetic = document.getElementById("btn-test-synthetic");
  const btnUpload = document.getElementById("btn-upload");
  const fileInput = document.getElementById("file-input");

  const sliderConf = document.getElementById("slider-conf");
  const valConf = document.getElementById("val-conf");

  const statTime = document.getElementById("stat-time");
  const statCount = document.getElementById("stat-count");
  const statClasses = document.getElementById("stat-classes");

  const imgOrig = document.getElementById("img-orig");
  const imgAnnotated = document.getElementById("img-annotated");

  let lastImageSource = null;

  function log(msg) {
    const time = new Date().toISOString().split("T")[1].slice(0, 8);
    logOutput.textContent += `[${time}] ${msg}\n`;
    logOutput.scrollTop = logOutput.scrollHeight;
  }

  log("Initializing YOLO26 In-Browser Web Worker with Fine-Tuned Privacy Model...");

  try {
    await window.yoloDetector.init("yolo26n.onnx");
    statusBadge.textContent = "[OK] Privacy Model Active (Face, Password, Text)";
    statusBadge.style.borderColor = "#10b981";
    log("[OK] Fine-tuned YOLO26-nano initialized successfully in Web Worker!");
  } catch (e) {
    statusBadge.textContent = "[FAIL] Initialization Error";
    statusBadge.style.color = "#f87171";
    log("[FAIL] Error initializing worker: " + e.message);
  }

  sliderConf.addEventListener("input", async (e) => {
    valConf.textContent = `${e.target.value}%`;
    if (lastImageSource) {
      await runInference(lastImageSource);
    }
  });

  async function runInference(imageSource) {
    lastImageSource = imageSource;
    imgOrig.src = typeof imageSource === "string" ? imageSource : imageSource.src;
    imgOrig.style.display = "block";

    const confThreshold = parseFloat(sliderConf.value) / 100.0;
    log(`Starting in-browser ONNX inference (confidence threshold: ${Math.round(confThreshold * 100)}%)...`);

    const res = await window.yoloDetector.redact(imageSource, { confThreshold, isDiagnostic: true });
    const counts = { face: 0, password_field: 0, pii_field: 0, sensitive_text: 0, input_field: 0, text_block: 0 };
    (res.detections || []).forEach((d) => {
      if (counts[d.class_name] !== undefined) counts[d.class_name]++;
      else counts[d.class_name] = 1;
    });

    document.getElementById("stat-time").textContent = `${res.redact_latency_ms || res.inference_ms || 0} ms`;
    document.getElementById("stat-faces").textContent = counts.face || 0;
    document.getElementById("stat-pwd").textContent = (counts.password_field || 0) + (counts.input_field || 0);
    document.getElementById("stat-pii").textContent = counts.pii_field || 0;
    document.getElementById("stat-text").textContent = (counts.sensitive_text || 0) + (counts.text_block || 0);

    imgAnnotated.src = res.redacted_screenshot;
    imgAnnotated.style.display = "block";

    if (res.detections.length > 0) {
      log("Detected Objects:\n" + JSON.stringify(res.detections, null, 2));
    } else {
      log("No objects above threshold. Try lowering the confidence slider!");
    }
  }

  // 1. Test Sample Login Screen
  btnTestSynthetic.addEventListener("click", async () => {
    btnTestSynthetic.disabled = true;
    try {
      const sampleUrl = chrome.runtime.getURL("assets/sample_login.jpg");
      await runInference(sampleUrl);
    } catch (err) {
      log("Error running test: " + err.message);
    } finally {
      btnTestSynthetic.disabled = false;
    }
  });

  // 2. Real Photo Test Button
  btnTestReal.addEventListener("click", async () => {
    btnTestReal.disabled = true;
    try {
      const sampleUrl = chrome.runtime.getURL("assets/sample_face.jpg");
      await runInference(sampleUrl);
    } catch (err) {
      log("Error running real test: " + err.message);
    } finally {
      btnTestReal.disabled = false;
    }
  });

  // 3. Upload Custom Image
  btnUpload.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      await runInference(event.target.result);
    };
    reader.readAsDataURL(file);
  });
});
