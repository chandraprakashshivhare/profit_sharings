// Test env defaults for modules that require process.env at import-time.
process.env.JWT_SECRET ||= 'test_jwt_secret';
process.env.MONGO_URL ||= 'mongodb://localhost:27017';
process.env.DB_NAME ||= 'technomatz_finance_test';
process.env.ACCESS_TOKEN_TTL_MINUTES ||= '15';

