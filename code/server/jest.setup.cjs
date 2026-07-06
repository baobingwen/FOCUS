// 测试环境初始化——必须在模块导入前设置
process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
