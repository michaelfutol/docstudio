import os, re, shutil, zipfile

out_dir = 'out'
assets_dir = os.path.join(out_dir, 'assets')
_next_dir = os.path.join(out_dir, '_next')

if os.path.exists(_next_dir):
    shutil.move(_next_dir, assets_dir)

for r, d, files in os.walk(out_dir):
    for f in files:
        if f.endswith(('.html', '.js', '.css', '.txt')):
            p = os.path.join(r, f)
            with open(p, 'r', encoding='utf-8', errors='ignore') as file:
                c = file.read()
            with open(p, 'w', encoding='utf-8') as file:
                file.write(re.sub(r'/_next/', '/assets/', c))

zipf = zipfile.ZipFile('..\docstudio-frontend-final.zip', 'w', zipfile.ZIP_DEFLATED)
for r, d, files in os.walk(out_dir):
    for f in files:
        zipf.write(os.path.join(r, f), os.path.relpath(os.path.join(r, f), out_dir).replace('\\', '/'))
zipf.close()
