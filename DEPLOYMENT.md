# AirIndex India — Deployment Guide

This repository contains the full **AirIndex India** platform (Frontend React/Vite dashboard and Backend Python/FastAPI scraping & calculation engine).

---

## 1. Architecture Overview

- **Frontend**: React + Vite + TailwindCSS + Recharts (Deployable on **Vercel**).
- **Backend**: FastAPI + Scrape Engine + Clustering Engine (Deployable on **Render**, **Railway**, or **AWS**).
- **Data Flow**: The frontend connects to the backend API (`VITE_API_URL`). When deployed on Vercel, the frontend communicates securely with the external backend server over HTTPS.

---

## 2. Deploying Backend to Render / Railway

### Deploy to Render (Recommended - Free Tier)
1. Push your codebase to **GitHub**.
2. Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** -> **Web Service**.
3. Select your repository `AirIndex-India`.
4. Configure service settings:
   - **Root Directory**: `backend` (or leave empty if at repo root)
   - **Environment**: `Python 3`
   - **Build Command**: `python -m pip install --upgrade pip setuptools wheel && pip install -r backend/requirements.txt`
   - **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
5. Click **Deploy**. Copy your public Render URL (e.g. `https://airindex-backend.onrender.com`).

---

## 3. Deploying Frontend to Vercel

1. Log into [Vercel](https://vercel.com/) and click **Add New** -> **Project**.
2. Select your GitHub repository.
3. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Expand **Environment Variables**:
   - **Name**: `VITE_API_URL`
   - **Value**: `https://airindex-backend.onrender.com` *(Your Backend URL)*
5. Click **Deploy**.

---

## 4. Local Development

To run locally:

### Start Backend (Port 8000)
```bash
python backend/main.py
```

### Start Frontend (Port 3000)
```bash
cd frontend
npm run dev
```
