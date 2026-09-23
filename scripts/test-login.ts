import "dotenv/config";
import { auth } from "../src/lib/auth";

async function run() {
  // BetterAuth signIn method for email/password using auth server side API if possible.
  // Actually auth.api.signInEmail is for server context, might need headers.
  console.log("Auth instance available:", !!auth);
  process.exit(0);
}
run();
