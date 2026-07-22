"""
Exa people search - Senior Software Engineer sourcing (New York / Maryland)

Finds candidates matching professional sourcing criteria and returns
structured records for a recruiting pipeline.

Criteria captured:
  - Current title: Senior Software Engineer
  - ~8-11 years total software engineering experience
  - Startup experience + 3+ years at a major consulting firm
    (Accenture, Deloitte, Thoughtworks, Slalom, IBM)
  - Master's degree preferred, top-100 university
  - Located in New York State or Maryland

Setup:
  pip install exa-py==2.14.0
  $env:EXA_API_KEY = "50c01336-1934-4e31-9e38-e9fc6f26d0dd"        # do NOT hardcode the key
  python exa_people_search.py
"""

import os
import json
from exa_py import Exa
EXA_API_KEY = ""

# Structured shape Exa synthesizes for each candidate.
# (Schema limits: <= 10 total properties, nesting depth <= 2.)
CANDIDATE_SCHEMA = {
    "type": "object",
    "required": ["candidates"],
    "properties": {
        "candidates": {
            "type": "array",
            "description": "People matching the sourcing criteria",
            "items": {
                "type": "object",
                "required": ["name", "source_url"],
                "properties": {
                    "name": {"type": "string", "description": "Full name"},
                    "current_title": {"type": "string", "description": "Current job title"},
                    "current_company": {"type": "string", "description": "Current employer"},
                    "location": {"type": "string", "description": "City / state, e.g. New York, NY"},
                    "consulting_firm": {
                        "type": "string",
                        "description": "Major consulting firm and approximate tenure, if any",
                    },
                    "startup_experience": {
                        "type": "string",
                        "description": "Startup company experience, if any",
                    },
                    "education": {
                        "type": "string",
                        "description": "Highest degree and university",
                    },
                    "source_url": {"type": "string", "description": "Profile / source URL"},
                },
            },
        }
    },
}

QUERY = (
    "Male, who is senior software engineer having 8~11 years of software engineering experience with startup experience and several years at a major management consulting firm such as Accenture, Deloitte,  Thoughtworks, Slalom, or IBM, holding a master's degree, based in New York or Maryland. Important thing is to find male who originally East Asian."
)

SYSTEM_PROMPT = (
    "Prefer authoritative professional profiles. Collapse duplicate profiles for the same person. Only include people whose current title is Senior Software Engineer (or equivalent) and who show both startup and consulting-firm experience. Keep every field grounded in the source."
)


def find_candidates(num_results: int = 25):
    api_key = os.environ.get("EXA_API_KEY")
    if not api_key:
        raise SystemExit("Set EXA_API_KEY in your environment first.")

    exa = Exa(api_key=api_key)

    return exa.search(
        QUERY,
        category="people",
        type="auto",            # switch to "deep" for stronger fact verification
        num_results=num_results,
        system_prompt=SYSTEM_PROMPT,
        output_schema=CANDIDATE_SCHEMA,
        contents={"highlights": True},
    )


def main():
    results = find_candidates()

    # Structured, grounded output (populated when schema synthesis runs)
    candidates = []
    output = getattr(results, "output", None)
    if output is not None and getattr(output, "content", None):
        content = output.content
        if isinstance(content, dict):
            candidates = content.get("candidates", [])

    if candidates:
        print(f"{len(candidates)} candidate(s) synthesized:\n")
        for c in candidates:
            print(f"- {c.get('name', '?')} | {c.get('current_title', '')} @ {c.get('current_company', '')}")
            print(f"    location:   {c.get('location', '')}")
            print(f"    consulting: {c.get('consulting_firm', '')}")
            print(f"    startup:    {c.get('startup_experience', '')}")
            print(f"    education:  {c.get('education', '')}")
            print(f"    source:     {c.get('source_url', '')}\n")
    else:
        print("No synthesized output returned - showing raw matches:\n")
        for r in results.results:
            print(f"- {r.title} | {r.url}")

    # Always keep the raw hits too, for manual review / debugging
    raw = [
        {"title": r.title, "url": r.url, "highlights": getattr(r, "highlights", None)}
        for r in results.results
    ]
    with open("exa_candidates.json", "w") as f:
        json.dump({"candidates": candidates, "raw_results": raw}, f, indent=2)
    print("\nSaved -> exa_candidates.json")


if __name__ == "__main__":
    main()