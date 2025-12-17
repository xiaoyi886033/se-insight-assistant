#!/usr/bin/env python3
"""
Create PNG icons from SVG for Chrome extension
"""

import os
import base64
from PIL import Image, ImageDraw, ImageFont
import io

def create_png_icon(size, output_path):
    """Create a PNG icon of specified size"""
    # Create image with gradient background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Create gradient effect by drawing multiple rectangles
    for i in range(size):
        # Gradient from blue to purple
        r = int(79 + (124 - 79) * i / size)  # 4F to 7C
        g = int(70 + (58 - 70) * i / size)   # 46 to 3A  
        b = int(229 + (237 - 229) * i / size) # E5 to ED
        
        draw.rectangle([i, 0, i+1, size], fill=(r, g, b, 255))
    
    # Round corners
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    corner_radius = max(3, size // 8)
    mask_draw.rounded_rectangle([0, 0, size, size], corner_radius, fill=255)
    
    # Apply mask
    img.putalpha(mask)
    
    # Add text lines (representing transcription)
    line_color = (255, 255, 255, 255)
    line_height = max(1, size // 16)
    
    # Draw transcription lines
    lines = [
        (size // 6, size // 3, size - size // 6),
        (size // 6, size // 2, size - size // 3),
        (size // 6, size * 2 // 3, size - size // 2),
    ]
    
    for x1, y, x2 in lines:
        draw.rectangle([x1, y, x2, y + line_height], fill=line_color)
    
    # Add checkmark (SE analysis indicator)
    if size >= 32:
        check_size = size // 4
        check_x = size - check_size - size // 8
        check_y = size - check_size - size // 8
        
        # Green circle background
        draw.ellipse([check_x - 2, check_y - 2, check_x + check_size + 2, check_y + check_size + 2], 
                    fill=(16, 185, 129, 255))
        
        # White checkmark
        check_thickness = max(1, size // 32)
        points = [
            (check_x + check_size // 4, check_y + check_size // 2),
            (check_x + check_size // 2, check_y + check_size * 3 // 4),
            (check_x + check_size * 3 // 4, check_y + check_size // 4)
        ]
        
        # Draw checkmark lines
        for i in range(len(points) - 1):
            x1, y1 = points[i]
            x2, y2 = points[i + 1]
            draw.line([x1, y1, x2, y2], fill=(255, 255, 255, 255), width=check_thickness)
    
    # Add "SE" text for larger icons
    if size >= 48:
        try:
            # Try to use a system font
            font_size = max(8, size // 8)
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            # Fallback to default font
            font = ImageFont.load_default()
        
        text = "SE"
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        text_x = (size - text_width) // 2
        text_y = size - text_height - size // 10
        
        draw.text((text_x, text_y), text, fill=(255, 255, 255, 255), font=font)
    
    # Save the image
    img.save(output_path, 'PNG')
    print(f"Created {output_path} ({size}x{size})")

def main():
    """Create all required icon sizes"""
    icon_sizes = [16, 48, 128]
    
    # Create icons directory if it doesn't exist
    icons_dir = "extension/icons"
    os.makedirs(icons_dir, exist_ok=True)
    
    for size in icon_sizes:
        output_path = f"{icons_dir}/icon{size}.png"
        create_png_icon(size, output_path)
    
    print("\n✅ All icons created successfully!")
    print("Icons are ready for Chrome Web Store submission.")

if __name__ == "__main__":
    main()