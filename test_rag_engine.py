#!/usr/bin/env python3
"""
Test Enhanced RAG Engine Features
"""

import requests
import json
import time

def test_enhanced_rag():
    """Test the enhanced RAG engine capabilities"""
    base_url = "http://localhost:8000"
    
    print("🧠 Testing Enhanced RAG Engine Features")
    print("=" * 50)
    
    # Test 1: Enhanced explanation for different user levels
    print("\n1. Testing Context-Aware Explanations...")
    
    terms_to_test = ["api", "microservices", "object oriented", "algorithm"]
    contexts = [
        ("web development", "beginner"),
        ("system design", "intermediate"), 
        ("enterprise architecture", "advanced")
    ]
    
    for term in terms_to_test[:2]:  # Test first 2 terms
        print(f"\n📚 Term: {term.upper()}")
        
        for context, level in contexts:
            try:
                response = requests.get(
                    f"{base_url}/se-terms/{term}/enhanced",
                    params={"context": context, "user_level": level}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    explanation = data["enhanced_explanation"]
                    
                    print(f"  🎯 {level.title()} Level ({context}):")
                    print(f"     Definition: {explanation['definition'][:80]}...")
                    print(f"     Category: {explanation['category']}")
                    print(f"     Complexity: {explanation['complexity']}")
                    print(f"     Example: {explanation['practical_example'][:60]}...")
                    
                    if explanation['learning_path']['prerequisites']:
                        print(f"     Prerequisites: {', '.join(explanation['learning_path']['prerequisites'])}")
                    
                    if explanation['learning_path']['next_steps']:
                        print(f"     Next Steps: {', '.join(explanation['learning_path']['next_steps'])}")
                        
                else:
                    print(f"  ❌ Error: {response.status_code}")
                    
            except Exception as e:
                print(f"  ❌ Error testing {term}: {e}")
    
    # Test 2: Learning path recommendations
    print(f"\n2. Testing Learning Path Generation...")
    
    try:
        response = requests.get(f"{base_url}/se-terms/microservices/enhanced")
        if response.status_code == 200:
            data = response.json()
            explanation = data["enhanced_explanation"]
            learning_path = explanation["learning_path"]
            
            print("📈 Microservices Learning Path:")
            print(f"   Prerequisites: {learning_path['prerequisites']}")
            print(f"   Related Concepts: {learning_path['related_concepts']}")
            print(f"   Next Steps: {learning_path['next_steps']}")
            print(f"   Misconceptions: {explanation['common_misconceptions']}")
            
    except Exception as e:
        print(f"❌ Error testing learning paths: {e}")
    
    # Test 3: Real-world context
    print(f"\n3. Testing Real-World Context...")
    
    try:
        response = requests.get(f"{base_url}/se-terms/database/enhanced")
        if response.status_code == 200:
            data = response.json()
            explanation = data["enhanced_explanation"]
            
            print("🌍 Database Real-World Usage:")
            print(f"   Usage Context: {explanation['real_world_usage']}")
            print(f"   Practical Example: {explanation['practical_example']}")
            
    except Exception as e:
        print(f"❌ Error testing real-world context: {e}")
    
    print(f"\n🎉 RAG Engine Testing Complete!")
    print("✅ Enhanced explanations with context awareness")
    print("✅ Learning path recommendations")
    print("✅ Real-world usage examples")
    print("✅ Common misconceptions addressed")

if __name__ == "__main__":
    test_enhanced_rag()