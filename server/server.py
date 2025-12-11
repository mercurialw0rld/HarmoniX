from typing import Any, Dict, List, Optional
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services import SongChords, getAIChord, getAIEnhancement, getChords


class EnhancementRequest(BaseModel):
    lyrics_with_chords: str
    user_request: str


class AiEnhancePayload(BaseModel):
    prompt: str
    song: Dict[str, Any]


class AiChordPayload(BaseModel):
    chord: str


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def build_song_payload(song: SongChords, *, query: Optional[str] = None) -> Dict[str, Any]:
    body = (song.lyrics_with_chords or "").strip()
    title = song.song_title or query or "Untitled"
    tags = song.chords[:5] if song.chords else []

    return {
        "id": f"scrape-{uuid4().hex}",
        "title": title,
        "artist": song.artist or "Unknown Artist",
        "body": body,
        "source": "Ultimate Guitar scrape",
        "tags": tags,
        "chords": song.chords or [],
        "key": None,
        "bpm": None,
        "tuning": "Standard",
        "notes": "Auto-scraped via Firecrawl",
    }


def rebuild_body_from_sections(sections: Optional[List[Dict[str, Any]]]) -> str:
    if not sections:
        return ""

    lines: List[str] = []
    for section in sections:
        label = section.get("label")
        if label:
            lines.append(f"[{label}]")
        for row in section.get("lines", []):
            chords = (row.get("chords") or "").rstrip()
            lyrics = (row.get("lyrics") or "").rstrip()
            if chords:
                lines.append(chords)
            if lyrics:
                lines.append(lyrics)
        lines.append("")

    return "\n".join(lines).strip()


def extract_body_from_song_payload(song_payload: Dict[str, Any]) -> str:
    body = song_payload.get("body")
    if isinstance(body, str) and body.strip():
        return body
    return rebuild_body_from_sections(song_payload.get("sections"))


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/get_chords")
def get_chords_endpoint(song_title: str = Query(..., alias="song_title")):
    try:
        song_chords = getChords(song_title)
        return song_chords
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/enhance_chords")
def enhance_chords_endpoint(request: EnhancementRequest):
    try:
        enhanced_content = getAIEnhancement(request.lyrics_with_chords, request.user_request)
        return {"enhanced_content": enhanced_content}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/songs")
def fetch_song(query: str = Query(..., min_length=2)):
    try:
        song_chords = getChords(query)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    payload = build_song_payload(song_chords, query=query)
    return {"song": payload}



@app.post("/api/ai/enhance")
def ai_enhance(payload: AiEnhancePayload):
    if not payload.song:
        raise HTTPException(status_code=400, detail="Song payload is required")

    body = extract_body_from_song_payload(payload.song)
    if not body:
        raise HTTPException(status_code=422, detail="Unable to extract chord sheet from song payload")

    try:
        enhanced = getAIEnhancement(body, payload.prompt)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    enhanced_body = (enhanced or "").strip()
    if not enhanced_body:
        raise HTTPException(status_code=502, detail="AI service returned an empty response")

    response_song = {
        "id": f"ai-{uuid4().hex}",
        "title": f"{payload.song.get('title', 'HarmoniX Sheet')} · AI",
        "artist": payload.song.get("artist"),
        "body": enhanced_body,
        "source": "AI Enhancement",
        "tags": payload.song.get("tags", []),
    }

    return {"song": response_song}


@app.post("/api/chords/diagram")
def ai_chord(payload: AiChordPayload):
    chord_name = (payload.chord or "").strip()
    if not chord_name:
        raise HTTPException(status_code=400, detail="Chord name is required")

    try:
        chord_data = getAIChord(chord_name)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return chord_data