#!/usr/bin/env python3
"""
FUXA SCADA Gauge-Grid Generator (reverse-flow dashboard reproducibility)

Purpose:
    Regenerate (or create) a FUXA view containing a grid of radial gauges —
    one per telemetry tag exposed by the portal's reverse-flow endpoint
    (GET /api/scada/tags) — and persist it via FUXA's `set-view` API.

    This makes the FUXA operator dashboard reproducible from code: re-run it
    any time the portal's telemetry tag set changes (new machines/metrics) to
    refresh the dashboard without hand-authoring gauges in the FUXA editor.

    The script is a faithful clone of a gauge authored in the FUXA editor
    (svg-ext-html_bag): it reuses the editor's exact item + SVG + options
    structure, only varying id/position/variableId/min-max/labeled zones.

Usage:
    # defaults: FUXA at http://localhost:1881, portal tags at
    # http://127.0.0.1:3000/api/scada/tags, view "MainView", 5 columns
    python3 scripts/fuxa-gauge-grid.py

    # override via flags / env
    FUXA_API_KEY=secret python3 scripts/fuxa-gauge-grid.py \\
        --fuxa-url http://localhost:1881 \\
        --tags-url http://127.0.0.1:3000/api/scada/tags \\
        --view MainView --cols 5

    # preview without writing
    python3 scripts/fuxa-gauge-grid.py --dry-run

Environment:
    FUXA_URL        FUXA base URL (default http://localhost:1881)
    FUXA_API_KEY    optional API key sent as `x-api-key` (never printed)
    PORTAL_TAGS_URL portal reverse-flow tags endpoint (default
                    http://127.0.0.1:3000/api/scada/tags)
    FUXA_VIEW_NAME  target view name (default MainView)

Notes:
    - No third-party dependencies (stdlib only).
    - The API key is read from env/flag and sent only in the `x-api-key`
      header; it is never printed or logged.
    - Per-metric gauge ranges: known drilling metrics use a built-in RANGES
      map; unknown tags auto-range from the current value.
"""

import argparse
import copy
import json
import os
import sys
import urllib.request
import uuid

# ── Defaults ────────────────────────────────────────────────────────────────
DEFAULT_FUXA_URL = "http://localhost:1881"
DEFAULT_TAGS_URL = "http://127.0.0.1:3000/api/scada/tags"
DEFAULT_VIEW = "MainView"
DEFAULT_COLS = 5
CANVAS_W, CANVAS_H = 1024, 768
GAUGE_W, GAUGE_H = 180, 180

# Known telemetry metrics → gauge (min, max). Extend as new metrics appear.
RANGES = {
    "engine_rpm": (0, 3000),
    "engine_temp": (0, 150),
    "hydraulic_pressure": (0, 400),
    "vibration_level": (0, 2),
    "fuel_level": (0, 100),
    "bit_depth": (0, 50),
    "penetration_rate": (0, 30),
    "rotary_speed": (0, 400),
    "pull_down_force": (0, 100),
}

# Faithful copy of a FUXA editor-authored svg-ext-html_bag gauge options,
# used as the styling baseline when the target view has no gauge to clone.
DEFAULT_OPTIONS = {
    "minValue": 0, "maxValue": 3000, "animationSpeed": 40,
    "colorStart": "#6fadcf", "colorStop": "#6fadcf", "gradientType": "",
    "strokeColor": "#e0e0e0",
    "pointer": {"length": 0.6, "strokeWidth": 0.05, "iconScale": 1, "color": "#000000"},
    "angle": -0.25, "lineWidth": 0.2, "radiusScale": 0.9, "fontSize": 18,
    "textFilePosition": 30, "limitMax": False, "limitMin": False,
    "highDpiSupport": True, "backgroundColor": "rgba(255, 255, 255, 0)",
    "shadowColor": "#d5d5d5", "fractionDigits": 0, "ticksEnabled": True,
    "renderTicks": {"divisions": 5, "divWidth": 1.1, "divLength": 0.7,
                    "divColor": "#333333", "subDivisions": 3, "subLength": 0.5,
                    "subWidth": 0.6, "subColor": "#666666"},
    "staticLabelsText": "", "staticFontSize": 10, "staticFontColor": "#000000",
    "staticLabels": {"font": "10px sans-serif", "labels": [], "fractionDigits": 0,
                     "color": "#000000"},
    "staticZones": [], "type": 2,
}

DEFAULT_PROFILE = {"width": CANVAS_W, "height": CANVAS_H, "bkcolor": "#ffffffff",
                   "margin": 10, "align": "topCenter", "gridType": "fixed",
                   "viewRenderDelay": 0}


def short_id():
    """FUXA-style 8hex-8hex identifier."""
    return uuid.uuid4().hex[:8] + "-" + uuid.uuid4().hex[:8]


def http_json(url, method="GET", body=None, key=None):
    headers = {"Content-Type": "application/json"}
    if key:
        headers["x-api-key"] = key
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return resp.status, resp.read().decode()


def range_for(tag_id, value):
    """Resolve (min, max) for a tag: RANGES by suffix, else auto-range."""
    for suffix, rng in RANGES.items():
        if tag_id.endswith(suffix):
            return rng
    v = value if isinstance(value, (int, float)) else 0
    import math
    mx = max(100, math.ceil(v * 1.25)) if v > 0 else 100
    return 0, mx


def zones(mn, mx):
    span = mx - mn
    return [
        {"strokeStyle": "#F03E3E", "min": mn, "max": mn + span * 0.1},
        {"strokeStyle": "#FFDD00", "min": mn + span * 0.1, "max": mn + span * 0.3},
        {"strokeStyle": "#3F4964", "min": mn + span * 0.3, "max": mn + span * 0.8},
        {"strokeStyle": "#FFDD00", "min": mn + span * 0.8, "max": mn + span * 0.9},
        {"strokeStyle": "#F03E3E", "min": mn + span * 0.9, "max": mx},
    ]


def labels(mn, mx):
    return [mn, round(mn + (mx - mn) * 0.25), round(mn + (mx - mn) * 0.5),
            round(mn + (mx - mn) * 0.75), mx]


def gauge_svg(bag, svgid, hbag, dbag, x, y, idx):
    return (
        f'  <g stroke="#000000" xml:space="preserve" text-anchor="right" '
        f'font-family="sans-serif" font-size="14" fill="#FFFFFF" '
        f'type="svg-ext-html_bag" id="{bag}">\n'
        f'   <rect stroke="null" id="{svgid}" height="{GAUGE_H}" width="{GAUGE_W}" '
        f'y="{y}" x="{x}" stroke-width="0"/>\n'
        f'   <foreignObject stroke="null" id="{hbag}" width="{GAUGE_W}" '
        f'height="{GAUGE_H}" y="{y}" x="{x}">\n'
        f'    <DIV stroke="null" style="width: 100%; height: 100%; '
        f'vector-effect: non-scaling-stroke;" id="{dbag}">\n'
        f'     <NGX-GAUGE class="ng-star-inserted">\n'
        f'      <DIV class="mygauge-container">\n'
        f'       <DIV style="font-size: 18px; color: rgb(0, 0, 0); top: 30%;" '
        f'class="mygauge-value">1</DIV>\n'
        f'       <CANVAS class="mygauge-canvas" height="{GAUGE_H}" '
        f'width="{GAUGE_W}" id="myGauge_{idx}"/>\n'
        f'      </DIV>\n'
        f'     </NGX-GAUGE>\n'
        f'    </DIV>\n'
        f'   </foreignObject>\n'
        f'  </g>'
    )


def main():
    ap = argparse.ArgumentParser(description="Generate a FUXA gauge-grid dashboard.")
    ap.add_argument("--fuxa-url", default=os.environ.get("FUXA_URL", DEFAULT_FUXA_URL))
    ap.add_argument("--tags-url", default=os.environ.get("PORTAL_TAGS_URL", DEFAULT_TAGS_URL))
    ap.add_argument("--view", default=os.environ.get("FUXA_VIEW_NAME", DEFAULT_VIEW))
    ap.add_argument("--cols", type=int, default=DEFAULT_COLS)
    ap.add_argument("--key", default=os.environ.get("FUXA_API_KEY"),
                    help="FUXA API key (or set FUXA_API_KEY env). Not printed.")
    ap.add_argument("--dry-run", action="store_true", help="preview without writing")
    args = ap.parse_args()
    key = args.key or None

    # 1. fetch telemetry tags from the portal reverse-flow endpoint
    tags_endpoint = args.tags_url.rstrip("/")
    if "scada/tags" not in tags_endpoint:
        tags_endpoint = tags_endpoint + "/api/scada/tags"
    st, raw = http_json(tags_endpoint, key=None)
    tags = json.loads(raw)
    if not tags:
        print("No telemetry tags found at", tags_endpoint, file=sys.stderr)
        return 1
    print(f"portal tags: {len(tags)} ({tags_endpoint})")

    # 2. fetch FUXA project + locate/create the target view
    st, raw = http_json(args.fuxa_url.rstrip("/") + "/api/project", key=key)
    proj = json.loads(raw)
    views = proj.setdefault("hmi", {}).setdefault("views", [])
    view = next((v for v in views if v.get("name") == args.view), None)
    if view is None:
        view = {"id": "v_" + short_id(), "name": args.view, "type": "svg",
                "profile": copy.deepcopy(DEFAULT_PROFILE), "items": {},
                "variables": {}, "svgcontent": "", "property": {}}
        views.append(view)
        print(f"created view: {view['id']} ({args.view})")
    else:
        print(f"existing view: {view['id']} ({args.view}) — gauges will be replaced")

    # 3. styling baseline: clone the first existing gauge's options if present,
    #    else DEFAULT_OPTIONS (faithful editor-authored template).
    existing = list(view.get("items", {}).values())
    base_opts = copy.deepcopy(existing[0]["property"]["options"]) if existing \
        else copy.deepcopy(DEFAULT_OPTIONS)

    # 4. build the grid
    cols = max(1, args.cols)
    rows = (len(tags) + cols - 1) // cols
    col_step = CANVAS_W // cols
    row_step = CANVAS_H // rows if rows else CANVAS_H
    x0 = max(8, (col_step - GAUGE_W) // 2)
    y0 = max(8, (row_step - GAUGE_H) // 2)

    items = {}
    svgs = []
    for i, t in enumerate(tags):
        tag = t.get("id") or t.get("name")
        val = t.get("value")
        mn, mx = range_for(tag, val)
        bag = "BAG_" + short_id()
        opts = copy.deepcopy(base_opts)
        opts["minValue"] = mn
        opts["maxValue"] = mx
        labs = labels(mn, mx)
        opts["staticLabels"]["labels"] = labs
        opts["staticLabelsText"] = ";".join(str(l) for l in labs)
        opts["staticZones"] = zones(mn, mx)
        items[bag] = {
            "id": bag, "type": "svg-ext-html_bag", "name": f"gauge_{i + 1}",
            "property": {"variableId": tag, "events": [], "actions": [], "options": opts},
            "label": "HtmlBag", "hide": False, "lock": False,
        }
        col, row = i % cols, i // cols
        x = x0 + col * col_step
        y = y0 + row * row_step
        svgs.append(gauge_svg(bag, "svg_" + short_id(), "H-BAG_" + short_id(),
                              "D-BAG_" + short_id(), x, y, i))

    svg = (
        f'<svg width="{CANVAS_W}" height="{CANVAS_H}" '
        f'xmlns="http://www.w3.org/2000/svg" '
        f'xmlns:svg="http://www.w3.org/2000/svg" '
        f'xmlns:html="http://www.w3.org/1999/xhtml">\n'
        f' <filter id="blur-filter" x="-3" y="-3" width="200" height="200">\n'
        f'  <feGaussianBlur stdDeviation="3"/>\n </filter>\n <g>\n'
        f'  <title>Layer 1</title>\n' + "\n".join(svgs) + "\n </g>\n</svg>"
    )
    view["items"] = items
    view["svgcontent"] = svg

    print(f"gauges: {len(items)} (grid {cols}x{rows})")
    for it in items.values():
        o = it["property"]["options"]
        print(f"  {it['name']:<10} {it['property']['variableId']:<40} {o['minValue']}-{o['maxValue']}")

    if args.dry_run:
        print("dry-run: not writing"); return 0

    st, resp = http_json(args.fuxa_url.rstrip("/") + "/api/projectData",
                         "POST", {"cmd": "set-view", "data": view}, key=key)
    print(f"set-view HTTP {st} {resp[:120]}")
    return 0 if st == 200 else 1


if __name__ == "__main__":
    sys.exit(main())