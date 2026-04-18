HarmoniX — AI Music Transcriber & Harmonizer
HarmoniX is an intelligent assistant designed for musicians to bridge the gap between web-based music resources and creative practice. By leveraging Large Language Models (LLMs) and advanced web scraping, it extracts, enhances, and visualizes musical structures in real-time.


🚀 Key Features
AI-Powered Web Scraping: Utilizes Firecrawl to navigate complex music sites (like Ultimate Guitar) and extract clean, structured musical data (JSON) from raw web content.

LLM Music Theory Analysis: Powered by Gemini 1.5 Flash, the system can re-harmonize songs, suggest genre shifts (e.g., Rock to Bossa Nova), and explain the theory behind chord progressions.

Dynamic Music Visualization: Automatically generates piano chord diagrams using Matplotlib on the backend, providing instant visual aids for learners.

Intelligent Chord Parsing: Features a custom regex-based processing engine to separate lyrics from musical notation, ensuring a clean user interface.

Modern Full-Stack Architecture: A decoupled system using FastAPI for high-performance asynchronous tasks and React for a responsive, fluid UX.

🛠️ Tech Stack
Frontend: React (Vite), CSS3.

Backend: FastAPI (Python 3.10+).

AI/ML: Google Gemini 1.5 Flash API.

Data Extraction: Firecrawl API.

Visualization: Matplotlib.

Deployment: Vercel.

🏗️ Architecture
Input: User provides a URL or a text-based chord sheet.

Extraction: The backend uses Firecrawl to "read" the website and Gemini to parse the unstructured text into a valid JSON musical object.

Enhancement: The AI engine suggests improvements or transformations based on music theory.

Generation: The system generates visual diagrams for the chords used in the song.

Delivery: The React frontend renders the interactive enhanced sheet and visualizations.

⚙️ Installation & Setup
Prerequisites
Python 3.10+
Node.js & npm
API Keys for Gemini and Firecrawl

# Backend Setup
Bash
cd server
pip install -r requirements.txt

# Create a .env file with GEMINI_API_KEY and FIRE_CRAWL_API_KEY
python server.py
Frontend Setup
Bash
cd client
npm install
npm run dev

📈 Engineering Highlights
Robust Error Handling: Implemented a structured response schema to ensure the LLM output is always valid for frontend consumption.

Asynchronous Processing: Leveraged FastAPI’s async capabilities to handle scraping and AI generation concurrently, reducing wait times.

Scalable Visualization: Developed a backend service that creates on-the-fly assets, reducing the need for large static libraries on the client side.
