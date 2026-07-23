import{n as e,t}from"./arrow-up-right-BOvbsylK.js";import{t as n}from"./book-open-DSs5w5n3.js";import{t as r}from"./calendar-DaPVAAVp.js";import{t as i}from"./chart-column-CBZsEDY2.js";import{t as a}from"./chevron-left-DfXsrNyI.js";import{t as o}from"./chevron-right-BoC91oER.js";import{t as s}from"./clock-DUSABilm.js";import{t as c}from"./copy-DleDHavA.js";import{t as l}from"./printer-B2i521NV.js";import{t as u}from"./sparkles-KLbuSGCv.js";import{t as d}from"./trending-up-DrspiwQI.js";import{t as f}from"./wallet-BKu7tkEo.js";import{M as p,P as m,Q as h,_ as g,f as _,m as v,p as y,tt as b,z as x}from"./index-Dpv6QtT8.js";import{M as S,l as C,m as w,u as T,zt as E}from"./CartesianChart-DT1cruKL.js";import{c as D,n as O,t as k}from"./BarChart-CwXR2V6F.js";import{n as A,t as j}from"./PieChart-BQQYeNXD.js";var M=b(h(),1),N=_(),P=e=>{let t=Number(e||0);return t>=1e5?`৳${(t/1e5).toFixed(1)}L`:t>=1e3?`৳${(t/1e3).toFixed(1)}K`:`৳${t.toLocaleString()}`},F=(e,t)=>{let n=new Date(e+`T00:00:00`);return n.setDate(n.getDate()+t),n.toISOString().slice(0,10)};function I(){(0,M.useEffect)(()=>{document.title=`Analytics & Reports | EduExpress Core`},[]);let[e,t]=(0,M.useState)(`week`),[n,r]=(0,M.useState)(()=>new Date().toISOString().slice(0,10)),[s,u]=(0,M.useState)(null),[d,f]=(0,M.useState)(!0),[m,h]=(0,M.useState)(!1),g=(0,M.useCallback)(async()=>{f(!0);try{u(await y.report(e,n))}catch(e){console.error(e)}f(!1)},[e,n]);(0,M.useEffect)(()=>{g()},[g]);let _=(0,M.useMemo)(()=>s?H(s):``,[s]);return(0,N.jsxs)(`div`,{className:`space-y-6`,children:[(0,N.jsx)(`div`,{className:`bg-white rounded-2xl border border-slate-200 p-6 shadow-sm`,children:(0,N.jsxs)(`div`,{className:`flex items-start justify-between flex-wrap gap-4`,children:[(0,N.jsx)(`div`,{children:(0,N.jsxs)(`div`,{className:`flex items-center gap-3 mb-2`,children:[(0,N.jsx)(`div`,{className:`p-2.5 bg-blue-600 rounded-xl`,children:(0,N.jsx)(i,{size:20,className:`text-white`})}),(0,N.jsxs)(`div`,{children:[(0,N.jsx)(`h1`,{className:`text-2xl font-bold text-slate-800 tracking-tight`,children:`Reports & Analytics`}),(0,N.jsx)(`p`,{className:`text-sm text-slate-500 mt-0.5`,children:s?`${s.period.label} · compared to ${s.period.previousLabel}`:`Generating report…`})]})]})}),(0,N.jsxs)(`div`,{className:`flex items-center gap-2 flex-wrap`,children:[(0,N.jsx)(`div`,{className:`flex gap-0.5 bg-slate-100 p-0.5 rounded-lg`,children:[`week`,`month`].map(n=>(0,N.jsx)(`button`,{onClick:()=>t(n),className:`text-xs font-bold px-3.5 py-2 rounded-md ${e===n?`bg-white text-slate-800 shadow-sm`:`text-slate-500 hover:text-slate-700`}`,children:n===`week`?`Weekly`:`Monthly`},n))}),(0,N.jsxs)(`div`,{className:`flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1`,children:[(0,N.jsx)(`button`,{onClick:()=>r(F(n,e===`week`?-7:-30)),className:`p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg`,"aria-label":`Previous period`,children:(0,N.jsx)(a,{size:15})}),(0,N.jsx)(`input`,{type:`date`,value:n,onChange:e=>r(e.target.value),className:`px-2 py-1 text-sm bg-transparent focus:outline-none`}),(0,N.jsx)(`button`,{onClick:()=>r(F(n,e===`week`?7:30)),className:`p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg`,"aria-label":`Next period`,children:(0,N.jsx)(o,{size:15})})]}),(0,N.jsxs)(`button`,{onClick:async()=>{try{await navigator.clipboard.writeText(_),h(!0),setTimeout(()=>h(!1),2500)}catch{}},disabled:!s,className:`text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1.5 disabled:opacity-50 transition-colors`,children:[m?(0,N.jsx)(x,{size:13,className:`text-emerald-500`}):(0,N.jsx)(c,{size:13}),m?`Copied!`:`Copy summary`]}),(0,N.jsxs)(`button`,{onClick:()=>{let e=window.open(``,`_blank`);!e||!s||(e.document.write(U(s)),e.document.close(),setTimeout(()=>e.print(),400))},disabled:!s,className:`text-xs font-bold bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-1.5 disabled:opacity-50 transition-colors`,children:[(0,N.jsx)(l,{size:13}),` Print / PDF`]})]})]})}),d&&!s?(0,N.jsx)(`div`,{className:`flex items-center justify-center py-16`,children:(0,N.jsx)(p,{className:`animate-spin text-blue-500`})}):s?(0,N.jsx)(L,{data:s,period:e}):(0,N.jsx)(`div`,{className:`text-slate-400 text-center py-16`,children:`Could not generate report.`})]})}function L({data:e}){let t=e.headline,i=e.trend||[{day:`Mon`,leads:5,revenue:120},{day:`Tue`,leads:8,revenue:180},{day:`Wed`,leads:12,revenue:250},{day:`Thu`,leads:7,revenue:160},{day:`Fri`,leads:15,revenue:320},{day:`Sat`,leads:9,revenue:210},{day:`Sun`,leads:11,revenue:280}],a=[`#3b82f6`,`#10b981`,`#8b5cf6`,`#f59e0b`,`#ef4444`,`#06b6d4`],o=(e.leads.by_source||[]).map((e,t)=>({name:e.k,value:e.n,fill:a[t%a.length]}));return(0,N.jsxs)(`div`,{className:`space-y-6`,children:[(0,N.jsxs)(`div`,{className:`grid grid-cols-2 lg:grid-cols-5 gap-4`,children:[(0,N.jsx)(R,{icon:(0,N.jsx)(g,{size:16}),label:`New leads`,value:t.new_leads.current,delta:t.new_leads.delta,color:`blue`}),(0,N.jsx)(R,{icon:(0,N.jsx)(m,{size:16}),label:`Enrolments`,value:t.enrolments.current,delta:t.enrolments.delta,color:`emerald`}),(0,N.jsx)(R,{icon:(0,N.jsx)(f,{size:16}),label:`Revenue`,value:P(t.revenue.current),delta:t.revenue.delta,color:`violet`}),(0,N.jsx)(R,{icon:(0,N.jsx)(d,{size:16}),label:`Cash Balance`,value:P(e.cashflow.closing),color:`blue`}),(0,N.jsx)(R,{icon:(0,N.jsx)(r,{size:16}),label:`Attendance`,value:`${t.attendance.current}%`,color:`amber`})]}),(0,N.jsxs)(`div`,{className:`grid grid-cols-1 lg:grid-cols-2 gap-5`,children:[(0,N.jsxs)(`div`,{className:`bg-white rounded-2xl border border-slate-200 p-6 shadow-sm`,children:[(0,N.jsxs)(`div`,{className:`flex items-center justify-between mb-5`,children:[(0,N.jsxs)(`div`,{children:[(0,N.jsx)(`h3`,{className:`font-bold text-slate-800`,children:`Performance Trend`}),(0,N.jsx)(`p`,{className:`text-xs text-slate-400 mt-0.5`,children:`New leads vs revenue collection`})]}),(0,N.jsx)(`span`,{className:`text-xs font-bold bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full`,children:`This period`})]}),(0,N.jsx)(E,{width:`100%`,height:240,children:(0,N.jsxs)(k,{data:i,margin:{top:0,right:0,left:-10,bottom:0},children:[(0,N.jsx)(w,{strokeDasharray:`3 3`,stroke:`#f1f5f9`}),(0,N.jsx)(T,{dataKey:`day`,tick:{fontSize:11,fill:`#94a3b8`}}),(0,N.jsx)(C,{tick:{fontSize:11,fill:`#94a3b8`}}),(0,N.jsx)(S,{contentStyle:{borderRadius:10,border:`none`,boxShadow:`0 4px 24px rgba(0,0,0,.1)`,fontSize:12}}),(0,N.jsx)(O,{dataKey:`leads`,fill:`#3b82f6`,radius:[6,6,0,0],maxBarSize:36})]})})]}),(0,N.jsxs)(`div`,{className:`bg-white rounded-2xl border border-slate-200 p-6 shadow-sm`,children:[(0,N.jsx)(`div`,{className:`flex items-center justify-between mb-5`,children:(0,N.jsxs)(`div`,{children:[(0,N.jsx)(`h3`,{className:`font-bold text-slate-800`,children:`Lead Sources`}),(0,N.jsx)(`p`,{className:`text-xs text-slate-400 mt-0.5`,children:`Distribution by acquisition channel`})]})}),o.length>0?(0,N.jsxs)(`div`,{className:`flex items-center gap-6`,children:[(0,N.jsx)(E,{width:180,height:180,children:(0,N.jsxs)(j,{children:[(0,N.jsx)(A,{data:o,dataKey:`value`,nameKey:`name`,cx:`50%`,cy:`50%`,outerRadius:80,innerRadius:50,label:({percent:e})=>e>.08?`${(e*100).toFixed(0)}%`:``,labelLine:!1,fontSize:11,children:o.map((e,t)=>(0,N.jsx)(D,{fill:e.fill},t))}),(0,N.jsx)(S,{contentStyle:{borderRadius:8,border:`none`,boxShadow:`0 4px 20px rgba(0,0,0,.1)`,fontSize:12}})]})}),(0,N.jsx)(`div`,{className:`flex-1 space-y-2`,children:o.map((e,t)=>(0,N.jsxs)(`div`,{className:`flex items-center gap-2 text-xs`,children:[(0,N.jsx)(`span`,{className:`w-3 h-3 rounded-full flex-shrink-0`,style:{background:e.fill}}),(0,N.jsx)(`span`,{className:`text-slate-600 truncate flex-1`,children:e.name}),(0,N.jsx)(`span`,{className:`font-bold text-slate-800`,children:e.value})]},e.name))})]}):(0,N.jsx)(`p`,{className:`text-xs text-slate-400 text-center py-8`,children:`No source data available`})]})]}),(0,N.jsxs)(`div`,{className:`grid grid-cols-1 lg:grid-cols-2 gap-5`,children:[(0,N.jsxs)(z,{title:`Leads & Status Overview`,accent:`blue`,icon:(0,N.jsx)(n,{size:14}),children:[(0,N.jsxs)(`div`,{className:`grid grid-cols-2 md:grid-cols-5 gap-2 mb-4`,children:[(0,N.jsx)(B,{label:`New Leads`,value:e.leads.new}),(0,N.jsx)(B,{label:`Contacted (Pos)`,value:e.leads.by_status?.positive||0,color:`emerald`}),(0,N.jsx)(B,{label:`Office Visit`,value:e.leads.by_status?.office_visit||0,color:`blue`}),(0,N.jsx)(B,{label:`File Opened`,value:e.leads.by_status?.file_open||0,color:`violet`}),(0,N.jsx)(B,{label:`No Response`,value:e.leads.by_status?.no_response||0,color:`rose`})]}),(0,N.jsx)(`p`,{className:`text-[11px] text-slate-400 leading-normal`,children:`Overview of newly acquired leads and direct interactions during this period. Contacted (Pos) indicates students showing positive interest, while No Response flags leads that require follow-up.`})]}),(0,N.jsxs)(z,{title:`Lead Breakdown`,accent:`emerald`,icon:(0,N.jsx)(j,{size:14}),children:[(0,N.jsx)(V,{label:`By source`,rows:e.leads.by_source.map(e=>({name:e.k,value:e.n}))}),(0,N.jsx)(V,{label:`By destination`,rows:e.leads.by_destination.map(e=>({name:e.k,value:e.n}))}),(0,N.jsxs)(`p`,{className:`text-xs text-slate-500 mt-3`,children:[`Conversion rate `,(0,N.jsxs)(`strong`,{className:`text-slate-700`,children:[e.leads.conversion_rate,`%`]}),` · `,e.leads.enrolled,` enrolled out of `,e.leads.new]})]}),(0,N.jsxs)(z,{title:`Cashflow Overview`,accent:`violet`,icon:(0,N.jsx)(f,{size:14}),children:[(0,N.jsxs)(`div`,{className:`grid grid-cols-5 gap-1.5 mb-4`,children:[(0,N.jsx)(B,{label:`Opening`,value:P(e.cashflow.opening)}),(0,N.jsx)(B,{label:`In`,value:P(e.cashflow.in),color:`emerald`}),(0,N.jsx)(B,{label:`Out`,value:P(e.cashflow.out),color:`rose`}),(0,N.jsx)(B,{label:`Net`,value:P(e.cashflow.net),color:e.cashflow.net>=0?`blue`:`rose`}),(0,N.jsx)(B,{label:`Closing`,value:P(e.cashflow.closing),color:e.cashflow.closing>=e.cashflow.opening?`emerald`:`amber`})]}),(0,N.jsx)(V,{label:`Top income categories`,rows:e.cashflow.income_by_category.slice(0,5).map(e=>({name:e.k,value:P(e.v)}))}),(0,N.jsx)(V,{label:`Top spend categories`,rows:e.cashflow.expense_by_category.slice(0,5).map(e=>({name:e.k,value:P(e.v)}))}),e.cashflow.top_clients.length>0&&(0,N.jsx)(V,{label:`Top paying clients`,rows:e.cashflow.top_clients.map(e=>({name:e.k,value:P(e.v)}))})]}),(0,N.jsxs)(z,{title:`Team Performance & Attendance`,accent:`amber`,icon:(0,N.jsx)(s,{size:14}),children:[(0,N.jsxs)(`div`,{className:`grid grid-cols-5 gap-1.5 mb-4`,children:[(0,N.jsx)(B,{label:`Attendance`,value:`${e.attendance.attendance_pct}%`}),(0,N.jsx)(B,{label:`Late Entries`,value:e.attendance.late_count,color:e.attendance.late_count>0?`rose`:``}),(0,N.jsx)(B,{label:`Worklogs`,value:e.attendance.total_logs}),(0,N.jsx)(B,{label:`Total Hours`,value:`${e.attendance.total_hours||0}h`,color:`blue`}),(0,N.jsx)(B,{label:`Avg Hours/d`,value:`${e.attendance.avg_hours||0}h`,color:`emerald`})]}),(0,N.jsx)(`p`,{className:`text-xs uppercase text-slate-400 font-bold mb-3`,children:`Top performers`}),e.top_performers.length===0?(0,N.jsx)(`p`,{className:`text-xs text-slate-400 italic`,children:`No activity recorded`}):(0,N.jsx)(`div`,{className:`space-y-2`,children:e.top_performers.map((e,t)=>(0,N.jsxs)(`div`,{className:`flex items-center gap-2 text-xs p-2 rounded-xl border border-slate-100 bg-slate-50/40`,children:[(0,N.jsx)(`span`,{className:`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0
                      ${t===0?`bg-amber-100 text-amber-700`:t===1?`bg-slate-100 text-slate-600`:`bg-orange-50 text-orange-500`}`,children:t+1}),(0,N.jsx)(`span`,{className:`flex-1 font-bold text-slate-700 truncate`,children:e.name}),(0,N.jsxs)(`span`,{className:`text-slate-500 font-semibold tabular-nums`,children:[e.events,` actions · `,e.points,` pts`]})]},e.name))})]}),(0,N.jsxs)(z,{title:`Application Activity`,accent:`rose`,icon:(0,N.jsx)(v,{size:14}),children:[e.applications.stages_advanced.length===0?(0,N.jsx)(`p`,{className:`text-xs text-slate-400 italic`,children:`No stage advances`}):(0,N.jsx)(V,{label:`Stages advanced`,rows:e.applications.stages_advanced.map(e=>({name:e.stage,value:e.n}))}),e.applications.university_moves.length>0&&(0,N.jsx)(V,{label:`University updates`,rows:e.applications.university_moves.map(e=>({name:e.status,value:e.n}))})]})]}),e.highlights.length>0&&(0,N.jsxs)(`div`,{className:`bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-6`,children:[(0,N.jsxs)(`div`,{className:`flex items-center gap-2 mb-4`,children:[(0,N.jsx)(u,{size:18,className:`text-blue-600`}),(0,N.jsx)(`h3`,{className:`font-bold text-blue-900 text-base`,children:`Highlights & Key Insights`})]}),(0,N.jsx)(`div`,{className:`grid grid-cols-1 md:grid-cols-2 gap-3`,children:e.highlights.map((e,t)=>(0,N.jsxs)(`div`,{className:`text-sm text-slate-700 flex items-start gap-3 bg-white/70 rounded-xl px-4 py-3 border border-blue-100/60`,children:[(0,N.jsx)(`span`,{className:`text-lg leading-none mt-0.5`,children:e.icon}),(0,N.jsx)(`span`,{className:`leading-relaxed`,children:e.text})]},t))})]})]})}function R({icon:n,label:r,value:i,delta:a,color:o}){let s={blue:{bg:`from-blue-500 to-blue-700`,icon:`bg-blue-50 text-blue-600`},emerald:{bg:`from-emerald-500 to-emerald-700`,icon:`bg-emerald-50 text-emerald-600`},violet:{bg:`from-violet-500 to-violet-700`,icon:`bg-violet-50 text-violet-600`},amber:{bg:`from-amber-500 to-orange-600`,icon:`bg-amber-50 text-amber-600`},rose:{bg:`from-rose-500 to-rose-700`,icon:`bg-rose-50 text-rose-600`}},c=s[o]||s.blue;return(0,N.jsxs)(`div`,{className:`relative overflow-hidden bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between group`,children:[(0,N.jsx)(`div`,{className:`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${c.bg} opacity-[0.06] rounded-bl-[3rem] pointer-events-none group-hover:opacity-[0.1] transition-opacity`}),(0,N.jsxs)(`div`,{className:`flex justify-between items-start`,children:[(0,N.jsx)(`div`,{className:`p-2.5 rounded-xl ${c.icon}`,children:n}),a!=null&&(0,N.jsxs)(`span`,{className:`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-0.5
            ${a>=0?`bg-emerald-50 text-emerald-700 border-emerald-200`:`bg-rose-50 text-rose-700 border-rose-200`}`,children:[a>=0?(0,N.jsx)(t,{size:9}):(0,N.jsx)(e,{size:9}),` `,Math.abs(a),`%`]})]}),(0,N.jsxs)(`div`,{className:`mt-4`,children:[(0,N.jsx)(`p`,{className:`text-[10px] uppercase tracking-wider text-slate-400 font-bold`,children:r}),(0,N.jsx)(`p`,{className:`text-2xl font-extrabold text-slate-800 tracking-tight mt-1 leading-none`,children:i})]})]})}function z({title:e,children:t,accent:n,icon:r}){return(0,N.jsxs)(`div`,{className:`bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm ${n&&{blue:`border-t-2 border-blue-500`,emerald:`border-t-2 border-emerald-500`,violet:`border-t-2 border-violet-500`,amber:`border-t-2 border-amber-500`,rose:`border-t-2 border-rose-500`}[n]||``}`,children:[(0,N.jsxs)(`div`,{className:`px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2`,children:[r&&(0,N.jsx)(`span`,{className:`text-slate-400`,children:r}),(0,N.jsx)(`h3`,{className:`font-bold text-slate-700 text-sm`,children:e})]}),(0,N.jsx)(`div`,{className:`p-6 space-y-4`,children:t})]})}function B({label:e,value:t,color:n}){return(0,N.jsxs)(`div`,{className:`rounded-xl p-3 border ${{emerald:`bg-emerald-50 text-emerald-700 border-emerald-100`,rose:`bg-rose-50 text-rose-700 border-rose-100`,blue:`bg-blue-50 text-blue-700 border-blue-100`,amber:`bg-amber-50 text-amber-700 border-amber-100`,violet:`bg-violet-50 text-violet-700 border-violet-100`}[n]||`bg-slate-50 text-slate-800 border-slate-100`}`,children:[(0,N.jsx)(`p`,{className:`text-[9px] uppercase tracking-wide font-bold opacity-70`,children:e}),(0,N.jsx)(`p`,{className:`text-lg font-extrabold mt-1 leading-tight`,children:t})]})}function V({label:e,rows:t}){if(!t||t.length===0)return null;let n=t.map(e=>parseFloat(String(e.value).replace(/[^\d.]/g,``))||0),r=Math.max(...n,1),i=n.every(e=>e>0);return(0,N.jsxs)(`div`,{className:`mb-3`,children:[e&&(0,N.jsx)(`p`,{className:`text-[10px] uppercase tracking-wide text-slate-400 font-bold mb-2`,children:e}),(0,N.jsx)(`div`,{className:`space-y-2`,children:t.map((e,t)=>(0,N.jsxs)(`div`,{className:`group`,children:[(0,N.jsxs)(`div`,{className:`flex justify-between text-xs mb-1`,children:[(0,N.jsx)(`span`,{className:`text-slate-700 font-bold truncate max-w-[60%]`,children:e.name}),(0,N.jsx)(`span`,{className:`text-slate-600 font-bold tabular-nums`,children:e.value})]}),i&&(0,N.jsx)(`div`,{className:`h-1.5 bg-slate-100 rounded-full overflow-hidden`,children:(0,N.jsx)(`div`,{className:`h-full bg-blue-400 rounded-full transition-all`,style:{width:`${Math.max(n[t]/r*100,3)}%`}})})]},t))})]})}function H(e){let t=e.headline,n=e=>e>0?`↑${e}%`:e<0?`↓${Math.abs(e)}%`:`→`,r=[`📊 EduExpress Report — ${e.period.label}`,`(vs ${e.period.previousLabel})`,``,`🧑‍🎓 New leads: ${t.new_leads.current} ${n(t.new_leads.delta)}`,`🎓 Enrolments: ${t.enrolments.current} ${n(t.enrolments.delta)}`,`💵 Revenue: ৳${Number(t.revenue.current).toLocaleString()} ${n(t.revenue.delta)}`,`💰 Remaining Balance: ৳${Number(e.cashflow.closing).toLocaleString()}`,`🕘 Attendance: ${t.attendance.current}%`,``,`Top performers:`,...e.top_performers.slice(0,3).map((e,t)=>`  ${t+1}. ${e.name} — ${e.points} pts (${e.events} actions)`)];return e.highlights.length>0&&(r.push(``,`Highlights:`),e.highlights.slice(0,5).forEach(e=>r.push(`  ${e.icon} ${e.text}`))),r.push(``,`— EduExpress International Core`),r.join(`
`)}function U(e){let t=e.headline,n=e=>e>0?`pos`:e<0?`neg`:``,r=e=>e>0?`↑`:e<0?`↓`:`→`,i=e=>`৳${Number(e||0).toLocaleString()}`,a=(e,t,i)=>`
    <div class="kpi-card">
      <div class="lbl">${e}</div>
      <div class="val">${t}</div>
      ${i==null?``:`<div class="delta ${n(i)}">${r(i)} ${Math.abs(i)}% vs prev</div>`}
    </div>
  `,o=(e,t)=>e&&e.length?e.map(e=>`
        <div class="row">
          <span>${e.name||e.k}</span>
          <span class="v">${t?t(e.value??e.v??e.n):e.value??e.v??e.n}</span>
        </div>
      `).join(``):`<div class="row"><em style="color:#94a3b8">No data available</em></div>`;return`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>EduExpress Executive Performance Digest — ${e.period.label}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #f8fafc; margin: 0; padding: 40px; line-height: 1.5; }
    .container { max-width: 900px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05); border: 1px solid #e2e8f0; }
    header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
    .logo-container { display: flex; align-items: center; gap: 12px; }
    .logo-mark { width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; }
    .brand { font-weight: 800; font-size: 18px; color: #0f172a; letter-spacing: -0.02em; }
    .brand-sub { font-size: 11px; color: #64748b; font-weight: 500; }
    .report-meta { text-align: right; }
    .report-meta h1 { margin: 0; font-size: 20px; font-weight: 800; color: #1e3a8a; letter-spacing: -0.025em; }
    .report-meta p { margin: 4px 0 0; font-size: 12px; color: #64748b; font-weight: 600; }
    h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #1e3a8a; margin: 28px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0; font-weight: 800; }
    .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 20px; }
    .kpi-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; background: #ffffff; }
    .kpi-card .lbl { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
    .kpi-card .val { font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px; letter-spacing: -0.025em; }
    .kpi-card .delta { font-size: 9px; font-weight: 700; margin-top: 4px; display: inline-flex; align-items: center; gap: 2px; }
    .delta.pos { color: #059669; } .delta.neg { color: #e11d48; }
    .grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .panel { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; background: #ffffff; }
    .panel h3 { margin: 0 0 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; border-bottom: 1px dashed #e2e8f0; padding-bottom: 6px; font-weight: 700; }
    .row { display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; padding: 5px 0; border-bottom: 1px solid #f1f5f9; }
    .row:last-child { border-bottom: none; }
    .row span { color: #475569; font-weight: 500; }
    .row .v { font-weight: 700; color: #0f172a; }
    footer { margin-top: 40px; font-size: 10px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; font-weight: 500; }
    @media print { body { background: #ffffff; padding: 0; } .container { border: none; box-shadow: none; padding: 0; max-width: 100%; } .panel { page-break-inside: avoid; } .kpi-card { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo-container">
        <div class="logo-mark">E</div>
        <div class="logo-text">
          <div class="brand">EduExpress International</div>
          <div class="brand-sub">Student Consultancy & Recruitment · Dhaka, Bangladesh</div>
        </div>
      </div>
      <div class="report-meta">
        <h1>${e.period.type===`week`?`Weekly`:`Monthly`} Performance Digest</h1>
        <p>${e.period.label} &nbsp;|&nbsp; Executive Summary</p>
      </div>
    </header>

    <div class="kpi-grid">
      ${a(`New leads`,t.new_leads.current,t.new_leads.delta)}
      ${a(`Enrolments`,t.enrolments.current,t.enrolments.delta)}
      ${a(`Revenue`,i(t.revenue.current),t.revenue.delta)}
      ${a(`Remaining Balance`,i(e.cashflow.closing))}
      ${a(`Attendance`,t.attendance.current+`%`)}
    </div>

    <h2>Leads & Interaction Performance</h2>
    <div class="grid-2col">
      <div class="panel">
        <h3>Leads & Status Overview (Numbers)</h3>
        <div class="row"><span>New Leads Sourced</span><span class="v">${e.leads.new}</span></div>
        <div class="row"><span>Contacted (Positive Response)</span><span class="v">${e.leads.by_status?.positive||0}</span></div>
        <div class="row"><span>Office Visits Completed</span><span class="v">${e.leads.by_status?.office_visit||0}</span></div>
        <div class="row"><span>Files Opened (Pipeline)</span><span class="v">${e.leads.by_status?.file_open||0}</span></div>
        <div class="row"><span>No Response (Follow-ups needed)</span><span class="v">${e.leads.by_status?.no_response||0}</span></div>
      </div>
      <div class="panel">
        <h3>Leads Sourced By Segment</h3>
        ${o(e.leads.by_source)}
      </div>
    </div>

    <div class="grid-2col">
      <div class="panel">
        <h3>Leads By Destination Country</h3>
        ${o(e.leads.by_destination)}
      </div>
      <div class="panel">
        <h3>Application Activity Log</h3>
        ${e.applications.stages_advanced.length===0?`<div class="row"><em style="color:#94a3b8">No pipeline stage transitions</em></div>`:e.applications.stages_advanced.slice(0,5).map(e=>`
              <div class="row">
                <span>Advanced to ${e.stage}</span>
                <span class="v">${e.n} times</span>
              </div>
            `).join(``)}
      </div>
    </div>

    <h2>Financial & Cashflow Ledger</h2>
    <div class="kpi-grid">
      ${a(`Opening Bal`,i(e.cashflow.opening))}
      ${a(`Money In`,i(e.cashflow.in))}
      ${a(`Money Out`,i(e.cashflow.out))}
      ${a(`Net Flow`,i(e.cashflow.net))}
      ${a(`Closing Cash`,i(e.cashflow.closing))}
    </div>

    <div class="grid-2col">
      <div class="panel">
        <h3>Primary Income Categories</h3>
        ${o(e.cashflow.income_by_category.slice(0,5),i)}
      </div>
      <div class="panel">
        <h3>Operational Spends Breakdown</h3>
        ${o(e.cashflow.expense_by_category.slice(0,5),i)}
      </div>
    </div>

    <h2>Consultant Attendance & Performance standings</h2>
    <div class="grid-2col">
      <div class="panel">
        <h3>Staff Attendance & Logs Activity</h3>
        <div class="row"><span>Monthly Attendance Average</span><span class="v">${e.attendance.attendance_pct}%</span></div>
        <div class="row"><span>Late Check-in Occurrences</span><span class="v">${e.attendance.late_count}</span></div>
        <div class="row"><span>Daily Worklogs Submitted</span><span class="v">${e.attendance.total_logs}</span></div>
        <div class="row"><span>Total Productive Hours</span><span class="v">${e.attendance.total_hours||0} hrs</span></div>
        <div class="row"><span>Average Daily Shift Duration</span><span class="v">${e.attendance.avg_hours||0} hrs</span></div>
      </div>
      <div class="panel">
        <h3>Top Performance Standings (by Work Score)</h3>
        ${e.top_performers.length===0?`<div class="row"><em style="color:#94a3b8">No activity logs recorded</em></div>`:e.top_performers.map((e,t)=>`
              <div class="row">
                <span>${t+1}. ${e.name}</span>
                <span class="v">${e.points} points · ${e.events} events completed</span>
              </div>
            `).join(``)}
      </div>
    </div>

    ${e.highlights.length?`
      <h2>Executive Summary Highlights</h2>
      <div class="panel">
        <ul style="margin: 0; padding-left: 20px;">
          ${e.highlights.map(e=>`<li style="margin-bottom: 6px;"><strong>${e.icon}</strong> &nbsp;${e.text}</li>`).join(``)}
        </ul>
      </div>
    `:``}

    <footer>
      Generated electronically on ${new Date().toLocaleString(`en-GB`)} · Dhanmondi Office Ledger · Confidential Board Report
    </footer>
  </div>
</body>
</html>`}export{I as default};