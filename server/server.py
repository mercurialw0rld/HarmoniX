from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services import * 
from pydantic import BaseModel
import asyncio

class song_title_request(BaseModel):
    song_title: str

class enhancement_request(BaseModel):
    lyrics_with_chords: str
    user_request: str

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/get_chords")
def get_chords_endpoint(request: song_title_request):
    try:
        song_chords = getChords(request.song_title)
        print("Retrieved song chords:", song_chords.lyrics_with_chords)
        return song_chords
    except Exception as e:
        return {"error": str(e)}
    
@app.post("/enhance_chords")
def enhance_chords_endpoint(request: enhancement_request):
    try:
        enhanced_content = getAIEnhancement(request.lyrics_with_chords, request.user_request)
        return {"enhanced_content": enhanced_content}
    except Exception as e:
        return {"error": str(e)}