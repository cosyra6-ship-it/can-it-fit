const state={step:1,item:null,space:null};
const screen=document.querySelector('#screen'),progress=document.querySelectorAll('.progress span'),back=document.querySelector('#back');
const camera=document.querySelector('#camera'), upload=document.querySelector('#upload');
let target='item';
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

    const data=await r.json();

if(!r.ok){
  const error=new Error(data.error || 'Analysis request failed');
  error.status=r.status;
  throw error;
}

    const verdict=toVerdict(data);
    state.step=4;

    screen.innerHTML=`<div class="result">
      <div class="icon">${verdict.icon}</div>
      <div class="badge ${verdict.cls}">${verdict.label}</div>
      <h2>${verdict.title}</h2>
      <p>${data.explanation}</p>
      <div class="details">AI checked both images. Confirm important moves with a real measurement.</div>
      <button class="button" data-action="restart">Try another fit</button>
    </div>`;

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
screen.addEventListener('click',e=>{const a=e.target.dataset.action;if(!a)return;if(a==='restart'){state.step=1;state.item=state.space=null;render();return}if(a==='retry'){state.step=3;analyze();return}target=state.step===1?'item':'space';(a==='camera'?camera:upload).click();});
function choose(e){const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{state[target]=reader.result;state.step++;render()};reader.readAsDataURL(file);e.target.value=''}camera.onchange=choose;upload.onchange=choose;back.onclick=()=>{state.step--;render()};render();
