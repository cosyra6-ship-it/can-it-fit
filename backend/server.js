const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..','frontend'); const types={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const RATE_LIMIT_WINDOW_MS=60*60*1000;
const RATE_LIMIT_MAX=20;
const rateBuckets=new Map();

function allowAnalyzeRequest(req){
  const ip=req.socket.remoteAddress||'unknown';
  const now=Date.now();
  let bucket=rateBuckets.get(ip);

  if(!bucket||now-bucket.startedAt>=RATE_LIMIT_WINDOW_MS){
    bucket={startedAt:now,count:0};
    rateBuckets.set(ip,bucket);
  }

  bucket.count++;
  return bucket.count<=RATE_LIMIT_MAX;
}
function readBody(req){
  return new Promise((resolve,reject)=>{
    let body='';
    const MAX_BODY_SIZE=15*1024*1024;

    req.on('data',chunk=>{
      body+=chunk;

      if(Buffer.byteLength(body,'utf8')>MAX_BODY_SIZE){
        const err=new Error('Request too large');
        err.statusCode=413;
        reject(err);
        req.destroy();
      }
    });

    req.on('end',()=>{
      try{
        resolve(JSON.parse(body));
      }catch(err){
        err.statusCode=400;
        reject(err);
      }
    });

    req.on('error',reject);
  });
}
async function analyze(body){
  if(!process.env.OPENAI_API_KEY) return {verdict:'maybe',explanation:'Photos received, but AI analysis is not configured yet. Add a ruler or tape measure to both photos for a reliable check.',configured:false};
const content=[{type:'input_text',text:`You assess whether an item fits into a target space using two photos.

The first image shows the ITEM.
The second image shows the SPACE or OPENING.

TRUSTWORTHY MEASUREMENT RULE:
Only treat a clearly readable ruler or measuring tape as a trustworthy source for exact dimensions in centimeters.

Do NOT infer exact centimeters from ordinary objects such as suitcase handles, phones, hands, bottles, furniture, doors, shelves, boxes, tiles, paper, or other objects whose real dimensions are not explicitly known.

Never invent measurements.

If BOTH images do not contain enough trustworthy measurement information to compare the necessary corresponding dimensions, return "maybe".
In that case, do not claim exact centimeter measurements.

DECISION RULES:

1. Return "wont_fit" when at least one reliably measured required dimension of the item is larger than the corresponding measured dimension of the opening or space.

Example:
item width = 35 cm
opening width = 20 cm
Result = wont_fit.

Once one reliable corresponding dimension proves impossibility, uncertainty about other dimensions must NOT change the verdict to maybe.

2. Return "can_fit" only when the trustworthy visible measurements provide enough evidence that ALL necessary dimensions fit with reasonable clearance.

Do not return can_fit merely because one dimension fits.

3. Return "maybe" when:
- trustworthy measurements are missing,
- corresponding dimensions cannot be reliably compared,
- measurements are too close for confidence,
- a necessary dimension is hidden or unclear,
- perspective or image angle prevents a reliable comparison.

DIMENSION MATCHING RULE — MANDATORY:

A measurement may ONLY be compared with the same physical dimension:
- item width may only be compared with opening width
- item height may only be compared with opening height
- item depth may only be compared with opening depth

NEVER compare different dimensions.
For example:
- NEVER compare item height with opening width
- NEVER compare item width with opening height
- NEVER compare item depth with opening width or height
- NEVER use a differently named dimension to produce "can_fit" or "wont_fit"

If the item has a trustworthy measurement for one dimension but the SPACE does not have a trustworthy measurement for that SAME dimension, that dimension is UNKNOWN.

If no same-dimension trustworthy measurement pair proves that the item cannot fit, and there is not enough same-dimension evidence to prove that all necessary dimensions fit, return "maybe".

Before returning "can_fit" or "wont_fit", verify that every measurement comparison used in the decision is SAME-DIMENSION.

Do not use an unknown-size object as a ruler.
Do not estimate centimeters from visual appearance alone.

Return strict JSON only:
{"verdict":"can_fit|maybe|wont_fit","explanation":"one concise sentence","has_reference":true|false}`},{type:'input_image',image_url:body.item},{type:'input_image',image_url:body.space}];
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_VISION_MODEL||'gpt-4.1-mini',input:[{role:'user',content}],text:{format:{type:'json_object'}}})});
  const raw = await response.text();
if (!response.ok) {
  throw new Error(`Vision provider returned ${response.status}: ${raw}`);
}

const data = JSON.parse(raw);
const text = data.output?.flatMap(o => o.content || []).find(c => c.type === 'output_text')?.text;
if (!text) throw new Error('Vision response contained no output text');
return {...JSON.parse(text), configured:true};
}
http.createServer(async(req,res)=>{
  if(req.method==='POST' && req.url==='/api/analyze'){

    if(!allowAnalyzeRequest(req)){
      res.writeHead(429,{'Content-Type':'application/json'});
      return res.end(JSON.stringify({
        error:'Too many requests. Please try again later.'
      }));
    }

    try{
      const result=await analyze(await readBody(req));

      res.writeHead(200,{'Content-Type':'application/json'});
      return res.end(JSON.stringify(result));

    }catch(error){
      console.error(error.message);

      const status=error.statusCode||502;

      if(status===413){
        res.writeHead(413,{'Content-Type':'application/json'});
        return res.end(JSON.stringify({
          error:'Upload too large. Please use smaller photos.'
        }));
      }

      if(status===400){
        res.writeHead(400,{'Content-Type':'application/json'});
        return res.end(JSON.stringify({
          error:'Invalid request. Please try the photos again.'
        }));
      }

      res.writeHead(502,{'Content-Type':'application/json'});
      return res.end(JSON.stringify({
        error:'AI analysis is temporarily unavailable. Please try again.'
      }));
    }
  }

  let file=req.url==='/'?'index.html':req.url.split('?')[0];
  file=path.normalize(file).replace(/^([.][.][\\/])+/,'');

  const target=path.join(root,file);

  fs.readFile(target,(err,data)=>{
    if(err){
      res.writeHead(404);
      return res.end('Not found');
    }

    res.writeHead(200,{
      'Content-Type':types[path.extname(target)]||'application/octet-stream'
    });

    res.end(data);
  });

}).listen(process.env.PORT||3000,()=>{
  console.log('Can It Fit running at http://localhost:3000');
});