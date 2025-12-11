import base64
import io
import json
import os
import re
from os.path import join, dirname
from typing import List, Optional

import matplotlib

matplotlib.use("Agg")

from dotenv import load_dotenv
from firecrawl import Firecrawl
from google import genai
from matplotlib import pyplot as plt
from matplotlib.patches import Rectangle
from pydantic import BaseModel

dotenv_path = join(dirname(__file__), '.env')
load_dotenv(dotenv_path)

client = genai.Client(api_key=os.getenv("GEMINI"))

app = Firecrawl(api_key=os.getenv("FIRECRAWL"))

class SongChords(BaseModel):
    song_title: str
    artist: str
    chords: Optional[list[str]] = None
    lyrics_with_chords: str

class EnhancementRequest(BaseModel):
    lyrics_with_chords: str
    user_request: str


def searchChords(userPrompt: str) -> str:
    try:
        search = app.search(query=userPrompt + " Chords from Ultimate Guitar", limit=1)
    except Exception as e:
        return "Error during search: " + str(e)
    if search.web:
        print(f"Found URL: {search.web[0].url}")
        return search.web[0].url
    else:
        return "No results found"

def getChords(userPrompt: str) -> SongChords:
    search = searchChords(userPrompt)
    print("Search result URL:", search)
    if not search or not (search.startswith("http") or search.startswith("www")):
        raise ValueError("No results found for the given prompt.")
    result = app.scrape(
        search,
        formats=[{
            "type": "json",
            "schema": SongChords.model_json_schema()
        }]
    )
    return SongChords.model_validate(result.json)


def getAIEnhancement(lyrics_with_chords: str, user_request: str) -> str:
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="The following are song lyrics with chords embedded." + lyrics_with_chords +
        "\n\nEnhance the above content based on the following user request: " + user_request
        + "You should only change the chords and lyrics as necessary to fulfill the user request, respect the original format of the content.",

    )
    return response.text


NOTE_SEQUENCE = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
FLAT_TO_SHARP = {
    "Bb": "A#",
    "Db": "C#",
    "Eb": "D#",
    "Gb": "F#",
    "Ab": "G#",
}
OCTAVE_RANGE = range(2, 6)
PIANO_KEYS = [f"{note}{octave}" for octave in OCTAVE_RANGE for note in NOTE_SEQUENCE]


def normalize_note_name(note: str) -> str:
    if not note:
        return ""
    match = re.match(r"^\s*([A-Ga-g])([#b♯♭]?)(\d{0,1})\s*$", note)
    if not match:
        return ""
    letter = match.group(1).upper()
    accidental = match.group(2) or ""
    octave = match.group(3) or "4"
    accidental = accidental.replace("♯", "#").replace("♭", "b")
    base_note = f"{letter}{accidental}"
    base_note = FLAT_TO_SHARP.get(base_note, base_note)
    if base_note not in NOTE_SEQUENCE:
        return ""
    return f"{base_note}{octave}"


def extract_notes_from_ai_response(raw: str) -> List[str]:
    if not raw:
        return []
    snippet = raw
    if "{" in raw and "}" in raw:
        snippet = raw[raw.index("{") : raw.rindex("}") + 1]
    try:
        candidate = json.loads(snippet)
    except json.JSONDecodeError:
        return []
    notes = candidate.get("notes") if isinstance(candidate, dict) else None
    if not isinstance(notes, list):
        return []
    normalized = [normalize_note_name(str(note)) for note in notes]
    return [note for note in normalized if note]


def make_piano_diagram(note_names: List[str]) -> str:
    if not note_names:
        return ""
    highlight = set(note_names)
    fig, ax = plt.subplots(figsize=(len(PIANO_KEYS) * 0.18, 1.8))
    ax.set_xlim(0, len(PIANO_KEYS))
    ax.set_ylim(0, 1)
    ax.axis("off")

    for idx, key in enumerate(PIANO_KEYS):
        is_sharp = "#" in key
        base_color = "#10141c" if is_sharp else "#fefefe"
        fill_color = "#ff4d6d" if key in highlight else base_color
        height = 0.8 if is_sharp else 1
        width = 0.7 if is_sharp else 0.95
        y_offset = 0.2 if is_sharp else 0
        x_offset = idx + (0.15 if is_sharp else 0)
        ax.add_patch(
            Rectangle(
                (x_offset, y_offset),
                width,
                height,
                facecolor=fill_color,
                edgecolor="#1b1f27",
                linewidth=0.7,
                zorder=2 if is_sharp else 1,
            )
        )

    for note in highlight:
        try:
            idx = PIANO_KEYS.index(note)
        except ValueError:
            continue
        is_sharp = "#" in note
        width = 0.7 if is_sharp else 0.95
        x_offset = idx + (0.15 if is_sharp else 0)
        ax.text(
            x_offset + width / 2,
            0.05 if not is_sharp else 0.22,
            note,
            ha="center",
            va="bottom",
            fontsize=7,
            color="#e3f6ff",
        )

    buffer = io.BytesIO()
    plt.tight_layout()
    fig.savefig(buffer, format="png", dpi=200, transparent=True)
    plt.close(fig)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def getAIChord(chord: str) -> dict:
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=(
            "Provide the notes ordered from low to high and with the octave to play for the following chord: "
            + chord
            + " Use a json format like this: {\"notes\": [\"note1\", \"note2\", ...]}"
        ),
    )
    notes = extract_notes_from_ai_response(response.text)
    if not notes:
        raise ValueError("Unable to parse chord notes from AI response")
    diagram = make_piano_diagram(notes)
    return {"chord": chord, "notes": notes, "diagram": diagram}


