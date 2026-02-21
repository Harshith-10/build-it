import { authClient } from "./src/lib/auth-client";
async function run() {
  const { data, error } = await authClient.signIn.username({ username: "admin", password: "password123" });
  console.log("data:", data);
  console.log("error:", error);
}
run();
