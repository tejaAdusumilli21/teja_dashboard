# ✦ teja Auth — Complete Build & Deploy Guide

A React + Firebase authentication app with Login, Signup, and Home screen.
Deploy to GitHub Pages in minutes.

---

## 📁 Project Structure

```
lumina-auth/
├── src/
│   ├── App.jsx        ← All UI + Firebase logic
│   └── main.jsx       ← React entry point
├── index.html         ← HTML shell
├── vite.config.js     ← Vite + GitHub Pages base config
├── package.json       ← Dependencies + deploy scripts
└── .gitignore
```

---

## 🔥 STEP 1 — Create a Firebase Project

1. Go to https://console.firebase.google.com
2. Click **"Add project"** → name it (e.g. `lumina-auth`) → Continue
3. Disable Google Analytics (optional) → **Create project**

### Enable Authentication
4. In the left sidebar → **Build → Authentication**
5. Click **"Get started"**
6. Enable these sign-in methods:
   - **Email/Password** → Enable → Save
   - **Google** → Enable → add your support email → Save
   - **Apple** → (requires Apple Developer account, skip for now)

### Create Firestore Database
7. Left sidebar → **Build → Firestore Database**
8. Click **"Create database"**
9. Choose **"Start in test mode"** → Next → select a region → Done

### Get your Firebase Config
10. Left sidebar → ⚙️ **Project Settings** (gear icon)
11. Scroll down to **"Your apps"** → click **"</> Web"**
12. Register app name (e.g. `lumina-web`) → click **"Register app"**
13. Copy the `firebaseConfig` object — you'll need it in Step 3

---

## 💻 STEP 2 — Set Up the Project Locally

Open your terminal and run these commands one by one:

```bash
# Create a new Vite + React project
npm create vite@latest lumina-auth -- --template react

# Go into the project folder
cd lumina-auth

# Install dependencies
npm install

# Install Firebase and gh-pages
npm install firebase
npm install --save-dev gh-pages
```

Now **replace** the generated files with the files from this project:
- Copy `src/App.jsx` → replace `src/App.jsx`
- Copy `src/main.jsx` → replace `src/main.jsx`
- Copy `vite.config.js` → replace `vite.config.js`
- Copy `package.json` → replace `package.json` (then run `npm install` again)
- Copy `index.html` → replace `index.html`

---

## 🔑 STEP 3 — Add Your Firebase Config

Open `src/App.jsx` and find this section near the top:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",           // ← Replace this
  authDomain: "YOUR_AUTH_DOMAIN",   // ← Replace this
  projectId: "YOUR_PROJECT_ID",     // ← Replace this
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

Paste in the values from your Firebase project (Step 1 → Step 13).

---

## 🧪 STEP 4 — Test Locally

```bash
npm run dev
```

Open http://localhost:5173 in your browser.
Test Login and Signup — check Firestore in Firebase Console to see user data appear.

---

## 🐙 STEP 5 — Push to GitHub

### Create a GitHub repository
1. Go to https://github.com/new
2. Name it **exactly** `lumina-auth` (must match `vite.config.js` base setting)
3. Set to Public → click **"Create repository"**
4. Copy the repository URL (e.g. `https://github.com/YOUR_USERNAME/lumina-auth.git`)

### Push your code
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/lumina-auth.git
git branch -M main
git push -u origin main
```

---

## 🚀 STEP 6 — Deploy to GitHub Pages

```bash
npm run deploy
```

This command will:
1. Build the app into a `dist/` folder
2. Push `dist/` to a `gh-pages` branch on GitHub automatically

---

## ⚙️ STEP 7 — Enable GitHub Pages

1. Go to your GitHub repo → **Settings** tab
2. Left sidebar → **Pages**
3. Under **Branch** → select `gh-pages` → click **Save**
4. Wait ~2 minutes

Your app will be live at:
```
https://YOUR_USERNAME.github.io/lumina-auth/
```

---

## 🔐 STEP 8 — Authorize GitHub Pages Domain in Firebase

Without this step, Google Sign-In will be blocked!

1. Go to Firebase Console → **Authentication** → **Settings** tab
2. Scroll to **Authorized domains**
3. Click **"Add domain"**
4. Enter: `YOUR_USERNAME.github.io`
5. Click **Add**

---

## 🔄 How to Update & Redeploy

Whenever you make changes:
```bash
npm run deploy
```
That's it! The site updates automatically.

---

## ❓ Troubleshooting

| Problem | Fix |
|---|---|
| Blank page on GitHub Pages | Check `base` in `vite.config.js` matches repo name exactly |
| Google Sign-In popup blocked | Add `YOUR_USERNAME.github.io` to Firebase Authorized Domains |
| "auth/invalid-api-key" error | Double-check your `firebaseConfig` values in `App.jsx` |
| Page not found on refresh | GitHub Pages doesn't support SPA routing — use hash routing or add a 404.html redirect |
| Deploy command fails | Run `git push -u origin main` first, then `npm run deploy` |

---

## 📱 Features

- Landing page with Login + Signup buttons
- Login via Google, Apple, or Email/Password
- Signup with First Name, Last Name, Email or Phone toggle
- User data saved to Firestore
- Auto sign-in on page refresh (`onAuthStateChanged`)
- Home screen with user's name and Sign Out button
- Responsive design, works on mobile

---

Built with React + Vite + Firebase + GitHub Pages
