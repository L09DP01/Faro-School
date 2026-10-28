import sharp from "sharp";

async function inspect() {
  const meta = await sharp("public/brand/mockup-desktop.jpg").metadata();
  console.log("Mockup metadata:", meta.width, "x", meta.height);
}

inspect().catch(console.error);
