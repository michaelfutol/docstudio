import urllib.request, json
req = urllib.request.Request("https://docstudio-830r.onrender.com/api/v1/stats/", headers={"User-Agent": "Mozilla/5.0"})
res = urllib.request.urlopen(req)
stats = json.loads(res.read())
for d in stats.get("recent_documents", []):
    print("ID:", d["id"], "Status:", d["status"], "Progress:", d.get("extraction_progress"))
