'use strict';
// Living bubble: one WebGL canvas and one draw call replace the CSS ribbons and particles.
// A ball at the centre and the material moving around it: water streams and smoke wisps in an
// organic, differentially rotating flow, a plasma ball with bolts leaping out, glyphs carried by
// the flow, and a flame unfolding upward from a burning ball. Each state has its own
// motion: slow at rest, voice-driven while listening, a fast vortex and a scanning ring during
// analysis, a heartbeat and a shock wave when a follow-up is ready. and the shape follows the assistant's state and the real voice level.
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
uniform vec2 uRes;uniform float uTime,uAmp,uEnergy,uAlert,uListen,uSeed,uLife;uniform int uMat;
uniform vec3 uLight,uMid,uHot,uBase;
float hash3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float vnoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
return mix(mix(mix(hash3(i),hash3(i+vec3(1.,0.,0.)),f.x),mix(hash3(i+vec3(0.,1.,0.)),hash3(i+vec3(1.,1.,0.)),f.x),f.y),
mix(mix(hash3(i+vec3(0.,0.,1.)),hash3(i+vec3(1.,0.,1.)),f.x),mix(hash3(i+vec3(0.,1.,1.)),hash3(i+vec3(1.,1.,1.)),f.x),f.y),f.z);}
float fbm(vec3 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vnoise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}
mat2 rot2(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
// An orbit seen at an angle: an ellipse of radius a, flattened by squash, rotated by tilt.
// x: coverage, y: position along the stream (0 head, 1 tail), z: 1 in front of the ball, w: across (-1..1).
vec4 orbit(vec2 uv,float a,float squash,float tilt,float head,float arc,float width,float px){
 vec2 p=rot2(-tilt)*uv;
 vec2 c=vec2(p.x,p.y/squash);
 float th=atan(c.y,c.x);
 float along=mod(head-th,6.2832)/max(arc,.01);
 float scale=mix(1.,squash,abs(sin(th)));
 float d=(length(c)-a)*scale;
 float w=width*(1.-smoothstep(.15,1.,along));
 float cover=smoothstep(w+px,w-px,abs(d))*step(along,1.);
 return vec4(cover,along,1.-step(0.,c.y),d/max(w,1e-3));
}
void main(){
 float px=2./min(uRes.x,uRes.y);
 vec2 uv=(gl_FragCoord.xy-.5*uRes)*px;
 float t=uTime*(.32+.38*uLife)+uSeed;
 float r=length(uv);vec2 dir=uv/max(r,1e-4);
 float ang=atan(uv.y,uv.x);
 // State rhythm: rest is slow, listening follows the voice, analysis spins, a follow-up beats.
 float pace=.35+.3*uListen+1.5*uEnergy+.45*uAmp;
 float beat=fract(uTime*.6);
 float thump=exp(-beat*7.)*uAlert;
 float R=(.33+.012*sin(t*.8)+uAmp*.025)*(1.+.08*thump);
 vec2 q=uv/R;float z=sqrt(max(0.,1.-dot(q,q)));
 float ball=smoothstep(R+px,R-px,r);
 vec3 L=normalize(vec3(-.45,.6,.65));
 vec3 ballC=vec3(0.);float ballA=0.;
 vec3 backC=vec3(0.);float backA=0.;
 vec3 frontC=vec3(0.);float frontA=0.;
 vec3 glowC=vec3(0.);
 if(uMat==1){
  // Electricity: the plasma ball, and bolts that leap out of it at random.
  float RE=R*1.45;
  float inside=smoothstep(RE+.03,RE-.1,r);
  float haze=fbm(vec3(uv*2.4,t*.3));
  ballC=mix(uBase*2.,uMid*.28,haze)*inside*(.3+.7*smoothstep(0.,RE,r));ballA=inside*.75;
  float bolts=0.;
  for(int i=0;i<3;i++){
   float fi=float(i);
   vec3 p=vec3(uv*(1.5+fi*.8),t*(.9+fi*.35)*(.7+.6*pace)+fi*7.);
   float f=fbm(p+fbm(p*1.7)*.9)+(vnoise(p*9.)-.5)*.07;
   float w=.005+.004*uEnergy+.003*uAmp;
   float dist=abs(f-.5);
   bolts+=(smoothstep(w*1.6,0.,dist)*1.4+w*.6/(dist+w))*(.8-fi*.2);
  }
  bolts*=inside*smoothstep(.0,.3,r);
  // Bolts out of the ball: each flashes briefly along a jagged, branching path.
  float leap=0.;
  for(int i=0;i<6;i++){
   float fi=float(i);
   float cyc=uTime*(.9+.4*hash3(vec3(fi,1.,1.)))*(1.+1.6*uEnergy+2.*uAmp)+hash3(vec3(fi,7.,3.));
   float id=floor(cyc),life=fract(cyc);
   float chance=.32+.7*uListen*uAmp+.4*uEnergy+.5*uAlert*step(beat,.2);
   float on=step(hash3(vec3(fi,id,5.)),chance);
   float flash=on*smoothstep(0.,.04,life)*smoothstep(.4,.12,life)*(.7+.3*vnoise(vec3(uTime*30.,fi,id)));
   float a=6.2832*hash3(vec3(fi,id,2.))+uEnergy*t*.8;
   vec2 db=vec2(cos(a),sin(a));
   float len=.22+.28*hash3(vec3(fi,id,9.))+.15*uAmp;
   float s=dot(uv,db)-RE*.92;
   float perp=dot(uv,vec2(-db.y,db.x));
   float sn=clamp(s/len,0.,1.);
   float off=(fbm(vec3(s*7.,id+fi*3.,1.))-.5)*.24*(sn+.15)+(vnoise(vec3(s*34.,id,fi))-.5)*.025;
   float w=.0045*(1.-sn*.6);
   float span=step(0.,s)*smoothstep(len,len*.75,s);
   float d1=abs(perp-off);
   float side=hash3(vec3(fi,id,4.))>.5?1.:-1.;
   float bs=max(s-len*.4,0.);
   float off2=off+side*bs*.9+(vnoise(vec3(s*28.,id,fi+4.))-.5)*.03;
   float d2=abs(perp-off2);
   float branch=step(len*.4,s)*smoothstep(len*.9,len*.6,s);
   leap+=flash*span*(smoothstep(w*2.,0.,d1)*1.5+w*.9/(d1+w)+branch*(smoothstep(w*1.6,0.,d2)+w*.5/(d2+w)));
  }
  float jitter=(vnoise(vec3(dir*5.,t*4.))-.5)*.08*(1.+uEnergy+uAmp)+(vnoise(vec3(dir*17.,t*7.))-.5)*.025;
  float rim=.005/(abs(r-RE-jitter)+.005);
  float rimCore=smoothstep(.012,.0,abs(r-RE-jitter));
  // Analysis: a bright arc runs round the rim like a scanner.
  float scan=uEnergy*smoothstep(.75,1.,cos(ang-uTime*5.))*1.6;
  float flick=.65+.35*vnoise(vec3(uTime*19.,uSeed,1.));
  vec3 white=mix(uHot,vec3(1.),.65);
  bolts+=leap;
  ballC+=(uLight*min(bolts,2.)*.55+white*smoothstep(.8,1.6,bolts)*.9+uLight*rim*(.35+scan)+white*rimCore*(.9+scan))*flick*(1.+thump*.8);
  glowC=uMid*exp(-max(r-RE,0.)*10.)*.35*(.6+uEnergy+uAmp+thump)*smoothstep(RE-.12,RE,r);
  ballA=max(ballA,clamp(max(ballC.r,max(ballC.g,ballC.b)),0.,1.));
 }else if(uMat==4){
  // Fire: a flame that unfolds upward from a small burning ball at its base, like a fire emoji.
  float ft=t*.9*pace+t*.35;
  vec2 cpos=vec2(0.,-.24);float Rf=R*.72;
  vec2 p=uv-cpos;
  float n=fbm(vec3(p.x*2.6,p.y*1.7-ft*1.1,ft*.15));
  float n2=fbm(vec3(p.x*5.5,p.y*3.6-ft*1.8,ft*.3));
  float rise=smoothstep(-Rf,.95,p.y);
  float halfW=Rf*(1.75+.3*uAmp)*(1.-rise*.9)+.015;
  float sway=(n-.5)*.24*rise+sin(ft*.6+p.y*3.)*.035*rise;
  float side=abs(p.x-sway)/(halfW*(.75+.6*n2));
  float height=(.72+.18*uAmp+.12*uEnergy)*(.8+.45*n);
  float top=p.y/height;
  float tongues=(fbm(vec3(p.x*7.,p.y*2.2-ft*2.2,ft*.4))-.5)*1.1*rise;
  float I=clamp(1.-side-max(top,0.)*1.05+(n2-.5)*.6+tongues-max(-p.y-Rf*1.3,0.)*5.,0.,1.);
  I=pow(I,.8);
  vec3 c=mix(uBase*.75,uBase,smoothstep(.0,.18,I));
  c=mix(c,uMid,smoothstep(.12,.42,I));
  c=mix(c,uLight,smoothstep(.4,.7,I));
  c=mix(c,uHot,smoothstep(.72,.95,I));
  float fa=smoothstep(.03,.2,I);
  // The burning ball glows at the base, inside the flame.
  vec2 cq=p/Rf;float cz=sqrt(max(0.,1.-dot(cq,cq)));
  float core=smoothstep(Rf+px,Rf-px,length(p));
  vec2 sxz=rot2(t*.08)*vec2(cq.x,cz);vec3 sp=vec3(sxz.x,cq.y,sxz.y);
  float heat=clamp(fbm(sp*3.+vec3(0.,0.,t*.3))*.9+fbm(sp*6.-vec3(t*.25))*.45,0.,1.);
  vec3 bc=mix(uLight,uHot,smoothstep(.4,.8,heat))*(1.+thump*.6);
  ballC=mix(c*fa,bc,core*(.55+.45*cz));ballA=max(fa,core);
  ball=core;
  // Embers drift upward, swaying.
  for(int i=0;i<6;i++){
   float fi=float(i);
   float cyc=uTime*(.18+.08*hash3(vec3(fi,2.,2.)))*(.6+pace)+hash3(vec3(fi,8.,1.));
   float id=floor(cyc),life=fract(cyc);
   float x0=(hash3(vec3(fi,id,3.))-.5)*R*1.6;
   vec2 e=vec2(x0+sin(life*6.+fi)*.04,-.2+life*(.85+.2*hash3(vec3(fi,id,6.))));
   float spark=smoothstep(.011,.0,length(uv-e))*(1.-life)*smoothstep(.0,.1,life);
   frontC+=uHot*spark;frontA=max(frontA,spark);
  }
  glowC=uMid*exp(-max(length((uv-vec2(0.,.05))*vec2(1.3,.8))-.3,0.)*6.)*.3*(1.+thump);
 }else{
  // Core ball and an organic flow around it: inner layers turn faster than outer ones
  // (differential rotation), the streams meander, thin out and break up.
  vec3 n=normalize(vec3(q,z+.001));
  float dif=dot(n,L);
  vec2 sxz=rot2(t*.1*pace)*vec2(q.x,z);vec3 sp=vec3(sxz.x,q.y,sxz.y);
  float wt=t*pace;
  float om=.45*pow(R/max(r,.05),1.3);
  vec2 ru=rot2(wt*om)*(uv-(uMat==3?vec2(0.,.03*sin(t*.3)):vec2(0.)));
  vec2 warp=vec2(fbm(vec3(ru*1.8,wt*.12)),fbm(vec3(ru*1.8+5.,wt*.12)))-.5;
  vec2 pr=ru+warp*(uMat==3?.3:.2);
  float rr=length(pr);vec2 dr=pr/max(rr,1e-4);
  float f=fbm(vec3(dr*1.25,rr*(uMat==3?3.5:5.5)+wt*.04));
  float reach=uMat==3?2.6:uMat==2?5.:4.2;
  float env=smoothstep(R*.9,R*1.06,r)*exp(-max(r-R,0.)*(reach-uAmp*1.2-uEnergy*.8));
  float breakup=smoothstep(.32,.56,fbm(vec3(dr*2.6,rr*3.-wt*.25)));
  vec3 fc=vec3(0.);float fa=0.;
  if(uMat==0){
   float ball0=ball;
   float wob=.02*sin(3.*ang+t*1.2)+.014*sin(5.*ang-t*1.6)+uAmp*.03*sin(7.*ang+t*5.);
   ball=smoothstep(R+wob+px,R+wob-px,r);
   vec3 c=mix(uMid,uLight,step(.25,dif));
   c=mix(c,uBase*1.2,step(dif,-.25)*.7);
   float s=fbm(vec3(q*2.2,t*.35));
   c=mix(c,mix(uLight,vec3(1.),.6),smoothstep(.02,.0,abs(s-.55))*step(.1,z));
   c=mix(c,vec3(1.),smoothstep(.93,.97,dot(reflect(-L,n),vec3(0.,0.,1.))));
   c=mix(c,mix(uLight,vec3(1.),.4),smoothstep(R-.03,R,r));
   ballC=c;
   // Water streams: iso-lines of the flow, crisp like a cartoon, a white glint on one side.
   float lw=.055+.03*uAmp+.02*uEnergy;
   float across=(f-.5)/lw;
   float tube=smoothstep(1.,.75,abs(across));
   fa=tube*env*breakup;
   fc=mix(uLight,uMid,smoothstep(-.3,1.,across));
   fc=mix(fc,vec3(1.),smoothstep(.3,.0,abs(across+.45))*.85);
   fa=smoothstep(.25,.4,fa);
  }else if(uMat==2){
   vec2 sg=vec2(atan(sp.x,sp.z)*2.6,asin(clamp(sp.y,-1.,1.))*3.2);
   vec2 sc=floor(sg),sf=fract(sg);
   float bit=step(.5,hash3(vec3(sc*2.3+floor(sf*vec2(3.,4.))*.7,floor(uTime*(1.2+2.5*uEnergy)+hash3(vec3(sc,4.))*9.))))*step(.12,sf.x)*step(sf.x,.88)*step(.1,sf.y)*step(sf.y,.9);
   ballC=uBase*1.5+uMid*bit*(.35+.65*z)*(.9+uAmp)+uLight*pow(1.-z,3.)*.7;
   // Data streams: glyphs carried along the meandering flow.
   float lw=.08+.03*uAmp;
   float tube=smoothstep(1.,.6,abs((f-.5)/lw));
   float th=atan(dr.y,dr.x);
   vec2 g=vec2(th*9.549,rr*20.);
   vec2 cid=floor(g),cf=fract(g);
   float bitg=step(.45,hash3(vec3(cid,floor(uTime*(1.5+3.*uEnergy)+hash3(vec3(cid,2.))*7.))+vec3(floor(cf*vec2(3.,4.))*.37,0.)));
   float cell=step(.14,cf.x)*step(cf.x,.86)*step(.1,cf.y)*step(cf.y,.9);
   float glyph=bitg*cell;
   float head=smoothstep(.7,.95,vnoise(vec3(cid*.4,uTime*.6)));
   fa=tube*env*(.35+.65*breakup);
   fc=(uMid*1.6+mix(uLight,vec3(1.),.5)*head*1.4)*glyph;
   fa*=glyph;
  }else{
   float sw=fbm(sp*2.2+vec3(0.,0.,t*.15));
   float sw2=fbm(sp*4.5+sw*2.-vec3(t*.1));
   vec3 c=mix(uMid,uBase,smoothstep(.3,.75,sw2));
   float curl=abs(fract(sw2*5.+sw*2.)-.5)*2.;
   c=mix(c,uLight*.9,smoothstep(.12,.0,curl)*.4);
   c=mix(c,uLight,pow(1.-z,2.)*.55);
   ballC=c*(.75+.35*dif);
   // Smoke: soft wisps carried round, curling, fading with distance.
   float d=fbm(vec3(pr*2.4+warp*2.,wt*.08));
   float dens=smoothstep(.42,.72,d)*env*(.5+.5*breakup);
   float cl=abs(fract(d*5.+f*3.)-.5)*2.;
   fc=mix(uLight,uMid,smoothstep(.3,.8,d));
   fc=mix(fc,mix(uLight,vec3(1.),.3),smoothstep(.12,.0,cl)*.5);
   fa=smoothstep(.05,.45,dens)*.9;
  }
  ballA=ball;ballC*=ball;
  // The flow passes in front of the ball on one side and behind it on the other.
  float front=step(0.,sin(atan(pr.y,pr.x)+wt*.2));
  fc*=fa;
  frontC=fc*front;frontA=fa*front;
  backC=fc*(1.-front);backA=fa*(1.-front);
 }
 // Analysis: a thin scanning ring sweeps round the ball.
 float ringR=R*1.18;
 float scanRing=uEnergy*smoothstep(.006,.0,abs(r-ringR))*smoothstep(.5,1.,cos(ang-uTime*4.5))*(uMat==1?0.:1.);
 // Follow-up ready: a heartbeat and a shock wave leaving the ball.
 float waveR=R*(uMat==1?1.45:1.)+beat*.45;
 float wave=uAlert*smoothstep(.02,.0,abs(r-waveR))*(1.-beat)*.9;
 vec3 warm=mix(uLight,vec3(1.,.66,.4),.45);
 vec3 fx=uLight*scanRing+warm*wave;
 float fxA=clamp(scanRing+wave,0.,1.);
 float glowA=clamp(max(glowC.r,max(glowC.g,glowC.b)),0.,1.);
 vec3 col=frontC+(1.-frontA)*(ballC+(1.-ballA)*(backC+glowC*(1.-backA)));
 float alpha=frontA+(1.-frontA)*(ballA+(1.-ballA)*(backA+(1.-backA)*glowA));
 col+=fx*(1.-alpha*.5);alpha=clamp(max(alpha,fxA),0.,1.);
 gl_FragColor=vec4(col,alpha);
}`;

  const canvas = document.createElement('canvas');
  canvas.className = 'orb-canvas'; canvas.setAttribute('aria-hidden', 'true');
  bubble.prepend(canvas);
  const seed = Math.random() * 50;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let gl = null, uniforms = {}, raf = 0, rafView = null, lastFrame = 0, lastDraw = 0;
  let amp = 0, energy = 0, alert = 0, listen = 0;
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
      for (const name of ['uRes', 'uTime', 'uAmp', 'uEnergy', 'uAlert', 'uListen', 'uSeed', 'uLife', 'uMat', 'uLight', 'uMid', 'uHot', 'uBase']) uniforms[name] = gl.getUniformLocation(program, name);
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
    listen += ((listening ? 1 : 0) - listen) * slow;
    // Phones have dense screens: 1.5 pixels per CSS pixel is enough for a small bubble.
    const ratio = Math.min(companion.ownerDocument.defaultView.devicePixelRatio || 1, window.InterpreteNative ? 1.5 : 2);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio)), height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const material = MATERIALS[companion.ownerDocument.documentElement.dataset.theme] || MATERIALS.pastel;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(uniforms.uRes, width, height); gl.uniform1f(uniforms.uTime, still ? 14 : now / 1000);
    gl.uniform1f(uniforms.uAmp, amp); gl.uniform1f(uniforms.uEnergy, energy); gl.uniform1f(uniforms.uAlert, alert); gl.uniform1f(uniforms.uListen, listen);
    gl.uniform1f(uniforms.uSeed, seed); gl.uniform1f(uniforms.uLife, LIFE); gl.uniform1i(uniforms.uMat, material.id);
    gl.uniform3fv(uniforms.uLight, hex(material.light)); gl.uniform3fv(uniforms.uMid, hex(material.mid));
    gl.uniform3fv(uniforms.uHot, hex(material.hot)); gl.uniform3fv(uniforms.uBase, hex(material.base));
    gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
    return amp > 0.02 || energy > 0.02 || alert > 0.02 || listen > 0.02;
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
