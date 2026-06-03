
const draftBtn = document.getElementById('draftOpener');
if (draftBtn) {
  draftBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openDrafts' });
  });
}

const container = document.getElementById('listingsContainer');
const MAX_LISTINGS = 30;
const MAX_IMAGES = 10;

function escapeHtml(str){return String(str||'').replace(/[&<>"]/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));}
function escapeAttr(str){return escapeHtml(str).replace(/'/g,'&#39;');}
function shortName(name){return name && name.length>24 ? name.slice(0,21)+'...' : (name||'');}

function parseLocationsText(){
  const el=document.getElementById('locationsList');
  if(!el) return [];
  return el.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
}
function setLocationsText(locations){
  const el=document.getElementById('locationsList');
  if(el) el.value = Array.isArray(locations) ? locations.join('\n') : '';
}

function createListingSections(count=1, savedListings=[]){
  count = Math.min(Math.max(parseInt(count,10)||1,1),MAX_LISTINGS);
  container.innerHTML='';
  for(let i=0;i<count;i++){
    const saved=savedListings[i]||{};
    const imgCount = Array.isArray(saved.imageDataList) ? saved.imageDataList.length : 0;
    const box=document.createElement('div');
    box.className='listingBox';
    box.dataset.index=i;
    box.innerHTML=`
      <h4>Listing ${i+1}</h4>
      <label>Title:</label>
      <input type="text" class="title" placeholder="Enter title" value="${escapeAttr(saved.title||'')}">
      <div class="row">
        <div><label>Price:</label><input type="number" class="price" placeholder="Price" value="${escapeAttr(saved.price||'')}"></div>
        <div><label>Images:</label><input type="file" class="imageInput" accept="image/jpeg,image/png,image/webp" multiple><span class="imgCount">Saved images: ${imgCount}/${MAX_IMAGES}</span></div>
      </div>
      <small class="small">Listing ${i+1} ke liye alag images choose karo. Max ${MAX_IMAGES} images.</small>
      <label>Description:</label>
      <textarea class="description" placeholder="Enter description">${escapeHtml(saved.description||'')}</textarea>
      ${count===1 ? `<div class="singleTabsBox"><label>Number of Tabs:</label><input type="number" class="singleTabCount" min="1" max="50" value="${escapeAttr(saved.singleTabCount||1)}" placeholder="How many tabs open?"><small class="small">Same title, price, description aur images jitne tabs likhoge utne tabs mein open honge.</small></div>` : ``}
    `;
    container.appendChild(box);
  }
  attachAutosave();
}

async function getStored(){return await chrome.storage.local.get(['listings','listingCount','singleTabCount','locations']);}

async function collectListings(keepOldImages=true){
  const boxes=Array.from(document.querySelectorAll('.listingBox'));
  const oldData=await getStored();
  const oldListings=Array.isArray(oldData.listings)?oldData.listings:[];
  const listings=[];
  for(let i=0;i<boxes.length;i++){
    const box=boxes[i];
    const title=box.querySelector('.title').value.trim();
    const price=box.querySelector('.price').value.trim();
    const description=box.querySelector('.description').value.trim();
    const singleTabInput=box.querySelector('.singleTabCount');
    const singleTabCount=singleTabInput ? Math.min(Math.max(parseInt(singleTabInput.value,10)||1,1),50) : 1;
    const fileInput=box.querySelector('.imageInput');
    let imageDataList=[];
    if(fileInput.files && fileInput.files.length){
      imageDataList=await readImages(fileInput,i+1);
    } else if(keepOldImages && oldListings[i] && Array.isArray(oldListings[i].imageDataList)){
      imageDataList=oldListings[i].imageDataList;
    }
    listings.push({title,price,description,imageDataList,singleTabCount});
  }
  return listings;
}

function readImages(fileInput, listingNumber){
  return new Promise((resolve,reject)=>{
    const files=Array.from(fileInput.files||[]);
    if(files.length>MAX_IMAGES){reject(`❌ Listing ${listingNumber}: maximum ${MAX_IMAGES} images select kar sakte ho.`);return;}
    if(files.length===0){resolve([]);return;}
    const imageDataList=new Array(files.length); let processed=0; let failed=false;
    files.forEach((file,index)=>{
      if(!["image/jpeg","image/png","image/webp"].includes(file.type)){failed=true; reject(`❌ Listing ${listingNumber}: ${file.name} JPG/PNG/WebP nahi hai.`); return;}
      if(file.size>6*1024*1024){failed=true; reject(`❌ Listing ${listingNumber}: ${file.name} bohat large hai. 6MB se choti image use karo.`); return;}
      const reader=new FileReader();
      reader.onload=e=>{ if(failed) return; imageDataList[index]=e.target.result; processed++; if(processed===files.length) resolve(imageDataList.filter(Boolean)); };
      reader.onerror=()=>{ if(!failed){failed=true; reject(`❌ Listing ${listingNumber}: image read failed.`);} };
      reader.readAsDataURL(file);
    });
  });
}

let autosaveTimer=null;
function attachAutosave(){
  document.querySelectorAll('.title,.price,.description,.singleTabCount').forEach(el=>el.addEventListener('input',scheduleAutosave));
  const locEl=document.getElementById('locationsList'); if(locEl) locEl.addEventListener('input',scheduleAutosave);
  document.querySelectorAll('.imageInput').forEach(el=>el.addEventListener('change',async()=>{
    const count=el.files.length;
    const span=el.closest('.listingBox').querySelector('.imgCount');
    span.textContent=`Selected images: ${count}/${MAX_IMAGES}`;
    await saveAll(false);
  }));
}
function scheduleAutosave(){clearTimeout(autosaveTimer); autosaveTimer=setTimeout(()=>saveAll(true,true),700);}

async function saveAll(silent=false, textOnly=false){
  try{
    const listings=await collectListings(true);
    const locations=parseLocationsText();
    const first=listings[0]||{title:'',price:'',description:'',imageDataList:[]};
    await chrome.storage.local.set({
      locations,
      listingCount:listings.length,
      singleTabCount:(listings[0] && listings[0].singleTabCount) ? listings[0].singleTabCount : 1,
      listings,
      title:first.title, price:first.price, description:first.description, imageDataList:first.imageDataList
    });
    if(!silent) alert(`✅ ${listings.length} listings saved. Har listing ki separate images saved hain.`);
    return listings;
  }catch(err){ if(!silent) alert(err); else console.warn(err); }
}


document.getElementById('listingCount').addEventListener('change',async()=>{
  const count=parseInt(document.getElementById('listingCount').value,10)||1;
  const data=await getStored();
  let savedListings=Array.isArray(data.listings)?data.listings:[];
  if(count===1 && savedListings[0]) savedListings[0].singleTabCount=data.singleTabCount||savedListings[0].singleTabCount||1;
  createListingSections(count,savedListings);
  await chrome.storage.local.set({listingCount:count});
});

function getSelectedListingCount(){
  const val=parseInt(document.getElementById('listingCount').value,10) || 1;
  return Math.min(Math.max(val,1),MAX_LISTINGS);
}

async function syncSectionsToCount(count){
  document.getElementById('listingCount').value=String(count);
  const data=await getStored();
  let savedListings=Array.isArray(data.listings)?data.listings:[];
  if(count===1 && savedListings[0]) savedListings[0].singleTabCount=data.singleTabCount||savedListings[0].singleTabCount||1;
  createListingSections(count,savedListings);
  await chrome.storage.local.set({listingCount:count});
}

async function openTabsForSelectedListings(){
  const count=getSelectedListingCount();
  const listings=await saveAll(true);
  if(!listings || !listings.length){ alert('❌ Pehle listing data save karo.'); return; }
  const baseUrl='https://www.facebook.com/marketplace/create/item';
  if(count===1){
    const box=document.querySelector('.listingBox');
    const tabInput=box ? box.querySelector('.singleTabCount') : null;
    const tabCount=Math.min(Math.max(parseInt(tabInput ? tabInput.value : (listings[0].singleTabCount||1),10)||1,1),50);
    await chrome.storage.local.set({singleTabCount:tabCount});
    for(let i=0;i<tabCount;i++) chrome.tabs.create({url:`${baseUrl}?autofillIndex=0&copyTab=${i}`});
  } else {
    for(let i=0;i<count;i++) chrome.tabs.create({url:`${baseUrl}?autofillIndex=${i}`});
  }
}

document.getElementById('openSelectedTabs').addEventListener('click',openTabsForSelectedListings);

document.getElementById('saveData').addEventListener('click',()=>saveAll(false));

document.getElementById('resetData').addEventListener('click', async()=>{
  const ok = confirm('Reset karna hai? Is se saved title, price, description, images aur tabs count clear ho jayega.');
  if(!ok) return;
  await chrome.storage.local.clear();
  document.getElementById('listingCount').value = '1';
  setLocationsText([]);
  createListingSections(1, []);
  alert('✅ Data reset ho gaya.');
});


document.getElementById('exportData').addEventListener('click',async()=>{
  const listings=await saveAll(true);
  const backup={version:'1.5',exportedAt:new Date().toISOString(),listingCount:listings.length,singleTabCount:(listings[0]&&listings[0].singleTabCount)||1,locations:parseLocationsText(),listings};
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download='fb_marketplace_autofill_backup.json'; a.click(); URL.revokeObjectURL(url);
});

document.getElementById('importData').addEventListener('change',e=>{
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=async ev=>{
    try{
      const imported=JSON.parse(ev.target.result);
      const listings=Array.isArray(imported.listings)?imported.listings.slice(0,MAX_LISTINGS):[];
      if(!listings.length){alert('❌ Import file mein listings nahi milin.');return;}
      const count=Math.min(imported.listingCount||listings.length,MAX_LISTINGS);
      const first=listings[0]||{title:'',price:'',description:'',imageDataList:[]};
      if(count===1 && listings[0]) listings[0].singleTabCount=imported.singleTabCount||listings[0].singleTabCount||1;
      const locations=Array.isArray(imported.locations)?imported.locations:[];
      await chrome.storage.local.set({listingCount:count,singleTabCount:imported.singleTabCount||1,locations,listings,title:first.title,price:first.price,description:first.description,imageDataList:first.imageDataList});
      setLocationsText(locations);
      document.getElementById('listingCount').value=String(count);
      createListingSections(count,listings);
      alert(`✅ Imported ${listings.length} listings with images.`);
    }catch(err){alert('❌ Import failed. Valid JSON backup select karo.');}
  };
  reader.readAsText(file);
});

chrome.storage.local.get(['listings','listingCount','singleTabCount','locations'],data=>{
  const savedListings=Array.isArray(data.listings)?data.listings:[];
  const count=Math.min(Math.max(parseInt(data.listingCount||savedListings.length||1,10),1),MAX_LISTINGS);
  document.getElementById('listingCount').value=String(count);
  setLocationsText(data.locations || []);
  if(count===1 && savedListings[0]) savedListings[0].singleTabCount=data.singleTabCount||savedListings[0].singleTabCount||1;
  createListingSections(count,savedListings);
});