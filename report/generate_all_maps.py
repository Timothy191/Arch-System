import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ------------------------------------------------------------------
# CONFIGURATION & CONSTANTS
# ------------------------------------------------------------------
WIDTH, HEIGHT = 1920, 1080
OUTPUT_DIR = "/home/timothy/Project/Arch-Mk2/report"

# File outputs
FLOWS_DARK_PATH = os.path.join(OUTPUT_DIR, "system_flows_dark.png")
DB_WEBHOOK_PATH = os.path.join(OUTPUT_DIR, "database_webhook_flow.png")
OFFLINE_SYNC_PATH = os.path.join(OUTPUT_DIR, "offline_sync_pipeline.png")
MONITORING_PATH = os.path.join(OUTPUT_DIR, "monitoring_observability.png")

# Font paths
FONT_TITLE_PATH = "/usr/share/fonts/truetype/quicksand/Quicksand-Bold.ttf"
FONT_TEXT_PATH = "/usr/share/fonts/truetype/inter-vf/InterVariable.ttf"

# Load fonts with fallbacks
try:
    font_title = ImageFont.truetype(FONT_TITLE_PATH, 38)
    font_subtitle = ImageFont.truetype(FONT_TEXT_PATH, 16)
    font_node_header = ImageFont.truetype(FONT_TITLE_PATH, 18)
    font_node_subtext = ImageFont.truetype(FONT_TEXT_PATH, 13)
    font_node_small = ImageFont.truetype(FONT_TEXT_PATH, 11)
    font_line_label = ImageFont.truetype(FONT_TEXT_PATH, 10)
    font_legend = ImageFont.truetype(FONT_TEXT_PATH, 14)
except Exception as e:
    print(f"Font loading error: {e}. Falling back to default.")
    font_title = font_subtitle = font_node_header = font_node_subtext = font_node_small = font_line_label = font_legend = ImageFont.load_default()

# Theme Colors (Premium Dark Mode Theme)
COLOR_BG_START = (10, 14, 26)  # Deep Slate Black
COLOR_BG_END = (2, 4, 8)       # Pure Dark Slate
COLOR_GRID = (255, 255, 255, 6) # Soft white grid lines
COLOR_TEXT_PRIMARY = (255, 255, 255) # White
COLOR_TEXT_SECONDARY = (148, 163, 184) # Slate 400
COLOR_TEXT_MUTED = (100, 116, 139) # Slate 500

# Accent Colors (RGBA)
ACCENT_BLUE = (59, 130, 246)
ACCENT_CYAN = (6, 182, 212)
ACCENT_PURPLE = (139, 92, 246)
ACCENT_AMBER = (245, 158, 11)
ACCENT_GREEN = (16, 185, 129)
ACCENT_TEAL = (20, 184, 166)
ACCENT_ROSE = (244, 63, 94)
ACCENT_INDIGO = (99, 102, 241)
ACCENT_SLATE = (148, 163, 184)

# ------------------------------------------------------------------
# RENDER HELPERS
# ------------------------------------------------------------------

def draw_gradient(draw, width, height, start_color, end_color):
    """Draws a vertical gradient background."""
    for y in range(height):
        ratio = y / height
        r = int(start_color[0] * (1 - ratio) + end_color[0] * ratio)
        g = int(start_color[1] * (1 - ratio) + end_color[1] * ratio)
        b = int(start_color[2] * (1 - ratio) + end_color[2] * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b, 255))

def draw_grid(draw, width, height, grid_size=60):
    """Draws a subtle background coordinate grid."""
    for x in range(0, width, grid_size):
        draw.line([(x, 0), (x, height)], fill=COLOR_GRID, width=1)
    for y in range(0, height, grid_size):
        draw.line([(0, y), (width, y)], fill=COLOR_GRID, width=1)

def draw_glow_blob(img, x, y, radius, color):
    """Creates a beautiful glowing background blob using GaussianBlur."""
    blob_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    blob_draw = ImageDraw.Draw(blob_layer)
    
    # Draw concentric circles with decreasing opacity
    for r in range(radius, 0, -20):
        pct = (1.0 - (r / radius) ** 1.5)
        opacity = int(pct * color[3])
        if opacity > 0:
            blob_draw.ellipse(
                [x - r, y - r, x + r, y + r],
                fill=(color[0], color[1], color[2], opacity)
            )
            
    # Apply heavy blur to blend nicely
    blurred = blob_layer.filter(ImageFilter.GaussianBlur(50))
    img.alpha_composite(blurred)

def draw_shadow(img, x, y, w, h, radius=12, offset_x=0, offset_y=0, blur=15):
    """Draws a soft glow shadow layer for a dark card (acting as ambient card shadow)."""
    shadow_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow_layer)
    
    shadow_draw.rounded_rectangle(
        [x, y, x + w, y + h],
        radius=radius,
        fill=(0, 0, 0, 180) # deep black shadow
    )
    
    blurred = shadow_layer.filter(ImageFilter.GaussianBlur(blur))
    img.alpha_composite(blurred)

def draw_glass_card(img, x, y, w, h, accent_color, radius=12, title="", subtext_list=None):
    """Draws a beautiful dark glassmorphic card with colored top accent line."""
    # 1. Shadow
    draw_shadow(img, x, y, w, h, radius=radius)
    
    # 2. Glass Base Card (on main image)
    card_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    card_draw = ImageDraw.Draw(card_layer)
    
    # Semi-transparent dark card fill
    card_draw.rounded_rectangle(
        [x, y, x + w, y + h],
        radius=radius,
        fill=(20, 28, 48, 205) # 80% dark blue-gray
    )
    
    # Faint card border
    card_draw.rounded_rectangle(
        [x, y, x + w, y + h],
        radius=radius,
        outline=(accent_color[0], accent_color[1], accent_color[2], 80),
        width=1
    )
    
    # Top colorful accent bar (thickness 4px)
    card_draw.rounded_rectangle(
        [x, y, x + w, y + 4],
        radius=radius,
        fill=(accent_color[0], accent_color[1], accent_color[2], 255)
    )
    
    img.alpha_composite(card_layer)
    
    # 3. Text rendering
    draw = ImageDraw.Draw(img)
    if title:
        draw.text((x + 18, y + 16), title, fill=COLOR_TEXT_PRIMARY, font=font_node_header)
        
    if subtext_list:
        curr_y = y + 42
        for line in subtext_list:
            draw.text((x + 18, curr_y), line, fill=COLOR_TEXT_SECONDARY, font=font_node_subtext)
            curr_y += 20

def draw_sub_pill(img, x, y, w, h, title, subtitle="", border_color=ACCENT_BLUE):
    """Draws a smaller dark sub-pill inside a layout card."""
    draw = ImageDraw.Draw(img)
    # Fill background
    draw.rounded_rectangle(
        [x, y, x + w, y + h],
        radius=6,
        fill=(15, 23, 42, 230), # dark background
        outline=(border_color[0], border_color[1], border_color[2], 70),
        width=1
    )
    
    # Accent indicator dot
    draw.ellipse([x + 10, y + h//2 - 4, x + 18, y + h//2 + 4], fill=border_color)
    
    # Text
    draw.text((x + 28, y + 6), title, fill=COLOR_TEXT_PRIMARY, font=font_node_subtext)
    if subtitle:
        draw.text((x + 28, y + h - 18), subtitle, fill=COLOR_TEXT_MUTED, font=font_node_small)

def draw_connection_line(img, start, end, color=ACCENT_BLUE, label="", curve_direction="direct"):
    """Draws a connection line between two coordinates with direction dots and a text label."""
    draw = ImageDraw.Draw(img)
    x1, y1 = start
    x2, y2 = end
    
    # 1. Draw line based on curve_direction
    if curve_direction == "direct":
        draw.line([start, end], fill=(color[0], color[1], color[2], 200), width=2)
    elif curve_direction == "h-v":
        mid_x = x2
        mid_y = y1
        draw.line([start, (mid_x, mid_y)], fill=(color[0], color[1], color[2], 200), width=2)
        draw.line([(mid_x, mid_y), end], fill=(color[0], color[1], color[2], 200), width=2)
    elif curve_direction == "v-h":
        mid_x = x1
        mid_y = y2
        draw.line([start, (mid_x, mid_y)], fill=(color[0], color[1], color[2], 200), width=2)
        draw.line([(mid_x, mid_y), end], fill=(color[0], color[1], color[2], 200), width=2)
    elif curve_direction == "s-curve":
        mid_x = (x1 + x2) // 2
        draw.line([start, (mid_x, y1)], fill=(color[0], color[1], color[2], 200), width=2)
        draw.line([(mid_x, y1), (mid_x, y2)], fill=(color[0], color[1], color[2], 200), width=2)
        draw.line([(mid_x, y2), end], fill=(color[0], color[1], color[2], 200), width=2)

    # 2. Draw Start Dot and End Arrow/Dot
    draw.ellipse([x1 - 4, y1 - 4, x1 + 4, y1 + 4], fill=(color[0], color[1], color[2], 255))
    draw.ellipse([x2 - 6, y2 - 6, x2 + 6, y2 + 6], fill=(color[0], color[1], color[2], 255))
    
    # 3. Draw Label
    if label:
        if curve_direction == "direct":
            mx, my = (x1 + x2) // 2, (y1 + y2) // 2
        elif curve_direction == "h-v":
            mx, my = (x1 + x2) // 2, y1
        elif curve_direction == "v-h":
            mx, my = x1, (y1 + y2) // 2
        elif curve_direction == "s-curve":
            mx, my = (x1 + x2) // 2, (y1 + y2) // 2
            
        # Draw background pill for text
        lbl_w = int(font_line_label.getlength(label)) + 12
        lbl_h = 18
        draw.rounded_rectangle(
            [mx - lbl_w//2, my - lbl_h//2, mx + lbl_w//2, my + lbl_h//2],
            radius=4,
            fill=(10, 14, 26, 255), # dark bg matching gradient
            outline=(color[0], color[1], color[2], 180),
            width=1
        )
        draw.text((mx, my), label, fill=COLOR_TEXT_PRIMARY, font=font_line_label, anchor="mm")

def draw_header_title(draw, title_str, subtitle_str):
    """Draws consistent headers across all maps."""
    draw.rectangle([90, 48, 96, 122], fill=ACCENT_BLUE)
    draw.text((112, 44), title_str, fill=COLOR_TEXT_PRIMARY, font=font_title)
    draw.text((114, 98), subtitle_str, fill=COLOR_TEXT_SECONDARY, font=font_subtitle)

def draw_footer_legend(draw, legend_items):
    """Draws standard footers with a custom legend."""
    draw.rectangle([90, 978, WIDTH - 90, 980], fill=COLOR_GRID)
    draw.text((90, 995), "SYSTEM FLOWMAP LEGEND:", fill=COLOR_TEXT_MUTED, font=font_legend)
    
    curr_lx = 300
    for label, col in legend_items:
        draw.rounded_rectangle([curr_lx, 998, curr_lx + 15, 1013], radius=3, fill=col)
        draw.text((curr_lx + 23, 997), label, fill=COLOR_TEXT_SECONDARY, font=font_legend)
        curr_lx += 200
        
    draw.text((WIDTH - 90, 997), "Generated automatically by Antigravity AI • 2026", fill=COLOR_TEXT_MUTED, font=font_legend, anchor="rm")

# ------------------------------------------------------------------
# DIAGRAM GENERATORS
# ------------------------------------------------------------------

def generate_flows_dark():
    print("Generating system_flows_dark.png...")
    img = Image.new("RGBA", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(img)
    
    draw_gradient(draw, WIDTH, HEIGHT, COLOR_BG_START, COLOR_BG_END)
    draw_grid(draw, WIDTH, HEIGHT, grid_size=60)
    
    # Ambient Blurs
    draw_glow_blob(img, 200, 300, 250, ACCENT_BLUE + (35,))
    draw_glow_blob(img, 700, 600, 350, ACCENT_PURPLE + (30,))
    draw_glow_blob(img, 1300, 200, 300, ACCENT_AMBER + (30,))
    draw_glow_blob(img, 1600, 500, 400, ACCENT_GREEN + (35,))
    
    # Connections
    draw_connection_line(img, (380, 500), (460, 370), color=ACCENT_BLUE, label="HTTP Request / Navigation", curve_direction="s-curve")
    draw_connection_line(img, (380, 500), (460, 650), color=ACCENT_ROSE, label="Telemetry Socket / API Calls", curve_direction="s-curve")
    draw_connection_line(img, (740, 650), (1240, 450), color=ACCENT_ROSE, label="Redis Key Lookup / Rate Check", curve_direction="s-curve")
    draw_connection_line(img, (740, 310), (1240, 270), color=ACCENT_PURPLE, label="Query Role / Session Context", curve_direction="s-curve")
    draw_connection_line(img, (740, 370), (820, 560), color=ACCENT_BLUE, label="Allow & Forward", curve_direction="direct")
    draw_connection_line(img, (740, 430), (1580, 275), color=ACCENT_SLATE, label="Fall back to DB on L1/L2 miss", curve_direction="s-curve")
    
    draw_connection_line(img, (1160, 255), (1240, 270), color=ACCENT_AMBER, label="L1 Memory Get (<0.1ms)")
    draw_connection_line(img, (1160, 450), (1240, 450), color=ACCENT_AMBER, label="L2 Redis / Cache Wrap")
    draw_connection_line(img, (1160, 650), (1240, 655), color=ACCENT_INDIGO, label="Enqueues Job Event", curve_direction="s-curve")
    draw_connection_line(img, (1160, 830), (1240, 850), color=ACCENT_ROSE, label="Emit Performance Metrics", curve_direction="s-curve")
    
    draw_connection_line(img, (1370, 340), (1370, 380), color=ACCENT_AMBER, label="Write-Through / Fallback")
    draw_connection_line(img, (1160, 310), (1580, 275), color=ACCENT_GREEN, label="SQL CRUD Operations", curve_direction="s-curve")
    draw_connection_line(img, (1160, 410), (1580, 455), color=ACCENT_TEAL, label="Offloads SELECT Reads", curve_direction="s-curve")
    draw_connection_line(img, (1720, 350), (1720, 390), color=ACCENT_GREEN, label="PG Streaming Replication")
    
    draw_connection_line(img, (1500, 655), (1720, 350), color=ACCENT_INDIGO, label="Processes Deferred Mutations", curve_direction="s-curve")
    draw_connection_line(img, (1580, 645), (1450, 450), color=ACCENT_SLATE, label="CMS Auth cache", curve_direction="s-curve")
    draw_connection_line(img, (1580, 645), (1720, 350), color=ACCENT_SLATE, label="Read wiki content", curve_direction="s-curve")
    draw_connection_line(img, (1580, 835), (1720, 350), color=ACCENT_SLATE, label="Fetch telemetry", curve_direction="s-curve")

    # Column 1: Client
    draw_glass_card(img, 100, 400, 280, 200, ACCENT_CYAN,
                    title="User Browser Client",
                    subtext_list=[
                        "• Next.js App Shell (React 19)",
                        "• maplibre-gl / deck.gl maps",
                        "• Recharts Operations Panels",
                        "• Zustand Client State Store",
                        "• Client-side Cache"
                    ])
                    
    # Column 2: Gating
    draw_glass_card(img, 460, 250, 280, 240, ACCENT_PURPLE,
                    title="Next.js Middleware",
                    subtext_list=[
                        "• Route Gate Security Filters",
                        "• Auth Token Session Refresh",
                        "• Dept-Slug to UUID Mapping",
                        "• Role-based Access Rules",
                        "• Caches metadata in L1/L2",
                        "• Bypass '/api/c66' endpoint"
                    ])
                    
    draw_glass_card(img, 460, 560, 280, 180, ACCENT_ROSE,
                    title="API Rate Limiter",
                    subtext_list=[
                        "• Distributed Rate Guard",
                        "• Redis-backed atomic count",
                        "• IP/User ID token bucket",
                        "• Local Map fallback on Redis fail",
                        "• Headers: X-RateLimit-*"
                    ])

    # Column 3: App Router
    draw_shadow(img, 820, 160, 340, 820)
    container_draw = ImageDraw.Draw(img)
    container_draw.rounded_rectangle([820, 160, 1160, 980], radius=16, fill=(20, 28, 48, 200), outline=(59, 130, 246, 80), width=2)
    container_draw.rounded_rectangle([820, 160, 1160, 164], radius=16, fill=ACCENT_BLUE)
    container_draw.text((840, 175), "Next.js 15 App Router", fill=COLOR_TEXT_PRIMARY, font=font_node_header)
    
    draw_sub_pill(img, 840, 220, 300, 48, title="Public Auth", subtitle="/login, /reset-password, /update-password", border_color=ACCENT_CYAN)
    draw_sub_pill(img, 840, 285, 300, 48, title="Executive Hub", subtitle="/ (Hub landing dashboard), /executive", border_color=ACCENT_BLUE)
    draw_sub_pill(img, 840, 350, 300, 120, title="Department Dashboards", subtitle="/[department] (drilling, engineering, safety...)\nSubpages: excavator-activity, hourly-loads,\nbreakdowns, machines, operational-delays,\nsar, satellite, hyperspectral, tools", border_color=ACCENT_AMBER)
    draw_sub_pill(img, 840, 485, 300, 48, title="Admin Panel", subtitle="/admin (restricted operator controls)", border_color=ACCENT_ROSE)
    draw_sub_pill(img, 840, 550, 300, 120, title="Server Actions & Services", subtitle="@repo/supabase server client wrappers\nAuth validation and RLS assertions\ncacheWrap() helper routines\nDatabase data mutation handlers", border_color=ACCENT_GREEN)
    draw_sub_pill(img, 840, 685, 300, 120, title="API Gateway Routers", subtitle="/api/c66 (Auth exempt hardware telemetry)\n/api/webhooks (External system ingress)\n/api/ai/* (GenAI chat orchestration)\n/api/plugins (Telemetry plugins ingress)", border_color=ACCENT_INDIGO)
    draw_sub_pill(img, 840, 820, 300, 48, title="Instrumentation Setup", subtitle="instrumentation.ts, sentry.server.config.ts", border_color=ACCENT_ROSE)

    # Column 4: Caching
    draw_glass_card(img, 1240, 200, 260, 140, ACCENT_AMBER,
                    title="L1 Memory Cache",
                    subtext_list=[
                        "• Node.js In-Memory Map",
                        "• LRU Eviction (1k items)",
                        "• Ultra-fast access (<0.1ms)",
                        "• Short TTLs (15 - 30s max)"
                    ])
                    
    draw_glass_card(img, 1240, 380, 260, 140, ACCENT_AMBER,
                    title="L2 Redis Cache",
                    subtext_list=[
                        "• Remote Redis Server",
                        "• Shared session data cache",
                        "• Dept UUID resolution caching",
                        "• Prefix scanning & tag invalidation"
                    ])
                    
    draw_glass_card(img, 1240, 580, 260, 150, ACCENT_INDIGO,
                    title="Inngest Engine",
                    subtext_list=[
                        "• Event-Driven Orchestrator",
                        "• Background jobs worker",
                        "• Webhooks routing & retries",
                        "• Step functions & concurrency"
                    ])
                    
    draw_glass_card(img, 1240, 780, 260, 140, ACCENT_ROSE,
                    title="Telemetry & Monitoring",
                    subtext_list=[
                        "• OpenTelemetry SDK tracing",
                        "• Sentry runtime errors",
                        "• Prometheus metric collectors",
                        "• Grafana Dashboards container"
                    ])

    # Column 5: Database
    draw_glass_card(img, 1580, 200, 280, 150, ACCENT_GREEN,
                    title="Supabase PostgreSQL (Primary)",
                    subtext_list=[
                        "• Primary PostgreSQL Database",
                        "• Row-Level Security (RLS) enforcement",
                        "• Employees & Departments source table",
                        "• Database schemas: packages/database",
                        "• Zero-padded migrations (001_name.sql)"
                    ])
                    
    draw_glass_card(img, 1580, 390, 280, 130, ACCENT_TEAL,
                    title="Supabase Read Replica",
                    subtext_list=[
                        "• High-scale PostgreSQL read-replica",
                        "• Hot-standby replication stream",
                        "• Read-only query dispatch",
                        "• Offloads SELECT heavy workloads"
                    ])
                    
    draw_glass_card(img, 1580, 580, 280, 130, ACCENT_SLATE,
                    title="Payload CMS v3",
                    subtext_list=[
                        "• Headless CMS framework integration",
                        "• Content modeling & admin controls",
                        "• Internal operations logs publisher",
                        "• wiki database mappings"
                    ])
                    
    draw_glass_card(img, 1580, 770, 280, 130, ACCENT_SLATE,
                    title="Overview Visualisation",
                    subtext_list=[
                        "• Standalone architecture viewer",
                        "• Live SVG hardware maps",
                        "• Isolated operations playground",
                        "• Zero-auth telemetry viewer"
                    ])

    draw_header_title(draw, "ARCH-SYSTEMS MINING PORTAL (DARK MODE)", "Architecture Flow & Data Caching Map • Next.js 15 Monorepo (Turborepo & pnpm workspace)")
    
    legend_items = [
        ("User / Clients", ACCENT_CYAN),
        ("Routing & Security", ACCENT_PURPLE),
        ("Next.js Application", ACCENT_BLUE),
        ("Multi-Layer Caching (L1/L2)", ACCENT_AMBER),
        ("SQL PostgreSQL DB", ACCENT_GREEN),
        ("Background Queue", ACCENT_INDIGO),
        ("Telemetry & Errors", ACCENT_ROSE),
        ("Static CMS & Overview", ACCENT_SLATE)
    ]
    draw_footer_legend(draw, legend_items)

    img_rgb = img.convert("RGB")
    img_rgb.save(FLOWS_DARK_PATH, "PNG", optimize=True)
    print(f"Flow map dark successfully saved to: {FLOWS_DARK_PATH}")

def generate_database_webhook():
    print("Generating database_webhook_flow.png...")
    img = Image.new("RGBA", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(img)
    
    draw_gradient(draw, WIDTH, HEIGHT, COLOR_BG_START, COLOR_BG_END)
    draw_grid(draw, WIDTH, HEIGHT, grid_size=60)
    
    # Ambient Blurs
    draw_glow_blob(img, 200, 400, 250, ACCENT_GREEN + (30,))
    draw_glow_blob(img, 600, 300, 300, ACCENT_PURPLE + (25,))
    draw_glow_blob(img, 1000, 600, 350, ACCENT_INDIGO + (30,))
    draw_glow_blob(img, 1500, 400, 350, ACCENT_CYAN + (30,))
    
    # Connections
    draw_connection_line(img, (380, 280), (460, 310), color=ACCENT_PURPLE, label="Employee ID validation")
    draw_connection_line(img, (380, 465), (460, 390), color=ACCENT_PURPLE, label="Validate dept scope")
    draw_connection_line(img, (740, 360), (840, 330), color=ACCENT_GREEN, label="Allowed mutations")
    draw_connection_line(img, (380, 630), (840, 410), color=ACCENT_GREEN, label="Select active URLs", curve_direction="s-curve")
    
    draw_connection_line(img, (1160, 350), (1240, 320), color=ACCENT_INDIGO, label="Enqueues webhook event", curve_direction="s-curve")
    draw_connection_line(img, (1000, 580), (1240, 380), color=ACCENT_INDIGO, label="LISTEN/NOTIFY payload", curve_direction="s-curve")
    draw_connection_line(img, (1240, 380), (1000, 580), color=ACCENT_AMBER, label="Checks rate limit", curve_direction="s-curve")
    
    draw_connection_line(img, (1380, 380), (1380, 480), color=ACCENT_INDIGO, label="Trigger SHA-256 Sign")
    draw_connection_line(img, (1520, 555), (1600, 630), color=ACCENT_SLATE, label="Write response status", curve_direction="s-curve")
    
    draw_connection_line(img, (1520, 320), (1600, 280), color=ACCENT_CYAN, label="HMAC header request", curve_direction="s-curve")
    draw_connection_line(img, (1520, 320), (1600, 430), color=ACCENT_CYAN, label="HMAC header request", curve_direction="s-curve")
    draw_connection_line(img, (1520, 320), (1600, 580), color=ACCENT_CYAN, label="HMAC header request", curve_direction="s-curve")

    # Column 1: DB Schema Entities
    draw_glass_card(img, 100, 200, 280, 160, ACCENT_GREEN,
                    title="employees Table",
                    subtext_list=[
                        "• id: uuid (PK)",
                        "• auth_id: uuid (FK auth.users)",
                        "• role: text (default: 'operator')",
                        "• department_id: uuid (FK)",
                        "• accessible_departments: uuid[]"
                    ])
                    
    draw_glass_card(img, 100, 400, 280, 130, ACCENT_GREEN,
                    title="departments Table",
                    subtext_list=[
                        "• id: uuid (PK)",
                        "• name: text (unique)",
                        "• location: text",
                        "• active: boolean"
                    ])
                    
    draw_glass_card(img, 100, 560, 280, 140, ACCENT_GREEN,
                    title="webhooks Table",
                    subtext_list=[
                        "• id: uuid (PK)",
                        "• url: text",
                        "• events: text[] (e.g. shift_close)",
                        "• secret: text (HMAC key)",
                        "• active: boolean"
                    ])
                    
    draw_glass_card(img, 100, 730, 280, 140, ACCENT_GREEN,
                    title="webhook_logs Table",
                    subtext_list=[
                        "• id: uuid (PK)",
                        "• webhook_id: uuid (FK)",
                        "• payload: jsonb",
                        "• response_status: int",
                        "• error_message: text"
                    ])

    # Column 2: RLS Policies & Gating
    draw_glass_card(img, 460, 250, 280, 220, ACCENT_PURPLE,
                    title="Supabase RLS Engine",
                    subtext_list=[
                        "• Gatekeeper for tables",
                        "• Enforces department isolation",
                        "• Checks employee roles in DB",
                        "• Policy: auth.uid() = auth_id",
                        "• Dynamic role validation checks",
                        "• Prevents unauthorized read/write"
                    ])
                    
    draw_glass_card(img, 460, 530, 280, 160, ACCENT_ROSE,
                    title="Rate Limiting Registry",
                    subtext_list=[
                        "• Redis ratelimit:* counters",
                        "• IP/User ID token windows",
                        "• Gated webhook dispatcher check",
                        "• Memory limits fallback map",
                        "• Prevents DDoS on receivers"
                    ])

    # Column 3: DB Event Broker & Triggers
    draw_glass_card(img, 840, 250, 320, 260, ACCENT_GREEN,
                    title="PostgreSQL PL/pgSQL Triggers",
                    subtext_list=[
                        "• Triggers on operational modifications",
                        "• Triggers: shift_close, breakdowns, loads",
                        "• Serializes new database row into JSON",
                        "• Injects event metadata (timestamp, id)",
                        "• Restricts access to department scope",
                        "• Dispatches to event notifier logic"
                    ])
                    
    draw_glass_card(img, 840, 580, 320, 180, ACCENT_INDIGO,
                    title="Event Notify Channel",
                    subtext_list=[
                        "• Built-in PG LISTEN/NOTIFY pipeline",
                        "• Channel name: arch_webhook_events",
                        "• Payload: compact event string",
                        "• Alternative: Inngest polling queue",
                        "• Non-blocking db operation stream",
                        "• Microsecond dispatch latency"
                    ])

    # Column 4: Webhook Dispatcher
    draw_glass_card(img, 1240, 220, 280, 200, ACCENT_INDIGO,
                    title="Inngest Event Dispatcher",
                    subtext_list=[
                        "• Async Webhook event consumer",
                        "• Reads configuration URLs from DB",
                        "• Filters events matching definition",
                        "• Implements exponential backoff",
                        "• Handles delivery retries (max: 5)",
                        "• Batches logs updates in DB"
                    ])
                    
    draw_glass_card(img, 1240, 480, 280, 150, ACCENT_CYAN,
                    title="HMAC SHA-256 Signer",
                    subtext_list=[
                        "• Cryptographic payload signer",
                        "• Combines payload with webhook secret",
                        "• Appends 'X-Arch-Signature' header",
                        "• Allows receivers to verify content",
                        "• Mitigates spoofing vectors"
                    ])

    # Column 5: External Consumer Systems
    draw_glass_card(img, 1600, 220, 260, 120, ACCENT_SLATE,
                    title="Drilling Telemetry Logger",
                    subtext_list=[
                        "• External drilling logger",
                        "• Receives logs telemetry",
                        "• Validates via signature header"
                    ])
                    
    draw_glass_card(img, 1600, 370, 260, 120, ACCENT_SLATE,
                    title="Safety System Supervisor",
                    subtext_list=[
                        "• Shift & incidents monitor",
                        "• Alerts on breakdown events",
                        "• Escalates safety indicators"
                    ])
                    
    draw_glass_card(img, 1600, 520, 260, 120, ACCENT_SLATE,
                    title="Third-Party ERP Systems",
                    subtext_list=[
                        "• Production accounting sync",
                        "• Scrapes daily closed loads",
                        "• Ingests material analytics"
                    ])
                    
    draw_glass_card(img, 1600, 670, 260, 120, ACCENT_SLATE,
                    title="Webhook Logs Archive",
                    subtext_list=[
                        "• Historic log analyzer app",
                        "• Collects webhook responses",
                        "• Reports service downtime"
                    ])

    draw_header_title(draw, "ARCH-SYSTEMS DATABASE & WEBHOOK ROUTING MAP", "RLS Policies, PostgreSQL PL/pgSQL Triggers, and Inngest-based Webhook Dispatcher pipeline")
    
    legend_items = [
        ("SQL PostgreSQL DB", ACCENT_GREEN),
        ("Security Gate / RLS", ACCENT_PURPLE),
        ("Background Queue", ACCENT_INDIGO),
        ("Security Signing", ACCENT_CYAN),
        ("Rate Limiter", ACCENT_ROSE),
        ("External Receivers", ACCENT_SLATE)
    ]
    draw_footer_legend(draw, legend_items)

    img_rgb = img.convert("RGB")
    img_rgb.save(DB_WEBHOOK_PATH, "PNG", optimize=True)
    print(f"DB Webhook map successfully saved to: {DB_WEBHOOK_PATH}")

def generate_offline_sync():
    print("Generating offline_sync_pipeline.png...")
    img = Image.new("RGBA", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(img)
    
    draw_gradient(draw, WIDTH, HEIGHT, COLOR_BG_START, COLOR_BG_END)
    draw_grid(draw, WIDTH, HEIGHT, grid_size=60)
    
    # Ambient Blurs
    draw_glow_blob(img, 200, 300, 250, ACCENT_BLUE + (30,))
    draw_glow_blob(img, 600, 500, 300, ACCENT_PURPLE + (25,))
    draw_glow_blob(img, 1000, 300, 350, ACCENT_CYAN + (30,))
    draw_glow_blob(img, 1500, 500, 350, ACCENT_GREEN + (35,))
    
    # Connections
    draw_connection_line(img, (380, 325), (460, 310), color=ACCENT_BLUE, label="Local Write-Through reads")
    draw_connection_line(img, (380, 525), (460, 540), color=ACCENT_BLUE, label="Mutations local write")
    draw_connection_line(img, (740, 310), (820, 330), color=ACCENT_PURPLE, label="Track queued modifications")
    draw_connection_line(img, (740, 540), (820, 400), color=ACCENT_PURPLE, label="Poll outbox mutations", curve_direction="s-curve")
    
    draw_connection_line(img, (1140, 330), (1240, 340), color=ACCENT_CYAN, label="Checks WAN connection")
    draw_connection_line(img, (1140, 590), (1240, 560), color=ACCENT_CYAN, label="Injects bearer auth credentials", curve_direction="s-curve")
    
    draw_connection_line(img, (1500, 340), (1580, 300), color=ACCENT_GREEN, label="Sends batch JSON commits", curve_direction="s-curve")
    draw_connection_line(img, (1500, 560), (1580, 505), color=ACCENT_GREEN, label="Writes synced rows to SQL", curve_direction="s-curve")
    draw_connection_line(img, (1860, 505), (1860, 705), color=ACCENT_AMBER, label="Invalidates Redis caches", curve_direction="v-h")

    # Column 1: On-Premises Delmas Clients
    draw_glass_card(img, 100, 250, 280, 150, ACCENT_BLUE,
                    title="Tablet Operator UI",
                    subtext_list=[
                        "• Runs on mobile field tablets",
                        "• Offline-resilient App router",
                        "• Serves offline views from cache",
                        "• Intermittently connected UI"
                    ])
                    
    draw_glass_card(img, 100, 450, 280, 150, ACCENT_BLUE,
                    title="Desktop Command Center",
                    subtext_list=[
                        "• Delmas control room dashboard",
                        "• Live websocket telemetry",
                        "• Local charts & gauges rendering",
                        "• High-availability display panels"
                    ])

    # Column 2: Cockpit Local DB & Queue
    draw_glass_card(img, 460, 220, 280, 180, ACCENT_PURPLE,
                    title="Cockpit Local Database",
                    subtext_list=[
                        "• SQLite / Cockpit local database",
                        "• Encrypted client data store",
                        "• Immediate write response",
                        "• Holds schema mirror",
                        "• Fallback index DB storage"
                    ])
                    
    draw_glass_card(img, 460, 450, 280, 180, ACCENT_PURPLE,
                    title="Outbox Mutation Queue",
                    subtext_list=[
                        "• Relational operations log",
                        "• Preserves transaction sequence",
                        "• Captures local updates offline",
                        "• Auto-increment index pointers",
                        "• Stores row state diffs"
                    ])

    # Column 3: Local Sync Manager & Conflict Resolver
    draw_glass_card(img, 820, 220, 320, 220, ACCENT_CYAN,
                    title="Sync Reconciliation Hub",
                    subtext_list=[
                        "• Core synchronization coordinator",
                        "• Scans outbox queue on network return",
                        "• Calculates diff hashes with server",
                        "• Bundles mutations into compact batches",
                        "• Implements compression on JSON payloads",
                        "• Handles batch rollback on failure"
                    ])
                    
    draw_glass_card(img, 820, 490, 320, 200, ACCENT_CYAN,
                    title="Conflict Resolution Logic",
                    subtext_list=[
                        "• Custom conflict handler rules",
                        "• Resolves concurrent updates on row",
                        "• Rules: Last-Write-Wins (LWW)",
                        "• Client-wins vs Cloud-wins options",
                        "• Complex nested merges for logs",
                        "• Logs manual overrides in archive"
                    ])

    # Column 4: Network & Tunnel Gating
    draw_glass_card(img, 1240, 250, 260, 180, ACCENT_TEAL,
                    title="LAN/WAN Sync Tunnel",
                    subtext_list=[
                        "• Monitored network wire bridge",
                        "• Heartbeat ping checks connectivity",
                        "• Auto-throttles on low bandwidth",
                        "• Compression: Gzip payload format",
                        "• Failover route selector logic"
                    ])
                    
    draw_glass_card(img, 1240, 480, 260, 160, ACCENT_ROSE,
                    title="Token Auth Gate",
                    subtext_list=[
                        "• Checks sync authorization tokens",
                        "• Extends Supabase JWT validation",
                        "• Refreshes expired sessions",
                        "• Rejects untrusted client machines",
                        "• Audits incoming client IP"
                    ])

    # Column 5: Cloud Target Services
    draw_glass_card(img, 1580, 220, 280, 160, ACCENT_INDIGO,
                    title="/api/sync Gateway",
                    subtext_list=[
                        "• Next.js batch sync endpoint",
                        "• Receives compressed outbox payload",
                        "• Authenticates and unpacks batch",
                        "• Spawns transactional writes block",
                        "• Returns conflict errors index"
                    ])
                    
    draw_glass_card(img, 1580, 430, 280, 150, ACCENT_GREEN,
                    title="Supabase Cloud PostgreSQL",
                    subtext_list=[
                        "• Central production database",
                        "• Executes transactional commits",
                        "• Triggers audit events",
                        "• Master source of system truth",
                        "• Enforces global constraints"
                    ])
                    
    draw_glass_card(img, 1580, 630, 280, 150, ACCENT_AMBER,
                    title="L2 Redis Invalidation",
                    subtext_list=[
                        "• Evicts dirty cache entries",
                        "• Invalidates department prefix cache",
                        "• Forces client browsers reload",
                        "• Clear L1 memory maps on cache",
                        "• Keeps cloud cache synchronized"
                    ])

    draw_header_title(draw, "ARCH-SYSTEMS OFFLINE-FIRST SYNCHRONIZATION PIPELINE", "Delmas LAN deployment architecture featuring client-side Cockpit DB, sync queues, conflict resolvers, and Cloud Supabase gateway")
    
    legend_items = [
        ("Delmas Clients", ACCENT_BLUE),
        ("Local DB / Outbox", ACCENT_PURPLE),
        ("Sync Coordinator", ACCENT_CYAN),
        ("Tunnel / Auth Gate", ACCENT_TEAL),
        ("Cloud Sync API Gateway", ACCENT_INDIGO),
        ("Cloud Database Store", ACCENT_GREEN),
        ("Cloud Cache Sync", ACCENT_AMBER)
    ]
    draw_footer_legend(draw, legend_items)

    img_rgb = img.convert("RGB")
    img_rgb.save(OFFLINE_SYNC_PATH, "PNG", optimize=True)
    print(f"Offline Sync map successfully saved to: {OFFLINE_SYNC_PATH}")

def generate_monitoring():
    print("Generating monitoring_observability.png...")
    img = Image.new("RGBA", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(img)
    
    draw_gradient(draw, WIDTH, HEIGHT, COLOR_BG_START, COLOR_BG_END)
    draw_grid(draw, WIDTH, HEIGHT, grid_size=60)
    
    # Ambient Blurs
    draw_glow_blob(img, 200, 500, 250, ACCENT_ROSE + (35,))
    draw_glow_blob(img, 600, 300, 300, ACCENT_BLUE + (25,))
    draw_glow_blob(img, 1000, 600, 350, ACCENT_INDIGO + (30,))
    draw_glow_blob(img, 1500, 400, 350, ACCENT_AMBER + (35,))
    
    # Connections
    draw_connection_line(img, (380, 325), (460, 300), color=ACCENT_ROSE, label="Captures uncaught UI errors", curve_direction="s-curve")
    draw_connection_line(img, (380, 530), (460, 520), color=ACCENT_BLUE, label="HTTP/SQL database spans", curve_direction="s-curve")
    draw_connection_line(img, (380, 735), (460, 735), color=ACCENT_CYAN, label="Parser raw machine logs")
    
    draw_connection_line(img, (740, 300), (1240, 300), color=ACCENT_ROSE, label="Post crash trace payload", curve_direction="s-curve")
    draw_connection_line(img, (740, 520), (840, 580), color=ACCENT_BLUE, label="Emits openTelemetry metrics", curve_direction="s-curve")
    draw_connection_line(img, (740, 735), (840, 340), color=ACCENT_CYAN, label="Enqueue telemetry event", curve_direction="s-curve")
    
    draw_connection_line(img, (1160, 340), (1240, 510), color=ACCENT_INDIGO, label="Metrics batch output", curve_direction="s-curve")
    draw_connection_line(img, (1160, 580), (1240, 510), color=ACCENT_AMBER, label="Scrapes Prom metrics")
    
    draw_connection_line(img, (1500, 300), (1580, 340), color=ACCENT_ROSE, label="Display bugs stack", curve_direction="s-curve")
    draw_connection_line(img, (1500, 510), (1580, 340), color=ACCENT_AMBER, label="Display resource graphs", curve_direction="s-curve")
    draw_connection_line(img, (1500, 510), (1580, 560), color=ACCENT_AMBER, label="Query metrics via API", curve_direction="s-curve")
    draw_connection_line(img, (1500, 510), (1580, 760), color=ACCENT_ROSE, label="Triggers threshold alerts", curve_direction="s-curve")

    # Column 1: Telemetry Sources
    draw_glass_card(img, 100, 250, 280, 150, ACCENT_ROSE,
                    title="Browser Clients",
                    subtext_list=[
                        "• User interface crash logs",
                        "• Web Vitals (LCP, FID, CLS)",
                        "• API response delay metrics",
                        "• Sentry React error boundaries"
                    ])
                    
    draw_glass_card(img, 100, 450, 280, 160, ACCENT_BLUE,
                    title="Next.js Node Server",
                    subtext_list=[
                        "• Server Actions execution times",
                        "• Database query performance",
                        "• Middleware routing latency",
                        "• Memory & CPU utilization stats"
                    ])
                    
    draw_glass_card(img, 100, 660, 280, 150, ACCENT_CYAN,
                    title="Hardware Devices / C66",
                    subtext_list=[
                        "• Excavator drill sensors telemetry",
                        "• Operational machine logs",
                        "• GPS coordinates coordinates",
                        "• Active connection signals"
                    ])

    # Column 2: SDK Instrumentation Agents
    draw_glass_card(img, 460, 220, 280, 160, ACCENT_ROSE,
                    title="Sentry SDK Client/Server",
                    subtext_list=[
                        "• Automatic crash capture",
                        "• Source-map file mapping",
                        "• Session replay diagnostics",
                        "• Core user context binding"
                    ])
                    
    draw_glass_card(img, 460, 430, 280, 180, ACCENT_BLUE,
                    title="OpenTelemetry Auto-Agents",
                    subtext_list=[
                        "• Instrumentation hooks (instrumentation.ts)",
                        "• Auto-trace PostgreSQL clients",
                        "• Auto-trace NextJS HTTP fetch",
                        "• Spans correlation headers propagation",
                        "• Generates traces payload format"
                    ])
                    
    draw_glass_card(img, 460, 660, 280, 150, ACCENT_CYAN,
                    title="c66 Telemetry Parser",
                    subtext_list=[
                        "• Raw binary to JSON parser",
                        "• Authenticates device UUID",
                        "• Handles format normalizations",
                        "• Bypasses middleware checks"
                    ])

    # Column 3: Event Brokers & Metric Stores
    draw_glass_card(img, 840, 250, 320, 180, ACCENT_INDIGO,
                    title="Inngest Log Queue",
                    subtext_list=[
                        "• Telemetry log event buffer",
                        "• Decouples database writes from UI",
                        "• Batches telemetry logs inserts",
                        "• Retries on log database throttle",
                        "• Runs periodic database log purges"
                    ])
                    
    draw_glass_card(img, 840, 490, 320, 180, ACCENT_AMBER,
                    title="Prometheus Collector",
                    subtext_list=[
                        "• Scrapes stats from server endpoints",
                        "• Tracks active connections index",
                        "• Tracks Redis latency hits/misses",
                        "• Aggregates rate limit triggers",
                        "• Implements metrics schema rules"
                    ])

    # Column 4: Storage & Alert Engines
    draw_glass_card(img, 1240, 220, 260, 160, ACCENT_ROSE,
                    title="Sentry Error Store",
                    subtext_list=[
                        "• Centralized crash database",
                        "• Groups similar exceptions",
                        "• Tracks release regression tags",
                        "• Tracks unresolved bug status"
                    ])
                    
    draw_glass_card(img, 1240, 430, 260, 160, ACCENT_AMBER,
                    title="Prometheus TSDB",
                    subtext_list=[
                        "• Time-Series Database engine",
                        "• Stores system metrics history",
                        "• Fast query evaluation engine",
                        "• Retains operational data indexes"
                    ])
                    
    draw_glass_card(img, 1240, 640, 260, 160, ACCENT_AMBER,
                    title="Redis Telemetry Cache",
                    subtext_list=[
                        "• Caches metrics summaries",
                        "• Accelerates admin dashboard load",
                        "• Stores temporary alerts state",
                        "• Prevents database load on HUD"
                    ])

    # Column 5: Visualization Dashboards & Alerts
    draw_glass_card(img, 1580, 250, 280, 180, ACCENT_AMBER,
                    title="Grafana Dashboard HUD",
                    subtext_list=[
                        "• System health dashboard display",
                        "• Displays memory/CPU load charts",
                        "• Visualizes cache hits & Miss ratios",
                        "• Visualizes OTel trace waterfall graphs",
                        "• Operational control room monitor"
                    ])
                    
    draw_glass_card(img, 1580, 480, 280, 160, ACCENT_CYAN,
                    title="/admin/telemetry Portal",
                    subtext_list=[
                        "• Internal admin portal HUD UI",
                        "• Checks auth roles (admin only)",
                        "• Displays live cache stats",
                        "• Displays active users index"
                    ])
                    
    draw_glass_card(img, 1580, 690, 280, 140, ACCENT_ROSE,
                    title="Pager / Ops Alerts",
                    subtext_list=[
                        "• Alerts on error thresholds",
                        "• Dispatches Slack notifications",
                        "• Triggers pager calls to admins",
                        "• High-scale vigilance guard"
                    ])

    draw_header_title(draw, "ARCH-SYSTEMS TELEMETRY, MONITORING & OBSERVA-HUD PIPELINE", "OpenTelemetry instrumentation, Sentry error loggers, Inngest background telemetry events, and Prometheus/Grafana infrastructure")
    
    legend_items = [
        ("Telemetry Sources", ACCENT_ROSE),
        ("Node/OTel SDK Spans", ACCENT_BLUE),
        ("Hardware Parser", ACCENT_CYAN),
        ("Log Queue Buffer", ACCENT_INDIGO),
        ("Prometheus Metrics", ACCENT_AMBER)
    ]
    draw_footer_legend(draw, legend_items)

    img_rgb = img.convert("RGB")
    img_rgb.save(MONITORING_PATH, "PNG", optimize=True)
    print(f"Monitoring map successfully saved to: {MONITORING_PATH}")

# ------------------------------------------------------------------
# MAIN EXECUTION
# ------------------------------------------------------------------

def main():
    print("Initiating all maps generation...")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Run all generators
    generate_flows_dark()
    generate_database_webhook()
    generate_offline_sync()
    generate_monitoring()
    
    print("All architecture maps generated successfully!")

if __name__ == "__main__":
    main()
