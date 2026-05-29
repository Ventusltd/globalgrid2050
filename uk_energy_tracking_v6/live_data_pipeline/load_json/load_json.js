window.V6LoadJson=(function(){
  function loadJson(url){return fetch(url+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).catch(function(){return null})}
  return{loadJson:loadJson};
})();
