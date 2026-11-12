/* RAX Scanner core: normalization, candidate ranking and resilient API requests. */
(function(root){
  "use strict";
  function normNumber(v){const m=String(v??"").match(/(\\d+)\\s*\\/\\s*(\\d+)/);return m?{number:String(parseInt(m[1],10)),total:String(parseInt(m[2],10))}:null;}
  function sameNum(a,b){return String(parseInt(String(a??""),10))===String(parseInt(String(b??""),10));}
  function scoreCard(c,q){
    let score=0; const n=normNumber(q.number), name=String(q.name||"").trim().toLowerCase();
    if(name){const cn=String(c.name||"").toLowerCase();if(cn===name)score+=100;else if(cn.includes(name))score+=55;else if(name.includes(cn)&&cn)score+=25;}
    if(n){if(sameNum(c.number,n.number))score+=45;if(sameNum(c.total_set_number,n.total))score+=35;}
    const set=String(q.set||"").trim().toLowerCase(), cs=String(c.set&&c.set.name||"").toLowerCase();
    if(set){if(cs===set)score+=40;else if(cs.includes(set)||set.includes(cs))score+=20;}
    return score;
  }
  function matches(c,q){
    const n=normNumber(q.number);
    if(n&&(!sameNum(c.number,n.number)||!sameNum(c.total_set_number,n.total)))return false;
    if(q.name){const a=String(c.name||"").toLowerCase(),b=String(q.name).trim().toLowerCase();if(!a.includes(b)&&!b.includes(a))return false;}
    if(q.set){const a=String(c.set&&c.set.name||"").toLowerCase(),b=String(q.set).trim().toLowerCase();if(!a.includes(b))return false;}
    return true;
  }
  function errorMessage(status,body){
    const e=body&&body.error||{}, code=e.code||"";
    if(status===401)return "API Key 无效或未发送。请到设置重新保存 PkmnPrices API Key。";
    if(status===403)return "当前 API Key / 套餐没有此数据权限。请检查账户方案及邮箱验证。";
    if(status===404)return "API 找不到该资源。请重新搜索卡片。";
    if(status===429){if(e.limit_type==="daily"||code==="credit_limit_exceeded")return "已达到今日 API 额度上限；额度重置前无法继续查询。";return "API 请求过于频繁，请稍等后重试。";}
    if(status>=500)return "PkmnPrices 服务暂时异常（"+status+"），请稍后重试。";
    return e.message||"API 请求失败（"+status+"）。";
  }
  async function request(url,apiKey,opts){
    opts=opts||{};const timeout=opts.timeout||12000,maxRetries=opts.retries??2;
    let last;
    for(let attempt=0;attempt<=maxRetries;attempt++){
      const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),timeout);
      try{
        const res=await fetch(url,{headers:{"X-API-Key":apiKey,"Accept":"application/json"},signal:controller.signal,cache:"no-store"});
        const raw=await res.text();let data=null;try{data=raw?JSON.parse(raw):{};}catch(_){throw new Error("API 返回了无法解析的数据，请稍后重试。");}
        if(!res.ok){
          const err=new Error(errorMessage(res.status,data));err.status=res.status;err.payload=data;
          const daily=res.status===429&&(data.error&&data.error.limit_type==="daily"||data.error&&data.error.code==="credit_limit_exceeded");
          const retryable=res.status===429&&!daily||res.status>=500;
          if(retryable&&attempt<maxRetries){const ra=Number(res.headers.get("Retry-After"));await new Promise(r=>setTimeout(r,Math.min(8000,ra>0?ra*1000:700*Math.pow(2,attempt))));continue;}
          throw err;
        }
        return data;
      }catch(e){
        last=e;
        if(e.name==="AbortError")last=new Error("请求超时（"+Math.round(timeout/1000)+" 秒）。请检查网络后重试。");
        const retryable=e.name==="AbortError"||!e.status;
        if(!retryable||attempt>=maxRetries)throw last;
        await new Promise(r=>setTimeout(r,500*Math.pow(2,attempt)));
      }finally{clearTimeout(timer);}
    }
    throw last||new Error("请求失败。");
  }
  root.RaxCore={normNumber,scoreCard,matches,errorMessage,request};
  if(typeof module!=="undefined"&&module.exports)module.exports=root.RaxCore;
})(typeof globalThis!=="undefined"?globalThis:this);
