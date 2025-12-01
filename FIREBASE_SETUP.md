# Setup Firebase untuk AR Web App

## Langkah-langkah Setup:

### 1. Buat Project Firebase
1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Klik "Add project" atau "Create a project"
3. Isi nama project (contoh: "ar-web-app")
4. Ikuti langkah-langkah setup

### 2. Enable Firebase Storage
1. Di Firebase Console, pilih project kamu
2. Klik "Storage" di menu kiri
3. Klik "Get started"
4. Pilih "Start in test mode" (untuk development)
5. Pilih lokasi storage (pilih yang terdekat)
6. Klik "Done"

### 3. Enable Firestore Database
1. Di Firebase Console, klik "Firestore Database"
2. Klik "Create database"
3. Pilih "Start in test mode" (untuk development)
4. Pilih lokasi (pilih yang sama dengan Storage)
5. Klik "Enable"

### 4. Dapatkan Firebase Config
1. Di Firebase Console, klik ikon ⚙️ (Settings) > "Project settings"
2. Scroll ke bawah ke bagian "Your apps"
3. Klik ikon web (</>) untuk menambahkan web app
4. Isi nama app (contoh: "AR Web App")
5. Klik "Register app"
6. Copy konfigurasi yang muncul (berbentuk seperti ini):

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### 5. Update firebase-config.js
1. Buka file `firebase-config.js`
2. Ganti semua nilai dengan config dari Firebase Console
3. Simpan file

### 6. Set Firestore Security Rules (Opsional)
1. Di Firebase Console, klik "Firestore Database" > "Rules"
2. Update rules untuk allow read/write:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /arModels/{document=**} {
      allow read, write: if true; // Untuk development, ganti dengan auth untuk production
    }
  }
}
```

### 7. Set Storage Security Rules (Opsional)
1. Di Firebase Console, klik "Storage" > "Rules"
2. Update rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /models/{allPaths=**} {
      allow read, write: if true; // Untuk development, ganti dengan auth untuk production
    }
  }
}
```

## Catatan Penting:

⚠️ **Security Rules di atas hanya untuk DEVELOPMENT!**
- Untuk production, gunakan authentication
- Jangan biarkan `if true` di production karena semua orang bisa akses

## Testing:

1. Buka website kamu
2. Login sebagai admin
3. Upload model GLB/JSON
4. Cek Firebase Console > Storage untuk melihat file yang terupload
5. Cek Firestore Database untuk melihat metadata model

## Troubleshooting:

- **Error: "Firebase tidak tersedia"**: Pastikan `firebase-config.js` sudah diisi dengan benar
- **Error upload**: Cek Storage rules di Firebase Console
- **Error save metadata**: Cek Firestore rules di Firebase Console

