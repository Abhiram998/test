import json
import urllib.request

BASE_URL = "http://localhost:8000"

def post_api(endpoint, data):
    req = urllib.request.Request(
        f"{BASE_URL}{endpoint}",
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req) as response:
            return 200, json.loads(response.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

def get_api(endpoint):
    with urllib.request.urlopen(f"{BASE_URL}{endpoint}") as response:
        return json.loads(response.read().decode())

print("--- PROBING HEAVY ENTRY FOR ALL ZONES ---")
zones = get_api("/api/zones")

for z in zones:
    zid = z['id']
    zname = z['name']
    heavy_limit = z['limits'].get('heavy', 0)
    heavy_occ = z['stats'].get('heavy', 0)
    
    print(f"\nChecking Zone: {zname} ({zid})")
    print(f"  Heavy Limit: {heavy_limit}")
    print(f"  Current Heavy: {heavy_occ}")
    
    # Try entry
    code, res = post_api("/api/enter", {"vehicle": f"PROBE-H-{zid}", "type": "heavy", "zone": zid})
    print(f"  Result Code: {code}")
    if code == 200:
        print(f"  SUCCESS! (Bypassed if limit was <= {heavy_occ})")
        # Exit to clean up? No, just keep note.
    else:
        print(f"  REJECTED: {res.get('message') or res.get('detail')}")
