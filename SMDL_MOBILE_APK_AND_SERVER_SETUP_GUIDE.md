# SMDL Attendance System — Mobile Server & APK Configuration Guide

> **Created Date:** October 18, 2026  
> **Status:** Active & Production Verified  
> **Repository:** SMDL College Smart Attendance & Communication System  

---

## 1. Quick Server Start Commands

Dono servers ko run karne ke liye commands:

### Backend Server (Port 5000):
```powershell
cd "d:\project by trae smdl\Attendence system\server"
node src/index.js
```
- **Local URL:** `http://localhost:5000`
- **Mobile/LAN Network URL:** `http://10.75.38.19:5000` (Dynamic IP)
- **Health Check:** `http://10.75.38.19:5000/api/health`

### Frontend Dev Server (Port 3000):
```powershell
cd "d:\project by trae smdl\Attendence system\client"
npm run dev
```
- **Local URL:** `http://localhost:3000`
- **Mobile/LAN Network URL:** `http://10.75.38.19:3000`

---

## 2. Mobile Access & Troubleshooting: "Network Error" Resolution

### Root Cause of "Network Error":
1. **Wi-Fi IP Change:** Laptop ka Wi-Fi IP router ke DHCP ke hisab se dynamically change hota hai (jaise pehle `172.16.225.19` tha aur ab `10.75.38.19` ho gaya).
2. **Hardcoded IP in Old APK:** Mobile me jo pehle APK install thi, uske compiled JavaScript me purana IP tha, isliye mobile device connect nahi kar pa raha tha.

---

## 3. Permanent Fixes Implemented

### A. Dynamic Server IP Logger (`server/src/index.js`)
Backend start hote waqt laptop ke current network card se IPv4 detect karta hai aur exact LAN URL log karta hai:
```javascript
const localIp = getLocalIp();
console.log(`📱 Mobile/LAN Network URL: http://${localIp}:${env.PORT}`);
```

### B. Dynamic API URL Resolution (`client/src/lib/api.js`)
Axios client ab priority ke hisab se URL resolve karta hai:
1. `localStorage.getItem('smdl_api_url')` (Custom user setting)
2. `import.meta.env.VITE_API_URL`
3. Capacitor Native APK: Default active Wi-Fi IP (`http://10.75.38.19:5000/api`)
4. Web Browser fallback: `/api` (Vite proxy)

### C. In-App Server Change Feature (`LoginPage.jsx`)
Login screen ke bottom par **"Server: http://10.75.38.19:5000/api (Change)"** button add kiya gaya hai:
- User app ke andar se hi kisi bhi waqt new IP type karke **"Test & Save"** kar sakta hai.
- Isse dobara APK compile karne ki zaroorat nahi padti.

---

## 4. Mobile me APK Install Karne ke Tareeqe

### Option 1: 1-Click Mobile Browser Download (Recommended)
1. Phone ko same Wi-Fi / Hotspot se connect karein.
2. Phone ke Chrome browser me link open karein:
   ```text
   http://10.75.38.19:3000/app-debug.apk
   ```
3. Download hone ke baad purani app uninstall karke ise install karein.

### Option 2: Direct File Location
Updated APK laptop par yahan stored hai:
```text
d:\project by trae smdl\Attendence system\client\android\app\build\outputs\apk\debug\app-debug.apk
```

### Option 3: Future APK Rebuild Command
Agar code update karne ke baad naya APK build karna ho:
```powershell
# Step 1: Web build
cd "d:\project by trae smdl\Attendence system\client"
npm run build

# Step 2: Copy to Android
node node_modules/@capacitor/cli/bin/capacitor copy android

# Step 3: Compile APK
cd android
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat assembleDebug

# Step 4: Copy to public for direct phone download
Copy-Item "app\build\outputs\apk\debug\app-debug.apk" -Destination "..\public\app-debug.apk" -Force
```
