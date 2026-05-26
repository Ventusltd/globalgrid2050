// V4 live tracker helpers. Depends on config.
function fmt(n,dp){return (n===null||n===undefined||isNaN(n))?"—":Number(n).toLocaleString("en-GB",{minimumFractionDigits:dp==null?2:dp,maximumFractionDigits:dp==null?2:dp});}
  function pct(n,min,max){ if(n===null||n===undefined||isNaN(n)) return 0; return Math.max(0,Math.min(1,(Number(n)-min)/(max-min))); }
  function arcPath(cx,cy,r,start,end){
    var s=(start-90)*Math.PI/180, e=(end-90)*Math.PI/180;
    var x1=cx+r*Math.cos(s), y1=cy+r*Math.sin(s), x2=cx+r*Math.cos(e), y2=cy+r*Math.sin(e);
    var large=end-start<=180?0:1;
    return "M "+x1+" "+y1+" A "+r+" "+r+" 0 "+large+" 1 "+x2+" "+y2;
  }
