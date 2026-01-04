import urllib.request
import json

def test_reports():
    url = "http://localhost:8000/api/reports"
    try:
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode())
            print("\n--- REPORT API RESPONSE (First 3 items) ---")
            for item in data[:3]:
                print(f"Vehicle: {item.get('vehicle')} | Zone: {item.get('zone')}")
            
            # Check specifically for the vehicle in the screenshot if possible, or just Z9 lookup
            z9_items = [i for i in data if i.get('zone') == 'Z9']
            if z9_items:
                print("\n❌ FAILURE: Found 'Z9' in response!")
            else:
                print("\n✅ SUCCESS: No 'Z9' found. Zone names are likely correct.")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_reports()
