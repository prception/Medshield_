const { chromium } = require('playwright');
(async () => {
  const b=await chromium.launch();
  const pg=await b.newPage({viewport:{width:1907,height:914}});
  await pg.goto('file:///D:/medshield/Medshield_/index.html');
  await pg.waitForTimeout(2500);
  const about=await pg.evaluate(()=>document.querySelector('.about').getBoundingClientRect().top+window.scrollY);
  await pg.evaluate(v=>window.scrollTo(0,v),Math.round(about*1.05));
  await pg.waitForTimeout(800);
  console.log(await pg.evaluate(()=>{
    const R=e=>{const r=e.getBoundingClientRect();return{t:Math.round(r.top),b:Math.round(r.bottom)}};
    const d=document.querySelector('.doubts'), ps=document.querySelector('.pin-spacer');
    const a=document.querySelector('.about'), pr=document.querySelector('.proof');
    const st=document.querySelector('.doubts__stage');
    // what paints in the band?
    const stack=document.elementsFromPoint(950,520).slice(0,7).map(x=>((x.className&&x.className.baseVal!==undefined)?x.className.baseVal:(x.className||''))+'|'+x.tagName);
    return {doubts:R(d), pinSpacer:ps?R(ps):null, stage:R(st), about:R(a), proof:R(pr),
      aboutZ:getComputedStyle(a).zIndex, aboutBg:getComputedStyle(a).backgroundColor,
      aboutIsCover:a.classList.contains('doubts-cover'),
      proofZ:getComputedStyle(pr).zIndex, proofPos:getComputedStyle(pr).position,
      proofBg:getComputedStyle(pr).backgroundColor,
      stackAtBand:stack};
  }));
  await b.close();
})();
