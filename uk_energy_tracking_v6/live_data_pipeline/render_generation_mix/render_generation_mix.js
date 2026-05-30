window.V6RenderGenerationMix=(function(){
  function render(energy){
    var root=document.getElementById('generation-mix-grid');
    if(!root)return;
    var mix=(energy&&energy.mix)||[];
    root.innerHTML=mix.map(function(r){
      var width=Math.max(0,Math.min(100,Number(r.pct||0)));
      var color=r.color||'#00ffff';
      return '<div class="scada-mini">'+
        '<div class="scada-mini-top">'+
          '<div class="scada-mini-name">'+(r.label||'Source')+'</div>'+
          '<div class="scada-mini-value">'+Number(r.gw||0).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})+' GW</div>'+
        '</div>'+
        '<div class="scada-mini-track"><div class="scada-mini-fill" style="width:'+width+'%;background:'+color+';box-shadow:0 0 10px '+color+'"></div></div>'+
        '<div class="commodity-unit">'+Number(r.pct||0).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})+'%</div>'+
      '</div>';
    }).join('');
  }
  return{render:render};
})();