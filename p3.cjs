const { chromium } = require('playwright');
const band = async pg => {
  const about=await pg.evaluate(()=>document.querySelector('.about').getBoundingClientRect().top+window.scrollY);
  const out=[];
  for(const f of [1.0,1.05,1.1,1.15]){
    await pg.evaluate(v=>window.scrollTo(0,v),Math.round(about*f));
    await pg.waitForTimeout(500);
    out.push(f+' => '+await pg.evaluate(()=>{
      const st=document.querySelector('.doubts__stage').getBoundingClientRect();
      const a=document.querySelector('.about').getBoundingClientRect();
      const gap=Math.round(st.bottom - a.bottom); // image tail past cover
      const e=document.elementFromPoint(950, Math.max(5,Math.min(909,a.bottom+40)));
      const cn=e?(((e.className&&e.className.baseVal!==undefined)?e.className.baseVal:(e.className||''))+'|'+e.tagName):'none';
      return 'tailPx='+gap+' belowCover='+cn;
    }));
  }
  return out;
};
(async () => {
  const b=await chromium.launch();
  for (const css of [null, '.doubts-cover{min-height:100svh;}']) {
    const pg=await b.newPage({viewport:{width:1907,height:914}});
    await pg.goto('file:///D:/medshield/Medshield_/index.html');
    await pg.waitForTimeout(2500);
    if(css) await pg.addStyleTag({content:css});
    console.log(css?('WITH '+css):'BASELINE');
    (await band(pg)).forEach(x=>console.log('   '+x));
    await pg.close();
  }
  await b.close();
})();
