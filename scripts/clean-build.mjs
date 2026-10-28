import fs from "fs";

try {
  if (fs.existsSync(".next")) {
    fs.rmSync(".next", { recursive: true, force: true });
    console.log("Successfully removed .next directory.");
  } else {
    console.log(".next does not exist.");
  }
} catch (e) {
  console.error("Failed to remove .next:", e.message);
}
