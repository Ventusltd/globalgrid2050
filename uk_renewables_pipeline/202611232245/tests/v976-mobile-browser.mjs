// V9.76: real REPD source, iPhone geometry, no vertical digits, native group/filters.
// Fail the build if numbers are rendered as one character per line.
import assert from "node:assert/strict";
import {chromium,webkit} from "playwright";
const url="http://127.0.0.1:8765/uk_renewables_pipeline/202611232245/";
const sizes=[
  {name:"iphone-se",width:320,height:695},
  {name:"iphone",width:393,height:852},
  {name:"iphone-max",width:430,height:932},
  {name:"landscape",width:852,height:393},
  {name:"desktop",width:1280,height:800}
];
for(const [engineName,engine] of [["chromium",chromium],["webkit",webkit]]) {
  const browser=await engine.launch({headless:true});
  try {
    for(const size of sizes) {
      const page=await browser.newPage({viewport:{width:size.width,height:size.height},
        hasTouch:size.width<=852,reducedMotion:"reduce"});
      const errors=[];page.on("pageerror",x=>errors.push(x.message));
      page.on("response",x=>{
        if(x.status()>=400&&/repd-mobile-v976|repd-reports|operator-aliases/.test(x.url()))
          errors.push(x.status()+" "+x.url());
      });
      try {
        await page.goto(url,{waitUntil:"domcontentloaded",timeout:75000});
        await page.waitForFunction(()=>(document.querySelector("#v2")?.textContent||"").replaceAll(",","").trim()==="3604",{timeout:75000});
        const oldHeading=await page.locator("#repdScroll th").first().evaluate(x=>getComputedStyle(x).color);
        const oldGaugeCount=await page.locator("#repdPanel>.hud-gauges>.card").count();
        assert.equal(oldGaugeCount,3,"All three original gauges");
        await page.locator('[data-repd-report="operator"]').click();
        await page.locator("#repdReportsPanel").waitFor({state:"visible"});
        await page.waitForSelector("#repdReportsBody .repd-native-report-table tbody tr");
        const geometry=await page.evaluate(()=>{
          const panel=document.querySelector("#repdReportsPanel");
          const wrap=document.querySelector("#repdReportsBody>.tablewrap");
          const table=wrap?.querySelector("table.repd-native-report-table");
          const row=table?.querySelector("tbody tr");
          const cells=[...(row?.cells||[])];
          const statuses=document.querySelector("#status");
          const buttons=[...statuses.querySelectorAll("button")];
          const hint=document.querySelector("#repdReportSwipeHint");
          const rect=panel.getBoundingClientRect();
          return {
            rectLeft:rect.left,rectRight:rect.right,screen:window.innerWidth,
            wrapWidth:wrap.clientWidth,wrapScroll:wrap.scrollWidth,
            tableWidth:table.getBoundingClientRect().width,cellCount:cells.length,
            numeric:cells.slice(1).map(x=>({
              width:x.getBoundingClientRect().width,
              height:x.getBoundingClientRect().height,
              whitespace:getComputedStyle(x).whiteSpace,
              text:x.textContent.trim()})),
            rowHeight:row.getBoundingClientRect().height,
            headerColour:getComputedStyle(table.querySelector("th")).color,
            statusScroll:statuses.scrollWidth,statusWidth:statuses.clientWidth,
            statusPositions:buttons.map(x=>Math.round(x.getBoundingClientRect().top)),
            statusWrap:getComputedStyle(statuses).flexWrap,
            hintDisplay:getComputedStyle(hint).display,
            groupText:cells[0]?.textContent.trim()||""
          };
        });
        assert.equal(geometry.cellCount,5,JSON.stringify(geometry));
        assert.equal(geometry.headerColour,oldHeading,"Inherited native REPD colours");
        if(size.width<=768) {
          assert.ok(geometry.rectLeft>=-2&&geometry.rectRight<=geometry.screen+2,
            "Report panel escaped viewport: "+JSON.stringify(geometry));
          assert.ok(geometry.wrapScroll>geometry.wrapWidth+200,
            "Report requires independent sideways swipe: "+JSON.stringify(geometry));
          assert.ok(geometry.tableWidth>=750,"Report must retain readable numeric columns");
          assert.equal(geometry.statusWrap,"nowrap","Status buttons must not orphan");
          assert.equal(new Set(geometry.statusPositions).size,1,"All status buttons must be on the same horizontal row");
          assert.ok(geometry.statusScroll>geometry.statusWidth+20,"Status buttons need horizontal swiping");
          assert.equal(geometry.hintDisplay,"block","Mobile-only swipe explanation required");
          assert.ok(geometry.rowHeight<140,"Digits are stacked vertically: "+JSON.stringify(geometry));
          for(const cell of geometry.numeric){
            assert.equal(cell.whitespace,"nowrap","Each number must be on one line");
            assert.ok(cell.width>=85,"Numbers have a narrow column: "+JSON.stringify(geometry));
            assert.ok(cell.height<140,"Numbers must not create very tall rows");
          }
          await page.locator("#repdReportsBody>.tablewrap").evaluate(node=>{node.scrollLeft=node.scrollWidth});
          const scrolled=await page.locator("#repdReportsBody>.tablewrap").evaluate(node=>node.scrollLeft);
          assert.ok(scrolled>200,"iOS horizontal swipe target should actually scroll");
          await page.locator("#status").evaluate(node=>{node.scrollLeft=node.scrollWidth});
          const statusScrolled=await page.locator("#status").evaluate(node=>node.scrollLeft);
          assert.ok(statusScrolled>30,"Native status scrolling works");
          await page.locator('#status [data-official-status="Application Submitted"]').click();
          await page.waitForFunction(()=>document.querySelector("#repdNativeStatus")?.value==="Application Submitted");
          const count=Number((await page.locator("#v2").textContent()).replaceAll(",",""));
          assert.ok(count>0&&count<3604,"Status action still changes original gauge");
          await page.locator("#repdNativeStatus").selectOption("All");
          await page.waitForFunction(()=>document.querySelector("#v2")?.textContent?.replaceAll(",","").trim()==="3604");
        }else{
          assert.equal(geometry.hintDisplay,"none","Desktop must have original appearance");
        }
        await page.locator("#repdNativeOperator").selectOption("Low Carbon");
        await page.waitForFunction(()=>{
          const n=Number((document.querySelector("#v2")?.textContent||"0").replaceAll(",",""));
          return n>0 && n<3604 && Number(document.querySelector("#tbody")?.dataset.total||0)===n;
        },{timeout:15000});
        assert.match(await page.locator("#repdReportsSummary").textContent(),/SELECTED /);
        await page.locator("#repdNativeOperator").selectOption("All");
        await page.locator('[data-repd-report="status"]').click();
        await page.waitForSelector("#repdReportsBody .repd-native-report-table tbody tr");
        await page.locator('[data-repd-report="region"]').click();
        await page.waitForSelector("#repdReportsBody .repd-native-report-table tbody tr");
        assert.equal(await page.locator("script[src='report-a4.mjs']").count(),1);
        assert.equal(await page.locator("script[src='map-entry.mjs']").count(),1);
        assert.deepEqual(errors,[],"Client errors: "+JSON.stringify(errors));
        console.log("PASS V9.76",engineName,size.name,size.width+"x"+size.height,
          "status scroll, numeric columns, panel containment, original colours, operator/status/region, MAP/A4");
      }finally{await page.close();}
    }
  }finally{await browser.close();}
}
