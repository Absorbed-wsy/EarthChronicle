const $ = id => document.getElementById(id);
export function initSettings({session,api,preferences,flushPreferences,onDatabaseImport,toast}) {
  const local = session.interface === 'local' && session.canEdit === true;
  let activeTab = 'appearance';
  let busy = false;
  $('server-settings-tab').hidden = !local;
  $('database-settings-tab').hidden = !local;
  $('preferences-status').textContent = '';
  function chooseTab(name) {
    if (!local && name !== 'appearance') return;
    activeTab = name;
    for (const tab of document.querySelectorAll('[data-settings-tab]')) {
      const selected = tab.dataset.settingsTab === name;
      tab.classList.toggle('active',selected);
      tab.setAttribute('aria-selected',String(selected));
      tab.tabIndex = selected ? 0 : -1;
      $(`${tab.dataset.settingsTab}-settings`).hidden = !selected;
    }
  }
  function renderContentServer(server) {
    $('server-enabled').checked = server.enabled;
    $('content-port').value = server.port;
    $('server-status').textContent = server.error || (server.enabled ? '已开启' : '已关闭');
    $('server-addresses').replaceChildren();
    for (const url of server.addresses || []) {
      const link = document.createElement('a'); link.href=url; link.textContent=url; link.target='_blank'; link.rel='noopener noreferrer';
      $('server-addresses').append(link,document.createElement('br'));
    }
    $('server-addresses').hidden = !server.enabled;
  }
  async function refresh() {
    if (!local) return;
    try {
      const settings=await api('/api/settings');
      renderContentServer(settings.contentServer);
      const counts=settings.database;
      $('database-stats').replaceChildren();
      for (const [value,label] of [[counts.historyEvents,'内置历史 · 只读'],[counts.geologySnapshots,'地质切片 · 只读'],[counts.places,'地理地点'],[counts.personalEvents,'个人记录']]) {
        const item=document.createElement('div');item.className='library-stat';
        const number=document.createElement('strong');number.textContent=value;
        const caption=document.createElement('span');caption.textContent=label;item.append(number,caption);$('database-stats').append(item);
      }
    } catch(error) { $('server-status').textContent=error.message;$('database-status').textContent=error.message; }
  }
  async function open(name='appearance') {chooseTab(name);if(!$('settings-dialog').open)$('settings-dialog').showModal();await refresh();}
  $('settings-button').onclick=()=>open();
  document.querySelectorAll('[data-settings-tab]').forEach(tab=>{
    tab.onclick=()=>chooseTab(tab.dataset.settingsTab);
    tab.onkeydown=event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();const tabs=[...document.querySelectorAll('[data-settings-tab]')].filter(t=>!t.hidden),index=tabs.indexOf(tab);
      const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
      chooseTab(tabs[next].dataset.settingsTab);tabs[next].focus();
    };
  });
  $('server-form').onsubmit=async event=>{
    event.preventDefault();if(!local)return;
    const button=event.target.querySelector('[type=submit]');button.disabled=true;$('server-status').textContent='正在保存内容服务器设置…';
    try{const result=await api('/api/content-server',{method:'PUT',body:JSON.stringify({enabled:$('server-enabled').checked,port:Number($('content-port').value)})});renderContentServer(result.contentServer);toast('内容服务器设置已保存');}
    catch(error){$('server-status').textContent=error.message;}
    finally{button.disabled=false;}
  };
  $('export-database').onclick=async()=>{
    if(!local||busy)return;busy=true;$('export-database').disabled=true;$('import-database').disabled=true;
    try{
      await flushPreferences();
      const response=await fetch('/api/database/export',{headers:{'X-Edit-Token':session.token}});
      if(!response.ok)throw new Error((await response.json()).error);
      const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');
      link.href=url;link.download=`地球史书-${new Date().toISOString().slice(0,10)}.sqlite`;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
      $('database-status').textContent='数据库已导出。';
    }catch(error){$('database-status').textContent='导出失败：'+error.message;}
    finally{busy=false;$('export-database').disabled=false;$('import-database').disabled=false;}
  };
  $('import-database').onchange=async event=>{
    const file=event.target.files[0];if(!file||!local||busy)return;
    busy=true;event.target.disabled=true;$('export-database').disabled=true;preferences.setLocked(true);
    $('database-status').textContent='正在校验数据库并合并个人记录…';
    try{
      if(file.size>128*1024*1024)throw new Error('数据库文件不能超过 128 MB。');
      await flushPreferences();
      const response=await fetch('/api/database/import',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Edit-Token':session.token},body:file});
      const result=await response.json();if(!response.ok)throw new Error(result.error);
      const saved=await api('/api/preferences');preferences.applyPreferences(saved.preferences);
      await onDatabaseImport();await refresh();
      $('database-status').textContent=`导入完成：新增 ${result.imported} 条，更新 ${result.updated} 条，保留 ${result.skipped} 条。`;
      toast('数据库迁移已完成');
    }catch(error){$('database-status').textContent='导入失败：'+error.message;}
    finally{busy=false;event.target.disabled=false;event.target.value='';$('export-database').disabled=false;preferences.setLocked(false);}
  };
  chooseTab(activeTab);
  return {open,refresh};
}
