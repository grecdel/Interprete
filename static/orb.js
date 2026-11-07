'use strict';
// Living bubble: one WebGL canvas and one draw call replace the CSS ribbons and particles.
// A particle sphere (dotted sphere, ribbons of dotted strands, a ring of dust, a soft glow) in the
// theme's colours. Rest pulses slowly, listening tilts it forward and makes it ripple, analysis
// spins it fast with sweeping waves, a follow-up makes it burst then settle. Each state has its own
// motion: slow at rest, voice-driven while listening, a fast vortex and a scanning ring during
// analysis, a heartbeat and a shock wave when a follow-up is ready. and the shape follows the assistant's state and the real voice level.
// Without WebGL, or once the context is lost for good, the CSS bubble stays in place.
(() => {
  const companion = document.getElementById('companion'), bubble = document.getElementById('bubble');
  if (!companion || !bubble) return;
  // One particle sphere for every theme; only the colours change.
  const MATERIALS = {
    pastel: {id: 0, light: '#7fe6ff', mid: '#8f7dff', hot: '#ff9fd6', base: '#5a7bd8'},
    dark: {id: 1, light: '#46f0c8', mid: '#9b5cff', hot: '#ff6fd8', base: '#2a1460'},
    matrix: {id: 2, light: '#6dffb0', mid: '#19c27a', hot: '#d4ff93', base: '#04351d'},
    investigation: {id: 3, light: '#f1e3cf', mid: '#b9a58f', hot: '#ffffff', base: '#4a4038'},
    fire: {id: 4, light: '#ffb23e', mid: '#ff5a1f', hot: '#ffe7a3', base: '#6a1408'}
  };
  const LIFE = 0.7; // Vivacity chosen for 0.7: organic, without distracting from the interview.
  const IDLE_FRAME_MS = 1000 / 30; // Rest and breathing states are drawn at 30 images per second.

  const VERTEX = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  // Shared with Android: scripts/orb_agsl.py turns this GLSL into AGSL for the native overlay bubble.
  const FRAGMENT = `precision highp float;
uniform vec2 uRes;uniform float uTime,uAmp,uEnergy,uAlert,uListen,uSeed,uLife,uBurst;uniform int uMat;
uniform vec3 uLight,uMid,uHot,uBase;
float hash3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
mat2 rot2(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
vec3 rotX(vec3 p,float a){vec2 yz=rot2(a)*vec2(p.y,p.z);return vec3(p.x,yz.x,yz.y);}
vec3 rotY(vec3 p,float a){vec2 xz=rot2(a)*vec2(p.x,p.z);return vec3(xz.x,p.y,xz.y);}
vec2 isph(vec3 ro,vec3 rd,float R){float b=dot(ro,rd);float c=dot(ro,ro)-R*R;float h=b*b-c;if(h<0.)return vec2(-1.);h=sqrt(h);return vec2(-b-h,-b+h);}
vec3 proj(vec3 p){float w=3.-p.z;return vec3(p.xy/(w*.36),w);}
// Distance to a segment (x) and position along it (y).
vec2 segd(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;float s=clamp(dot(pa,ba)/max(dot(ba,ba),1e-7),0.,1.);return vec2(length(pa-ba*s),s);}
void main(){
 float px=2./min(uRes.x,uRes.y);
 vec2 uv=(gl_FragCoord.xy-.5*uRes)*px;
 float t=uTime*(.5+.5*uLife)+uSeed+float(uMat)*1.7;
 float burst=uBurst>=0.?uBurst:99.;
 float boom=exp(-burst*2.2);
 float flash=exp(-burst*9.);
 float speed=.22+.2*uListen+1.8*uEnergy+.5*boom;
 float breath=sin(uTime*(1.05+.45*uListen))*(.022+.035*uListen+.045*uAmp);
 float R=.5*(1.+breath)*(1.+.14*boom);
 float tilt=.3*uListen+.06*uEnergy*sin(uTime*3.1);
 float spin=t*speed;
 float bright=.72+.4*uEnergy+.2*uListen+.15*uAlert+1.4*flash;
 vec3 ro=vec3(0.,0.,3.);vec3 rd=normalize(vec3(uv*.36,-1.));
 vec3 col=vec3(0.);float alpha=0.;
 float r=length(uv);float Rs=R/(3.*.36);
 // Soft glow behind the sphere.
 float glow=exp(-max(r-Rs*.5,0.)*2.6)*(.2+.07*sin(uTime*1.05)+.2*uEnergy+.7*boom);
 col+=mix(uBase,uMid,.45)*glow;alpha+=glow*.55;
 // Dotted sphere: front dots bright, back dots seen through, rim brighter.
 vec2 h=isph(ro,rd,R);
 if(h.x>0.){
  for(int k=0;k<2;k++){
   float tm=k==0?h.x:h.y;
   vec3 p=ro+rd*tm;
   vec3 q=rotY(rotX(p,tilt),spin*.55);
   vec3 n=normalize(q);
   float lat=asin(clamp(n.y,-1.,1.)),lon=atan(n.x,n.z);
   float wave=sin(lat*6.+uTime*2.2)*.45*uListen*(.5+uAmp)+sin(lon*4.-uTime*4.)*.35*uEnergy;
   vec2 g=vec2(lon*34./3.1416,lat*30./3.1416+wave);
   vec2 f=fract(g)-.5;
   float dotm=smoothstep(.2,.04,length(f));
   float facing=k==0?1.:.32;
   vec3 sw=normalize(vec3(cos(uTime*2.4),sin(uTime*1.6)*.6,sin(uTime*2.4)));
   float sweep=uEnergy*(smoothstep(.14,.0,abs(dot(n,sw)))*1.8+smoothstep(.1,.0,abs(dot(n,sw.zxy)))*1.2);
   float rim=pow(1.-abs(dot(normalize(p),-rd)),2.);
   vec3 c=mix(uLight,uMid,.5+.5*n.y);
   c=mix(c,uHot,sweep*.4);
   float b=dotm*(.4+.7*rim+sweep)*facing*bright;
   col+=c*b;alpha+=b*.8;
  }
 }
 // Ribbons of dotted strands winding around and through the sphere.
 for(int j=0;j<3;j++){
  float fj=float(j);
  vec3 ax=normalize(vec3(sin(fj*2.1+.3),cos(fj*1.7+.2),sin(fj*1.3+1.)));
  vec3 bx=normalize(cross(ax,vec3(.2,1.,.3)));vec3 cx=cross(ax,bx);
  float u0=t*speed*(1.2+.35*fj)+fj*2.1;
  float span=2.4+.6*sin(t*.2+fj);
  for(int k=0;k<8;k++){
   float fk=float(k)/7.-.5;
   vec3 pp=vec3(0.);
   for(int i=0;i<18;i++){
    float s=float(i)/17.;
    float u=u0+s*span;
    vec3 dir=bx*cos(u)+cx*sin(u);
    float rr=R*(.82+.32*sin(u*2.+fj*1.7+t*.25))*(1.+boom*.9);
    float tw=u*1.6+t*.6+fj;
    float wdt=R*.55*sin(3.1416*s);
    vec3 p3=dir*rr+(ax*cos(tw)+dir*sin(tw))*fk*wdt;
    p3=rotY(rotX(p3,tilt),spin*.3);
    if(i>0){
     vec3 a=proj(pp),b=proj(p3);
     vec2 sd=segd(uv,a.xy,b.xy);float d=sd.x,sp=sd.y;
     float ss=s-sp/17.;
     float dotted=.45+.55*smoothstep(.3,.0,abs(fract((ss*span+fk)*9.-t*1.5)-.5));
     float depth=smoothstep(3.6,2.4,mix(a.z,b.z,sp));
     float line=(smoothstep(.004,.0,d)+.25*smoothstep(.014,.0,d))*sin(3.1416*ss)*dotted*(.35+.65*depth);
     vec3 c=mix(uLight,uHot,ss);c=mix(c,uMid,.5+.5*fk);
     col+=c*line*bright*1.4;alpha+=line*.85;
    }
    pp=p3;
   }
  }
 }
 // A ring of dust drifting around; it spins during analysis and bursts out on a follow-up.
 for(int i=0;i<70;i++){
  float fi=float(i);
  vec3 d=normalize(vec3(hash3(vec3(fi,1.,7.)),hash3(vec3(fi,2.,7.))*.5+.25,hash3(vec3(fi,3.,7.)))-.5);
  float rr=R*(1.22+.3*hash3(vec3(fi,4.,4.)))*(1.+boom*2.4);
  vec3 p3=rotY(d*rr,t*speed*(.6+.4*hash3(vec3(fi,5.,5.)))+fi);
  p3=rotX(p3,tilt);
  vec3 a=proj(p3);
  float sz=(.0045+.004*hash3(vec3(fi,6.,6.)))*(1.+boom);
  float tw=.55+.45*sin(uTime*(1.5+hash3(vec3(fi,8.,8.))*3.)+fi);
  float pt=smoothstep(sz,.0,length(uv-a.xy))*tw*(.5+.5*smoothstep(3.6,2.4,a.z));
  col+=mix(uMid,uHot,hash3(vec3(fi,9.,9.)))*pt*bright*1.3;alpha+=pt;
 }
 // A speckled halo of fine dust around the sphere.
 float ang=atan(uv.y,uv.x)+t*speed*.4;
 vec2 cell=floor(vec2(ang*60.,r*90.));
 float speck=step(.9,hash3(vec3(cell,floor(uTime*3.+hash3(vec3(cell,2.))*6.))))*smoothstep(.16,.0,abs(r-Rs*(1.18+.5*boom)))*.6;
 col+=mix(uMid,uHot,.35)*speck*bright;alpha+=speck*.6;
 // Follow-up: a white flash and a ring of light leaving the sphere.
 float ringR=Rs*(1.+burst*1.6);
 float ring=smoothstep(.03,.0,abs(r-ringR))*boom;
 col+=mix(uHot,vec3(1.),.6)*(ring+flash*.35*exp(-r*2.));alpha+=ring+flash*.3*exp(-r*2.);
 alpha=clamp(alpha,0.,1.);
 gl_FragColor=vec4(col,alpha);
}`;

  const canvas = document.createElement('canvas');
  canvas.className = 'orb-canvas'; canvas.setAttribute('aria-hidden', 'true');
  bubble.prepend(canvas);
  const seed = Math.random() * 50;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let gl = null, uniforms = {}, raf = 0, rafView = null, lastFrame = 0, lastDraw = 0;
  let amp = 0, energy = 0, alert = 0, listen = 0;
  // Follow-up ready: an energy burst when it starts, then calm (uBurst = seconds since the burst).
  let burstAt = -1, wasAlert = false;
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
      for (const name of ['uRes', 'uTime', 'uAmp', 'uEnergy', 'uAlert', 'uListen', 'uBurst', 'uSeed', 'uLife', 'uMat', 'uLight', 'uMid', 'uHot', 'uBase']) uniforms[name] = gl.getUniformLocation(program, name);
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
    if (targetAlert && !wasAlert) burstAt = now; wasAlert = !!targetAlert;
    const burst = burstAt < 0 ? -1 : (now - burstAt) / 1000;
    const still = reduceMotion?.matches;
    const fast = still ? 1 : 1 - Math.exp(-delta * (targetAmp > amp ? 14 : 5)), slow = still ? 1 : 1 - Math.exp(-delta * 2.5);
    amp += (targetAmp - amp) * fast; energy += (targetEnergy - energy) * slow; alert += (targetAlert - alert) * slow;
    listen += ((listening ? 1 : 0) - listen) * slow;
    // Phones have dense screens: 1.5 pixels per CSS pixel is enough for a small bubble.
    const ratio = Math.min(companion.ownerDocument.defaultView.devicePixelRatio || 1, window.InterpreteNative ? 1.5 : 2);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio)), height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const material = MATERIALS[companion.ownerDocument.documentElement.dataset.theme] || MATERIALS.pastel;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(uniforms.uRes, width, height); gl.uniform1f(uniforms.uTime, still ? 14 : now / 1000);
    gl.uniform1f(uniforms.uAmp, amp); gl.uniform1f(uniforms.uEnergy, energy); gl.uniform1f(uniforms.uAlert, alert); gl.uniform1f(uniforms.uListen, listen); gl.uniform1f(uniforms.uBurst, still ? -1 : burst);
    gl.uniform1f(uniforms.uSeed, seed); gl.uniform1f(uniforms.uLife, LIFE); gl.uniform1i(uniforms.uMat, material.id);
    gl.uniform3fv(uniforms.uLight, hex(material.light)); gl.uniform3fv(uniforms.uMid, hex(material.mid));
    gl.uniform3fv(uniforms.uHot, hex(material.hot)); gl.uniform3fv(uniforms.uBase, hex(material.base));
    gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
    return amp > 0.02 || energy > 0.02 || alert > 0.02 || listen > 0.02 || (burst >= 0 && burst < 3);
  }
  function frame(now) {
    raf = 0;
    if (!gl || !visible()) return;
    const delta = Math.min(0.1, (now - (lastFrame || now)) / 1000); lastFrame = now;
    // Faster states get every frame; rest is capped at 30 images per second.
    const busy = amp > 0.02 || energy > 0.02 || alert > 0.02 || companion.classList.contains('is-listening') || (burstAt >= 0 && now - burstAt < 3000);
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
