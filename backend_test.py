#!/usr/bin/env python3
"""
Comprehensive Backend API Tests for Technomatz Finance Management System
Tests all authentication, CRUD operations, and financial calculations
"""

import requests
import json
import time
from datetime import datetime, timedelta
import os

# Get base URL from environment
BASE_URL = "https://director-ledger.preview.emergentagent.com/api"

class TechnomatzAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.access_token = None
        self.current_user = None
        self.test_results = []
        
    def log_result(self, test_name, success, message="", data=None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "data": data,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        
    def make_request(self, method, endpoint, data=None, headers=None):
        """Make HTTP request with proper error handling"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, headers=headers)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, headers=headers)
            elif method.upper() == 'PUT':
                response = self.session.put(url, json=data, headers=headers)
            elif method.upper() == 'DELETE':
                response = self.session.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
            return None
    
    def test_api_root(self):
        """Test API root endpoint"""
        response = self.make_request('GET', '/')
        
        if response and response.status_code == 200:
            data = response.json()
            if 'message' in data and 'Technomatz' in data['message']:
                self.log_result("API Root", True, "API root accessible")
                return True
            else:
                self.log_result("API Root", False, f"Unexpected response: {data}")
        else:
            status = response.status_code if response else "No response"
            self.log_result("API Root", False, f"Failed to access API root: {status}")
        return False
    
    def test_auth_register(self):
        """Test user registration"""
        # Test with new user
        test_user = {
            "name": "Test Director E",
            "email": "directore@technomatz.com",
            "password": "password123"
        }
        
        response = self.make_request('POST', '/auth/register', test_user)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'id' in data and 'email' in data and data['email'] == test_user['email']:
                self.log_result("Auth Register", True, "User registration successful")
                return True
            else:
                self.log_result("Auth Register", False, f"Invalid registration response: {data}")
        elif response and response.status_code == 400:
            # User might already exist, which is fine for testing
            data = response.json()
            if 'already registered' in data.get('error', ''):
                self.log_result("Auth Register", True, "User already exists (expected)")
                return True
            else:
                self.log_result("Auth Register", False, f"Registration failed: {data}")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Auth Register", False, f"Registration failed: {status}")
        return False
    
    def test_auth_login(self):
        """Test user login"""
        login_data = {
            "email": "directora@technomatz.com",
            "password": "password123"
        }
        
        response = self.make_request('POST', '/auth/login', login_data)
        
        if response and response.status_code == 200:
            data = response.json()
            if 'id' in data and 'email' in data:
                self.current_user = data
                # Extract access token from cookies if available
                cookies = response.cookies
                if 'access_token' in cookies:
                    self.access_token = cookies['access_token']
                    self.session.cookies.update(cookies)
                self.log_result("Auth Login", True, f"Login successful for {data['email']}")
                return True
            else:
                self.log_result("Auth Login", False, f"Invalid login response: {data}")
        else:
            status = response.status_code if response else "No response"
            error_msg = response.json().get('error', 'Unknown error') if response else "No response"
            self.log_result("Auth Login", False, f"Login failed: {status} - {error_msg}")
        return False
    
    def test_auth_me(self):
        """Test getting current user info"""
        response = self.make_request('GET', '/auth/me')
        
        if response and response.status_code == 200:
            data = response.json()
            if 'id' in data and 'email' in data:
                self.log_result("Auth Me", True, f"User info retrieved: {data['email']}")
                return True
            else:
                self.log_result("Auth Me", False, f"Invalid user info response: {data}")
        elif response and response.status_code == 401:
            self.log_result("Auth Me", False, "Not authenticated - login may have failed")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Auth Me", False, f"Failed to get user info: {status}")
        return False
    
    def test_auth_refresh(self):
        """Test token refresh"""
        response = self.make_request('POST', '/auth/refresh')
        
        if response and response.status_code == 200:
            data = response.json()
            if 'message' in data:
                self.log_result("Auth Refresh", True, "Token refresh successful")
                return True
            else:
                self.log_result("Auth Refresh", False, f"Invalid refresh response: {data}")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Auth Refresh", False, f"Token refresh failed: {status}")
        return False
    
    def test_auth_logout(self):
        """Test user logout"""
        response = self.make_request('POST', '/auth/logout')
        
        if response and response.status_code == 200:
            data = response.json()
            if 'message' in data:
                self.log_result("Auth Logout", True, "Logout successful")
                return True
            else:
                self.log_result("Auth Logout", False, f"Invalid logout response: {data}")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Auth Logout", False, f"Logout failed: {status}")
        return False
    
    def test_directors_list(self):
        """Test listing all directors"""
        response = self.make_request('GET', '/directors')
        
        if response and response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                self.log_result("Directors List", True, f"Retrieved {len(data)} directors")
                return True
            else:
                self.log_result("Directors List", False, f"Invalid directors response: {data}")
        elif response and response.status_code == 401:
            self.log_result("Directors List", False, "Not authenticated")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Directors List", False, f"Failed to get directors: {status}")
        return False
    
    def test_projects_crud(self):
        """Test complete CRUD operations for projects"""
        # Create project
        project_data = {
            "name": "Test Project Alpha",
            "salary": 50000,
            "status": "active",
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "developer_name": "John Developer"
        }
        
        # CREATE
        response = self.make_request('POST', '/projects', project_data)
        if not response or response.status_code != 200:
            status = response.status_code if response else "No response"
            self.log_result("Projects Create", False, f"Failed to create project: {status}")
            return False
        
        created_project = response.json()
        project_id = created_project.get('id')
        if not project_id:
            self.log_result("Projects Create", False, "No project ID in response")
            return False
        
        self.log_result("Projects Create", True, f"Project created with ID: {project_id}")
        
        # READ (List)
        response = self.make_request('GET', '/projects')
        if response and response.status_code == 200:
            projects = response.json()
            if isinstance(projects, list):
                self.log_result("Projects List", True, f"Retrieved {len(projects)} projects")
            else:
                self.log_result("Projects List", False, "Invalid projects list response")
                return False
        else:
            self.log_result("Projects List", False, "Failed to list projects")
            return False
        
        # READ (Single)
        response = self.make_request('GET', f'/projects/{project_id}')
        if response and response.status_code == 200:
            project = response.json()
            if project.get('id') == project_id:
                self.log_result("Projects Get", True, f"Retrieved project: {project['name']}")
            else:
                self.log_result("Projects Get", False, "Project ID mismatch")
                return False
        else:
            self.log_result("Projects Get", False, "Failed to get project")
            return False
        
        # UPDATE
        update_data = {
            "name": "Updated Test Project Alpha",
            "salary": 60000,
            "status": "completed"
        }
        
        response = self.make_request('PUT', f'/projects/{project_id}', update_data)
        if response and response.status_code == 200:
            updated_project = response.json()
            if updated_project.get('name') == update_data['name']:
                self.log_result("Projects Update", True, "Project updated successfully")
            else:
                self.log_result("Projects Update", False, "Project update failed")
                return False
        else:
            self.log_result("Projects Update", False, "Failed to update project")
            return False
        
        # DELETE
        response = self.make_request('DELETE', f'/projects/{project_id}')
        if response and response.status_code == 200:
            self.log_result("Projects Delete", True, "Project deleted successfully")
        else:
            self.log_result("Projects Delete", False, "Failed to delete project")
            return False
        
        return True
    
    def test_transactions_crud(self):
        """Test complete CRUD operations for transactions"""
        if not self.current_user:
            self.log_result("Transactions CRUD", False, "No current user for testing")
            return False
        
        director_id = self.current_user['id']
        
        # Test different transaction types
        transactions_to_test = [
            {
                "transaction_type": "income",
                "amount": 10000,
                "account_type": "company",
                "description": "Project payment received",
                "transaction_date": "2024-01-15"
            },
            {
                "transaction_type": "expense",
                "amount": 2000,
                "account_type": "company",
                "description": "Office rent",
                "transaction_date": "2024-01-16"
            },
            {
                "transaction_type": "loan",
                "amount": 5000,
                "director_id": director_id,
                "description": "Director loan to company",
                "transaction_date": "2024-01-17"
            },
            {
                "transaction_type": "transfer",
                "amount": 1000,
                "from_director_id": director_id,
                "to_director_id": director_id,  # Self transfer for testing
                "description": "Test transfer",
                "transaction_date": "2024-01-18"
            }
        ]
        
        created_transaction_ids = []
        
        # CREATE transactions
        for i, transaction_data in enumerate(transactions_to_test):
            response = self.make_request('POST', '/transactions', transaction_data)
            if response and response.status_code == 200:
                created_transaction = response.json()
                transaction_id = created_transaction.get('id')
                if transaction_id:
                    created_transaction_ids.append(transaction_id)
                    self.log_result(f"Transaction Create ({transaction_data['transaction_type']})", 
                                  True, f"Created {transaction_data['transaction_type']} transaction")
                else:
                    self.log_result(f"Transaction Create ({transaction_data['transaction_type']})", 
                                  False, "No transaction ID in response")
            else:
                status = response.status_code if response else "No response"
                self.log_result(f"Transaction Create ({transaction_data['transaction_type']})", 
                              False, f"Failed to create transaction: {status}")
        
        if not created_transaction_ids:
            self.log_result("Transactions CRUD", False, "No transactions created")
            return False
        
        # READ (List all)
        response = self.make_request('GET', '/transactions')
        if response and response.status_code == 200:
            transactions = response.json()
            if isinstance(transactions, list):
                self.log_result("Transactions List", True, f"Retrieved {len(transactions)} transactions")
            else:
                self.log_result("Transactions List", False, "Invalid transactions list response")
        else:
            self.log_result("Transactions List", False, "Failed to list transactions")
        
        # READ (Filter by type)
        response = self.make_request('GET', '/transactions?type=income')
        if response and response.status_code == 200:
            income_transactions = response.json()
            if isinstance(income_transactions, list):
                self.log_result("Transactions Filter", True, f"Retrieved {len(income_transactions)} income transactions")
            else:
                self.log_result("Transactions Filter", False, "Invalid filtered transactions response")
        else:
            self.log_result("Transactions Filter", False, "Failed to filter transactions")
        
        # READ (Single transaction)
        test_transaction_id = created_transaction_ids[0]
        response = self.make_request('GET', f'/transactions/{test_transaction_id}')
        if response and response.status_code == 200:
            transaction = response.json()
            if transaction.get('id') == test_transaction_id:
                self.log_result("Transaction Get", True, f"Retrieved transaction: {transaction['transaction_type']}")
            else:
                self.log_result("Transaction Get", False, "Transaction ID mismatch")
        else:
            self.log_result("Transaction Get", False, "Failed to get transaction")
        
        # UPDATE transaction
        update_data = {
            "amount": 12000,
            "description": "Updated project payment"
        }
        
        response = self.make_request('PUT', f'/transactions/{test_transaction_id}', update_data)
        if response and response.status_code == 200:
            updated_transaction = response.json()
            if updated_transaction.get('amount') == update_data['amount']:
                self.log_result("Transaction Update", True, "Transaction updated successfully")
            else:
                self.log_result("Transaction Update", False, "Transaction update failed")
        else:
            self.log_result("Transaction Update", False, "Failed to update transaction")
        
        # DELETE transactions (cleanup)
        for transaction_id in created_transaction_ids:
            response = self.make_request('DELETE', f'/transactions/{transaction_id}')
            if response and response.status_code == 200:
                self.log_result(f"Transaction Delete ({transaction_id[:8]})", True, "Transaction deleted")
            else:
                self.log_result(f"Transaction Delete ({transaction_id[:8]})", False, "Failed to delete transaction")
        
        return True
    
    def test_dashboard_company(self):
        """Test company dashboard endpoint"""
        # Test different periods
        periods_to_test = [
            ('all', {}),
            ('year', {'year': '2024'}),
            ('month', {'month': '0', 'year': '2024'})  # January 2024
        ]
        
        for period, params in periods_to_test:
            query_params = f"?period={period}"
            for key, value in params.items():
                query_params += f"&{key}={value}"
            
            response = self.make_request('GET', f'/dashboard/company{query_params}')
            if response and response.status_code == 200:
                data = response.json()
                required_fields = ['totalIncome', 'totalExpenses', 'companyIncome', 'companyBalance']
                if all(field in data for field in required_fields):
                    self.log_result(f"Dashboard Company ({period})", True, 
                                  f"Company dashboard data retrieved for {period}")
                else:
                    self.log_result(f"Dashboard Company ({period})", False, 
                                  f"Missing required fields in response: {data}")
            else:
                status = response.status_code if response else "No response"
                self.log_result(f"Dashboard Company ({period})", False, 
                              f"Failed to get company dashboard: {status}")
        
        return True
    
    def test_dashboard_director(self):
        """Test director dashboard endpoint"""
        if not self.current_user:
            self.log_result("Dashboard Director", False, "No current user for testing")
            return False
        
        director_id = self.current_user['id']
        
        # Test different periods
        periods_to_test = [
            ('all', {}),
            ('year', {'year': '2024'}),
            ('month', {'month': '0', 'year': '2024'})  # January 2024
        ]
        
        for period, params in periods_to_test:
            query_params = f"?director_id={director_id}&period={period}"
            for key, value in params.items():
                query_params += f"&{key}={value}"
            
            response = self.make_request('GET', f'/dashboard/director{query_params}')
            if response and response.status_code == 200:
                data = response.json()
                required_fields = ['directorId', 'directorOwnIncome', 'directorExpenses', 
                                 'loansGiven', 'transfersOut', 'transfersIn', 'shareOfIncome', 'balance']
                if all(field in data for field in required_fields):
                    self.log_result(f"Dashboard Director ({period})", True, 
                                  f"Director dashboard data retrieved for {period}")
                else:
                    self.log_result(f"Dashboard Director ({period})", False, 
                                  f"Missing required fields in response: {data}")
            else:
                status = response.status_code if response else "No response"
                self.log_result(f"Dashboard Director ({period})", False, 
                              f"Failed to get director dashboard: {status}")
        
        return True
    
    def test_authentication_required(self):
        """Test that protected endpoints require authentication"""
        # Logout first to clear authentication
        self.make_request('POST', '/auth/logout')
        self.session.cookies.clear()
        
        protected_endpoints = [
            ('GET', '/auth/me'),
            ('GET', '/projects'),
            ('GET', '/transactions'),
            ('GET', '/directors'),
            ('GET', '/dashboard/company'),
            ('GET', '/dashboard/director')
        ]
        
        all_protected = True
        for method, endpoint in protected_endpoints:
            response = self.make_request(method, endpoint)
            if response and response.status_code == 401:
                self.log_result(f"Auth Required ({endpoint})", True, "Endpoint properly protected")
            else:
                status = response.status_code if response else "No response"
                self.log_result(f"Auth Required ({endpoint})", False, 
                              f"Endpoint not properly protected: {status}")
                all_protected = False
        
        # Re-login for other tests
        self.test_auth_login()
        
        return all_protected
    
    def test_data_validation(self):
        """Test data validation on endpoints"""
        # Test invalid transaction type
        invalid_transaction = {
            "transaction_type": "invalid_type",
            "amount": 1000,
            "description": "Test invalid transaction"
        }
        
        response = self.make_request('POST', '/transactions', invalid_transaction)
        if response and response.status_code == 400:
            self.log_result("Data Validation (Invalid Transaction Type)", True, 
                          "Invalid transaction type properly rejected")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Data Validation (Invalid Transaction Type)", False, 
                          f"Invalid data not properly validated: {status}")
        
        # Test missing required fields
        incomplete_project = {
            "salary": 50000  # Missing required 'name' field
        }
        
        response = self.make_request('POST', '/projects', incomplete_project)
        if response and response.status_code == 400:
            self.log_result("Data Validation (Missing Required Field)", True, 
                          "Missing required field properly rejected")
        else:
            status = response.status_code if response else "No response"
            self.log_result("Data Validation (Missing Required Field)", False, 
                          f"Missing required field not properly validated: {status}")
        
        return True
    
    def run_all_tests(self):
        """Run all test suites"""
        print("=" * 80)
        print("TECHNOMATZ FINANCE MANAGEMENT SYSTEM - BACKEND API TESTS")
        print("=" * 80)
        print(f"Testing API at: {self.base_url}")
        print(f"Started at: {datetime.now().isoformat()}")
        print("=" * 80)
        
        # Test suites in order
        test_suites = [
            ("API Root", self.test_api_root),
            ("Authentication - Register", self.test_auth_register),
            ("Authentication - Login", self.test_auth_login),
            ("Authentication - Me", self.test_auth_me),
            ("Authentication - Refresh", self.test_auth_refresh),
            ("Directors List", self.test_directors_list),
            ("Projects CRUD", self.test_projects_crud),
            ("Transactions CRUD", self.test_transactions_crud),
            ("Dashboard Company", self.test_dashboard_company),
            ("Dashboard Director", self.test_dashboard_director),
            ("Authentication Required", self.test_authentication_required),
            ("Data Validation", self.test_data_validation),
            ("Authentication - Logout", self.test_auth_logout)
        ]
        
        passed = 0
        failed = 0
        
        for suite_name, test_func in test_suites:
            print(f"\n--- Running {suite_name} Tests ---")
            try:
                success = test_func()
                if success:
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ FAIL: {suite_name} - Exception: {str(e)}")
                self.log_result(suite_name, False, f"Exception: {str(e)}")
                failed += 1
        
        # Summary
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        print(f"Total Test Suites: {len(test_suites)}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed / len(test_suites)) * 100:.1f}%")
        
        # Detailed results
        print("\nDETAILED RESULTS:")
        print("-" * 80)
        for result in self.test_results:
            status = "✅" if result['success'] else "❌"
            print(f"{status} {result['test']}: {result['message']}")
        
        print("\n" + "=" * 80)
        print(f"Testing completed at: {datetime.now().isoformat()}")
        print("=" * 80)
        
        return passed, failed

def main():
    """Main test execution"""
    tester = TechnomatzAPITester()
    passed, failed = tester.run_all_tests()
    
    # Exit with appropriate code
    exit_code = 0 if failed == 0 else 1
    return exit_code

if __name__ == "__main__":
    exit_code = main()
    exit(exit_code)