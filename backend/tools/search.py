import os
import urllib.parse
import httpx


async def search_resources(query: str) -> list[dict]:
    """Search YouTube for a relevant tutorial video.
    With YOUTUBE_API_KEY: returns an embeddable video URL.
    Without key: returns a YouTube search page link (no embed, but still useful).
    YouTube Data API v3 is free — 10,000 queries/day via Google Cloud Console.
    """
    api_key = os.getenv("YOUTUBE_API_KEY")

    if api_key:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://www.googleapis.com/youtube/v3/search",
                    params={
                        "part": "snippet",
                        "q": query,
                        "type": "video",
                        "maxResults": 1,
                        "key": api_key,
                        "relevanceLanguage": "en",
                        "safeSearch": "moderate",
                    },
                    timeout=10,
                )
                resp.raise_for_status()
                items = resp.json().get("items", [])

            if items:
                video_id = items[0]["id"]["videoId"]
                title    = items[0]["snippet"]["title"]
                return [{
                    "title":    title,
                    "url":      f"https://www.youtube.com/embed/{video_id}?rel=0",
                    "snippet":  items[0]["snippet"].get("description", ""),
                }]
        except Exception as e:
            print(f"[search] YouTube API error: {e} — falling back to search link")

    # Fallback: search results link (not embeddable, but still navigable)
    search_query = urllib.parse.quote_plus(query)
    return [{"title": query, "url": f"https://www.youtube.com/results?search_query={search_query}", "snippet": ""}]
