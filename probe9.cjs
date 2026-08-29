const { chromium } = require('playwright');
(async () => {
  const b=await chromium.launch();
  const pg=await b.newPage({viewport:{width:1440,height:900}});
  await pg.goto('file:///D:/medshield/Medshield_/index.html');
  await pg.waitForTimeout(2500);
  const about=await pg.evaluate(()=>document.querySelector('.about').getBoundingClientRect().top+window.scrollY);
  await pg.evaluate(v=>window.scrollTo(0,v),Math.round(about*0.92));
  await pg.waitForTimeout(700);
  console.log(await pg.evaluate(()=>{
    const d=document.querySelector('.doubts');
    const ps=document.querySelector('.pin-spacer');
    const dr=d.getBoundingClientRect(), pr=ps.getBoundingClientRect();
    const a=document.querySelector('.about').getBoundingClientRect();
    return {
      doubtsRect:{t:Math.round(dr.top),b:Math.round(dr.bottom)},
      pinSpacer:{t:Math.round(pr.top),b:Math.round(pr.bottom),h:Math.round(pr.height)},
      aboutRect:{t:Math.round(a.top),b:Math.round(a.bottom)},
      doubtsOverflow:getComputedStyle(d).overflow,
      // The key question: does .about's top edge sit ABOVE doubts' bottom?
      coverRisenBy: Math.round(dr.bottom - a.top),
      scrollY:Math.round(window.scrollY),
    };
  }));
  await b.close();
})();
