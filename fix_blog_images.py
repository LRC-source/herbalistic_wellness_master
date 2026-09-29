import json
import os
import re

json_path = r'C:\Users\lacar\Desktop\LRC Master\src\apps\apothecary\herbalistic_wellness\blog_posts.json'
img_dir = r'C:\Users\lacar\Desktop\LRC Master\src\apps\apothecary\herbalistic_wellness\assets\images\generated'

with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# The generated images exist in img_dir. Let's list them.
generated_images = os.listdir(img_dir) if os.path.exists(img_dir) else []

updated_count = 0

for d in data:
    title = d['title']
    seo_name = title.lower().replace(' ', '-').replace('?', '').replace('!', '').replace(':', '').replace('\'', '').replace('\"', '') + '-generated.png'
    
    if seo_name in generated_images:
        # It has a generated image! Let's find the first image in the content and replace its src
        # The regex should match ANY <img ... src="..." ...> and replace the src with the local one
        old_content = d['content']
        # Find the first <img> tag
        match = re.search(r'<img[^>]+>', old_content)
        if match:
            img_tag = match.group(0)
            # Replace the src attribute inside the img tag
            new_img_tag = re.sub(r'src=\"[^\"]+\"', f'src="./assets/images/generated/{seo_name}"', img_tag)
            
            # If the original didn't have a src with double quotes, try single quotes
            if new_img_tag == img_tag:
                new_img_tag = re.sub(r"src='[^']+'", f'src="./assets/images/generated/{seo_name}"', img_tag)
                
            d['content'] = old_content.replace(img_tag, new_img_tag)
            if old_content != d['content']:
                updated_count += 1

with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=4)

print(f"Updated {updated_count} posts with local generated images.")
