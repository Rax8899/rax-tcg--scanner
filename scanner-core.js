/* RAX Scanner core: tolerant card matching and resilient API requests. */
(function(root){
  "use strict";
  function normNumber(v){
    const m=String(v??"").match(/(\d+)\s*\/\s*(\d+)/);
    return m?{number:String(parseInt(m[1],10)),total:String(parseInt(m[2],10))}:null;
  }
  function cardNumberParts(card){
    const raw=String((card&&card.number)??"").trim();
    const combined=normNumber(raw);
    if(combined)return combined;
    const n=raw.match(/\d+/);
    const total=String((card&&card.total_set_number)??"").match(/\d+/);
    return n&&total?{number:String(parseInt(n[0],10)),total:String(parseInt(total[0],10))}:null;
  }
  function normalizeName(value){
    return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  }
  function sameNum(a,b){
    const left=String(a??"").match(/\d+/),right=String(b??"").match(/\d+/);
    return !!left&&!!right&&parseInt(left[0],10)===parseInt(right[0],10);
  }
  function scoreCard(c,q){
    let score=0;
    const n=normNumber(q.number), cn=cardNumberParts(c);
    const name=normalizeName(q.name);
    if(name){
      const cardName=normalizeName(c.name);
      if(cardName===name)score+=100;
      else if(cardName.includes(name))score+=55;
      else if(name.includes(cardName)&&cardName)score+=25;
    }
    if(n&&cn){
      if(sameNum(cn.number,n.number))score+=45;
      if(sameNum(cn.total,n.total))score+=35;
    }
    const set=normalizeName(q.set);
    const cardSet=normalizeName(c.set&&c.set.name);
    if(set){
      if(cardSet===set)score+=40;
      else if(cardSet.includes(set)||set.includes(cardSet))score+=20;
    }
    return score;
  }
  function matches(c,q){
    const n=normNumber(q.number);
    if(n){
      const cn=cardNumberParts(c);
      if(!cn||!sameNum(cn.number,n.number)||!sameNum(cn.total,n.total))return false;
    }
    if(q.name){
      const a=normalizeName(c.name),b=normalizeName(q.name);
      if(!a.includes(b)&&!b.includes(a))return false;
    }
    if(q.set){
      const a=normalizeName(c.set&&c.set.name),b=normalizeName(q.set);
      if(!a.includes(b))return false;
    }
    return true;
  }
  function errorMessage(status,body){
    const e=body&&body.error||{},code=e.code||"";
    if(status===401)return "API Key 无效或未发送。请检查服务器端 PKMNPRICES_API_KEY。";
    if(status===403)return "当前 API Key / 套餐没有此数据权限。请检查账户方案及邮箱验证。";
    if(status===404)return "API 找不到该资源。请重新搜索卡片。";
    if(status===429){
      if(e.limit_type==="daily"||code==="credit_limit_exceeded")return "已达到今日 API 额度上限；额度重置前无法继续查询。";
      return "API 请求过于频繁，请稍等后重试。";
    }
    if(status>=500)return "PkmnPrices 服务暂时异常（"+status+"），请稍后重试。";
    return e.message||"API 请求失败（"+status+"）。";
  }
  async function request(url,apiKey,opts){
    opts=opts||{};
    const timeout=opts.timeout||12000,maxRetries=opts.retries??2;
    let last;
    for(let attempt=0;attempt<=maxRetries;attempt++){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
      try{
        const res=await fetch(url,{headers:{"X-API-Key":apiKey,"Accept":"application/json"},mode:"cors",credentials:"omit",signal:controller.signal,cache:"no-store"});
        const raw=await res.text();
        let data=null;
        try{data=raw?JSON.parse(raw):{};}catch(_){throw new Error("API 返回了无法解析的数据，请稍后重试。");}
        if(!res.ok){
          const err=new Error(errorMessage(res.status,data));err.status=res.status;err.payload=data;
          const daily=res.status===429&&(data.error&&(data.error.limit_type==="daily"||data.error.code==="credit_limit_exceeded"));
          const retryable=res.status===429&&!daily||res.status>=500;
          if(retryable&&attempt<maxRetries){
            const ra=Number(res.headers.get("Retry-After"));
            await new Promise(r=>setTimeout(r,Math.min(8000,ra>0?ra*1000:700*Math.pow(2,attempt))));
            continue;
          }
          throw err;
        }
        return data;
      }catch(e){
        last=e;
        if(e.name==="AbortError")last=new Error("请求超时（"+Math.round(timeout/1000)+" 秒）。请检查网络后重试。");
        else if(e instanceof TypeError||/load failed|failed to fetch|networkerror/i.test(String(e.message||"")))
          last=new Error("浏览器无法读取 API 响应。请检查 Worker、网络或跨域设置；这不代表卡片不存在。");
        const retryable=e.name==="AbortError"||!e.status;
        if(!retryable||attempt>=maxRetries)throw last;
        await new Promise(r=>setTimeout(r,500*Math.pow(2,attempt)));
      }finally{clearTimeout(timer);}
    }
    throw last||new Error("请求失败。");
  }

  function emptyState(){return {schemaVersion:2,holdings:[],watchlist:[],scanHistory:[],collections:[]};}
  function normalizeState(raw){
    const d=raw&&typeof raw==="object"?raw:{};
    return {
      schemaVersion:2,
      holdings:Array.isArray(d.holdings)?d.holdings.filter(x=>x&&typeof x==="object").map(x=>({...x,qty:Math.max(1,Number(x.qty)||1),cost:Math.max(0,Number(x.cost)||0)})):[],
      watchlist:Array.isArray(d.watchlist)?d.watchlist.filter(x=>x&&typeof x==="object"):[],
      scanHistory:Array.isArray(d.scanHistory)?d.scanHistory.filter(x=>x&&typeof x==="object").slice(0,500):[],
      collections:Array.isArray(d.collections)?d.collections.filter(x=>x&&typeof x==="object"):[]
    };
  }
  function holdingKey(x){
    return [x&&x.id,x&&x.variant||"Normal",x&&x.language||"English",x&&x.condition||"Near Mint"].map(v=>String(v??"").trim().toLowerCase()).join("|");
  }
  function upsertHolding(rawState,incoming){
    const state=normalizeState(rawState),item={...incoming};
    item.qty=Math.max(1,Math.floor(Number(item.qty)||1));
    item.cost=Math.max(0,Number(item.cost)||0);
    const key=holdingKey(item),index=state.holdings.findIndex(x=>holdingKey(x)===key);
    if(index<0){state.holdings.push(item);return {state,merged:false,holding:item};}
    const old=state.holdings[index],oldQty=Math.max(1,Number(old.qty)||1),newQty=item.qty,total=oldQty+newQty;
    const oldCost=Math.max(0,Number(old.cost)||0),newCost=item.cost;
    const merged={...old,...item,qty:total,cost:((oldCost*oldQty)+(newCost*newQty))/total};
    state.holdings[index]=merged;
    return {state,merged:true,holding:merged};
  }
  function portfolioSummary(holdings,fx){
    const list=Array.isArray(holdings)?holdings:[];
    let quantity=0,costBasis=0,marketValue=0,pricedCostBasis=0,valuedQuantity=0,unpricedQuantity=0;
    for(const h of list){
      const qty=Math.max(1,Number(h&&h.qty)||1),cost=Math.max(0,Number(h&&h.cost)||0);
      quantity+=qty;costBasis+=cost*qty;
      let value=Number(h&&h.marketMyr);
      if(!Number.isFinite(value)){
        const amount=Number(h&&(h.marketAmount??h.usd));
        const currency=String(h&&h.currency||"USD").toUpperCase();
        const rate=currency==="MYR"?1:currency==="EUR"?Number(fx&&fx.EUR):Number(fx&&fx.USD);
        value=Number.isFinite(amount)&&Number.isFinite(rate)&&rate>0?amount*rate:NaN;
      }
      if(Number.isFinite(value)&&value>=0){marketValue+=value*qty;pricedCostBasis+=cost*qty;valuedQuantity+=qty;}
      else unpricedQuantity+=qty;
    }
    const pnl=marketValue-pricedCostBasis;
    return {quantity,costBasis,marketValue,pricedCostBasis,pnl,roi:pricedCostBasis?pnl/pricedCostBasis*100:0,valuedQuantity,unpricedQuantity};
  }

  root.RaxCore={normNumber,cardNumberParts,normalizeName,scoreCard,matches,errorMessage,request,emptyState,normalizeState,holdingKey,upsertHolding,portfolioSummary};
  if(typeof module!=="undefined"&&module.exports)module.exports=root.RaxCore;
})(typeof globalThis!=="undefined"?globalThis:this);
