import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {greetingName} from '../src/lib/pwa/display-name';import {supportContact} from '../src/lib/support-contact';
async function main(){
 assert.equal(greetingName(' LORVENSON DON PIERRE ','fr'),'Lorvenson');assert.equal(greetingName('JAN-PÒL ÉTIENNE','fr'),'Jan-Pòl');assert.equal(greetingName("D'HAÏTI EXEMPLE",'fr'),"D'Haïti");assert.equal(greetingName('','ht'),'Aprenan');
 const css=await readFile('src/styles/tokens.css','utf8'),bg=css.match(/--bg:\s*(#[A-Fa-f0-9]+)/)![1].toUpperCase(),manifest=JSON.parse(await readFile('public/manifest.webmanifest','utf8'));
 assert.equal(manifest.theme_color.toUpperCase(),bg);assert.equal(manifest.background_color.toUpperCase(),bg);assert.equal(manifest.name,'Faro School');assert.equal(manifest.short_name,'Faro School');assert.equal(manifest.display,'standalone');assert.equal(manifest.orientation,'portrait');assert.equal(manifest.start_url,'/app?source=pwa');
 const layout=await readFile('src/app/[locale]/layout.tsx','utf8');assert.ok(layout.includes('viewportFit: "cover"'));assert.ok(layout.includes('statusBarStyle: "default"'));assert.ok(layout.includes('themeColor: "'+bg+'"'));
 for(const file of ['public/apple-touch-icon.png','public/icons/apple-touch-icon-180.png']){const png=await readFile(file);assert.equal(png.readUInt32BE(16),180);assert.equal(png.readUInt32BE(20),180);}
 const old=process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;delete process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;assert.deepEqual(supportContact('fr'),{href:'/dashboard/messages',external:false});process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP='50936000000';assert.equal(supportContact('fr').external,false);if(old===undefined)delete process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;else process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP=old;
 console.log('PASS greeting presentation, FR/KR labels, unchanged background token/meta/manifest match, 180px icons and no fictitious support contact');
}
main().catch(e=>{console.error(e);process.exitCode=1});
