window.V6FullscreenPeriodMenu=(function(){
  function byId(id){return document.getElementById(id)}
  function textFor(select){var opt=select.options[select.selectedIndex];return opt?opt.textContent:select.value}
  function closeMenu(){var wrap=byId('price-history-fullscreen-period-menu');if(wrap)wrap.classList.remove('open')}
  function syncButton(){var select=byId('price-history-fullscreen-period-select');var button=byId('price-history-fullscreen-period-button');if(select&&button)button.textContent=textFor(select)}
  function start(){
    var select=byId('price-history-fullscreen-period-select');
    if(!select||select.dataset.scadaMenu)return;
    var label=select.closest('label');
    if(!label)return;
    select.dataset.scadaMenu='1';
    select.classList.add('price-history-native-hidden');
    var wrap=document.createElement('span');
    wrap.id='price-history-fullscreen-period-menu';
    wrap.className='price-history-custom-period';
    var button=document.createElement('button');
    button.type='button';
    button.id='price-history-fullscreen-period-button';
    button.className='price-history-custom-period-button';
    var list=document.createElement('div');
    list.className='price-history-custom-period-list';
    Array.prototype.forEach.call(select.options,function(opt){
      var item=document.createElement('button');
      item.type='button';
      item.className='price-history-custom-period-option';
      item.dataset.value=opt.value;
      item.textContent=opt.textContent;
      item.addEventListener('click',function(){
        select.value=opt.value;
        select.dispatchEvent(new Event('change',{bubbles:true}));
        closeMenu();
        syncButton();
      });
      list.appendChild(item);
    });
    button.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();wrap.classList.toggle('open')});
    wrap.appendChild(button);
    wrap.appendChild(list);
    label.appendChild(wrap);
    document.addEventListener('click',closeMenu);
    select.addEventListener('change',syncButton);
    syncButton();
  }
  return{start:start,sync:syncButton};
})();
