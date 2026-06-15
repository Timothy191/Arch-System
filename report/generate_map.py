import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ------------------------------------------------------------------
# CONFIGURATION & CONSTANTS
# ------------------------------------------------------------------
WIDTH, HEIGHT = 1920, 1080
OUTPUT_DIR = "/home/timothy/Project/Arch-Mk2/report"
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "system_flows.png")

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

# Theme Colors (Light Glassmorphism Theme)
COLOR_BG_START = (241, 245, 249) # Slate 100
COLOR_BG_END = (239, 246, 255)   # Blue 50
COLOR_GRID = (203, 213, 225, 45)  # Slate 300 with transparency
COLOR_TEXT_PRIMARY = (15, 23, 42) # Slate 900
COLOR_TEXT_SECONDARY = (71, 85, 105) # Slate 600
COLOR_TEXT_MUTED = (148, 163, 184) # Slate 400

# Accent Colors (RGBA)
ACCENT_BLUE = (59, 130, 246)
ACCENT_CYAN = (6, 182, 212)
ACCENT_PURPLE = (139, 92, 246)
ACCENT_AMBER = (245, 158, 11)
ACCENT_GREEN = (16, 185, 129)
ACCENT_TEAL = (20, 184, 166)
ACCENT_ROSE = (244, 63, 94)
ACCENT_INDIGO = (99, 102, 241)
ACCENT_SLATE = (100, 116, 139)

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

def draw_shadow(img, x, y, w, h, radius=12, offset_x=4, offset_y=6, blur=8):
    """Draws a soft drop shadow layer for a card."""
    shadow_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow_layer)
    
    # Draw soft dark rectangle for shadow
    shadow_draw.rounded_rectangle(
        [x + offset_x, y + offset_y, x + w + offset_x, y + h + offset_y],
        radius=radius,
        fill=(15, 23, 42, 35) # Dark slate with low opacity
    )
    
    blurred = shadow_layer.filter(ImageFilter.GaussianBlur(blur))
    img.alpha_composite(blurred)

def draw_glass_card(img, x, y, w, h, accent_color, radius=12, title="", subtext_list=None):
    """Draws a beautiful glassmorphic card with colored top accent line."""
    # 1. Shadow
    draw_shadow(img, x, y, w, h, radius=radius)
    
    # 2. Glass Base Card (on main image)
    card_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    card_draw = ImageDraw.Draw(card_layer)
    
    # Semi-transparent white card fill
    card_draw.rounded_rectangle(
        [x, y, x + w, y + h],
        radius=radius,
        fill=(255, 255, 255, 225) # 88% white
    )
    
    # Faint card border
    card_draw.rounded_rectangle(
        [x, y, x + w, y + h],
        radius=radius,
        outline=(accent_color[0], accent_color[1], accent_color[2], 120),
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
    """Draws a smaller sub-pill inside a layout card."""
    draw = ImageDraw.Draw(img)
    # Fill background
    draw.rounded_rectangle(
        [x, y, x + w, y + h],
        radius=6,
        fill=(248, 250, 252, 230), # slate 50
        outline=(border_color[0], border_color[1], border_color[2], 80),
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
    points = []
    if curve_direction == "direct":
        points = [start, end]
        draw.line([start, end], fill=(color[0], color[1], color[2], 180), width=2)
    elif curve_direction == "h-v":
        # Horizontal then Vertical
        mid_x = x2
        mid_y = y1
        points = [start, (mid_x, mid_y), end]
        draw.line([start, (mid_x, mid_y)], fill=(color[0], color[1], color[2], 180), width=2)
        draw.line([(mid_x, mid_y), end], fill=(color[0], color[1], color[2], 180), width=2)
    elif curve_direction == "v-h":
        # Vertical then Horizontal
        mid_x = x1
        mid_y = y2
        points = [start, (mid_x, mid_y), end]
        draw.line([start, (mid_x, mid_y)], fill=(color[0], color[1], color[2], 180), width=2)
        draw.line([(mid_x, mid_y), end], fill=(color[0], color[1], color[2], 180), width=2)
    elif curve_direction == "s-curve":
        # Split half-way
        mid_x = (x1 + x2) // 2
        points = [start, (mid_x, y1), (mid_x, y2), end]
        draw.line([start, (mid_x, y1)], fill=(color[0], color[1], color[2], 180), width=2)
        draw.line([(mid_x, y1), (mid_x, y2)], fill=(color[0], color[1], color[2], 180), width=2)
        draw.line([(mid_x, y2), end], fill=(color[0], color[1], color[2], 180), width=2)

    # 2. Draw Start Dot and End Arrow/Dot
    draw.ellipse([x1 - 4, y1 - 4, x1 + 4, y1 + 4], fill=(color[0], color[1], color[2], 255))
    draw.ellipse([x2 - 6, y2 - 6, x2 + 6, y2 + 6], fill=(color[0], color[1], color[2], 255))
    
    # 3. Draw Label
    if label:
        # Determine label position at midpoint of lines
        if curve_direction == "direct":
            mx, my = (x1 + x2) // 2, (y1 + y2) // 2
        elif curve_direction == "h-v":
            # Midpoint of the horizontal segment
            mx, my = (x1 + x2) // 2, y1
        elif curve_direction == "v-h":
            # Midpoint of the vertical segment
            mx, my = x1, (y1 + y2) // 2
        elif curve_direction == "s-curve":
            # Center of the vertical connector
            mx, my = (x1 + x2) // 2, (y1 + y2) // 2
            
        # Draw background pill for text
        lbl_w = int(font_line_label.getlength(label)) + 12
        lbl_h = 18
        draw.rounded_rectangle(
            [mx - lbl_w//2, my - lbl_h//2, mx + lbl_w//2, my + lbl_h//2],
            radius=4,
            fill=(255, 255, 255, 255),
            outline=(color[0], color[1], color[2], 120),
            width=1
        )
        draw.text((mx, my), label, fill=COLOR_TEXT_PRIMARY, font=font_line_label, anchor="mm")

# ------------------------------------------------------------------
# MAIN GENERATION
# ------------------------------------------------------------------

def main():
    print("Initiating system flow map generation...")
    
    # 1. Base Image Setup
    img = Image.new("RGBA", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(img)
    
    # 2. Background Gradient & Grid
    draw_gradient(draw, WIDTH, HEIGHT, COLOR_BG_START, COLOR_BG_END)
    draw_grid(draw, WIDTH, HEIGHT, grid_size=60)
    
    # 3. Ambient Blurs (Depth)
    draw_glow_blob(img, 200, 300, 250, ACCENT_BLUE + (30,))
    draw_glow_blob(img, 700, 600, 350, ACCENT_PURPLE + (25,))
    draw_glow_blob(img, 1300, 200, 300, ACCENT_AMBER + (25,))
    draw_glow_blob(img, 1600, 500, 400, ACCENT_GREEN + (30,))
    
    # 4. Draw Connectors first, so cards sit on top of them nicely
    # Connectors from Client
    draw_connection_line(img, (380, 500), (460, 370), color=ACCENT_BLUE, label="HTTP Request / Navigation", curve_direction="s-curve")
    draw_connection_line(img, (380, 500), (460, 650), color=ACCENT_ROSE, label="Telemetry Socket / API Calls", curve_direction="s-curve")
    
    # Connectors from Rate Limiter
    draw_connection_line(img, (740, 650), (1240, 450), color=ACCENT_ROSE, label="Redis Key Lookup / Rate Check", curve_direction="s-curve")
    
    # Connectors from Middleware
    draw_connection_line(img, (740, 310), (1240, 270), color=ACCENT_PURPLE, label="Query Role / Session Context", curve_direction="s-curve")
    draw_connection_line(img, (740, 370), (820, 560), color=ACCENT_BLUE, label="Allow & Forward", curve_direction="direct")
    draw_connection_line(img, (740, 430), (1580, 275), color=ACCENT_SLATE, label="Fall back to DB on L1/L2 miss", curve_direction="s-curve")
    
    # Connectors from App Router (Server Actions / APIs)
    draw_connection_line(img, (1160, 255), (1240, 270), color=ACCENT_AMBER, label="L1 Memory Get (<0.1ms)")
    draw_connection_line(img, (1160, 450), (1240, 450), color=ACCENT_AMBER, label="L2 Redis / Cache Wrap")
    draw_connection_line(img, (1160, 650), (1240, 655), color=ACCENT_INDIGO, label="Enqueues Job Event", curve_direction="s-curve")
    draw_connection_line(img, (1160, 830), (1240, 850), color=ACCENT_ROSE, label="Emit Performance Metrics", curve_direction="s-curve")
    
    # Caching internal link
    draw_connection_line(img, (1370, 340), (1370, 380), color=ACCENT_AMBER, label="Write-Through / Fallback")
    
    # Connectors from App Router to Databases
    draw_connection_line(img, (1160, 310), (1580, 275), color=ACCENT_GREEN, label="SQL CRUD Operations", curve_direction="s-curve")
    draw_connection_line(img, (1160, 410), (1580, 455), color=ACCENT_TEAL, label="Offloads SELECT Reads", curve_direction="s-curve")
    
    # Database replication
    draw_connection_line(img, (1720, 350), (1720, 390), color=ACCENT_GREEN, label="PG Streaming Replication")
    
    # Inngest to DB operations
    draw_connection_line(img, (1500, 655), (1720, 350), color=ACCENT_INDIGO, label="Processes Deferred Mutations", curve_direction="s-curve")
    
    # Content syncs
    draw_connection_line(img, (1580, 645), (1450, 450), color=ACCENT_SLATE, label="CMS Auth cache", curve_direction="s-curve")
    draw_connection_line(img, (1580, 645), (1720, 350), color=ACCENT_SLATE, label="Read wiki content", curve_direction="s-curve")
    draw_connection_line(img, (1580, 835), (1720, 350), color=ACCENT_SLATE, label="Fetch telemetry", curve_direction="s-curve")

    # 5. Render Core Cards (Nodes)
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

    # Column 3: App Router Container
    # Main container shadow and card
    draw_shadow(img, 820, 160, 340, 820)
    # Draw container with transparent white
    container_draw = ImageDraw.Draw(img)
    container_draw.rounded_rectangle([820, 160, 1160, 980], radius=16, fill=(255, 255, 255, 180), outline=(59, 130, 246, 80), width=2)
    # Accent header
    container_draw.rounded_rectangle([820, 160, 1160, 164], radius=16, fill=ACCENT_BLUE)
    container_draw.text((840, 175), "Next.js 15 App Router", fill=COLOR_TEXT_PRIMARY, font=font_node_header)
    
    # Sub-pills (routes and pages)
    draw_sub_pill(img, 840, 220, 300, 48, title="Public Auth", subtitle="/login, /reset-password, /update-password", border_color=ACCENT_CYAN)
    draw_sub_pill(img, 840, 285, 300, 48, title="Executive Hub", subtitle="/ (Hub landing dashboard), /executive", border_color=ACCENT_BLUE)
    draw_sub_pill(img, 840, 350, 300, 120, title="Department Dashboards", subtitle="/[department] (drilling, engineering, safety...)\nSubpages: excavator-activity, hourly-loads,\nbreakdowns, machines, operational-delays,\nsar, satellite, hyperspectral, tools", border_color=ACCENT_AMBER)
    draw_sub_pill(img, 840, 485, 300, 48, title="Admin Panel", subtitle="/admin (restricted operator controls)", border_color=ACCENT_ROSE)
    draw_sub_pill(img, 840, 550, 300, 120, title="Server Actions & Services", subtitle="@repo/supabase server client wrappers\nAuth validation and RLS assertions\ncacheWrap() helper routines\nDatabase data mutation handlers", border_color=ACCENT_GREEN)
    draw_sub_pill(img, 840, 685, 300, 120, title="API Gateway Routers", subtitle="/api/c66 (Auth exempt hardware telemetry)\n/api/webhooks (External system ingress)\n/api/ai/* (GenAI chat orchestration)\n/api/plugins (Telemetry plugins ingress)", border_color=ACCENT_INDIGO)
    draw_sub_pill(img, 840, 820, 300, 48, title="Instrumentation Setup", subtitle="instrumentation.ts, sentry.server.config.ts", border_color=ACCENT_ROSE)

    # Column 4: Caching & Jobs
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

    # Column 5: Database & CMS
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

    # 6. Title and Metadata Header
    # Left decorative bar
    draw.rectangle([90, 48, 96, 122], fill=ACCENT_BLUE)
    draw.text((112, 44), "ARCH-SYSTEMS MINING PORTAL", fill=COLOR_TEXT_PRIMARY, font=font_title)
    draw.text((114, 98), "Architecture Flow & Data Caching Map • Next.js 15 Monorepo (Turborepo & pnpm workspace)", fill=COLOR_TEXT_SECONDARY, font=font_subtitle)
    
    # 7. Legend & Footer
    draw.rectangle([90, 978, WIDTH - 90, 980], fill=COLOR_GRID)
    draw.text((90, 995), "SYSTEM FLOWMAP LEGEND:", fill=COLOR_TEXT_MUTED, font=font_legend)
    
    # Draw Legend color indicators
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
    
    curr_lx = 300
    for label, col in legend_items:
        draw.rounded_rectangle([curr_lx, 998, curr_lx + 15, 1013], radius=3, fill=col)
        draw.text((curr_lx + 23, 997), label, fill=COLOR_TEXT_SECONDARY, font=font_legend)
        curr_lx += 200
        
    draw.text((WIDTH - 90, 997), "Generated automatically by Antigravity AI • 2026", fill=COLOR_TEXT_MUTED, font=font_legend, anchor="rm")

    # 8. Save Image
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    img_rgb = img.convert("RGB") # convert to RGB to save as high quality PNG
    img_rgb.save(OUTPUT_PATH, "PNG", optimize=True)
    print(f"Flow map image successfully saved to: {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
