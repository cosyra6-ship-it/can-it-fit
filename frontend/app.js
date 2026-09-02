const state={step:1,item:null,space:null,aiMeasurements:null,missingDimensions:null};
const screen=document.querySelector('#screen'),progress=document.querySelectorAll('.progress span'),back=document.querySelector('#back');
const camera=document.querySelector('#camera'), upload=document.querySelector('#upload');
let target='item';
const DIMENSION_PAIRS=[{item:'item_width',space:'space_width',label:'width',itemName:'Item width',spaceName:'Space width'},{item:'item_height',space:'space_height',label:'height',itemName:'Item height',spaceName:'Space height'},{item:'item_depth',space:'space_depth',label:'depth',itemName:'Item depth',spaceName:'Space depth'}];

function computeFinalVerdict(merged){
  for(const pair of DIMENSION_PAIRS){
    const itemVal=merged[pair.item],spaceVal=merged[pair.space];
    if(typeof itemVal==='number'&&typeof spaceVal==='number'&&itemVal>spaceVal){
      return {verdict:'wont_fit',explanation:`Item ${pair.label} (${itemVal} cm) is larger than space ${pair.label} (${spaceVal} cm).`};
    }
  }
  const allPairsPresent=DIMENSION_PAIRS.every(p=>typeof merged[p.item]==='number'&&typeof merged[p.space]==='number');
  if(allPairsPresent&&DIMENSION_PAIRS.every(p=>merged[p.item]<merged[p.space])){
    return {verdict:'can_fit',explanation:'All measurements show the item fits in the space with clearance.'};
  }
  return {verdict:'maybe',explanation:'Some measurements are still missing or unclear.'};
}

function renderResult(verdict,explanation){
  screen.innerHTML=`<div class="result">
    <div class="icon">${verdict.icon}</div>
    <div class="badge ${verdict.cls}">${verdict.label}</div>
    <h2>${verdict.title}</h2>
    <p>${explanation}</p>
    <div class="details">AI checked both images. Confirm important moves with a real measurement.</div>
    <button class="button" data-action="restart">Try another fit</button>
  </div>`;
}

function renderMissingForm(){
  const missing=state.missingDimensions;
  const fields=missing.map(dim=>`<label class="field"><span>${dim.name||dim.key}</span><input type="number" inputmode="decimal" step="0.1" min="0.1" data-key="${dim.key}" placeholder="cm" /></label>`).join('');
  screen.innerHTML=`<p class="eyebrow">More measurements needed</p>
    <h2>We need ${missing.length} more measurement${missing.length===1?'':'s'}</h2>
    <p>The AI could not read these dimensions from the photos. Please measure and enter them in centimeters.</p>
    <form id="missing-form" class="form" novalidate>
      ${fields}
      <button class="button" type="submit">Continue</button>
    </form>`;
  const form=document.querySelector('#missing-form');
  form.addEventListener('submit',e=>{
    e.preventDefault();
    const inputs=screen.querySelectorAll('input[data-key]');
    const userMeasurements={};
    let allValid=true;
    inputs.forEach(input=>{
      const val=parseFloat(input.value);
      if(!Number.isFinite(val)||val<=0){input.classList.add('error');allValid=false;}
      else {userMeasurements[input.dataset.key]=val;input.classList.remove('error');}
    });
    if(!allValid) return;
    const ai=state.aiMeasurements||{};
    const merged={
      item_width:ai.item_width,item_height:ai.item_height,item_depth:ai.item_depth,
      space_width:ai.space_width,space_height:ai.space_height,space_depth:ai.space_depth,
      ...userMeasurements
    };
    const final=computeFinalVerdict(merged);
    state.step=4;
    renderResult(toVerdict(final),final.explanation);
    renderProgress();
  });
}
function render(){progress.forEach((p,i)=>p.classList.toggle('active',i<state.step));back.hidden=state.step===1||state.step===4;if(state.step===1)page('Item','Photo 1 — ITEM','Photograph the item you want to fit. Place a ruler or measuring tape clearly beside it, with the measurement marks and item edges visible. Without a clear ruler or measuring tape, the result may be MAYBE.','your item');else if(state.step===2)page('Space','Photo 2 — SPACE','Photograph the opening or space where the item needs to fit. Place a ruler or measuring tape clearly beside the opening, measuring the corresponding dimension. Without a clear ruler or measuring tape, the result may be MAYBE.','the space');else if(state.step===3)analyze();}function page(eyebrow,title,copy,name){screen.innerHTML=`<p class="eyebrow">Step ${state.step} of 3 · ${eyebrow}</p><h2>${title}</h2><p>${copy}</p><div class="visual">${state[target]?`<img src="${state[target]}" alt="Selected ${name}" />`:`<span>📷<br/>No photo selected yet</span>`}</div><button class="button" data-action="camera">Take Photo</button><button class="button alt" data-action="upload">Upload Photo</button>`;}
async function analyze(){
  screen.innerHTML=`<div class="loading">
    <div class="spinner"></div>
    <h2>Checking the fit...</h2>
    <p>Looking for the item, the space, and a size reference.</p>
  </div>`;

  try{
    const r=await fetch('/api/analyze',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        item:state.item,
        space:state.space
      })
    });

    const raw = await r.text();

    let data = {};

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      console.error(
        'Non-JSON API response:',
        r.status,
        raw.slice(0, 500)
      );
    }

    if (!r.ok) {
      const error = new Error(
        data.error || `Analysis request failed (${r.status})`
      );
      error.status = r.status;
      throw error;
    }

    const verdict=toVerdict(data);

    if(data.verdict==='maybe'&&Array.isArray(data.missing_dimensions)&&data.missing_dimensions.length>0){
      state.aiMeasurements=data.measurements||null;
      state.missingDimensions=data.missing_dimensions;
      state.step=4;
      renderMissingForm();
      renderProgress();
      return;
    }

    state.step=4;
    renderResult(verdict,data.explanation);
    renderProgress();

}catch(error){
  state.step=4;

  let title='Analysis unavailable';
  let message="We couldn't complete the AI check. Please check your connection and try again.";
  let button='Try again';

  if(error.status===413){
    title='Photos are too large';
    message='Please use smaller photos and try again.';
    button='Choose smaller photos';
  }else if(error.status===429){
    title='Too many checks';
    message='You have reached the temporary usage limit. Please wait and try again later.';
    button='Try again later';
  }

  screen.innerHTML=`<div class="result">
    <div class="icon">⚠️</div>
    <div class="badge maybe">ERROR</div>
    <h2>${title}</h2>
    <p>${message}</p>
    <div class="details">This is a technical error, not a fit result.</div>
    <button class="button" data-action="retry">${button}</button>
  </div>`;

  renderProgress();
}
}
function toVerdict(data){return data.verdict==='can_fit'?{icon:'🟢',cls:'can',label:'CAN FIT',title:'It should fit'}:data.verdict==='wont_fit'?{icon:'🔴',cls:'no',label:"WON'T FIT",title:'It likely will not fit'}:{icon:'🟡',cls:'maybe',label:'MAYBE',title:'We need more certainty'}}
function renderProgress(){progress.forEach((p,i)=>p.classList.toggle('active',i<state.step));}
screen.addEventListener('click',e=>{const a=e.target.dataset.action;if(!a)return;if(a==='restart'){state.step=1;state.item=state.space=state.aiMeasurements=state.missingDimensions=null;render();return}if(a==='retry'){state.step=3;state.aiMeasurements=state.missingDimensions=null;analyze();return}target=state.step===1?'item':'space';(a==='camera'?camera:upload).click();});
function choose(e){const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{state[target]=reader.result;state.step++;render()};reader.readAsDataURL(file);e.target.value=''}camera.onchange=choose;upload.onchange=choose;back.onclick=()=>{state.step--;render()};render();
