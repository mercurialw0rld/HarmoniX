# HarmoniX — AI-Powered Music Transcriber & Harmonizer

**HarmoniX** is a full-stack application that leverages Large Language Models (LLMs) to transform how musicians interact with online tabs. By combining advanced web scraping, generative AI, and dynamic visual processing, HarmoniX extracts, enhances, and visualizes musical compositions in real-time.

🚀 **Live Demo:** [https://harmoni-x-rose.vercel.app/]

## 🌟 Key Features

* **Intelligent Web Scraping:** Uses **Firecrawl** to navigate and extract structured data from complex music repositories (e.g., Ultimate Guitar), bypassing traditional scraping limitations.
* **AI-Driven Harmonization:** Powered by **Gemini 1.5 Flash** to re-harmonize songs, suggest genre-specific chord progressions, and provide musical theory insights.
* **Dynamic Visual Assets:** Automatically generates piano chord diagrams using **Matplotlib** based on the chords detected in the song.
* **Context-Aware Parsing:** Implements custom logic to differentiate between lyrics, chords, and song structures like verses or choruses.
* **Modern UX:** A responsive React interface featuring real-time "AI Enhance" capabilities and a clean, dark-mode aesthetic for musicians.

## 🛠️ Tech Stack

* **Backend:** Python, FastAPI.
* **AI & Data:** Google Gemini API (LLM), Firecrawl (Scraping), Matplotlib (Visualization).
* **Frontend:** React.js, Vite, Tailwind CSS.
* **Deployment:** Vercel (Frontend/Backend).

## 🧠 How It Works

1.  **Extraction:** The user provides a URL. The backend uses Firecrawl to fetch the raw content of the song.
2.  **Processing:** Gemini 1.5 Flash processes the text to identify the key, structure, and original chords.
3.  **Enhancement:** Users can request the AI to "Change to Jazz style" or "Simplify chords". The LLM returns a structured musical output.
4.  **Visualization:** For every chord detected, the system checks for corresponding piano patterns and displays them dynamically to the user.

## 🚀 Installation & Local Setup

### Backend
1. Navigate to the `/server` directory.
2. Create a `.env` file with your `GEMINI_API_KEY` and `FIRECRAWL_API_KEY`.
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI server:
   ```bash
   uvicorn server:app --reload
   ```

### Frontend
1. Navigate to the `/client` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 📈 Future Roadmap
* **Audio Synthesis:** Integration with TTS or MIDI APIs to provide audio previews of the re-harmonized progressions.
* **Multi-Instrument Support:** Dynamic generation of guitar fretboards and ukulele diagrams.
* **Advanced RAG:** Implementation of a vector database to allow users to search through their "Saved Songs" library using natural language.

---

