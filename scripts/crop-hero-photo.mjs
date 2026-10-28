import sharp from "sharp";

async function cropHero() {
  // Let's inspect the hero area of the desktop mockup (682 x 1024)
  // The hero section is located in the upper part, roughly:
  // x: 380 to 660, y: 40 to 220
  
  const heroRegion = await sharp("public/brand/mockup-desktop.jpg")
    .extract({
      left: 360,
      top: 45,
      width: 290,
      height: 200,
    })
    .resize(600, null, { fit: "contain" })
    .webp({ quality: 90 })
    .toFile("public/brand/hero.webp");

  console.log("Created public/brand/hero.webp:", heroRegion);
}

cropHero().catch(console.error);
