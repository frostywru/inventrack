# InvenTrack — Complete Setup & Deployment Guide

---

## 📁 Project Files

```
inventory-system/
├── index.html       ← Main HTML (structure + markup)
├── styles.css       ← All styles & responsive design
├── script.js        ← All logic + Firebase integration
└── SETUP_GUIDE.md   ← This file
```

---

## PART 1 — FIREBASE SETUP

### Step 1: Create a Firebase Project

1. Go to **https://console.firebase.google.com**
2. Click **"Add project"**
3. Enter a project name (e.g., `inventrack`)
4. You can disable Google Analytics — click **"Create project"**
5. Wait for it to finish, then click **"Continue"**

---

### Step 2: Create a Web App

1. On the Firebase project home page, click the **`</>`** (Web) icon
2. Enter an app nickname (e.g., `InvenTrack Web`)
3. Leave **"Also set up Firebase Hosting"** unchecked (we'll use GitHub Pages instead)
4. Click **"Register app"**
5. You'll see a code block like this:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

6. **Copy these values** — you'll need them in the next step
7. Click **"Continue to console"**

---

### Step 3: Set Up Firestore Database

1. In the left sidebar, click **"Build" → "Firestore Database"**
2. Click **"Create database"**
3. Select **"Start in test mode"** (allows read/write for 30 days)
4. Choose your preferred Firestore location (pick the one closest to you)
5. Click **"Enable"**

> ⚠️ **IMPORTANT:** Test mode expires after 30 days. Before going live, go to
> Firestore → **Rules** and update them properly. For now, test mode is fine.

---

### Step 4: Add Your Firebase Config to script.js

1. Open **`script.js`** in any text editor (Notepad, VS Code, etc.)
2. Find this section near the top of the file:

```js
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
```

3. Replace each `"YOUR_..."` value with the actual values from Step 2
4. **Save the file**

Example (your values will be different):
```js
const firebaseConfig = {
  apiKey:            "AIzaSyABCdefGHIjkl_MNOP",
  authDomain:        "inventrack-abc12.firebaseapp.com",
  projectId:         "inventrack-abc12",
  storageBucket:     "inventrack-abc12.appspot.com",
  messagingSenderId: "987654321098",
  appId:             "1:987654321098:web:abc123def456"
};
```

---

## PART 2 — GITHUB PAGES DEPLOYMENT

### Step 1: Create a GitHub Account (if needed)

Go to **https://github.com** and sign up for a free account.

---

### Step 2: Create a New Repository

1. Click the **"+"** icon (top right) → **"New repository"**
2. Repository name: `inventrack` (or any name you like)
3. Set visibility to **Public** (required for free GitHub Pages)
4. Leave everything else as default
5. Click **"Create repository"**

---

### Step 3: Upload Your Files

**Option A — Upload via GitHub website (easiest for beginners):**

1. On your new repository page, click **"uploading an existing file"**
2. Drag and drop (or select) all 3 files:
   - `index.html`
   - `styles.css`
   - `script.js`
3. Add a commit message like `"Initial upload"`
4. Click **"Commit changes"**

**Option B — Using Git (for those comfortable with the terminal):**

```bash
git init
git add .
git commit -m "Initial upload"
git remote add origin https://github.com/YOUR_USERNAME/inventrack.git
git branch -M main
git push -u origin main
```

---

### Step 4: Enable GitHub Pages

1. In your repository, click **"Settings"** (top menu)
2. Scroll down to the **"Pages"** section in the left sidebar
3. Under **"Source"**, select **"Deploy from a branch"**
4. Branch: **main**, Folder: **/ (root)**
5. Click **"Save"**
6. Wait 1–2 minutes, then refresh the page
7. You'll see: **"Your site is published at https://YOUR_USERNAME.github.io/inventrack/"**

---

### Step 5: Test Your App

1. Open your GitHub Pages URL in a browser
2. You should see the PIN screen
3. Enter the PIN: **070602**
4. You're in!

---

## PART 3 — FIRST-TIME USE

### Default PIN
```
070602
```

### Initial Setup

1. Log in with the PIN above
2. Go to **Dashboard**
3. Set your **Low Stock Threshold** (default is 5) and click **Save**
4. Navigate to **Inventory Management**
5. Click **"+ Add Product"** to add your first product

---

## PART 4 — FIREBASE SECURITY RULES (After 30 Days)

When your test mode expires, go to **Firestore → Rules** and replace the rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

> This keeps it open for personal/small team use. For a real production app,
> you'd want to set up Firebase Authentication and restrict rules to logged-in users.

---

## PART 5 — FEATURES REFERENCE

| Feature | Description |
|---|---|
| **PIN Auth** | 6-digit PIN (070602). Session stored in localStorage. |
| **Dashboard KPIs** | Total Products, Inventory Value, Total Stock, Low Stock, Out of Stock, Recently Updated |
| **Alerts** | Auto-generated warnings for low/out-of-stock |
| **Low Stock Threshold** | Configurable. Stored in Firebase. Default = 5. |
| **Low Stock Table** | Products with 1 ≤ stock ≤ threshold |
| **Out of Stock Table** | Products with stock = 0 |
| **Recent Activity** | Last 20 add/update/delete events, stored in Firebase |
| **Add/Edit Product** | Full form with 8 fields. Saved to Firestore. |
| **Delete Product** | Confirmation dialog before deleting |
| **Update Stock** | Quick stock update via prompt dialog |
| **Search** | Real-time search by name or category |
| **Filter** | Filter by status and category |
| **Inventory Value** | Cost Price × Stock Quantity, per product and total |
| **Status Badges** | Green (In Stock), Orange (Low Stock), Red (Out of Stock) |
| **Toast Notifications** | Success/error/info pop-ups |
| **Mobile Responsive** | Cards, collapsible sidebar, touch-friendly |

---

## PART 6 — CHANGING THE PIN

To change the PIN, open `script.js` and find line:

```js
const CORRECT_PIN = "070602";
```

Replace `070602` with your desired 6-digit PIN, save the file, and re-upload it to GitHub.

---

## TROUBLESHOOTING

| Problem | Solution |
|---|---|
| Blank white screen | Open browser DevTools (F12) → Console. Look for errors. Usually a Firebase config issue. |
| "Firebase configuration error" toast | Check your `firebaseConfig` values in `script.js` |
| Data not saving | Make sure Firestore is in test mode and not expired |
| GitHub Pages not loading | Wait a few more minutes; Pages can take up to 10 minutes to deploy |
| PIN not working | Make sure you're entering exactly `070602` |
| Styles look broken | Make sure `styles.css` is in the same folder as `index.html` |

---

*Built with Firebase Firestore + vanilla HTML/CSS/JS · Hosted on GitHub Pages*
