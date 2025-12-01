// Simple state
let currentModel3D = null;
let currentModel2D = null;
let currentScale = 1.0;
let currentMarker = null;
let isAdminLoggedIn = false;
let activeModelId = null; // ID model yang aktif di AR
const ADMIN_PASSWORD = "admin123"; // Ganti dengan password yang diinginkan

// Generate unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

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

  function loadModelToAR(glbUrl, jsonData, scale) {
    // Bersihkan model lama
    clearContainer(model3dContainer);
    clearContainer(model2dContainer);

    // GLB
    if (glbUrl) {
      const gltfEntity = document.createElement("a-entity");
      gltfEntity.setAttribute("gltf-model", glbUrl);
      gltfEntity.setAttribute("scale", `${scale} ${scale} ${scale}`);
      gltfEntity.setAttribute("rotation", "0 0 0");
      gltfEntity.setAttribute("position", "0 0 0");
      model3dContainer.appendChild(gltfEntity);
    }

    // JSON
    if (jsonData) {
      const textEntity = document.createElement("a-entity");
      const pretty = JSON.stringify(jsonData, null, 2);
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
    }
  }

  function loadFromInputs() {
    return new Promise((resolve, reject) => {
      const glbFile = glbInput.files && glbInput.files[0];
      const jsonFile = jsonInput.files && jsonInput.files[0];

      let glbUrl = null;
      let jsonData = null;
      let glbBase64 = null;
      let promises = [];

      // GLB - convert ke base64 untuk disimpan
      if (glbFile) {
        glbUrl = URL.createObjectURL(glbFile);
        currentModel3D = { url: glbUrl, file: glbFile };
        
        // Convert ke base64 untuk storage
        const glbReader = new FileReader();
        promises.push(new Promise((res) => {
          glbReader.onload = () => {
            glbBase64 = glbReader.result;
            currentModel3D.base64 = glbBase64;
            res();
          };
          glbReader.onerror = reject;
          glbReader.readAsDataURL(glbFile);
        }));
      }

      // JSON
      if (jsonFile) {
        const jsonReader = new FileReader();
        promises.push(new Promise((res, rej) => {
          jsonReader.onload = () => {
            try {
              jsonData = JSON.parse(jsonReader.result);
              currentModel2D = { data: jsonData, file: jsonFile };
              res();
            } catch (err) {
              showToast("File JSON tidak valid.", "error");
              rej(err);
            }
          };
          jsonReader.onerror = rej;
          jsonReader.readAsText(jsonFile);
        }));
      }

      Promise.all(promises).then(() => {
        // Load ke AR
        loadModelToAR(glbUrl, jsonData, currentScale);
        resolve();
      }).catch(reject);
    });
  }

  // Firebase Functions
  // Check if Firebase is available
  function isFirebaseAvailable() {
    return false;
  }

  // Get storage and db references
  const storage = null;
  const db = null;

  // Get all models from Firebase Firestore
  async function getAllModels() {
    if (!isFirebaseAvailable()) {
      // Fallback to localStorage
      try {
        const modelsJson = localStorage.getItem("arModels");
        return modelsJson ? JSON.parse(modelsJson) : [];
      } catch (err) {
        console.error("Error loading models:", err);
        return [];
      }
    }

    try {
      if (!db) {
        throw new Error("Firestore tidak tersedia");
      }
      const snapshot = await db.collection('arModels').orderBy('createdAt', 'desc').get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (err) {
      console.error("Error loading models from Firebase:", err);
      showToast("Gagal memuat model dari cloud", "error");
      // Fallback to localStorage
      try {
        const modelsJson = localStorage.getItem("arModels");
        return modelsJson ? JSON.parse(modelsJson) : [];
      } catch (e) {
        return [];
      }
    }
  }

  // Upload file to Firebase Storage
  async function uploadFileToFirebase(file, path) {
    if (!isFirebaseAvailable() || !storage) {
      throw new Error("Firebase tidak tersedia");
    }

    try {
      const storageRef = storage.ref(path);
      const snapshot = await storageRef.put(file);
      const downloadURL = await snapshot.ref.getDownloadURL();
      return downloadURL;
    } catch (err) {
      console.error("Error uploading file:", err);
      throw err;
    }
  }

  async function deleteFileFromFirebase(path) { return; }

  let idbPromise = null;
  function getDb() {
    if (idbPromise) return idbPromise;
    idbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('ar_local', 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('glbFiles')) {
          db.createObjectStore('glbFiles');
        }
        if (!db.objectStoreNames.contains('jsonFiles')) {
          db.createObjectStore('jsonFiles');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return idbPromise;
  }

  async function idbPutGLB(id, blob) {
    const dbx = await getDb();
    return new Promise((resolve, reject) => {
      const tx = dbx.transaction('glbFiles', 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore('glbFiles').put(blob, id);
    });
  }

  async function idbGetGLB(id) {
    const dbx = await getDb();
    return new Promise((resolve, reject) => {
      const tx = dbx.transaction('glbFiles', 'readonly');
      tx.onerror = () => reject(tx.error);
      const req = tx.objectStore('glbFiles').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbDeleteGLB(id) {
    const dbx = await getDb();
    return new Promise((resolve, reject) => {
      const tx = dbx.transaction('glbFiles', 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore('glbFiles').delete(id);
    });
  }

  async function idbPutJSON(id, blob) {
    const dbx = await getDb();
    return new Promise((resolve, reject) => {
      const tx = dbx.transaction('jsonFiles', 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore('jsonFiles').put(blob, id);
    });
  }

  async function idbGetJSON(id) {
    const dbx = await getDb();
    return new Promise((resolve, reject) => {
      const tx = dbx.transaction('jsonFiles', 'readonly');
      tx.onerror = () => reject(tx.error);
      const req = tx.objectStore('jsonFiles').get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbDeleteJSON(id) {
    const dbx = await getDb();
    return new Promise((resolve, reject) => {
      const tx = dbx.transaction('jsonFiles', 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore('jsonFiles').delete(id);
    });
  }

  // Load active model from Firebase or localStorage
  async function loadActiveModelFromStorage() {
    try {
      const activeId = localStorage.getItem("activeModelId");
      if (!activeId) return;

      const models = await getAllModels();
      const model = models.find(m => m.id === activeId);
      
      if (!model) return;

      let glbUrl = null;
      let jsonData = model.jsonData || null;

      let blobFromIdb = null;
      if (model.glbId) {
        blobFromIdb = await idbGetGLB(model.glbId);
        if (blobFromIdb) glbUrl = URL.createObjectURL(blobFromIdb);
      }
      
      // Load GLB from base64
      if (model.glbUrl) {
        glbUrl = model.glbUrl;
      } else if (model.glbBase64) {
        const byteCharacters = atob(model.glbBase64.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'model/gltf-binary' });
        glbUrl = URL.createObjectURL(blob);
      }

      if (glbUrl) {
        loadModelToAR(glbUrl, jsonData, model.scale || 1.0);
        currentScale = model.scale || 1.0;
        currentModel3D = { url: glbUrl };
        currentModel2D = jsonData ? { data: jsonData } : null;
        activeModelId = model.id;
      }
    } catch (err) {
      console.error("Error loading active model:", err);
    }
  }

  // Add new model to Firebase or localStorage
  async function addModelToStorage() {
    try {
      const modelName = document.getElementById("modelName").value || `Model ${new Date().toLocaleDateString()}`;
      const modelId = generateId();
      
      let glbUrl = null;
      let glbPath = null;
      let glbId = null;

      if (currentModel3D?.file) {
        glbId = modelId;
        await idbPutGLB(glbId, currentModel3D.file);
      }

      let jsonUrl = null;
      let jsonPath = null;
      let jsonId = null;

      const modelData = {
        id: modelId,
        name: modelName,
        glbUrl: glbUrl || null,
        glbPath: glbPath || null,
        glbId: glbId || null,
        jsonUrl: jsonUrl || null,
        jsonPath: jsonPath || null,
        jsonId: jsonId || null,
        jsonData: currentModel2D?.data || null,
        glbBase64: null,
        scale: currentScale,
        createdAt: new Date().toISOString()
      };

      if (currentModel2D?.data) {
        jsonId = `${modelId}-json`;
        const jsonBlob = new Blob([JSON.stringify(currentModel2D.data)], { type: 'application/json' });
        await idbPutJSON(jsonId, jsonBlob);
        modelData.jsonId = jsonId;
      }

      const models = await getAllModels();
      models.push(modelData);
      localStorage.setItem("arModels", JSON.stringify(models));
      
      return modelId;
    } catch (err) {
      console.error("Error adding model:", err);
      showToast("Gagal menyimpan model", "error");
      return null;
    }
  }

  // Delete model from Firebase or localStorage
  async function deleteModelFromStorage(modelId) {
    try {
      const models = await getAllModels();
      const model = models.find(m => m.id === modelId);
      
      if (model && model.glbId) {
        try { await idbDeleteGLB(model.glbId); } catch (_) {}
      }
      if (model && model.jsonId) {
        try { await idbDeleteJSON(model.jsonId); } catch (_) {}
      }

      // Delete from localStorage (fallback or if no Firebase)
      const filtered = models.filter(m => m.id !== modelId);
      localStorage.setItem("arModels", JSON.stringify(filtered));
      
      // If deleted model was active, clear AR
      if (activeModelId === modelId) {
        activeModelId = null;
        localStorage.removeItem("activeModelId");
        clearContainer(model3dContainer);
        clearContainer(model2dContainer);
      }
      
      return true;
    } catch (err) {
      console.error("Error deleting model:", err);
      return false;
    }
  }

  // Set active model
  async function setActiveModel(modelId) {
    activeModelId = modelId;
    localStorage.setItem("activeModelId", modelId);
    await loadActiveModelFromStorage();
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

  uploadBtn.addEventListener("click", async () => {
    if ((!glbInput.files || !glbInput.files[0]) && (!jsonInput.files || !jsonInput.files[0])) {
      showToast("Pilih dulu file GLB dan/atau JSON.", "error");
      return;
    }
    
    try {
      // Load model ke preview dulu
      await loadFromInputs();
      
      // Simpan ke storage (Firebase or localStorage)
      const modelId = await addModelToStorage();
      
      if (modelId) {
        // Set as active
        await setActiveModel(modelId);
        
        // Feedback sukses
        const uploadedFiles = [];
        if (glbInput.files && glbInput.files[0]) uploadedFiles.push("Model 3D");
        if (jsonInput.files && jsonInput.files[0]) uploadedFiles.push("Data JSON");
        
        showToast(`✅ Upload berhasil! ${uploadedFiles.join(" & ")} tersimpan di lokal.`, "success");
        
        // Tutup modal dan refresh dashboard
        uploadModal.style.display = "none";
        renderDashboard();
        
        // Clear form
        clearBtn.click();
      }
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

  // Admin login
  const adminBtn = document.getElementById("adminBtn");
  const loginModal = document.getElementById("loginModal");
  const passwordInput = document.getElementById("passwordInput");
  const loginBtn = document.getElementById("loginBtn");
  const cancelLoginBtn = document.getElementById("cancelLoginBtn");
  const adminPanel = document.getElementById("adminPanel");
  const closeAdminBtn = document.getElementById("closeAdminBtn");
  const scannerView = document.getElementById("scannerView");

  adminBtn.addEventListener("click", () => {
    loginModal.style.display = "flex";
    passwordInput.focus();
  });

  cancelLoginBtn.addEventListener("click", () => {
    loginModal.style.display = "none";
    passwordInput.value = "";
  });

  loginBtn.addEventListener("click", () => {
    if (passwordInput.value === ADMIN_PASSWORD) {
      isAdminLoggedIn = true;
      loginModal.style.display = "none";
      adminPanel.style.display = "block";
      scannerView.style.display = "none";
      passwordInput.value = "";
      showToast("Login berhasil!", "success");
      initializeAdmin();
    } else {
      showToast("Kata sandi salah!", "error");
      passwordInput.value = "";
    }
  });

  closeAdminBtn.addEventListener("click", () => {
    adminPanel.style.display = "none";
    scannerView.style.display = "block";
    isAdminLoggedIn = false;
  });

  // Dashboard functions
  const dashboardView = document.getElementById("dashboardView");
  const modelsList = document.getElementById("modelsList");
  const addModelBtn = document.getElementById("addModelBtn");
  const uploadModal = document.getElementById("uploadModal");
  const cancelUploadBtn = document.getElementById("cancelUploadBtn");

  addModelBtn.addEventListener("click", () => {
    uploadModal.style.display = "flex";
    // Reset form
    clearBtn.click();
  });

  cancelUploadBtn.addEventListener("click", () => {
    uploadModal.style.display = "none";
    clearBtn.click();
  });

  async function renderDashboard() {
    const models = await getAllModels();
    const activeId = localStorage.getItem("activeModelId");

    if (models.length === 0) {
      modelsList.innerHTML = `
        <div class="empty-state">
          <p>Belum ada model yang diupload.</p>
          <button type="button" class="add-btn" onclick="document.getElementById('tabUpload').click()">+ Tambah Model Pertama</button>
        </div>
      `;
      return;
    }

    function formatDate(createdAt) {
      if (!createdAt) return '-';
      try {
        if (createdAt && typeof createdAt.toDate === 'function') {
          return createdAt.toDate().toLocaleDateString('id-ID');
        }
        return new Date(createdAt).toLocaleDateString('id-ID');
      } catch (_) {
        return '-';
      }
    }

    modelsList.innerHTML = models.map(model => {
      const isActive = model.id === activeId;
      const hasGLB = !!(model.glbBase64 || model.glbUrl || model.glbId);
      const hasJSON = !!(model.jsonData || model.jsonUrl);
      const date = formatDate(model.createdAt);

      return `
        <div class="model-card ${isActive ? 'active' : ''}">
          <div class="model-card-header">
            <h3>${model.name}</h3>
            ${isActive ? '<span class="active-badge">Aktif</span>' : ''}
          </div>
          <div class="model-card-info">
            <p><strong>Skala:</strong> ${model.scale || 1.0}x</p>
            <p><strong>File:</strong> ${hasGLB ? '✓ GLB' : ''} ${hasJSON ? '✓ JSON' : ''}</p>
            <p><strong>Dibuat:</strong> ${date}</p>
          </div>
          <div class="model-card-actions">
            ${!isActive ? `<button type="button" class="activate-btn" data-id="${model.id}">Aktifkan</button>` : ''}
            <button type="button" class="delete-btn" data-id="${model.id}">Hapus</button>
            ${hasGLB ? `<button type="button" class="download-glb-btn" data-id="${model.id}">Unduh GLB</button>` : ''}
            ${hasJSON ? `<button type="button" class="download-json-btn" data-id="${model.id}">Unduh JSON</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Add event listeners
    modelsList.querySelectorAll('.activate-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const modelId = e.target.getAttribute('data-id');
        await setActiveModel(modelId);
        renderDashboard();
        showToast("Model diaktifkan!", "success");
      });
    });

    modelsList.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const modelId = e.target.getAttribute('data-id');
        if (confirm('Yakin ingin menghapus model ini?')) {
          if (await deleteModelFromStorage(modelId)) {
            renderDashboard();
            showToast("Model dihapus!", "success");
          } else {
            showToast("Gagal menghapus model", "error");
          }
        }
      });
    });

    function base64ToGLBBlob(base64) {
      try {
        const byteCharacters = atob(base64.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: 'model/gltf-binary' });
      } catch (_) {
        return null;
      }
    }

    function triggerDownload(filename, blobOrUrl) {
      try {
        let href = blobOrUrl;
        let revoke = false;
        if (blobOrUrl instanceof Blob) {
          href = URL.createObjectURL(blobOrUrl);
          revoke = true;
        }
        const a = document.createElement('a');
        a.href = href;
        a.download = filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        a.remove();
        if (revoke) URL.revokeObjectURL(href);
      } catch (err) {
        console.error('Download error', err);
        showToast('Gagal mengunduh file', 'error');
      }
    }

    modelsList.querySelectorAll('.download-glb-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const modelId = e.target.getAttribute('data-id');
        const model = models.find(m => m.id === modelId);
        if (!model) return;
        if (model.glbUrl) {
          triggerDownload(`${model.name || 'model'}.glb`, model.glbUrl);
        } else if (model.glbBase64) {
          const blob = base64ToGLBBlob(model.glbBase64);
          if (blob) triggerDownload(`${model.name || 'model'}.glb`, blob);
          else showToast('GLB lokal tidak valid', 'error');
        } else if (model.glbId) {
          const blob = await idbGetGLB(model.glbId);
          if (blob) triggerDownload(`${model.name || 'model'}.glb`, blob);
          else showToast('File GLB tidak ditemukan di penyimpanan lokal', 'error');
        } else {
          showToast('Tidak ada file GLB untuk model ini', 'info');
        }
      });
    });

    modelsList.querySelectorAll('.download-json-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const modelId = e.target.getAttribute('data-id');
        const model = models.find(m => m.id === modelId);
        if (!model) return;
        if (model.jsonUrl) {
          triggerDownload(`${model.name || 'data'}.json`, model.jsonUrl);
        } else if (model.jsonId) {
          const blob = await idbGetJSON(model.jsonId);
          if (blob) triggerDownload(`${model.name || 'data'}.json`, blob);
          else showToast('File JSON tidak ditemukan di penyimpanan lokal', 'error');
        } else if (model.jsonData) {
          const blob = new Blob([JSON.stringify(model.jsonData, null, 2)], { type: 'application/json' });
          triggerDownload(`${model.name || 'data'}.json`, blob);
        } else {
          showToast('Tidak ada file JSON untuk model ini', 'info');
        }
      });
    });
  }

  // Enter key untuk login
  passwordInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      loginBtn.click();
    }
  });

  // Initialize: Load model dari storage dan start kamera
  async function initializeScanner() {
    console.log('Initializing scanner...');
    
    // Load active model dari Firebase or localStorage
    await loadActiveModelFromStorage();
    
    // Tunggu A-Frame selesai load
    const scene = document.querySelector("a-scene");
    if (!scene) {
      console.error('A-Scene not found!');
      return;
    }

    console.log('A-Scene found, requesting camera...');

    // Request permission kamera dan inisialisasi AR
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Gunakan kamera belakang di mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      console.log('Camera stream obtained:', stream);
      
      // AR.js akan menggunakan stream ini
      // Pastikan scene sudah ready
      const initAR = () => {
        console.log('Initializing AR.js...');
        scene.setAttribute("arjs", "sourceType: webcam; debugUIEnabled: true; videoTexture: true; detectionMode: mono_and_matrix; matrixCodeType: 3x3;");
        
        // Pastikan video element terlihat - check multiple times
        const checkVideo = () => {
          const videos = document.querySelectorAll('video');
          console.log('Found videos:', videos.length);
          
          videos.forEach((video, index) => {
            console.log(`Video ${index}:`, {
              src: video.src,
              srcObject: video.srcObject,
              display: window.getComputedStyle(video).display,
              zIndex: window.getComputedStyle(video).zIndex
            });
            
             video.style.display = 'block';
             video.style.position = 'fixed';
             video.style.top = '50%';
             video.style.left = '50%';
             video.style.transform = 'translate(-50%, -50%)';
             video.style.width = '100vw';
             video.style.height = '100vh';
             video.style.objectFit = 'contain';
             video.style.objectPosition = 'center center';
             video.style.zIndex = '1';
             video.style.background = '#000';
             video.style.margin = '0';
             video.style.padding = '0';
            
            if (video.paused) {
              video.play().catch(e => console.log('Video play error:', e));
            }
          });
        };

        // Check multiple times karena AR.js membuat video secara async
        checkVideo();
        setTimeout(checkVideo, 500);
        setTimeout(checkVideo, 1000);
        setTimeout(checkVideo, 2000);
        setTimeout(checkVideo, 3000);
      };

      if (scene.hasLoaded) {
        initAR();
      } else {
        scene.addEventListener('loaded', initAR, { once: true });
        // Fallback
        setTimeout(initAR, 1000);
      }

    } catch (err) {
      console.error("Camera error:", err);
      showToast("Izin kamera diperlukan untuk AR. Pastikan browser mengizinkan akses kamera.", "error");
      
      // Show more specific error
      if (err.name === 'NotAllowedError') {
        showToast("Akses kamera ditolak. Izinkan akses kamera di pengaturan browser.", "error");
      } else if (err.name === 'NotFoundError') {
        showToast("Kamera tidak ditemukan.", "error");
      }
    }
  }

  // Initialize dashboard saat login
  async function initializeAdmin() {
    await renderDashboard();
  }

  // Jalankan saat halaman load - tunggu A-Frame ready
  function startApp() {
    // Tunggu sampai A-Frame dan AR.js selesai load
    if (typeof AFRAME !== 'undefined' && typeof ARjs !== 'undefined') {
      const scene = document.querySelector('a-scene');
      if (scene) {
        scene.addEventListener('loaded', () => {
          setTimeout(() => {
            initializeScanner();
          }, 500);
        });
        
        // Fallback jika event loaded tidak trigger
        setTimeout(() => {
          if (!scene.hasLoaded) {
            initializeScanner();
          }
        }, 2000);
      } else {
        setTimeout(startApp, 100);
      }
    } else {
      setTimeout(startApp, 100);
    }
  }

  // Start app
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
  } else {
    startApp();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
