import os
import shutil

out_dir = 'out'
old_next_dir = os.path.join(out_dir, '_next')
new_next_dir = os.path.join(out_dir, 'assets')

if os.path.exists(old_next_dir):
    # Rename _next to assets
    if os.path.exists(new_next_dir):
        shutil.rmtree(new_next_dir)
    os.rename(old_next_dir, new_next_dir)
    print("Renamed _next to assets")

# Traverse all files and replace /_next/ with /assets/
replace_count = 0
for root, dirs, files in os.walk(out_dir):
    for file in files:
        if file.endswith(('.html', '.js', '.css', '.json', '.txt')):
            file_path = os.path.join(root, file)
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if '/_next/' in content or '"_next/' in content or '_next/' in content:
                content = content.replace('/_next/', '/assets/')
                content = content.replace('"/_next/', '"/assets/')
                # Also handle cases where it might be encoded or relative
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                replace_count += 1

print(f"Replaced _next references in {replace_count} files.")

import zipfile
zip_path = '../docstudio-frontend-chunking.zip'
print(f"Creating zip at {zip_path}...")
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for r, d, files in os.walk(out_dir):
        for f in files:
            full_path = os.path.join(r, f)
            rel_path = os.path.relpath(full_path, out_dir).replace('\\', '/')
            zipf.write(full_path, rel_path)
print("Zip creation complete.")
