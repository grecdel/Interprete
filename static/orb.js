'use strict';
// Living bubble: one WebGL canvas and one draw call replace the CSS ribbons and particles.
// The material follows the theme (pastel = water splash, dark = plasma ball, matrix = glyph rain,
// investigation = ink smoke, fire = flames) and the shape follows the assistant's state and the real voice level.
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
 if(uMat==0){
  // Water: a cartoon splash. Crisp body, tongues thrown upward, droplets, white streaks.
  float n1=vnoise(vec3(dir*2.2,t*.8)),n2=vnoise(vec3(dir*5.,t*1.6+3.));
  float up=smoothstep(-.3,1.,dir.y);
  float n3=vnoise(vec3(dir*9.,t*2.2+7.));
  float body=.4+breath+(n1-.5)*.14+(n2-.5)*.06+up*pow(n2,2.)*smoothstep(.45,.8,n3)*(.42+.5*uAmp+.2*uEnergy)+uAmp*.04-r;
  float drops=-1.;
  for(int i=0;i<6;i++){
   float fi=float(i);
   float life=fract(t*(.16+.03*fi)*(1.+uEnergy)+fi*.37);
   float side=fi*1.9+sin(fi*3.1)*.6;
   vec2 c0=vec2(cos(side)*.55,abs(sin(side))*.45+.25)*(.45+life*.75)-vec2(0.,life*life*.5);
   drops=max(drops,(.055*(1.-life)+.012)-length(uv-c0));
  }
  float field=max(body,drops);
  float inside=smoothstep(-px*1.2,px*1.2,field);
  vec3 c=mix(uMid,uLight,smoothstep(-.55,.55,uv.y+(n1-.5)*.3));
  c=mix(c,uBase,smoothstep(-.05,-.6,uv.y)*.55);
  float rim=smoothstep(.045,.0,field);
  c=mix(c,mix(uLight,vec3(1.),.5),rim*.75);
  float s=fbm(vec3(uv*2.6+vec2(0.,-t*.3),t*.4));
  float band=smoothstep(.022,.0,abs(s-.56))*step(.05,field)*smoothstep(-.3,.3,uv.y+.1);
  c=mix(c,vec3(1.),band*.9);
  c=mix(c,uMid*.85,smoothstep(.02,.0,abs(s-.42))*step(.08,field)*.35);
  float spot=length((uv-vec2(-.17,.17))*vec2(1.,1.6));
  c=mix(c,vec3(1.),smoothstep(.07,.05,spot));
  col=c*inside;alpha=inside;
 }else if(uMat==1){
  // Electricity: a plasma ball. Jagged arcs on the rim and across a dark, translucent core.
  float R=.6+breath+uAmp*.05;
  float inside=smoothstep(R+.03,R-.1,r);
  float haze=fbm(vec3(uv*2.4,t*.3));
  col+=mix(uBase*2.,uMid*.28,haze)*inside*(.3+.7*smoothstep(0.,R,r));
  alpha+=inside*.75;
  float bolts=0.;
  for(int i=0;i<3;i++){
   float fi=float(i);
   vec3 p=vec3(uv*(1.5+fi*.8),t*(.9+fi*.35)+fi*7.);
   float f=fbm(p+fbm(p*1.7)*.9)+(vnoise(p*9.)-.5)*.07;
   float w=.005+.005*uEnergy+.003*uAmp;
   float dist=abs(f-.5);
   bolts+=(smoothstep(w*1.6,0.,dist)*1.4+w*.6/(dist+w))*(.8-fi*.2);
  }
  bolts*=inside*smoothstep(.0,.3,r);
  float jitter=(vnoise(vec3(dir*5.,t*4.))-.5)*.08*(1.+uEnergy+uAmp)+(vnoise(vec3(dir*17.,t*7.))-.5)*.025;
  float rim=.005/(abs(r-R-jitter)+.005);
  float flick=.65+.35*vnoise(vec3(uTime*19.,uSeed,1.));
  vec3 white=mix(uHot,vec3(1.),.65);
  float rimCore=smoothstep(.012,.0,abs(r-R-jitter));
  col+=(uLight*min(bolts,2.)*.55+white*smoothstep(.8,1.6,bolts)*.9+uLight*rim*.35+white*rimCore*.9)*flick;
  col+=uMid*exp(-max(r-R,0.)*10.)*.35*(.6+uEnergy+uAmp)*smoothstep(R-.12,R,r);
  alpha=max(alpha,clamp(max(col.r,max(col.g,col.b)),0.,1.));
 }else if(uMat==2){
  // Data: falling glyph columns inside a soft, slightly bulging disc.
  vec2 g=uv*(1.+.28*r*r);
  float cols=floor(mix(8.,20.,smoothstep(60.,360.,min(uRes.x,uRes.y))));
  vec2 gv=g*cols*.5+vec2(.5,0.);
  vec2 cid=floor(gv),cf=fract(gv);
  float speed=.45+hash3(vec3(cid.x,1.,7.))*1.3;
  float v=fract(cid.y*.04+t*.32*speed*(1.+1.6*uEnergy)+hash3(vec3(cid.x,5.,1.)));
  float trail=pow(1.-v,2.6),head=smoothstep(.045,0.,v);
  vec2 bc=floor(cf*vec2(4.,5.));
  float bit=step(.46,hash3(vec3(cid*3.1+bc*.71,floor(uTime*3.5+hash3(vec3(cid,9.))*20.))));
  float cell=step(.1,cf.x)*step(cf.x,.9)*step(.06,cf.y)*step(cf.y,.94);
  float glyph=bit*cell;
  float mask=smoothstep(.74,.5,r+(vnoise(vec3(dir*3.,t*.5))-.5)*.08);
  vec3 c=glyph*(uMid*trail*1.25+mix(uLight,vec3(1.),.55)*head*1.7)*(1.+uAmp*.7);
  col=c*mask+uBase*mask;
  alpha=clamp(max(max(c.r,max(c.g,c.b))*mask,.55*mask),0.,1.);
 }else if(uMat==3){
  // Smoke: ink billows. Overlapping puffs, a dark heart, pale curling edges and swirl lines.
  float ts=t*(.10+.12*uEnergy);
  vec2 q=vec2(fbm(vec3(uv*1.2,ts)),fbm(vec3(uv*1.2+5.2,ts+3.)));
  vec2 w=vec2(fbm(vec3(uv*1.6+q*1.8+vec2(1.7,9.2),ts*1.3)),fbm(vec3(uv*1.6+q*1.8+vec2(8.3,2.8),ts*1.3)));
  vec2 wv=uv+(w-.5)*.55+(q-.5)*.25;
  float puffs=0.;
  for(int i=0;i<7;i++){
   float fi=float(i);
   float ang=fi*.9+ts*.8;
   vec2 c0=(i==0?vec2(0.):vec2(cos(ang)*1.25,sin(ang)*.85)*(.26+.06*sin(ts*2.+fi)))+(q-.5)*.15;
   float rad=(i==0?.3:.2+.07*hash3(vec3(fi,5.,1.)))+uAmp*.03;
   puffs+=exp(-dot(wv-c0,wv-c0)/(rad*rad));
  }
  float d=fbm(vec3(uv*2.2+w*2.6,ts));
  float body=puffs+(d-.5)*1.2;
  float mask=smoothstep(.38,.6,body);
  float d2=fbm(vec3(wv*2.6+w*3.,ts*1.5));
  float shade=clamp((body-.6)*.3+(d2-.5)*1.7+.38-uv.y*.3,0.,1.);
  vec3 c=mix(uLight,uMid,smoothstep(.12,.55,shade));
  c=mix(c,uBase,smoothstep(.55,.95,shade));
  float curl=abs(fract(d2*5.+body*.7)-.5)*2.;
  float lines=smoothstep(.13,.0,curl)*smoothstep(.25,.75,shade);
  c=mix(c,mix(uLight,vec3(1.),.3),lines*.55);
  float edgeLight=smoothstep(.6,.45,body)*mask;
  c=mix(c,uLight*1.05,edgeLight*.6);
  alpha=mask*(.75+.25*shade);
  col=c*alpha;
 }else{
  // Fire: tongues of flame rising from a dark red heart.
  vec2 p=uv*1.45+vec2(0.,.42);
  float rise=t*(.9+.7*uEnergy);
  float n=fbm(vec3(p.x*2.3,p.y*1.5-rise,t*.25));
  float n2=fbm(vec3(p.x*5.,p.y*3.4-rise*1.7,t*.5));
  float w=.5*(1.-smoothstep(-.4,1.1,p.y)*.55);
  float shape=1.-length(vec2(p.x/max(w,.05),(p.y+.05)*1.05));
  float tongues=smoothstep(-.1,1.,p.y);
  float flame=shape+(n-.5)*1.1+(n2-.5)*.5+tongues*(n-.42)*.9+uAmp*.28;
  float I=clamp(flame*1.55,0.,1.);
  vec3 c=mix(uBase*.6,uBase,smoothstep(.0,.25,I));
  c=mix(c,uMid,smoothstep(.18,.5,I));
  c=mix(c,uLight,smoothstep(.45,.78,I));
  c=mix(c,uHot,smoothstep(.8,1.,I)*(.6+.4*n2));
  float heart=smoothstep(.42,.05,length((p-vec2(.06,-.05))*vec2(1.,.8))+(n2-.5)*.3);
  c=mix(c,mix(uBase,uMid,.3),heart*.85*smoothstep(.45,.9,I));
  alpha=smoothstep(.02,.3,I);
  col=c*alpha;
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
