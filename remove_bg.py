
import sys
from PIL import Image
import numpy as np

def remove_black_background(input_path, output_path, threshold=50):
    try:
        img = Image.open(input_path).convert("RGBA")
        data = np.array(img)
        
        # Extract RGB channels
        r, g, b, a = data.T
        
        # Define black condition (all channels < threshold)
        black_areas = (r < threshold) & (g < threshold) & (b < threshold)
        
        # Set alpha to 0 for black areas
        data[..., 3][black_areas.T] = 0
        
        # Create new image
        new_img = Image.fromarray(data)
        new_img.save(output_path)
        print(f"Successfully saved to {output_path}")
        
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    input_file = "attached_assets/39187d46-b1f9-4842-8f8a-5185d294889e_1764999830963.jpeg"
    output_file = "attached_assets/police-logo-transparent.png"
    remove_black_background(input_file, output_file)
