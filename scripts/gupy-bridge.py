#!/usr/bin/env python3
"""
gupy-bridge.py — thin adapter between career-ops and gupy-job-scrapper.

Reads one JSON object from stdin, runs gupy_scraper.JobScraperService,
writes one JSON object to stdout.  All diagnostics go to stderr so stdout
stays JSON-clean.

Request schema:
  {
    "repo_path": "/abs/path/to/gupy-job-scrapper",
    "keywords": ["Full Stack", "Backend"],
    "date_start": "2026-07-24",          # ISO date or null
    "description_required_keywords": [],
    "workplace_types": ["remote", "hybrid"],
    "exclude_keywords": [],
    "state": "",
    "country": "",
    "job_types": ["vacancy_type_effective"],
    "description_chars": 4000
  }

Success response:
  {"ok": true, "engine": "<version>", "count": 123, "stats": {}, "jobs": [...]}

Error response (exit 1):
  {"ok": false, "error": "..."}
"""

import html
import json
import logging
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

logging.basicConfig(level=logging.WARNING, stream=sys.stderr)
log = logging.getLogger(__name__)


def fail(message: str) -> None:
    print(json.dumps({"ok": False, "error": message}))
    raise SystemExit(1)


def string_list(req: dict, key: str) -> list:
    value = req.get(key) or []
    if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
        fail(f"{key} must be a list of strings")
    return [item.strip() for item in value if item.strip()]


def strip_html(text: str) -> str:
    text = html.unescape(text or "")
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def truncate_stable(text: str, max_chars: int) -> str:
    """Deterministic prefix truncation — keeps fingerprints comparable across runs."""
    if max_chars <= 0 or len(text) <= max_chars:
        return text
    return text[:max_chars]


def to_iso(dt) -> str:
    if dt is None:
        return ""
    if isinstance(dt, datetime):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    return str(dt)


def main():
    try:
        req = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        fail(f"invalid JSON on stdin: {exc}")

    if not isinstance(req, dict):
        fail("request must be a JSON object")

    repo_path = req.get("repo_path", "")
    if not isinstance(repo_path, str) or not repo_path.strip():
        fail("repo_path is required and must be a string")

    scraper_pkg = Path(repo_path) / "packages" / "scraper"
    if not scraper_pkg.exists():
        fail(f"gupy_scraper package not found at {scraper_pkg}")

    sys.path.insert(0, str(scraper_pkg))

    try:
        from gupy_scraper import JobScraperService
    except ImportError as exc:
        fail(f"cannot import gupy_scraper: {exc}")

    keywords = string_list(req, "keywords")
    if not keywords:
        fail("keywords list is required and must not be empty")

    date_start_raw = req.get("date_start")
    date_start = None
    if date_start_raw:
        try:
            date_start = datetime.fromisoformat(date_start_raw).replace(tzinfo=timezone.utc)
        except (TypeError, ValueError) as exc:
            log.warning("ignoring invalid date_start %r: %s", date_start_raw, exc)

    try:
        description_chars = int(req.get("description_chars") or 4000)
    except (TypeError, ValueError):
        fail("description_chars must be a positive integer")
    if description_chars <= 0 or description_chars > 100_000:
        fail("description_chars must be between 1 and 100000")

    try:
        state = req.get("state") or None
        country = req.get("country") or None
        if state is not None and not isinstance(state, str):
            fail("state must be a string")
        if country is not None and not isinstance(country, str):
            fail("country must be a string")
        svc = JobScraperService(
            date_start=date_start,
            description_required_keywords=string_list(req, "description_required_keywords"),
            workplace_types=string_list(req, "workplace_types"),
            exclude_keywords=string_list(req, "exclude_keywords"),
            state=state,
            country=country,
            job_types=string_list(req, "job_types"),
        )
        vacancies, stats = svc.search_jobs(keywords)
    except Exception as exc:
        fail(f"JobScraperService error: {exc}")

    if not isinstance(vacancies, list):
        fail("JobScraperService returned a non-list vacancies value")

    jobs = []
    for v in vacancies:
        if not isinstance(v, dict):
            log.warning("ignoring non-object vacancy: %r", v)
            continue
        raw_desc = v.get("description") or ""
        clean_desc = truncate_stable(strip_html(raw_desc), description_chars)
        jobs.append({
            "job_id": str(v.get("job_id") or ""),
            "company": str(v.get("career_page_name") or v.get("company_id") or ""),
            "name": str(v.get("name") or ""),
            "url": str(v.get("job_url") or ""),
            "type": str(v.get("type") or ""),
            "city": str(v.get("city") or ""),
            "state": str(v.get("state") or ""),
            "country": str(v.get("country") or ""),
            "workplace_types": v.get("workplace_types") if isinstance(v.get("workplace_types"), list) else [],
            "published_date": to_iso(v.get("published_date")),
            "description": clean_desc,
        })

    try:
        engine_version = JobScraperService.__module__.split(".")[0] + " (gupy_scraper)"
    except Exception:
        engine_version = "gupy_scraper"

    out = {
        "ok": True,
        "engine": engine_version,
        "count": len(jobs),
        "stats": {
            k: v
            for k, v in (stats.items() if isinstance(stats, dict) else [])
            if isinstance(v, (int, float, str, bool, type(None)))
        },
        "jobs": jobs,
    }
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
