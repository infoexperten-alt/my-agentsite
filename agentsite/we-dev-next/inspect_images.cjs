const { chromium } = require('playwright-core');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/snap/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const responses=[]; page.on('response',r=>{if(r.request().resourceType()==='image') responses.push({url:r.url(),status:r.status(),ct:r.headers()['content-type']||''})});
 await page.goto('http://127.0.0.1:3000/api/project-preview/proj-1784471529199-5fb5746a/',{waitUntil:'networkidle',timeout:60000});
 await page.evaluate(async()=>{for(let y=0;y<document.documentElement.scrollHeight;y+=600){scrollTo(0,y);await new Promise(r=>setTimeout(r,120));}scrollTo(0,0);await new Promise(r=>setTimeout(r,1500));});
 const images=await page.evaluate(()=>Array.from(document.images).map((i,index)=>({index,src:i.getAttribute('src'),currentSrc:i.currentSrc,complete:i.complete,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,loading:i.loading,outer:i.outerHTML.slice(0,500)})));
 console.log(JSON.stringify({images,responses},null,2)); await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
