export const apps = [
  {
    name: "build-it",
    script: "node_modules/next/dist/bin/next",
    args: "start",
    instances: "max",
    exec_mode: "cluster",
    env: {
      PORT: 3000,
      NODE_ENV: "production",
      DB_HOST: "localhost",
      DB_USER: "buildit_dev",
      DB_PASSWORD: "buildit_dev_pass",
      DB_NAME: "buildit_db",
      DB_PORT: 5432,
      BETTER_AUTH_SECRET: "NPdkz12rmFVS3E3OIWSmLpvx4d6twGYo",
      BETTER_AUTH_URL: "http://localhost:3000",
      TURBO_API_BASE_URL: "http://localhost:4000/api/v1",
    },
  },
];
