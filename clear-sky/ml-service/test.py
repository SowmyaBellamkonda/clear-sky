import eco_service
api_token = eco_service._get_access_token()
print("Token retrieved, length:", len(api_token))
import requests

# Try fetching
try:
    print(eco_service.fetch_ndvi(19.0760, 72.8777))
except Exception as e:
    import traceback
    traceback.print_exc()
