#!/usr/bin/env python3
"""
Icon generator for Fact Checker Pro Chrome Extension
Creates PNG icons from SVG in required sizes
"""

import os
import sys
from PIL import Image, ImageDraw, ImageFont
import io

def create_icon_png(size, output_path):
    """Create a PNG icon of the specified size"""
    # Create a new image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Calculate dimensions
    center = size // 2
    radius = int(size * 0.4)
    
    # Draw gradient background circle
    # Create a simple gradient effect by drawing multiple circles
    for i in range(radius):
        alpha = int(255 * (1 - i / radius))
        color1 = (79, 70, 229, alpha)  # #4f46e5
        color2 = (124, 58, 237, alpha)  # #7c3aed
        
        # Interpolate between colors
        ratio = i / radius
        r = int(color1[0] * (1 - ratio) + color2[0] * ratio)
        g = int(color1[1] * (1 - ratio) + color2[1] * ratio)
        b = int(color1[2] * (1 - ratio) + color2[2] * ratio)
        
        draw.ellipse([
            center - radius + i, center - radius + i,
            center + radius - i, center + radius - i
        ], fill=(r, g, b, 255))
    
    # Draw white border
    border_width = max(1, size // 32)
    draw.ellipse([
        center - radius, center - radius,
        center + radius, center + radius
    ], outline=(255, 255, 255, 255), width=border_width)
    
    # Draw magnifying glass
    glass_radius = int(size * 0.15)
    glass_x = center - int(size * 0.08)
    glass_y = center - int(size * 0.08)
    
    # Magnifying glass circle
    glass_width = max(1, size // 24)
    draw.ellipse([
        glass_x - glass_radius, glass_y - glass_radius,
        glass_x + glass_radius, glass_y + glass_radius
    ], outline=(255, 255, 255, 255), width=glass_width)
    
    # Magnifying glass handle
    handle_start_x = glass_x + int(glass_radius * 0.7)
    handle_start_y = glass_y + int(glass_radius * 0.7)
    handle_end_x = handle_start_x + int(size * 0.08)
    handle_end_y = handle_start_y + int(size * 0.08)
    
    draw.line([
        handle_start_x, handle_start_y,
        handle_end_x, handle_end_y
    ], fill=(255, 255, 255, 255), width=glass_width)
    
    # Draw checkmark inside magnifying glass
    check_size = int(glass_radius * 0.8)
    check_x = glass_x
    check_y = glass_y
    
    # Checkmark path (simplified)
    check_width = max(1, size // 32)
    draw.line([
        check_x - check_size//2, check_y,
        check_x - check_size//4, check_y + check_size//3,
    ], fill=(255, 255, 255, 255), width=check_width)
    
    draw.line([
        check_x - check_size//4, check_y + check_size//3,
        check_x + check_size//2, check_y - check_size//3,
    ], fill=(255, 255, 255, 255), width=check_width)
    
    # Draw status indicator dots
    dot_radius = max(2, size // 24)
    dot_x = center + int(size * 0.2)
    
    # True (green)
    draw.ellipse([
        dot_x - dot_radius, center - int(size * 0.2) - dot_radius,
        dot_x + dot_radius, center - int(size * 0.2) + dot_radius
    ], fill=(16, 185, 129, 255))  # #10b981
    
    # False (red)
    draw.ellipse([
        dot_x - dot_radius, center - dot_radius,
        dot_x + dot_radius, center + dot_radius
    ], fill=(239, 68, 68, 255))  # #ef4444
    
    # Unknown (yellow)
    draw.ellipse([
        dot_x - dot_radius, center + int(size * 0.2) - dot_radius,
        dot_x + dot_radius, center + int(size * 0.2) + dot_radius
    ], fill=(245, 158, 11, 255))  # #f59e0b
    
    # Save the image
    img.save(output_path, 'PNG')
    print(f"Created {output_path} ({size}x{size})")

def main():
    """Create all required icon sizes"""
    # Icon sizes required by Chrome extensions
    sizes = [16, 32, 48, 128]
    
    # Create icons directory if it doesn't exist
    icons_dir = "/Users/armaanmulani/Desktop/Extension_project/chrome-extension/icons"
    os.makedirs(icons_dir, exist_ok=True)
    
    print("Creating Fact Checker Pro extension icons...")
    
    for size in sizes:
        output_path = os.path.join(icons_dir, f"icon{size}.png")
        create_icon_png(size, output_path)
    
    print("\n✅ All icons created successfully!")
    print(f"📁 Icons saved to: {icons_dir}")
    print("\nIcon files created:")
    for size in sizes:
        print(f"  - icon{size}.png ({size}x{size})")

if __name__ == '__main__':
    try:
        main()
    except ImportError as e:
        print(f"❌ Error: Missing required library: {e}")
        print("💡 Install Pillow with: pip install Pillow")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error creating icons: {e}")
        sys.exit(1)
