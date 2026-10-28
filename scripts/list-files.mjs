import fs from "fs";
import path from "path";

console.log("=== Actions ===");
if (fs.existsSync("src/app/actions")) {
  console.log(fs.readdirSync("src/app/actions"));
}

console.log("\n=== Messaging ===");
if (fs.existsSync("src/lib/messaging")) {
  console.log(fs.readdirSync("src/lib/messaging"));
}

console.log("\n=== Migrations ===");
if (fs.existsSync("supabase/migrations")) {
  console.log(fs.readdirSync("supabase/migrations"));
}

console.log("\n=== Auth / Login ===");
if (fs.existsSync("src/components/auth")) {
  console.log(fs.readdirSync("src/components/auth"));
}
