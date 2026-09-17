import {searchCountries} from './geography.js';

// Enhance the native select without changing its value/change contract.
export function initCountryPicker(select,{onOpen=()=>{}}={}) {
  const create=(tag,className,attributes={})=>{
    const element=document.createElement(tag);
    element.className=className;
    for(const [name,value] of Object.entries(attributes))element.setAttribute(name,value);
    return element;
  };
  const id=select.id;
  const label=select.labels[0];
  const button=create('button','country-picker-button',{id:id+'-button',type:'button','aria-haspopup':'listbox','aria-expanded':'false','aria-controls':id+'-results'});
  const value=create('span','country-picker-value');
  const arrow=create('span','country-picker-arrow',{'aria-hidden':'true'});arrow.textContent='⌄';
  button.append(value,arrow);
  const popup=create('div','country-picker-popup');popup.hidden=true;
  const input=create('input','country-picker-search',{id:'country-search',type:'search',placeholder:'搜索国家','aria-label':'搜索国家',role:'combobox','aria-autocomplete':'list','aria-expanded':'false','aria-controls':id+'-results',autocomplete:'off',spellcheck:'false'});
  const list=create('div','country-picker-results',{id:id+'-results',role:'listbox','aria-label':'国家'});
  const status=create('div','country-picker-status',{role:'status','aria-live':'polite'});
  popup.append(input,list,status);document.body.append(popup);
  select.after(button);if(label)label.htmlFor=button.id;select.hidden=true;
  let matches=[],active=-1;

  function position() {
    if(popup.hidden)return;
    const rect=button.getBoundingClientRect();
    if(!rect.width||!rect.height||rect.bottom<0||rect.top>innerHeight){close();return;}
    const sidebar=button.closest('.explorer')?.getBoundingClientRect();
    const leftBoundary=Math.max(8,sidebar?.left??8);
    const rightBoundary=Math.min(innerWidth-8,sidebar?.right??innerWidth-8);
    const width=Math.min(rect.width,Math.max(0,rightBoundary-leftBoundary));
    if(!width){close();return;}
    popup.style.width=width+'px';
    popup.style.left=Math.max(leftBoundary,Math.min(rect.left,rightBoundary-width))+'px';
    const below=innerHeight-rect.bottom-12,above=rect.top-12;
    const upwards=below<220&&above>below;
    popup.style.maxHeight=Math.min(320,Math.max(100,upwards?above:below))+'px';
    popup.style.top=upwards?'auto':rect.bottom+4+'px';
    popup.style.bottom=upwards?innerHeight-rect.top+4+'px':'auto';
  }
  function highlight(index) {
    active=matches.length?Math.max(0,Math.min(matches.length-1,index)):-1;
    [...list.children].forEach((option,i)=>option.classList.toggle('is-active',i===active));
    if(active<0)input.removeAttribute('aria-activedescendant');
    else {
      const option=list.children[active];input.setAttribute('aria-activedescendant',option.id);
      option.scrollIntoView({block:'nearest'});
    }
  }
  function render(preferred=select.value) {
    const options=[...select.options].map(option=>({code:option.value,name:option.textContent}));
    matches=searchCountries(options,input.value);
    list.replaceChildren();
    for(const country of matches){
      const option=create('div','country-picker-option',{id:id+'-option-'+country.code,role:'option','aria-selected':String(country.code===select.value)});
      option.dataset.code=country.code;
      const name=create('span','');name.textContent=country.name;
      const mark=create('span','country-picker-mark',{'aria-hidden':'true'});mark.textContent=country.code===select.value?'✓':'';
      option.append(name,mark);list.append(option);
    }
    status.textContent=matches.length?'':'无匹配国家';status.hidden=!!matches.length;
    highlight(Math.max(0,matches.findIndex(country=>country.code===preferred)));
  }
  function close({focus=false}={}) {
    popup.hidden=true;button.setAttribute('aria-expanded','false');input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');
    if(focus)button.focus({preventScroll:true});
  }
  function open() {
    onOpen();input.value='';popup.hidden=false;button.setAttribute('aria-expanded','true');input.setAttribute('aria-expanded','true');
    position();render();input.focus({preventScroll:true});
  }
  function choose(code) {
    if(!matches.some(country=>country.code===code))return;
    const changed=select.value!==code;
    select.value=code;close({focus:true});
    if(changed)select.dispatchEvent(new Event('change',{bubbles:true}));
    sync();
  }
  function sync() {
    value.textContent=select.selectedOptions[0]?.textContent||'全部';
    if(!popup.hidden){render(matches[active]?.code);position();}
  }
  button.addEventListener('click',()=>popup.hidden?open():close());
  button.addEventListener('keydown',event=>{
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();open();}
  });
  input.addEventListener('input',()=>render(null));
  input.addEventListener('keydown',event=>{
    if(event.isComposing||event.keyCode===229)return;
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();highlight(active+(event.key==='ArrowDown'?1:-1));
    }else if(event.key==='Enter'){
      event.preventDefault();if(active>=0)choose(matches[active].code);
    }else if(event.key==='Escape'){event.preventDefault();close({focus:true});}
    else if(event.key==='Tab'){close({focus:true});}
  });
  list.addEventListener('pointerdown',event=>event.preventDefault());
  list.addEventListener('click',event=>{
    const option=event.target.closest('[data-code]');if(option)choose(option.dataset.code);
  });
  document.addEventListener('pointerdown',event=>{
    if(!popup.hidden&&!popup.contains(event.target)&&!button.contains(event.target))close();
  });
  document.addEventListener('focusin',event=>{
    if(!popup.hidden&&!popup.contains(event.target)&&event.target!==button)close();
  });
  window.addEventListener('resize',position);
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(position).observe(button);
  window.addEventListener('scroll',event=>{if(!popup.contains(event.target))position();},true);
  select.addEventListener('change',sync);
  sync();return {sync};
}
