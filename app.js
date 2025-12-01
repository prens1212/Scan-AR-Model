// Simple state
let currentModel3D = null;
let currentModel2D = null;
let currentScale = 1.0;
let currentMarker = null;

function clearContainer(entity) {
  while (entity.firstChild) {
    entity.removeChild(entity.firstChild);
  }
}

function init() {
  const glbInput = document.getElementById("glbInput");
  const jsonInput = document.getElementById("jsonInput");
  const markerInput = document.getElementById("markerInput");
  const clearBtn = document.getElementById("clearBtn");
  const uploadBtn = document.getElementById("uploadBtn");
  const scaleRange = document.getElementById("scaleRange");
  const scaleValue = document.getElementById("scaleValue");
  const animateToggle = document.getElementById("animateToggle");
  const markerPreviewWrapper = document.getElementById("markerPreviewWrapper");
  const markerPreview = document.getElementById("markerPreview");

  const model3dContainer = document.getElementById("model3dContainer");
  const model2dContainer = document.getElementById("model2dContainer");

  scaleRange.addEventListener("input", () => {
    currentScale = parseFloat(scaleRange.value || "1");
    scaleValue.textContent = currentScale.toFixed(1) + "x";
    if (model3dContainer.firstChild) {
      model3dContainer.firstChild.setAttribute(
        "scale",
        `${currentScale} ${currentScale} ${currentScale}`
      );
    }
  });

  // Upload marker image hanya untuk preview / disimpan user.
  markerInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) {
      markerPreviewWrapper.style.display = "none";
      markerPreview.src = "";
      currentMarker = null;
      return;
    }

    const url = URL.createObjectURL(file);
    markerPreview.src = url;
    markerPreviewWrapper.style.display = "flex";
    currentMarker = { url, file };
  });

  function loadFromInputs() {
    const glbFile = glbInput.files && glbInput.files[0];
    const jsonFile = jsonInput.files && jsonInput.files[0];

    // GLB
    if (glbFile) {
      const url = URL.createObjectURL(glbFile);

      // Bersihkan model lama
      clearContainer(model3dContainer);

      const gltfEntity = document.createElement("a-entity");
      gltfEntity.setAttribute("gltf-model", url);
      gltfEntity.setAttribute("scale", `${currentScale} ${currentScale} ${currentScale}`);
      gltfEntity.setAttribute("rotation", "0 0 0");
      gltfEntity.setAttribute("position", "0 0 0");

      model3dContainer.appendChild(gltfEntity);

      currentModel3D = { url, file: glbFile };
    }

    // JSON
    if (jsonFile) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);

          clearContainer(model2dContainer);

          // Sederhana: tampilkan JSON sebagai teks di atas marker
          const textEntity = document.createElement("a-entity");
          const pretty = JSON.stringify(data, null, 2);

          textEntity.setAttribute("text", {
            value: pretty,
            color: "#ffffff",
            align: "center",
            baseline: "top",
            wrapCount: 30,
            width: 2.5,
          });

          textEntity.setAttribute("position", "0 0 0");

          model2dContainer.appendChild(textEntity);

          currentModel2D = { data, file: jsonFile };
        } catch (err) {
          alert("File JSON tidak valid.");
          console.error(err);
        }
      };
      reader.readAsText(jsonFile);
    }
  }

  // Toast notification
  function showToast(message, type = "success") {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    toast.style.display = "block";
    
    setTimeout(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    }, 10);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-20px)";
      setTimeout(() => {
        toast.style.display = "none";
      }, 300);
    }, 3000);
  }

  uploadBtn.addEventListener("click", () => {
    if ((!glbInput.files || !glbInput.files[0]) && (!jsonInput.files || !jsonInput.files[0])) {
      showToast("Pilih dulu file GLB dan/atau JSON.", "error");
      return;
    }
    
    try {
      loadFromInputs();
      
      // Feedback sukses
      const uploadedFiles = [];
      if (glbInput.files && glbInput.files[0]) uploadedFiles.push("Model 3D");
      if (jsonInput.files && jsonInput.files[0]) uploadedFiles.push("Data JSON");
      
      showToast(`✅ Upload berhasil! ${uploadedFiles.join(" & ")} siap ditampilkan di AR.`, "success");
    } catch (err) {
      showToast("❌ Upload gagal. Coba lagi.", "error");
      console.error(err);
    }
  });

  clearBtn.addEventListener("click", () => {
    clearContainer(model3dContainer);
    clearContainer(model2dContainer);
    glbInput.value = "";
    jsonInput.value = "";
    markerInput.value = "";
    currentModel3D = null;
    currentModel2D = null;
    currentMarker = null;
    currentScale = 1.0;
    scaleRange.value = "1";
    scaleValue.textContent = "1.0x";
    animateToggle.checked = false;
    markerPreviewWrapper.style.display = "none";
    markerPreview.src = "";
    showToast("Data telah direset", "info");
  });

  // Tab switching
  const tabUpload = document.getElementById("tabUpload");
  const tabScanner = document.getElementById("tabScanner");
  const uploadCard = document.getElementById("uploadCard");
  const uploadBody = document.getElementById("uploadBody");
  const scannerView = document.getElementById("scannerView");
  const backBtn = document.getElementById("backBtn");

  tabUpload.addEventListener("click", () => {
    tabUpload.classList.add("active");
    tabScanner.classList.remove("active");
    uploadCard.style.display = "block";
    scannerView.style.display = "none";
  });

  tabScanner.addEventListener("click", () => {
    if (!currentModel3D && !currentModel2D) {
      showToast("Upload model dulu sebelum scan AR", "error");
      return;
    }
    tabScanner.classList.add("active");
    tabUpload.classList.remove("active");
    uploadCard.style.display = "none";
    scannerView.style.display = "block";
  });

  backBtn.addEventListener("click", () => {
    tabUpload.classList.add("active");
    tabScanner.classList.remove("active");
    uploadCard.style.display = "block";
    scannerView.style.display = "none";
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}


