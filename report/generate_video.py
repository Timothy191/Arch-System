import os
import shutil
import subprocess
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

# Video configurations
WIDTH, HEIGHT = 1280, 720
FPS = 30
SECONDS_PER_SLIDE = 8
TRANSITION_SECONDS = 1.0  # cross-fade duration in seconds

FRAMES_PER_SLIDE = SECONDS_PER_SLIDE * FPS
TRANSITION_FRAMES = int(TRANSITION_SECONDS * FPS)
NUM_SLIDES = 5
TOTAL_FRAMES = NUM_SLIDES * FRAMES_PER_SLIDE

# Output paths
OUTPUT_DIR = "/home/timothy/Project/Arch-Mk2/report"
TEMP_FRAMES_DIR = os.path.join(OUTPUT_DIR, "temp_frames")
OUTPUT_VIDEO_PATH = os.path.join(OUTPUT_DIR, "corporate_presentation.mp4")

# External Assets
SCREENSHOT_PATH = "/home/timothy/.gemini/antigravity/brain/fe2e30ac-a7ec-4d4e-984b-a49ea657f401/drilling_dashboard_1779855792237.png"
if not os.path.exists(SCREENSHOT_PATH):
    SCREENSHOT_PATH = None

# Font paths
FONT_TITLE_PATH = "/usr/share/fonts/truetype/quicksand/Quicksand-Bold.ttf"
FONT_TEXT_PATH = "/usr/share/fonts/truetype/inter-vf/InterVariable.ttf"
FONT_MONO_PATH = "/usr/share/fonts/truetype/katex/KaTeX_AMS-Regular.ttf"

# Load fonts
try:
    font_xxl = ImageFont.truetype(FONT_TITLE_PATH, 54)
    font_xl = ImageFont.truetype(FONT_TITLE_PATH, 42)
    font_large = ImageFont.truetype(FONT_TITLE_PATH, 28)
    font_medium = ImageFont.truetype(FONT_TEXT_PATH, 20)
    font_small = ImageFont.truetype(FONT_TEXT_PATH, 15)
    font_mono = ImageFont.truetype(FONT_TEXT_PATH, 14)
except Exception as e:
    print(f"Error loading fonts: {e}. Falling back to default.")
    font_xxl = font_xl = font_large = font_medium = font_small = font_mono = ImageFont.load_default()

# Colors (Corporate Dark Mode)
COLOR_BG_START = (4, 6, 10)
COLOR_BG_END = (14, 18, 28)
COLOR_GRID = (255, 255, 255, 2)
COLOR_CYAN = (6, 182, 212)
COLOR_BLUE = (59, 130, 246)
COLOR_GOLD = (245, 158, 11)
COLOR_RED = (239, 68, 68)
COLOR_WHITE = (255, 255, 255)
COLOR_GRAY = (148, 163, 184)
COLOR_CARD_BG = (15, 20, 35, 180)
COLOR_BORDER = (255, 255, 255, 15)

# Load and prepare screenshot mockup
ui_mockup = None
if SCREENSHOT_PATH:
    try:
        raw_img = Image.open(SCREENSHOT_PATH).convert("RGBA")
        # Resize to fit nicely
        aspect = raw_img.width / raw_img.height
        new_h = 440
        new_w = int(new_h * aspect)
        ui_mockup = raw_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        # Add a subtle border and shadow (we can simulate shadow during render)
        # Create a rounded version
        mask = Image.new("L", (new_w, new_h), 0)
        draw_mask = ImageDraw.Draw(mask)
        draw_mask.rounded_rectangle([0, 0, new_w, new_h], radius=12, fill=255)
        
        ui_mockup.putalpha(mask)
    except Exception as e:
        print(f"Failed to load screenshot: {e}")

def draw_gradient(draw, width, height, start_color, end_color):
    for y in range(height):
        ratio = y / height
        r = int(start_color[0] * (1 - ratio) + end_color[0] * ratio)
        g = int(start_color[1] * (1 - ratio) + end_color[1] * ratio)
        b = int(start_color[2] * (1 - ratio) + end_color[2] * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b, 255))

def draw_glow_blob(draw, x, y, radius, color):
    for r in range(radius, 0, -12):
        opacity = int((1.0 - (r / radius) ** 1.8) * 10)
        if opacity > 0:
            draw.ellipse([x - r, y - r, x + r, y + r], fill=color + (opacity,))

def draw_grid(draw, width, height, offset_x, offset_y):
    grid_size = 60
    ox = offset_x % grid_size
    oy = offset_y % grid_size
    for x in range(int(ox), width, grid_size):
        draw.line([(x, 0), (x, height)], fill=COLOR_GRID, width=1)
    for y in range(int(oy), height, grid_size):
        draw.line([(0, y), (width, y)], fill=COLOR_GRID, width=1)

def draw_card(draw, x, y, w, h, bg_color, border_color, radius=12):
    draw.rounded_rectangle([x, y, x + w, y + h], radius=radius, fill=bg_color)
    draw.rounded_rectangle([x, y, x + w, y + h], radius=radius, outline=border_color, width=1)

def draw_header(draw, slide_title, slide_number):
    draw.text((90, 50), f"0{slide_number} / ARCH-SYSTEMS OVERVIEW", fill=COLOR_CYAN, font=font_mono)
    draw.text((90, 75), slide_title, fill=COLOR_WHITE, font=font_xl)
    draw.line([(90, 135), (WIDTH - 90, 135)], fill=(255, 255, 255, 10), width=1)

def wrap_text(text, max_width, font):
    words = text.split()
    lines = []
    cur_line = []
    for w in words:
        cur_line.append(w)
        length = font.getlength(" ".join(cur_line))
        if length > max_width:
            cur_line.pop()
            lines.append(" ".join(cur_line))
            cur_line = [w]
    lines.append(" ".join(cur_line))
    return lines

def render_slide(slide_index, frame_in_slide):
    img = Image.new("RGBA", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(img)

    total_frame_idx = slide_index * FRAMES_PER_SLIDE + frame_in_slide
    
    # 1. Background
    grid_offset = total_frame_idx * 0.3
    draw_gradient(draw, WIDTH, HEIGHT, COLOR_BG_START, COLOR_BG_END)
    draw_grid(draw, WIDTH, HEIGHT, grid_offset, grid_offset * 0.5)

    # Ambient glowing blobs
    blob1_x = int(WIDTH * 0.2 + 20 * math.sin(total_frame_idx * 0.01))
    blob1_y = int(HEIGHT * 0.3 + 15 * math.cos(total_frame_idx * 0.015))
    blob2_x = int(WIDTH * 0.8 + 30 * math.cos(total_frame_idx * 0.008))
    blob2_y = int(HEIGHT * 0.7 + 20 * math.sin(total_frame_idx * 0.012))
    draw_glow_blob(draw, blob1_x, blob1_y, 450, COLOR_BLUE)
    draw_glow_blob(draw, blob2_x, blob2_y, 500, COLOR_CYAN)

    # Animation progress (0.0 to 1.0) for intro effects
    intro_prog = min(1.0, frame_in_slide / (FPS * 1.5))
    ease_out = 1.0 - (1.0 - intro_prog) ** 3  # cubic ease out
    fade_alpha = int(ease_out * 255)
    
    # Context specific graphics
    if slide_index == 0:
        # Corporate Title Slide
        center_y = int(HEIGHT / 2)
        offset_y = int((1.0 - ease_out) * 30)
        
        # Subtle logo/icon
        draw.ellipse([WIDTH//2 - 25, center_y - 120 + offset_y, WIDTH//2 + 25, center_y - 70 + offset_y], outline=COLOR_CYAN, width=2)
        draw.ellipse([WIDTH//2 - 10, center_y - 105 + offset_y, WIDTH//2 + 10, center_y - 85 + offset_y], fill=COLOR_BLUE)

        draw.text((WIDTH // 2, center_y - 10 + offset_y), "ARCH-SYSTEMS", fill=COLOR_WHITE[:3] + (fade_alpha,), font=font_xxl, anchor="mm")
        draw.text((WIDTH // 2, center_y + 45 + offset_y), "INDUSTRIAL OPERATIONS PORTAL", fill=COLOR_CYAN[:3] + (fade_alpha,), font=font_large, anchor="mm")
        
        draw.text((WIDTH // 2, center_y + 110 + offset_y), "HIGH-SCALE VIGILANCE & OPERATIONAL PRECISION", fill=COLOR_GRAY[:3] + (fade_alpha,), font=font_mono, anchor="mm", letter_spacing=2)

    elif slide_index == 1:
        # Architecture & UI
        draw_header(draw, "Command Center Interface", 1)
        
        # Split layout
        draw_card(draw, 90, 170, 520, 420, COLOR_CARD_BG, COLOR_BORDER)
        
        content = [
            ("Industrial UI Design", "Dark-themed glassmorphism optimized for low-light control rooms.", COLOR_CYAN),
            ("8 Integrated Departments", "Drilling, production, safety, engineering, access, training & more.", COLOR_BLUE),
            ("Live Telemetry", "Real-time updates via Next.js 15 App Router & Server Actions.", COLOR_GOLD)
        ]
        
        y_pos = 210
        for idx, (title, desc, col) in enumerate(content):
            # Staggered fade in
            item_prog = min(1.0, max(0.0, (frame_in_slide - idx * 10) / (FPS * 1.0)))
            item_ease = 1.0 - (1.0 - item_prog) ** 3
            i_alpha = int(item_ease * 255)
            i_offset = int((1.0 - item_ease) * 20)
            
            if i_alpha > 0:
                draw.rectangle([120, y_pos + i_offset, 124, y_pos + 60 + i_offset], fill=col[:3] + (i_alpha,))
                draw.text((145, y_pos + i_offset), title, fill=COLOR_WHITE[:3] + (i_alpha,), font=font_large)
                
                lines = wrap_text(desc, 440, font_medium)
                for l_idx, line in enumerate(lines):
                    draw.text((145, y_pos + 35 + l_idx * 22 + i_offset), line, fill=COLOR_GRAY[:3] + (i_alpha,), font=font_medium)
            y_pos += 120

        # Right side - Mockup Image
        if ui_mockup and fade_alpha > 0:
            mockup_w, mockup_h = ui_mockup.size
            mock_x = 700 + int((1.0 - ease_out) * 50)
            mock_y = 160
            
            # Draw shadow
            draw_card(draw, mock_x - 10, mock_y - 10, mockup_w + 20, mockup_h + 20, (0,0,0,100), (0,0,0,0), radius=16)
            
            # Apply alpha to image if needed (PIL composite)
            if fade_alpha < 255:
                tmp = Image.new("RGBA", img.size)
                tmp.paste(ui_mockup, (mock_x, mock_y), ui_mockup)
                tmp.putalpha(fade_alpha)
                img.alpha_composite(tmp)
            else:
                img.paste(ui_mockup, (mock_x, mock_y), ui_mockup)
                # Glass reflection line on top
                draw.line([(mock_x+10, mock_y), (mock_x+mockup_w-10, mock_y)], fill=(255, 255, 255, 60), width=1)
        else:
            # Fallback graphic
            draw_card(draw, 700, 160, 480, 440, COLOR_CARD_BG, COLOR_BORDER)
            draw.text((940, 380), "[ Dashboard UI Preview ]", fill=COLOR_GRAY, font=font_medium, anchor="mm")

    elif slide_index == 2:
        # Technical Foundation
        draw_header(draw, "Technical Monorepo Stack", 2)
        
        # Three columns
        cols = [
            ("Frontend Engine", "Next.js 15, React 19, Tailwind OKLCH", COLOR_CYAN),
            ("State & Data", "Supabase, PostgreSQL, RLS Policies", COLOR_BLUE),
            ("DevOps Tooling", "Turborepo, pnpm catalogs, Playwright", COLOR_GOLD)
        ]
        
        card_w = 340
        for idx, (title, desc, col) in enumerate(cols):
            x = 90 + idx * (card_w + 40)
            y = 180 + int((1.0 - ease_out) * 30)
            
            if fade_alpha > 0:
                draw_card(draw, x, y, card_w, 200, COLOR_CARD_BG, COLOR_BORDER)
                draw.rectangle([x, y, x + card_w, y + 4], fill=col[:3] + (fade_alpha,))
                
                draw.text((x + 20, y + 30), title, fill=COLOR_WHITE[:3] + (fade_alpha,), font=font_large)
                
                lines = wrap_text(desc, card_w - 40, font_medium)
                for l_idx, line in enumerate(lines):
                    draw.text((x + 20, y + 80 + l_idx * 25), line, fill=COLOR_GRAY[:3] + (fade_alpha,), font=font_medium)
                    
        # Animated Data Flow Graph
        graph_y = 420
        draw_card(draw, 90, graph_y, 1100, 180, COLOR_CARD_BG, COLOR_BORDER)
        draw.text((110, graph_y + 20), "Real-time Telemetry Pipeline", fill=COLOR_WHITE, font=font_medium)
        
        # Draw some nodes and moving dots
        nodes = [(250, graph_y+90, "Sensors"), (550, graph_y+90, "Redis Cache"), (850, graph_y+90, "Portal UI")]
        for i in range(len(nodes) - 1):
            n1 = nodes[i]
            n2 = nodes[i+1]
            draw.line([(n1[0], n1[1]), (n2[0], n2[1])], fill=COLOR_BORDER, width=2)
            
            # Moving particle
            part_prog = (frame_in_slide * 0.02 + i * 0.5) % 1.0
            px = int(n1[0] + (n2[0] - n1[0]) * part_prog)
            draw.ellipse([px-4, n1[1]-4, px+4, n1[1]+4], fill=COLOR_CYAN)

        for nx, ny, label in nodes:
            draw.ellipse([nx-12, ny-12, nx+12, ny+12], fill=COLOR_CARD_BG, outline=COLOR_BLUE, width=3)
            draw.text((nx, ny+25), label, fill=COLOR_GRAY, font=font_mono, anchor="mm")

    elif slide_index == 3:
        # System Quality (Charts)
        draw_header(draw, "System Quality & CI/CD", 3)
        
        draw_card(draw, 90, 170, 480, 430, COLOR_CARD_BG, COLOR_BORDER)
        
        y_pos = 200
        for lbl, score, col in [("Stability Score", "7.5 / 10", COLOR_CYAN), ("Build Infra", "Best in Class", COLOR_BLUE), ("Test Coverage", "40%", COLOR_RED)]:
            draw.text((120, y_pos), lbl, fill=COLOR_GRAY, font=font_medium)
            draw.text((120, y_pos + 30), score, fill=col, font=font_xl)
            y_pos += 110
            
        draw.text((120, 520), "Next target: 80% coverage (Phase 4)", fill=COLOR_GOLD, font=font_small)

        # Draw a beautiful bar chart on the right
        draw_card(draw, 600, 170, 590, 430, COLOR_CARD_BG, COLOR_BORDER)
        draw.text((630, 200), "CI/CD Pipeline Stages", fill=COLOR_WHITE, font=font_medium)
        
        stages = [
            ("Linting", 1.0, COLOR_CYAN),
            ("Type Check", 1.0, COLOR_CYAN),
            ("Unit Tests", 0.95, COLOR_BLUE),
            ("E2E Playwright", 0.98, COLOR_BLUE),
            ("DeepEval AI", 0.85, COLOR_GOLD)
        ]
        
        b_x = 640
        b_w = 40
        b_gap = 60
        b_base_y = 520
        max_h = 240
        
        for idx, (label, val, col) in enumerate(stages):
            bx = b_x + idx * (b_w + b_gap)
            # Animate bars growing
            bar_prog = min(1.0, max(0.0, (frame_in_slide - idx * 5) / (FPS * 0.8)))
            bar_ease = 1.0 - (1.0 - bar_prog) ** 3
            h = int(max_h * val * bar_ease)
            
            if h > 0:
                draw.rectangle([bx, b_base_y - h, bx + b_w, b_base_y], fill=col)
                # Draw glass reflection on bar
                draw.rectangle([bx, b_base_y - h, bx + b_w // 2, b_base_y], fill=(255,255,255,20))
                
            # Vertical text label
            # We must create a small image for text and rotate it
            txt_img = Image.new("RGBA", (150, 20), (0,0,0,0))
            txt_draw = ImageDraw.Draw(txt_img)
            txt_draw.text((140, 10), label, fill=COLOR_GRAY, font=font_mono, anchor="rm")
            txt_img = txt_img.rotate(90, expand=True)
            img.alpha_composite(txt_img, (bx + 10, b_base_y + 10))

    elif slide_index == 4:
        # Roadmap Timeline
        draw_header(draw, "Strategic Roadmap: Phases 4 & 5", 4)
        
        # Horizontal Timeline
        t_y = 350
        draw.line([(100, t_y), (1180, t_y)], fill=COLOR_BORDER, width=4)
        
        milestones = [
            ("Phase 4.1", "On-Premises Delmas", "Cockpit offline-first DB", COLOR_CYAN, 0.15),
            ("Phase 4.2", "QA Expansion", "Reach 80% Test Coverage", COLOR_BLUE, 0.40),
            ("Phase 5.1", "Mobile PWA", "Tablet operator support", COLOR_GOLD, 0.65),
            ("Phase 5.2", "Shift Analytics", "Automated daily closeouts", COLOR_RED, 0.90)
        ]
        
        for title, subtitle, desc, col, pos_pct in milestones:
            mx = int(100 + 1080 * pos_pct)
            
            # Animate milestone drop-in
            m_prog = min(1.0, max(0.0, (frame_in_slide - pos_pct * FPS * 1.5) / (FPS * 0.5)))
            m_ease = 1.0 - (1.0 - m_prog) ** 3
            
            if m_ease > 0:
                # Node
                draw.ellipse([mx-10, t_y-10, mx+10, t_y+10], fill=COLOR_CARD_BG, outline=col, width=4)
                
                y_offset = -120 if milestones.index((title, subtitle, desc, col, pos_pct)) % 2 == 0 else 40
                
                draw.line([(mx, t_y), (mx, t_y + y_offset // 2)], fill=col[:3] + (100,), width=2)
                
                txt_y = t_y + y_offset + int((1.0 - m_ease) * 10)
                alpha = int(m_ease * 255)
                
                draw.text((mx, txt_y), title, fill=col[:3] + (alpha,), font=font_large, anchor="mm")
                draw.text((mx, txt_y + 30), subtitle, fill=COLOR_WHITE[:3] + (alpha,), font=font_medium, anchor="mm")
                draw.text((mx, txt_y + 55), desc, fill=COLOR_GRAY[:3] + (alpha,), font=font_small, anchor="mm")

    # Global Footer & Progress
    draw.text((90, HEIGHT - 45), "Arch-Systems Mining Operations Portal", fill=COLOR_GRAY, font=font_small)
    draw.text((WIDTH - 90, HEIGHT - 45), f"0{slide_index + 1} / 0{NUM_SLIDES}", fill=COLOR_CYAN, font=font_mono, anchor="rm")
    
    # Elegant thin progress bar
    progress_w = 500
    progress_h = 2
    progress_x = (WIDTH - progress_w) // 2
    progress_y = HEIGHT - 40
    draw.rectangle([progress_x, progress_y, progress_x + progress_w, progress_y + progress_h], fill=(255, 255, 255, 10))
    
    percentage = frame_in_slide / FRAMES_PER_SLIDE
    active_w = int(progress_w * percentage)
    if active_w > 0:
        draw.rectangle([progress_x, progress_y, progress_x + active_w, progress_y + progress_h], fill=COLOR_CYAN)

    return img

def main():
    print("Generating corporate presentation frames...")
    if os.path.exists(TEMP_FRAMES_DIR):
        shutil.rmtree(TEMP_FRAMES_DIR)
    os.makedirs(TEMP_FRAMES_DIR)

    # We cannot fully pre-cache because of the animations which depend on `frame_in_slide`
    frame_number = 0
    while frame_number < TOTAL_FRAMES:
        slide_idx = frame_number // FRAMES_PER_SLIDE
        frame_in_slide = frame_number % FRAMES_PER_SLIDE

        img_curr = render_slide(slide_idx, frame_in_slide)

        # Cross-fading transition
        if frame_in_slide < TRANSITION_FRAMES and slide_idx > 0:
            prev_slide_idx = slide_idx - 1
            prev_frame_in_slide = FRAMES_PER_SLIDE - 1
            # We need to re-render the last frame of the previous slide to blend
            img_prev = render_slide(prev_slide_idx, prev_frame_in_slide)
            
            alpha = frame_in_slide / TRANSITION_FRAMES
            final_img = Image.blend(img_prev, img_curr, alpha)
        else:
            final_img = img_curr

        frame_path = os.path.join(TEMP_FRAMES_DIR, f"frame_{frame_number:05d}.png")
        final_img.save(frame_path, "PNG")

        frame_number += 1
        if frame_number % 100 == 0:
            print(f"Rendered {frame_number} / {TOTAL_FRAMES} frames...")

    print("Frames generation complete. Running ffmpeg to compile video...")
    
    cmd = [
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", os.path.join(TEMP_FRAMES_DIR, "frame_%05d.png"),
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-profile:v", "high",
        "-level", "4.0",
        OUTPUT_VIDEO_PATH
    ]
    
    try:
        subprocess.run(cmd, check=True)
        print(f"Success! Corporate Video created at: {OUTPUT_VIDEO_PATH}")
    except subprocess.CalledProcessError as e:
        print(f"Error compiling video: {e}")
    finally:
        print("Cleaning up temporary frames...")
        shutil.rmtree(TEMP_FRAMES_DIR)
        print("Cleanup complete.")

if __name__ == "__main__":
    main()
