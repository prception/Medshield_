const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:8801/index.html',{waitUntil:'load'});
  await p.evaluate(()=>{window.__seatDbg=[];});
  await p.waitForTimeout(1000);
  const pt = await p.evaluate(()=>Math.round(document.getElementById('process').getBoundingClientRect().top+window.scrollY));
  await p.mouse.move(700,450);
  await p.evaluate(y=>window.scrollTo(0,y),pt);
  await p.waitForTimeout(400);
  for(let i=0;i<20;i++){
    await p.mouse.wheel(0,160); await p.waitForTimeout(150);
    const r=await p.evaluate(()=>{
      const c=document.querySelector('.process__camera');
      return {sy:Math.round(scrollY),y:Math.round(c.getBoundingClientRect().top),
        top:c.style.top||'-', sc:(window.gsap?gsap.getProperty(c,'scale'):'?'),
        m:document.getElementById('process').classList.contains('is-morphing')?'M':'-'};
    });
    if(r.m||i>13) console.log(i,JSON.stringify(r));
  }
  console.log('seat calls:', await p.evaluate(()=>window.__seatDbg.slice(0,8)));
  await b.close();
})();
