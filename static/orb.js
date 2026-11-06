'use strict';
// Living bubble: one WebGL canvas and one draw call replace the CSS ribbons and particles.
// A ball is the centre of gravity and the material moves around it following its own physics:
// pastel = water drop and ballistic droplets, dark = plasma ball, matrix = glyph accretion,
// investigation = smoke atmosphere in differential rotation, fire = burning ball and rising flames and the shape follows the assistant's state and the real voice level.
// Without WebGL, or once the context is lost for good, the CSS bubble stays in place.
(() => {
  const companion = document.getElementById('companion'), bubble = document.getElementById('bubble');
  if (!companion || !bubble) return;
  const MATERIALS = {
    pastel: {id: 0, light: '#8ff3ff', mid: '#22b8e8', hot: '#ffffff', base: '#0b4f9c'},
    dark: {id: 1, light: '#ff4fe0', mid: '#a326ff', hot: '#ffd2ff', base: '#14031f'},
    matrix: {id: 2, light: '#b9ffd8', mid: '#1fd58a', hot: '#eafff3', base: '#020c07'},
    investigation: {id: 3, light: '#ece9e4', mid: '#9a959a', hot: '#ffffff', base: '#16151a'},
    fire: {id: 4, light: '#ff9a1f', mid: '#f0400f', hot: '#ffeeb0', base: '#8c1208'}
  };
  const LIFE = 0.7; // Vivacity chosen for 0.7: organic, without distracting from the interview.
  const IDLE_FRAME_MS = 1000 / 30; // Rest and breathing states are drawn at 30 images per second.

  const VERTEX = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  // Shared with Android: scripts/orb_agsl.py turns this GLSL into AGSL for the native overlay bubble.
  const FRAGMENT = `precision highp float;
uniform vec2 uRes;uniform float uTime,uAmp,uEnergy,uAlert,uSeed,uLife;uniform int uMat;
uniform vec3 uLight,uMid,uHot,uBase;
float hash3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vnoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
return mix(mix(mix(hash3(i),hash3(i+vec3(1.,0.,0.)),f.x),mix(hash3(i+vec3(0.,1.,0.)),hash3(i+vec3(1.,1.,0.)),f.x),f.y),
mix(mix(hash3(i+vec3(0.,0.,1.)),hash3(i+vec3(1.,0.,1.)),f.x),mix(hash3(i+vec3(0.,1.,1.)),hash3(i+vec3(1.,1.,1.)),f.x),f.y),f.z);}
float fbm(vec3 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vnoise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}
void main(){
 float px=2./min(uRes.x,uRes.y);
 vec2 uv=(gl_FragCoord.xy-.5*uRes)*px;
 float t=uTime*(.55+.6*uLife)+uSeed;
 float r=length(uv);vec2 dir=uv/max(r,1e-4);
 float breath=.012*sin(t*.8);
 vec3 col=vec3(0.);float alpha=0.;
 float ang=atan(uv.y,uv.x);
 vec3 L=normalize(vec3(-.45,.6,.65));
 if(uMat==0){
  // Water: a drop held by surface tension. Its outline oscillates in low modes; droplets are thrown
  // from the surface and fall back under the ball's gravity (ballistic arcs), merging on impact.
  float R=.4+breath+uAmp*.03;
  float wob=.028*sin(3.*ang+t*1.7)+.022*sin(5.*ang-t*2.3)+.012*sin(8.*ang+t*3.1)+.025*(vnoise(vec3(dir*3.,t))-.5)+uAmp*.035*sin(7.*ang+t*7.);
  float field=R+wob-r;
  float drops=-1.;
  for(int i=0;i<8;i++){
   float fi=float(i);
   float cycle=t*(.35+.12*hash3(vec3(fi,3.,1.)))*(1.+.8*uEnergy+.6*uAmp)+hash3(vec3(fi,1.,9.));
   float ph=fract(cycle),round_=floor(cycle);
   float a=6.2832*hash3(vec3(fi,round_,4.));
   vec2 d0=vec2(cos(a),sin(a));
   float hmax=.12+.12*hash3(vec3(fi,round_,7.))+uAmp*.12;
   float h=4.*hmax*ph*(1.-ph);
   float rad=.022+.018*hash3(vec3(fi,2.,2.));
   vec2 c0=d0*(R+h+rad*.5)+vec2(-d0.y,d0.x)*.08*(ph-.5);
   float drop=rad-length(uv-c0);
   drops=max(drops,drop);
   float k=28.;field=log(exp(k*field)+exp(k*drop))/k;
  }
  float inside=smoothstep(-px*1.2,px*1.2,field);
  vec2 q=uv/R;float z=sqrt(max(0.,1.-dot(q,q)));vec3 n=normalize(vec3(q,z+.001));
  float dif=dot(n,L);
  vec3 c=mix(uMid,uLight,step(.25,dif));
  c=mix(c,uBase*1.2,step(dif,-.25)*.7);
  float s=fbm(vec3(q*2.2,t*.5));
  c=mix(c,mix(uLight,vec3(1.),.6),smoothstep(.02,.0,abs(s-.55))*step(.1,z));
  c=mix(c,vec3(1.),smoothstep(.93,.97,dot(reflect(-L,n),vec3(0.,0.,1.))));
  c=mix(c,mix(uLight,vec3(1.),.4),smoothstep(.035,.0,field)*.8);
  c=mix(c,uLight,step(R*1.02,r)*.6);
  col=c*inside;alpha=inside;
 }else if(uMat==1){
  // Electricity: a plasma ball. Arcs crawl across a dark core, the rim crackles,
  // and from time to time a discharge escapes outward.
  float R=.52+breath+uAmp*.04;
  float inside=smoothstep(R+.03,R-.1,r);
  float haze=fbm(vec3(uv*2.4,t*.3));
  col+=mix(uBase*2.,uMid*.28,haze)*inside*(.3+.7*smoothstep(0.,R,r));
  alpha+=inside*.75;
  float bolts=0.,escape=0.;
  for(int i=0;i<3;i++){
   float fi=float(i);
   vec3 p=vec3(uv*(1.5+fi*.8),t*(.9+fi*.35)+fi*7.);
   float f=fbm(p+fbm(p*1.7)*.9)+(vnoise(p*9.)-.5)*.07;
   float w=.005+.005*uEnergy+.003*uAmp;
   float dist=abs(f-.5);
   float line=(smoothstep(w*1.6,0.,dist)*1.4+w*.6/(dist+w))*(.8-fi*.2);
   bolts+=line;escape+=line;
  }
  bolts*=inside*smoothstep(.0,.3,r);
  float gate=smoothstep(.62-.2*uEnergy-.15*uAmp,.8,vnoise(vec3(dir*2.5,t*1.6)));
  escape*=gate*smoothstep(R-.02,R+.02,r)*exp(-max(r-R,0.)*9.);
  float jitter=(vnoise(vec3(dir*5.,t*4.))-.5)*.08*(1.+uEnergy+uAmp)+(vnoise(vec3(dir*17.,t*7.))-.5)*.025;
  float rim=.005/(abs(r-R-jitter)+.005);
  float flick=.65+.35*vnoise(vec3(uTime*19.,uSeed,1.));
  vec3 white=mix(uHot,vec3(1.),.65);
  float rimCore=smoothstep(.012,.0,abs(r-R-jitter));
  bolts+=escape;
  col+=(uLight*min(bolts,2.)*.55+white*smoothstep(.8,1.6,bolts)*.9+uLight*rim*.35+white*rimCore*.9)*flick;
  col+=uMid*exp(-max(r-R,0.)*10.)*.35*(.6+uEnergy+uAmp)*smoothstep(R-.12,R,r);
  alpha=max(alpha,clamp(max(col.r,max(col.g,col.b)),0.,1.));
 }else if(uMat==2){
  // Data: a core covered in glyphs; streams of signs spiral in, pulled by the core (accretion).
  float R=.36+breath;
  float inside=smoothstep(R+px,R-px,r);
  vec2 q=uv/R;float z=sqrt(max(0.,1.-dot(q,q)));
  float sp=t*.2;vec2 pxz=mat2(cos(sp),-sin(sp),sin(sp),cos(sp))*vec2(q.x,z);vec3 p=vec3(pxz.x,q.y,pxz.y);
  vec2 sg=vec2(atan(p.x,p.z)*2.6,asin(clamp(p.y,-1.,1.))*3.2);
  vec2 sc=floor(sg),sf=fract(sg);
  float sbit=step(.5,hash3(vec3(sc*2.3+floor(sf*vec2(3.,4.))*.7,floor(uTime*2.+hash3(vec3(sc,4.))*9.))))*step(.12,sf.x)*step(sf.x,.88)*step(.1,sf.y)*step(sf.y,.9);
  vec3 core=uBase*1.5+uMid*sbit*(.35+.65*z)*.9+uLight*pow(1.-z,3.)*.6;
  float lr=log(max(r,.02)/R);
  float th=ang/6.2832;
  float N=24.;
  vec2 g=vec2(th*N+lr*3.,lr*7.+t*(1.1+1.5*uEnergy+uAmp));
  vec2 cid=floor(g),cf=fract(g);
  float lane=step(.55,hash3(vec3(mod(cid.x,N),3.,1.)+floor(t*.15+hash3(vec3(mod(cid.x,N),8.,8.)))));
  float bit=step(.45,hash3(vec3(mod(cid.x,N),cid.y,floor(uTime*4.))+vec3(floor(cf*vec2(3.,4.))*.5,0.)));
  float cell=step(.15,cf.x)*step(cf.x,.85)*step(.1,cf.y)*step(cf.y,.9);
  float head=smoothstep(.75,1.,fract(cid.y*.13+hash3(vec3(mod(cid.x,N),1.,5.))));
  float outside=step(R,r)*exp(-max(r-R,0.)*3.2)*smoothstep(.95,.7,r);
  vec3 stream=(uMid+mix(uLight,vec3(1.),.5)*head*1.3)*bit*cell*lane*outside*(1.+uAmp*.7);
  col=core*inside+stream*(1.-inside)+uMid*exp(-max(r-R,0.)*14.)*.35;
  alpha=clamp(inside+max(stream.g,col.g*.6)*(1.-inside),0.,1.);
 }else if(uMat==3){
  // Smoke: a dark smoke ball wrapped in an atmosphere of wisps. Inner layers turn faster than
  // outer ones (differential rotation), which stretches the smoke into curling spirals.
  float R=.38+breath+uAmp*.03;
  float rr=max(r,.05);
  float omega=.3*pow(R/rr,.8)*(1.+uEnergy);
  float sa=t*.3*omega;
  vec2 turb=vec2(fbm(vec3(uv*1.3,t*.08)),fbm(vec3(uv*1.3+4.,t*.08)))-.5;
  vec2 ruv=mat2(cos(sa),-sin(sa),sin(sa),cos(sa))*(uv+turb*.35);
  vec3 p=vec3(ruv*1.7,t*.12);
  float w=fbm(p+fbm(p*1.6)*1.5);
  float d=fbm(vec3(ruv*3.+w*1.8,t*.15));
  float env=exp(-max(r-R,0.)*(4.2-uAmp*1.5));
  float inside=smoothstep(R+.04,R-.06,r+(d-.5)*.12);
  float dens=clamp(smoothstep(.38,.72,d)*env*1.25+inside,0.,1.);
  float mask=smoothstep(.12,.35,dens);
  vec3 c=mix(uLight,uMid,smoothstep(.3,.75,dens));
  c=mix(c,uBase,smoothstep(.7,1.,dens)*(.4+.6*inside));
  float curl=abs(fract(d*5.+w*2.)-.5)*2.;
  c=mix(c,mix(uLight,vec3(1.),.3),smoothstep(.13,.0,curl)*smoothstep(.3,.8,dens)*.55*(1.-inside));
  c=mix(c,mix(uBase,uMid,.35+.3*w),inside*.85);
  c=mix(c,uLight*.9,inside*smoothstep(R-.1,R,r)*.5);
  c=mix(c,uLight*1.05,smoothstep(.35,.12,dens)*mask*.6);
  alpha=mask*(.7+.3*dens);
  col=c*alpha;
 }else{
  // Fire: a burning ball. Its surface churns; flames rise outward from it (convection),
  // each tongue living and dying at random around the ball.
  float R=.33+breath+uAmp*.02;
  vec2 q=uv/R;float z=sqrt(max(0.,1.-dot(q,q)));
  float sa=t*.12;vec2 nxz=mat2(cos(sa),-sin(sa),sin(sa),cos(sa))*vec2(q.x,z);vec3 n=vec3(nxz.x,q.y,nxz.y);
  float heat=clamp(fbm(n*3.+vec3(0.,0.,t*.45))*.9+fbm(n*6.-vec3(t*.35))*.45,0.,1.);
  vec3 surf=mix(uMid,uLight,smoothstep(.3,.7,heat));
  surf=mix(surf,uHot,smoothstep(.65,.95,heat));
  surf=mix(uBase,surf,.55+.45*z);
  float inside=smoothstep(R+px,R-px,r);
  float h=max(r-R,0.)/R;
  float fl=fbm(vec3(dir*2.4,h*1.8-t*1.2));
  float fl2=fbm(vec3(dir*6.,h*3.6-t*2.));
  float top=.25+.9*fl*fl+.35*fl2+uAmp*.45+uEnergy*.2;
  float I=clamp((top-h)/max(top,.05),0.,1.)*(.55+.7*fl2);
  I=clamp(I,0.,1.);
  vec3 c=mix(uBase*.7,uBase,smoothstep(.0,.2,I));
  c=mix(c,uMid,smoothstep(.15,.45,I));
  c=mix(c,uLight,smoothstep(.45,.75,I));
  c=mix(c,uHot,smoothstep(.85,1.,I));
  float fa=smoothstep(.02,.25,I)*step(R-px,r);
  col=surf*inside+c*fa*(1.-inside);
  alpha=clamp(inside+fa*(1.-inside),0.,1.);
 }
 // A follow-up is ready: a warm, slow pulse around any material.
 float pulse=.5+.5*sin(uTime*6.5);
 vec3 warm=vec3(1.,.62,.38);
 float halo=exp(-max(r-.55,0.)*7.)*uAlert*pulse*.55*smoothstep(.35,.6,r);
 col+=warm*halo;alpha=clamp(max(alpha,halo),0.,1.);
 gl_FragColor=vec4(col,alpha);
}`;

  const canvas = document.createElement('canvas');
  canvas.className = 'orb-canvas'; canvas.setAttribute('aria-hidden', 'true');
  bubble.prepend(canvas);
  const seed = Math.random() * 50;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let gl = null, uniforms = {}, raf = 0, rafView = null, lastFrame = 0, lastDraw = 0;
  let amp = 0, energy = 0, alert = 0;
  // Voice level: from an analysed microphone stream when there is one, otherwise short pulses on recognised speech.
  let analyser = null, audioContext = null, samples = null, pulseLevel = 0, pulseAt = 0;

  const hex = value => { const n = parseInt(value.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  // Software or emulated GPUs (SwiftShader, llvmpipe, Android emulator…) can freeze the page:
  // the CSS bubble stays there, unless the viewer asked for WebGL (localStorage "interprete-orb" = "webgl").
  function softwareRenderer(context) {
    try {
      const info = context.getExtension('WEBGL_debug_renderer_info');
      const name = String(context.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : context.RENDERER));
      // Emulated or virtual GPUs (Android emulator, VMs) are listed too: they can freeze the whole device.
      return /swiftshader|llvmpipe|softpipe|software|basic render|emulator|gfxstream|translator|virgl|vmware|virtualbox|parallels/i.test(name);
    } catch { return false; }
  }
  function forced() { try { return localStorage.getItem('interprete-orb') === 'webgl'; } catch { return false; } }
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function setup() {
    // On Android, ask the app first: creating a context on an emulated GPU can already crash the renderer.
    try { if (window.InterpreteNative?.emulatedGpu?.() && !forced()) return false; } catch { /* Older bridge: carry on. */ }
    gl = canvas.getContext('webgl', {alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power'});
    if (!gl) return false;
    if (softwareRenderer(gl) && !forced()) { gl.getExtension('WEBGL_lose_context')?.loseContext(); gl = null; return false; }
    const shader = (type, source) => { const value = gl.createShader(type); gl.shaderSource(value, source); gl.compileShader(value); return value; };
    try {
      const program = gl.createProgram();
      gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX)); gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      // Compile without blocking the page when the browser allows it; the CSS bubble shows meanwhile.
      const parallel = gl.getExtension('KHR_parallel_shader_compile');
      if (parallel) {
        const limit = performance.now() + 8000;
        while (!gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) {
          if (performance.now() > limit) throw new Error('Shader de la bulle trop lent à préparer.');
          await pause(50);
        }
      } else await pause(0);
      if (!gl || !gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shader de la bulle refusé.');
      gl.useProgram(program);
      const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'a'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      uniforms = {};
      for (const name of ['uRes', 'uTime', 'uAmp', 'uEnergy', 'uAlert', 'uSeed', 'uLife', 'uMat', 'uLight', 'uMid', 'uHot', 'uBase']) uniforms[name] = gl.getUniformLocation(program, name);
      gl.clearColor(0, 0, 0, 0);
      return true;
    } catch { gl?.getExtension('WEBGL_lose_context')?.loseContext(); gl = null; return false; }
  }
  // Watchdog: if the device cannot keep about 12 images per second, return to the CSS bubble for good.
  let watchStart = 0, watchFrames = 0, watched = false;
  function giveUp() {
    if (raf) { rafView?.cancelAnimationFrame(raf); raf = 0; }
    companion.classList.remove('orb-gl');
    const context = gl; gl = null; context?.getExtension('WEBGL_lose_context')?.loseContext();
    canvas.remove();
  }
  function watch(now, delta) {
    if (watched || reduceMotion?.matches) return;
    if (!watchStart || delta > .5) { watchStart = now; watchFrames = 0; return; }
    watchFrames++;
    const elapsed = (now - watchStart) / 1000;
    if (elapsed >= 2.5) { watched = true; if (watchFrames / elapsed < 12) giveUp(); }
  }

  function voiceLevel(now) {
    if (analyser) {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0; for (const value of samples) sum += value * value;
      const decibels = 10 * Math.log10(sum / samples.length + 1e-10);
      return Math.max(0, Math.min(1, (decibels + 55) / 40));
    }
    return pulseLevel * Math.max(0, 1 - (now - pulseAt) / 450);
  }
  function visible() {
    const doc = companion.ownerDocument;
    return canvas.isConnected && !doc.hidden && canvas.getClientRects().length > 0;
  }
  function draw(now, delta) {
    const listening = companion.classList.contains('is-listening');
    const targetAmp = listening ? voiceLevel(now) : 0;
    const targetEnergy = companion.classList.contains('is-busy') ? 1 : listening ? 0.15 : 0;
    const targetAlert = companion.classList.contains('has-followup') ? 1 : 0;
    const still = reduceMotion?.matches;
    const fast = still ? 1 : 1 - Math.exp(-delta * (targetAmp > amp ? 14 : 5)), slow = still ? 1 : 1 - Math.exp(-delta * 2.5);
    amp += (targetAmp - amp) * fast; energy += (targetEnergy - energy) * slow; alert += (targetAlert - alert) * slow;
    // Phones have dense screens: 1.5 pixels per CSS pixel is enough for a small bubble.
    const ratio = Math.min(companion.ownerDocument.defaultView.devicePixelRatio || 1, window.InterpreteNative ? 1.5 : 2);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio)), height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const material = MATERIALS[companion.ownerDocument.documentElement.dataset.theme] || MATERIALS.pastel;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(uniforms.uRes, width, height); gl.uniform1f(uniforms.uTime, still ? 14 : now / 1000);
    gl.uniform1f(uniforms.uAmp, amp); gl.uniform1f(uniforms.uEnergy, energy); gl.uniform1f(uniforms.uAlert, alert);
    gl.uniform1f(uniforms.uSeed, seed); gl.uniform1f(uniforms.uLife, LIFE); gl.uniform1i(uniforms.uMat, material.id);
    gl.uniform3fv(uniforms.uLight, hex(material.light)); gl.uniform3fv(uniforms.uMid, hex(material.mid));
    gl.uniform3fv(uniforms.uHot, hex(material.hot)); gl.uniform3fv(uniforms.uBase, hex(material.base));
    gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
    return amp > 0.02 || energy > 0.02 || alert > 0.02;
  }
  function frame(now) {
    raf = 0;
    if (!gl || !visible()) return;
    const delta = Math.min(0.1, (now - (lastFrame || now)) / 1000); lastFrame = now;
    // Faster states get every frame; rest is capped at 30 images per second.
    const busy = amp > 0.02 || energy > 0.02 || alert > 0.02 || companion.classList.contains('is-listening');
    if (busy || now - lastDraw >= IDLE_FRAME_MS - 1) { const since = (now - lastDraw) / 1000; draw(now, Math.max(delta, since)); lastDraw = now; watch(now, since); if (!gl) return; }
    if (reduceMotion?.matches) return; // One still image of the material.
    rafView = companion.ownerDocument.defaultView; raf = rafView.requestAnimationFrame(frame);
  }
  // The companion can move into a floating window: always schedule on the window that shows it.
  function wake() {
    if (!gl) return;
    if (raf && rafView !== companion.ownerDocument.defaultView) { rafView?.cancelAnimationFrame(raf); raf = 0; }
    if (!raf && visible()) { lastFrame = 0; rafView = companion.ownerDocument.defaultView; raf = rafView.requestAnimationFrame(frame); }
  }

  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); gl = null; companion.classList.remove('orb-gl'); });
  canvas.addEventListener('webglcontextrestored', () => { setup().then(ready => { if (ready) { companion.classList.add('orb-gl'); wake(); } }); });
  setup().then(ready => { if (!ready) { canvas.remove(); return; } companion.classList.add('orb-gl'); wake(); });

  // Restart on anything that can make the bubble visible or change its state or theme.
  new MutationObserver(wake).observe(companion, {attributes: true, attributeFilter: ['class', 'hidden']});
  new MutationObserver(wake).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  document.addEventListener('visibilitychange', wake);
  reduceMotion?.addEventListener?.('change', wake);
  window.addEventListener('resize', wake);

  window.InterpreteOrb = {
    // A microphone stream (desktop capture) drives the membrane directly.
    attachStream(stream) {
      try {
        this.detachStream();
        const Context = window.AudioContext || window.webkitAudioContext; if (!Context) return;
        audioContext = new Context();
        const node = audioContext.createAnalyser(); node.fftSize = 512;
        audioContext.createMediaStreamSource(stream).connect(node);
        analyser = node; samples = new Float32Array(node.fftSize); wake();
      } catch { this.detachStream(); }
    },
    detachStream() {
      analyser = null; samples = null;
      if (audioContext) { audioContext.close().catch(() => {}); audioContext = null; }
    },
    // Without a stream (browser speech recognition, Android), recognised speech gives short pulses.
    pulse(strength = 0.6) { pulseLevel = Math.max(0, Math.min(1, strength)); pulseAt = performance.now(); wake(); },
    setLevel(value) { this.pulse(value); }
  };
  wake();
})();
