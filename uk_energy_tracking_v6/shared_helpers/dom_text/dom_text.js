window.V6DomText=(function(){
  function setText(id,value){var el=document.getElementById(id);if(el)el.textContent=value==null?'—':String(value)}
  function fmt(value,digits){if(value==null||isNaN(Number(value)))return'—';return Number(value).toLocaleString('en-GB',{minimumFractionDigits:digits,maximumFractionDigits:digits})}
  function isoLabel(value){if(!value)return'—';try{return new Date(value).toLocaleString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'})}catch(e){return value}}
  return{setText:setText,fmt:fmt,isoLabel:isoLabel};
})();
