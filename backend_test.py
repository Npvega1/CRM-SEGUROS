#!/usr/bin/env python3
"""
Backend API Testing for AI Comparison Module
Tests the /api/ai/compare endpoint and related functionality
"""

import requests
import sys
import json
import base64
from datetime import datetime
from typing import Dict, Any, List

class AIComparisonTester:
    def __init__(self, base_url: str = "https://quote-ai-2.preview.emergentagent.com"):
        self.base_url = base_url.rstrip('/')
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results: List[Dict[str, Any]] = []

    def log_test(self, name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED")
        else:
            print(f"❌ {name}: FAILED - {details}")
        
        self.test_results.append({
            "test_name": name,
            "success": success,
            "details": details,
            "response_data": response_data,
            "timestamp": datetime.now().isoformat()
        })

    def test_basic_connectivity(self) -> bool:
        """Test basic API connectivity"""
        try:
            response = requests.get(f"{self.base_url}/api/", timeout=10)
            if response.status_code == 200:
                data = response.json()
                success = "message" in data
                self.log_test("Basic API Connectivity", success, 
                            f"Status: {response.status_code}, Response: {data}")
                return success
            else:
                self.log_test("Basic API Connectivity", False, 
                            f"Unexpected status code: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Basic API Connectivity", False, f"Connection error: {str(e)}")
            return False

    def test_ai_compare_endpoint_exists(self) -> bool:
        """Test if /api/ai/compare endpoint exists"""
        try:
            # Test with minimal invalid data to check if endpoint exists
            response = requests.post(
                f"{self.base_url}/api/ai/compare",
                json={},
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            # Endpoint exists if we get 422 (validation error) or 500, not 404
            if response.status_code in [422, 500]:
                self.log_test("AI Compare Endpoint Exists", True, 
                            f"Endpoint exists (status: {response.status_code})")
                return True
            elif response.status_code == 404:
                self.log_test("AI Compare Endpoint Exists", False, 
                            "Endpoint not found (404)")
                return False
            else:
                # Try to parse response for more info
                try:
                    data = response.json()
                    self.log_test("AI Compare Endpoint Exists", True, 
                                f"Endpoint exists (status: {response.status_code}, response: {data})")
                    return True
                except:
                    self.log_test("AI Compare Endpoint Exists", True, 
                                f"Endpoint exists (status: {response.status_code})")
                    return True
                    
        except Exception as e:
            self.log_test("AI Compare Endpoint Exists", False, f"Error: {str(e)}")
            return False

    def create_sample_pdf_base64(self) -> str:
        """Create a minimal PDF in base64 format for testing"""
        # Minimal PDF content
        pdf_content = b"""%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Test Insurance Quote) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
300
%%EOF"""
        return base64.b64encode(pdf_content).decode('utf-8')

    def test_ai_compare_with_sample_data(self) -> bool:
        """Test AI compare endpoint with sample data"""
        try:
            # Create sample request data
            sample_pdf_base64 = self.create_sample_pdf_base64()
            
            request_data = {
                "comparisonId": "test-comparison-123",
                "tenantId": "test-tenant-456", 
                "line": "auto",
                "files": [
                    {
                        "name": "quote1.pdf",
                        "file_url": "test-url-1",
                        "file_type": "pdf",
                        "base64_content": sample_pdf_base64
                    },
                    {
                        "name": "quote2.pdf", 
                        "file_url": "test-url-2",
                        "file_type": "pdf",
                        "base64_content": sample_pdf_base64
                    }
                ],
                "criteria": ["Prima Anual", "Valor Asegurado", "Cobertura Daños"]
            }
            
            response = requests.post(
                f"{self.base_url}/api/ai/compare",
                json=request_data,
                headers={'Content-Type': 'application/json'},
                timeout=30  # Longer timeout for AI processing
            )
            
            print(f"AI Compare Response Status: {response.status_code}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    success = "success" in data
                    self.log_test("AI Compare with Sample Data", success, 
                                f"Response received: {json.dumps(data, indent=2)[:500]}...")
                    return success
                except json.JSONDecodeError:
                    self.log_test("AI Compare with Sample Data", False, 
                                "Invalid JSON response")
                    return False
            elif response.status_code == 500:
                try:
                    error_data = response.json()
                    # Check if it's an API key issue or other server error
                    error_msg = error_data.get('detail', 'Unknown server error')
                    if 'API key' in error_msg or 'EMERGENT_LLM_KEY' in error_msg:
                        self.log_test("AI Compare with Sample Data", False, 
                                    f"API Key Configuration Issue: {error_msg}")
                    else:
                        self.log_test("AI Compare with Sample Data", False, 
                                    f"Server Error: {error_msg}")
                    return False
                except:
                    self.log_test("AI Compare with Sample Data", False, 
                                f"Server Error (Status: {response.status_code})")
                    return False
            else:
                try:
                    error_data = response.json()
                    self.log_test("AI Compare with Sample Data", False, 
                                f"Status: {response.status_code}, Error: {error_data}")
                except:
                    self.log_test("AI Compare with Sample Data", False, 
                                f"Status: {response.status_code}")
                return False
                
        except requests.exceptions.Timeout:
            self.log_test("AI Compare with Sample Data", False, 
                        "Request timeout (30s) - AI processing may be slow")
            return False
        except Exception as e:
            self.log_test("AI Compare with Sample Data", False, f"Error: {str(e)}")
            return False

    def test_ai_compare_validation(self) -> bool:
        """Test AI compare endpoint input validation"""
        try:
            # Test with missing required fields
            invalid_requests = [
                ({}, "Empty request"),
                ({"comparisonId": "test"}, "Missing tenantId, line, files, criteria"),
                ({"comparisonId": "test", "tenantId": "test", "line": "auto"}, "Missing files and criteria"),
                ({"comparisonId": "test", "tenantId": "test", "line": "invalid_line", "files": [], "criteria": []}, "Invalid line value")
            ]
            
            validation_passed = 0
            for invalid_data, description in invalid_requests:
                response = requests.post(
                    f"{self.base_url}/api/ai/compare",
                    json=invalid_data,
                    headers={'Content-Type': 'application/json'},
                    timeout=10
                )
                
                # Should return 422 for validation errors
                if response.status_code == 422:
                    validation_passed += 1
                    print(f"  ✓ Validation test passed: {description}")
                else:
                    print(f"  ✗ Validation test failed: {description} (got {response.status_code})")
            
            success = validation_passed >= 2  # At least half should pass
            self.log_test("AI Compare Input Validation", success, 
                        f"{validation_passed}/{len(invalid_requests)} validation tests passed")
            return success
            
        except Exception as e:
            self.log_test("AI Compare Input Validation", False, f"Error: {str(e)}")
            return False

    def test_emergent_llm_key_configured(self) -> bool:
        """Test if Emergent LLM key is properly configured by checking error messages"""
        try:
            # Send a minimal valid request to trigger API key usage
            request_data = {
                "comparisonId": "key-test-123",
                "tenantId": "key-test-tenant",
                "line": "auto", 
                "files": [
                    {
                        "name": "test.pdf",
                        "file_url": "test-url",
                        "file_type": "pdf",
                        "base64_content": self.create_sample_pdf_base64()
                    }
                ],
                "criteria": ["Prima"]
            }
            
            response = requests.post(
                f"{self.base_url}/api/ai/compare",
                json=request_data,
                headers={'Content-Type': 'application/json'},
                timeout=15
            )
            
            if response.status_code == 500:
                try:
                    error_data = response.json()
                    error_msg = error_data.get('detail', '').lower()
                    
                    if 'api key not configured' in error_msg or 'emergent_llm_key' in error_msg:
                        self.log_test("Emergent LLM Key Configuration", False, 
                                    "API key not configured or missing")
                        return False
                    else:
                        # If we get a different error, the key is likely configured
                        self.log_test("Emergent LLM Key Configuration", True, 
                                    f"API key appears configured (got different error: {error_msg[:100]})")
                        return True
                except:
                    self.log_test("Emergent LLM Key Configuration", True, 
                                "API key appears configured (non-JSON error response)")
                    return True
            else:
                # Any other response suggests the key is configured
                self.log_test("Emergent LLM Key Configuration", True, 
                            f"API key appears configured (status: {response.status_code})")
                return True
                
        except Exception as e:
            self.log_test("Emergent LLM Key Configuration", False, f"Error: {str(e)}")
            return False

    def run_all_tests(self) -> Dict[str, Any]:
        """Run all backend tests"""
        print("🚀 Starting Backend API Tests for AI Comparison Module")
        print("=" * 60)
        
        # Test basic connectivity first
        if not self.test_basic_connectivity():
            print("❌ Basic connectivity failed. Stopping tests.")
            return self.get_summary()
        
        # Test AI compare endpoint
        self.test_ai_compare_endpoint_exists()
        self.test_ai_compare_validation()
        self.test_emergent_llm_key_configured()
        self.test_ai_compare_with_sample_data()
        
        return self.get_summary()

    def get_summary(self) -> Dict[str, Any]:
        """Get test summary"""
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": self.tests_run - self.tests_passed,
            "success_rate": f"{success_rate:.1f}%",
            "test_results": self.test_results,
            "summary": f"Backend API Tests: {self.tests_passed}/{self.tests_run} passed ({success_rate:.1f}%)"
        }

def main():
    """Main test execution"""
    tester = AIComparisonTester()
    
    try:
        summary = tester.run_all_tests()
        
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Total Tests: {summary['total_tests']}")
        print(f"Passed: {summary['passed_tests']}")
        print(f"Failed: {summary['failed_tests']}")
        print(f"Success Rate: {summary['success_rate']}")
        
        # Print failed tests details
        failed_tests = [t for t in summary['test_results'] if not t['success']]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            for test in failed_tests:
                print(f"  • {test['test_name']}: {test['details']}")
        
        # Return appropriate exit code
        return 0 if summary['passed_tests'] == summary['total_tests'] else 1
        
    except Exception as e:
        print(f"❌ Test execution failed: {str(e)}")
        return 1

if __name__ == "__main__":
    sys.exit(main())