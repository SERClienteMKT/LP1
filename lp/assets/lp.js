/* S.E.R. Cliente — comportamento compartilhado das LPs por segmento */
(function(){
  /* ─── CONFIG ───
     LEAD_ENDPOINT: rota do site principal que grava o lead no Google Sheets e
     dispara os e-mails (api/submit-lead.js). Só responde no mesmo domínio que
     serve /lp. Vazio = só mostra a confirmação, sem enviar (útil em prévias). */
  var LEAD_ENDPOINT = '/api/submit-lead';

  /* ─── SCROLL REVEAL ─── */
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){ e.target.classList.add('on'); io.unobserve(e.target); }
    });
  },{threshold:.12});
  document.querySelectorAll('.rv,.flow,.bars,.tl,.pillar,.band').forEach(function(el){ io.observe(el); });

  /* ─── SPOTLIGHT NOS CARDS ─── */
  document.querySelectorAll('.feat').forEach(function(card){
    card.addEventListener('pointermove',function(ev){
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx',(ev.clientX - r.left)+'px');
      card.style.setProperty('--my',(ev.clientY - r.top)+'px');
    });
  });

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ─── BARRA DE PROGRESSO, NAV E PARALLAX (tema claro) ─── */
  var bar = document.querySelector('.progress'), nav = document.querySelector('.nav');
  var px = reduce ? [] : [].slice.call(document.querySelectorAll('[data-parallax]'));
  var ticking = false;
  function frame(){
    ticking = false;
    var h = document.documentElement.scrollHeight - innerHeight;
    if(bar) bar.style.setProperty('--p', h > 0 ? scrollY / h : 0);
    if(nav) nav.classList.toggle('scrolled', scrollY > 20);
    px.forEach(function(el){
      var r = el.getBoundingClientRect();
      if(r.bottom < -200 || r.top > innerHeight + 200) return;
      var d = (r.top + r.height / 2 - innerHeight / 2) * -(+el.dataset.parallax);
      el.style.setProperty('--py', d.toFixed(1) + 'px');
      if(!el.classList.contains('letter')) el.style.transform = 'translate3d(0,' + d.toFixed(1) + 'px,0)';
    });
  }
  addEventListener('scroll', function(){ if(!ticking){ ticking = true; requestAnimationFrame(frame); } }, {passive:true});
  frame();

  /* ─── LINK ATIVO NO MENU ─── */
  var links = document.querySelectorAll('.nav-links a[href^="#"]');
  if(links.length){
    var spy = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(!e.isIntersecting) return;
        links.forEach(function(a){ a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id); });
      });
    },{rootMargin:'-45% 0px -50% 0px'});
    links.forEach(function(a){ var s = document.querySelector(a.getAttribute('href')); if(s) spy.observe(s); });
  }

  /* ─── CONTADORES ─── */
  var cio = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(!e.isIntersecting) return;
      cio.unobserve(e.target);
      var el = e.target, end = +el.dataset.count, t0 = null;
      var fmt = function(n){ return n.toLocaleString('pt-BR'); };
      if(reduce){ el.textContent = fmt(end); return; }
      requestAnimationFrame(function step(t){
        if(!t0) t0 = t;
        var k = Math.min((t - t0) / 1400, 1);
        el.textContent = fmt(Math.round(end * (1 - Math.pow(1 - k, 3))));
        if(k < 1) requestAnimationFrame(step);
      });
    });
  },{threshold:.6});
  document.querySelectorAll('[data-count]').forEach(function(el){ cio.observe(el); });

  /* ─── FAQ COM ABERTURA SUAVE ─── */
  document.querySelectorAll('.faq details').forEach(function(d){
    var sum = d.querySelector('summary'), ans = d.querySelector('.ans');
    if(!ans || reduce) return;
    sum.addEventListener('click', function(ev){
      ev.preventDefault();
      if(d.open){
        var a = ans.animate([{height:ans.offsetHeight+'px',opacity:1},{height:'0px',opacity:0}],{duration:280,easing:'ease'});
        a.onfinish = function(){ d.open = false; };
      } else {
        d.open = true;
        ans.animate([{height:'0px',opacity:0},{height:ans.offsetHeight+'px',opacity:1}],{duration:340,easing:'cubic-bezier(.2,.7,.2,1)'});
      }
    });
  });

  /* ─── IA "DIGITANDO" NO MOCKUP ─── */
  var t = document.querySelector('[data-type]');
  if(t && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    var full = t.getAttribute('data-type'), i = 0;
    t.textContent = '';
    t.classList.add('typing');
    setTimeout(function tick(){
      t.textContent = full.slice(0, ++i);
      if(i < full.length) setTimeout(tick, 22);
      else setTimeout(function(){ t.classList.remove('typing'); }, 1200);
    }, 1600);
  }

  /* ─── CTA FIXO NO MOBILE ─── */
  var sticky = document.querySelector('.sticky-cta');
  var form = document.getElementById('demo');
  if(sticky && form){
    var formVisible = false;
    new IntersectionObserver(function(e){ formVisible = e[0].isIntersecting; onScroll(); }).observe(form);
    function onScroll(){ sticky.classList.toggle('show', scrollY > 600 && !formVisible); }
    addEventListener('scroll', onScroll, {passive:true});
  }

  /* ─── ATRIBUIÇÃO (UTM, gclid, li_fat_id) ─── */
  var KEYS = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','li_fat_id'];
  var qs = new URLSearchParams(location.search), attr = {};
  try { attr = JSON.parse(sessionStorage.getItem('ser_attr') || '{}'); } catch(e){}
  KEYS.forEach(function(k){ if(qs.get(k)) attr[k] = qs.get(k); });
  try { sessionStorage.setItem('ser_attr', JSON.stringify(attr)); } catch(e){}

  /* ─── FORMULÁRIO DE LEAD ─── */
  var f = document.querySelector('form.form');
  if(!f) return;
  f.addEventListener('submit', function(ev){
    ev.preventDefault();
    if(!f.checkValidity()){ f.reportValidity(); return; }
    var btn = f.querySelector('button[type=submit]');
    var err = f.querySelector('.form-err');
    btn.disabled = true;
    if(err) err.hidden = true;
    var d = Object.fromEntries(new FormData(f).entries());
    /* Campos no formato de api/submit-lead (name, company, email, phone, website);
       os demais vão como extras para registrar segmento, porte e origem. */
    var lead = Object.assign({
      name: d.nome,
      company: d.empresa,
      email: d.email,
      phone: d.telefone,
      website: d.website || '',
      role: d.cargo,
      size: d.unidades || d.concessoes || d.alunos || '',
      segment: f.dataset.segmento,
      page: location.pathname,
      referrer: document.referrer || ''
    }, attr);

    var done = function(){
      f.classList.add('sent');
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event:'generate_lead', lead_segment: f.dataset.segmento });
      if(window.lintrk && f.dataset.liConversion) window.lintrk('track', { conversion_id: +f.dataset.liConversion });
    };
    if(!LEAD_ENDPOINT){ console.info('[S.E.R.] LEAD_ENDPOINT vazio — lead não enviado:', lead); done(); return; }
    fetch(LEAD_ENDPOINT, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(lead) })
      .then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); done(); })
      .catch(function(){ btn.disabled = false; if(err) err.hidden = false; });
  });
})();
