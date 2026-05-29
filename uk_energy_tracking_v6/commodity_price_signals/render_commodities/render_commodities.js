window.V6RenderCommodities=(function(){
  function formatPrice(value,prefix){return value==null||isNaN(Number(value))?'—':prefix+Number(value).toLocaleString('en-GB',{maximumFractionDigits:0})}
  function render(data){data=data||{};var h=window.V6DomText;h.setText('brent-price',data.brentUSDperBarrel==null?'—':'USD '+h.fmt(data.brentUSDperBarrel,2));h.setText('wti-price',data.wtiUSDperBarrel==null?'—':'USD '+h.fmt(data.wtiUSDperBarrel,2));h.setText('copper-price',[formatPrice(data.copperUSDperTonne,'USD '),formatPrice(data.copperEURperTonne,'EUR '),formatPrice(data.copperGBPperTonne,'GBP ')].join(' · '));h.setText('aluminium-price',[formatPrice(data.aluminiumUSDperTonne,'USD '),formatPrice(data.aluminiumEURperTonne,'EUR '),formatPrice(data.aluminiumGBPperTonne,'GBP ')].join(' · '));}
  return{render:render};
})();
