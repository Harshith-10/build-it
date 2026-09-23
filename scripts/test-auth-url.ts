import "dotenv/config";
import { auth } from "../src/lib/auth";

console.log("Auth Base URL:", auth.options.baseURL);
