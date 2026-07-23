const HTML = `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Проекты — We0</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f1219;color:#e1e8ef;font-size:14px;min-height:100vh}
.header{background:#161b26;border-bottom:1px solid #2a3040;padding:16px 32px;display:flex;justify-content:space-between;align-items:center}
.header h1{font-size:20px;background:linear-gradient(135deg,#60a5fa,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.header .nav a{color:#94a3b8;text-decoration:none;margin-left:20px;font-size:13px}
.header .nav a:hover{color:#60a5fa}
.main{max-width:1200px;margin:0 auto;padding:32px 24px}
.stats{display:flex;gap:16px;margin-bottom:32px}
.stat-card{background:#1a2030;border:1px solid #2a3040;border-radius:10px;padding:20px;flex:1}
.stat-card .num{font-size:28px;font-weight:700;color:#60a5fa}
.stat-card .lbl{font-size:12px;color:#94a3b8;margin-top:2px;text-transform:uppercase;letter-spacing:.5px}
table{width:100%;border-collapse:collapse;background:#1a2030;border:1px solid #2a3040;border-radius:10px;overflow:hidden}
th{text-align:left;padding:12px 16px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #2a3040;background:#161b26;font-weight:600}
td{padding:12px 16px;border-bottom:1px solid #2a3040;font-size:13px}
tr:last-child td{border-bottom:none}
tr:hover td{background:#1e2740}
.name-cell{font-weight:600;color:#f1f5f9;cursor:pointer}
.name-cell:hover{color:#60a5fa}
.framework{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500}
.framework-react{background:#1a365d;color:#60a5fa}
.framework-nextjs{background:#1a1a1a;color:#fff}
.framework-vue{background:#1a3a2a;color:#4ade80}
.framework-node{background:#2a1a1a;color:#f59e0b}
.framework-unknown{background:#2a3040;color:#94a3b8}
.date{color:#94a3b8;font-size:12px}
.id-cell{color:#64748b;font-family:monospace;font-size:12px}
.empty{text-align:center;padding:80px 20px;color:#64748b}
.empty h2{font-size:18px;margin-bottom:8px;color:#94a3b8}
.modal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.7);z-index:100}
.modal.open{display:flex;align-items:center;justify-content:center}
.modal-content{background:#1a2030;border:1px solid #2a3040;border-radius:12px;width:90%;max-width:800px;max-height:80vh;overflow:hidden;display:flex;flex-direction:column}
.modal-head{padding:16px 20px;border-bottom:1px solid #2a3040;display:flex;justify-content:space-between;align-items:center}
.modal-head h2{font-size:16px}
.modal-close{background:none;border:none;color:#94a3b8;font-size:22px;cursor:pointer;padding:2px 8px;line-height:1}
.modal-body{padding:20px;overflow-y:auto;flex:1;font-size:13px}
.modal-body .field{margin-bottom:12px}
.modal-body .field-label{color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
.modal-body .field-value{color:#e1e8ef}
.modal-body pre{background:#0f1219;padding:12px;border-radius:6px;overflow-x:auto;font-size:12px;color:#94a3b8;max-height:200px;margin-top:8px}
.loading{text-align:center;padding:40px;color:#64748b}
.preview-btn{background:#059669;color:#fff;border:none;border-radius:4px;padding:5px 12px;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap}
.preview-btn:hover{background:#047857}
.preview-btn:disabled{opacity:.5;cursor:wait}
.delete-btn{background:#991b1b;color:#fff;border:none;border-radius:4px;padding:5px 10px;cursor:pointer;font-size:12px;font-weight:600;margin-left:4px;white-space:nowrap}
.delete-btn:hover{background:#7f1d1d}
.actions{display:flex;gap:4px}
</style></head><body>
<div class="header">
<h1>We0 — AI Digital Agency</h1>
<div class="nav">
<a href="http://64.188.115.45:5173">We0 Editor</a>
<a href="/api/projects/ui">Проекты</a>
</div></div>
<div class="main">
<div class="stats" id="stats">
<div class="stat-card"><div class="num" id="totalProjects">—</div><div class="lbl">Проектов</div></div>
<div class="stat-card"><div class="num" id="totalFiles">—</div><div class="lbl">Файлов всего</div></div>
<div class="stat-card"><div class="num" id="frameworks">—</div><div class="lbl">Фреймворков</div></div>
</div>
<div id="projectList"><div class="loading">Загрузка проектов...</div></div>
</div>
<div class="modal" id="projectModal">
<div class="modal-content">
<div class="modal-head"><h2 id="modalTitle">Проект</h2><button class="modal-close" id="modalCloseBtn">&times;</button></div>
<div class="modal-body" id="modalBody"><div class="loading">Загрузка...</div></div>
</div></div>
<script>
var projects = [];
function fmtDate(d){if(!d)return'-';var dt=new Date(d);return dt.toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function fmtFramework(fw){var map={react:'React',vue:'Vue',nextjs:'Next.js',astro:'Astro','node.js':'Node.js',express:'Express',angular:'Angular',nuxt:'Nuxt','react+vite':'React+Vite'};var cls=(fw||'').toLowerCase().replace(/[+.]+/g,'-').replace(/[^a-z0-9-]/g,'');return'<span class="framework framework-'+cls+'">'+(map[fw.toLowerCase()]||fw)+'</span>'}
function openModal(id){var m=document.getElementById('projectModal');document.getElementById('modalTitle').textContent='Проект: '+id;document.getElementById('modalBody').innerHTML='<div class="loading">Загрузка...</div>';m.classList.add('open');fetch('/api/projects?id='+id).then(function(r){return r.json()}).then(function(x){if(x.error){document.getElementById('modalBody').innerHTML='<div class="empty"><h2>Ошибка</h2><p>'+x.error+'</p></div>';return}document.getElementById('modalTitle').textContent='Проект: '+(x.displayName||x.name||id);document.getElementById('modalBody').innerHTML='<div class="field"><div class="field-label">Название</div><div class="field-value">'+(x.name||'-')+'</div></div><div class="field"><div class="field-label">ID</div><div class="field-value" style="font-family:monospace;font-size:12px">'+(x.id||'')+'</div></div><div class="field"><div class="field-label">Описание</div><div class="field-value">'+(x.description||'-')+'</div></div><div class="field"><div class="field-label">Фреймворк</div><div class="field-value">'+fmtFramework(x.framework||'unknown')+'</div></div><div class="field"><div class="field-label">Файлов</div><div class="field-value">'+x.fileCount+'</div></div><div class="field"><div class="field-label">Создан</div><div class="field-value">'+fmtDate(x.createdAt)+'</div></div><div class="field"><div class="field-label">Изменён</div><div class="field-value">'+fmtDate(x.modifiedAt)+'</div></div><div class="field"><div class="field-label">package.json</div><pre>'+(x.packageJson?JSON.stringify(x.packageJson,null,2):'-')+'</pre></div>'}).catch(function(e){document.getElementById('modalBody').innerHTML='<div class="empty"><h2>Ошибка</h2><p>'+e.message+'</p></div>'})}
function closeModal(){document.getElementById('projectModal').classList.remove('open')}
function deleteProject(id,btn){if(!confirm('Удалить проект '+id+'?'))return;btn.disabled=true;btn.textContent='...';fetch('/api/projects?id='+id,{method:'DELETE'}).then(function(r){return r.json()}).then(function(d){if(d.ok){load()}else{alert('Ошибка: '+(d.error||'?'))}}).catch(function(e){alert(e.message)}).finally(function(){btn.disabled=false;btn.textContent='X'})}
function startPreview(id,btn){btn.disabled=true;btn.textContent='...';fetch('/api/preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:id})}).then(function(r){return r.json()}).then(function(d){if(d.url)window.open(d.url,'_blank');else alert('Ошибка: '+(d.error||'неизвестная'))}).catch(function(e){alert(e.message)}).finally(function(){btn.disabled=false;btn.textContent='Preview'})}
function load(){fetch('/api/projects').then(function(r){return r.json()}).then(function(d){projects=d.projects||[];document.getElementById('totalProjects').textContent=projects.length;var fc=0,fws={};projects.forEach(function(x){fc+=x.fileCount||0;if(x.framework)fws[x.framework]=1});document.getElementById('totalFiles').textContent=fc;document.getElementById('frameworks').textContent=Object.keys(fws).length;var l=document.getElementById('projectList');if(!projects.length){l.innerHTML='<div class="empty"><h2>Проектов пока нет</h2><p>Создайте проект в We0 Editor</p></div>';return}var rows='';for(var i=0;i<projects.length;i++){var x=projects[i];rows+='<tr><td class="name-cell" data-idx="'+i+'">'+(x.displayName||x.name||x.id)+'</td><td class="id-cell">'+x.id.slice(0,12)+'&hellip;</td><td>'+fmtFramework(x.framework||'unknown')+'</td><td>'+x.fileCount+'</td><td class="date">'+fmtDate(x.createdAt)+'</td><td class="date">'+fmtDate(x.modifiedAt)+'</td><td><div class="actions"><button class="preview-btn" data-pid="'+x.id+'">Preview</button><button class="delete-btn" data-delid="'+x.id+'">X</button></div></td></tr>'}l.innerHTML='<table><thead><tr><th>Название</th><th>ID</th><th>Фреймворк</th><th>Файлы</th><th>Создан</th><th>Изменён</th><th>Действия</th></tr></thead><tbody>'+rows+'</tbody></table>';l.querySelectorAll('.name-cell').forEach(function(td,i){td.addEventListener('click',function(){openModal(projects[i].id)})});l.querySelectorAll('.preview-btn').forEach(function(btn){btn.addEventListener('click',function(e){e.stopPropagation();startPreview(btn.getAttribute('data-pid'),btn)})});l.querySelectorAll('.delete-btn').forEach(function(btn){btn.addEventListener('click',function(e){e.stopPropagation();deleteProject(btn.getAttribute('data-delid'),btn)})})}).catch(function(e){document.getElementById('projectList').innerHTML='<div class="empty"><h2>Ошибка загрузки</h2><p>'+e.message+'</p></div>'})}
document.getElementById('modalCloseBtn').addEventListener('click',closeModal);
load();
</script></body></html>`;

export async function GET() {
  return new Response(HTML, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
