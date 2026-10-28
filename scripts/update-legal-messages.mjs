import fs from "fs";

function updateMessages() {
  const frPath = "src/messages/fr.json";
  const htPath = "src/messages/ht.json";

  const fr = JSON.parse(fs.readFileSync(frPath, "utf8"));
  const ht = JSON.parse(fs.readFileSync(htPath, "utf8"));

  // Ensure every section has `paragraphs`
  for (const page of ["cgu", "confidentialite", "remboursement"]) {
    if (fr.legal?.[page]?.sections) {
      for (const sec of fr.legal[page].sections) {
        if (!sec.paragraphs && sec.content) {
          sec.paragraphs = sec.content;
          delete sec.content;
        }
      }
    }
    if (ht.legal?.[page]?.sections) {
      for (const sec of ht.legal[page].sections) {
        if (!sec.paragraphs && sec.content) {
          sec.paragraphs = sec.content;
          delete sec.content;
        }
      }
    }
  }

  fs.writeFileSync(frPath, JSON.stringify(fr, null, 2) + "\n", "utf8");
  fs.writeFileSync(htPath, JSON.stringify(ht, null, 2) + "\n", "utf8");
  console.log("Fixed paragraphs array across all legal sections!");
}

updateMessages();
