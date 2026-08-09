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
        out = {"ok": False, "error": f"invalid JSON on stdin: {exc}"}
        print(json.dumps(out))
        sys.exit(1)

    repo_path = req.get("repo_path", "")
    if not repo_path:
        out = {"ok": False, "error": "repo_path is required"}
        print(json.dumps(out))
        sys.exit(1)

    scraper_pkg = Path(repo_path) / "packages" / "scraper"
    if not scraper_pkg.exists():
        out = {"ok": False, "error": f"gupy_scraper package not found at {scraper_pkg}"}
        print(json.dumps(out))
        sys.exit(1)

    sys.path.insert(0, str(scraper_pkg))

    try:
        from gupy_scraper import JobScraperService
    except ImportError as exc:
        out = {"ok": False, "error": f"cannot import gupy_scraper: {exc}"}
        print(json.dumps(out))
        sys.exit(1)

    keywords = req.get("keywords") or []
    if not keywords:
        out = {"ok": False, "error": "keywords list is required and must not be empty"}
        print(json.dumps(out))
        sys.exit(1)

    date_start_raw = req.get("date_start")
    date_start = None
    if date_start_raw:
        try:
            date_start = datetime.fromisoformat(date_start_raw).replace(tzinfo=timezone.utc)
        except ValueError as exc:
            log.warning("ignoring invalid date_start %r: %s", date_start_raw, exc)

    description_chars = int(req.get("description_chars") or 4000)

    try:
        svc = JobScraperService(
            date_start=date_start,
            description_required_keywords=req.get("description_required_keywords") or [],
            workplace_types=req.get("workplace_types") or [],
            exclude_keywords=req.get("exclude_keywords") or [],
            state=req.get("state") or None,
            country=req.get("country") or None,
            job_types=req.get("job_types") or [],
        )
        vacancies, stats = svc.search_jobs(keywords)
    except Exception as exc:
        out = {"ok": False, "error": f"JobScraperService error: {exc}"}
        print(json.dumps(out))
        sys.exit(1)

    jobs = []
    for v in vacancies:
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
            "workplace_types": list(v.get("workplace_types") or []),
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
        "stats": {k: v for k, v in (stats or {}).items() if isinstance(v, (int, float, str, bool, type(None)))},
        "jobs": jobs,
    }
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
