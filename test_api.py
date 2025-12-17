#!/usr/bin/env python3
"""
Simple API test for SE Insight Backend
"""

import requests
import json

def test_api():
    """Test the API endpoints"""
    base_url = "http://localhost:8000"
    
    try:
        # Test root endpoint
        print("Testing root endpoint...")
        response = requests.get(f"{base_url}/")
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Root endpoint working: {data['message']}")
            print(f"✓ Version: {data['version']}")
            print(f"✓ Active connections: {data['active_connections']}")
            print(f"✓ Capabilities: {data['capabilities']}")
        else:
            print(f"✗ Root endpoint failed: {response.status_code}")
            return False
        
        # Test health endpoint
        print("\nTesting health endpoint...")
        response = requests.get(f"{base_url}/health")
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Health check: {data['status']}")
            print(f"✓ Models: {data['models']}")
        else:
            print(f"✗ Health endpoint failed: {response.status_code}")
            return False
        
        # Test stats endpoint
        print("\nTesting stats endpoint...")
        response = requests.get(f"{base_url}/stats")
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Stats endpoint working")
            print(f"✓ System info: {data['system']}")
        else:
            print(f"✗ Stats endpoint failed: {response.status_code}")
            return False
        
        # Test SE terms endpoint
        print("\nTesting SE terms endpoint...")
        response = requests.get(f"{base_url}/se-terms")
        if response.status_code == 200:
            data = response.json()
            print(f"✓ SE terms: {data['total_terms']} terms available")
            print(f"✓ Categories: {list(data['categories'].keys())}")
        else:
            print(f"✗ SE terms endpoint failed: {response.status_code}")
            return False
        
        print("\n🎉 All API endpoints are working correctly!")
        return True
        
    except Exception as e:
        print(f"✗ API test failed: {e}")
        return False

if __name__ == "__main__":
    test_api()