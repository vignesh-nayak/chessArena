process.env.NODE_ENV = "test";
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/chessarena-test";
process.env.CORS_ORIGIN ??= "http://localhost:5173";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-not-for-production";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-not-for-production";
