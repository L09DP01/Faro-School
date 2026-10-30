import { readFile,mkdir,writeFile } from "node:fs/promises";
import { renderCertificatePdf } from "../src/lib/certificates/pdf";
import { SAMPLE_CERTIFICATE } from "../src/components/certificates/AdminCertificates";
import { CERTIFICATE_LAYOUT as L } from "../src/lib/certificates/layout";
import { verificationUrl } from "../src/lib/certificates/shared";
async function main(){
 await mkdir("docs/screenshots/certificates",{recursive:true});
 const asset=async(path:string)=>new Uint8Array(await readFile(`public${path}`));
 const assets={bold:await asset(L.fonts.bold),italic:await asset(L.fonts.italic),body:await asset(L.fonts.body),bodyBold:await asset(L.fonts.bodyBold),background:await asset(L.background)};
 const longName="Marie Éléonore Saint-Juste D'Haïti "+"A".repeat(60-"Marie Éléonore Saint-Juste D'Haïti ".length);
 const cases={standard:{},kr:{course_title:"Entrepreneuriat et gestion des entreprises en Haïti"},"long-name":{student_name:longName},"long-title":{course_title:"Stratégies de marketing numérique, développement commercial, gestion financière et accompagnement des petites entreprises dans un environnement économique en pleine transformation"},apostrophe:{student_name:"D'Haiti"}};
 for(const [name,values] of Object.entries(cases)){
  const cert={...SAMPLE_CERTIFICATE,...values,signature_name:"Élodie Paul",signature_title:"Direction pédagogique"};
  const bytes=await renderCertificatePdf(cert,verificationUrl("https://faroschool.com",cert.certificate_number),assets);
  await writeFile(`docs/screenshots/certificates/pdf-${name}.pdf`,bytes);
 }
 console.log("Five sample PDFs generated from production renderer; the KR interface case is also French.");
}
main().catch(e=>{console.error(e);process.exitCode=1;});
