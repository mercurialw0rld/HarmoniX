from firecrawl import Firecrawl
from pydantic import BaseModel
from google import genai
import os
from os.path import join, dirname
import asyncio
from dotenv import load_dotenv

dotenv_path = join(dirname(__file__), '.env')
load_dotenv(dotenv_path)

client = genai.Client(api_key=os.getenv("GEMINI"))

app = Firecrawl(api_key=os.getenv("FIRECRAWL"))

class SongChords(BaseModel):
    song_title: str
    artist: str
    chords: list[str]
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

