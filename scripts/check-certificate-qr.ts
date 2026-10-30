import { readFile,writeFile } from "node:fs/promises";
import { PNG } from "pngjs";
import jsQR from "jsqr";
async function main(){
 const results=[];
 for(const name of ["standard","kr","long-name","long-title","apostrophe"]){
  const png=PNG.sync.read(await readFile(`docs/screenshots/certificates/pdf-${name}.png`));
  const result=jsQR(new Uint8ClampedArray(png.data),png.width,png.height);
  const expected="https://faroschool.com/fr/verification/FARO-2026-7K4M9X2A";
  if(result?.data!==expected)throw new Error(`QR mismatch: ${name}`);
  results.push({case:name,url:result.data,width:png.width,height:png.height});
 }
 await writeFile("docs/screenshots/certificates/qr-checks.json",JSON.stringify(results,null,2));console.log("PASS 5/5 rendered PDF QR codes decoded to the correct French verification URL.");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
