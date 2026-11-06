'use strict';
// Living bubble: one WebGL canvas and one draw call replace the CSS ribbons and particles.
// Three-dimensional, ray-marched materials moving around an invisible sphere: a drawn flame
// rising, ink smoke billowing out, glyphs swarming and sent out, water churning; and the plasma
// ball with bolts leaping out. Each state has its own
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
float fbm3(vec3 p){float s=0.,a=.5;for(int i=0;i<3;i++){s+=a*vnoise(p);p=p*2.07+vec3(5.1,1.3,7.7);a*=.5;}return s*1.14;}
vec2 isph(vec3 ro,vec3 rd,float R){float b=dot(ro,rd);float c=dot(ro,ro)-R*R;float h=b*b-c;if(h<0.)return vec2(-1.);h=sqrt(h);return vec2(-b-h,-b+h);}
vec3 yrot(vec3 p,float a){vec2 xz=rot2(a)*vec2(p.x,p.z);return vec3(xz.x,p.y,xz.y);}
// Flame field (> 0 inside): a mass of fire held by the invisible sphere, tongues rising out of it.
float flameField(vec3 p,float ft,float amp,float swirl){
 vec3 q=vec3(p.x*(1.+max(p.y,0.)*1.4),p.y>0.?p.y*.62:p.y*1.1,p.z*(1.+max(p.y,0.)*1.4));
 float s=.36+amp*.05-length(q*vec3(1.,.95,1.)-vec3(0.,-.06,0.));
 vec3 sp=yrot(p,swirl*ft*.7+p.y*1.5*swirl);
 float n=fbm3(vec3(sp.x*2.3,sp.y*1.5-ft*1.25,sp.z*2.3));
 float n2=vnoise(vec3(sp.x*5.,sp.y*3.4-ft*2.1,sp.z*5.));
 float up=smoothstep(-.15,.7,p.y);
 float tongues=(vnoise(vec3(atan(sp.x,sp.z)*1.6,sp.y*2.2-ft*2.4,ft*.2))-.5)*.35*up;
 return s+(n-.5)*(.22+.4*up)+(n2-.5)*.14*up+tongues-max(p.y-.86,0.)*3.;
}
// Smoke field (> 0 inside): distinct round billows. Four roll inside the invisible sphere,
// six escape upward and swell; a light noise keeps the outline irregular.
float smokeField(vec3 p,float st,float amp,float swirl){
 vec3 sp=yrot(p,swirl*st*.9);
 float f=0.;
 for(int i=0;i<4;i++){
  float fi=float(i);
  float a=st*.35+fi*1.5708;
  vec3 c=vec3(cos(a)*.24,sin(st*.4+fi*1.7)*.08-.06,sin(a)*.2);
  f+=exp(-dot(sp-c,sp-c)/.03);
 }
 for(int i=0;i<6;i++){
  float fi=float(i);
  float a=st*.5+fi*1.047;
  vec3 c=vec3(cos(a)*.36,sin(st*.6+fi*2.3)*.12-.02,sin(a)*.3);
  f+=exp(-dot(sp-c,sp-c)/.014)*.95;
 }
 for(int i=0;i<6;i++){
  float fi=float(i);
  float cyc=st*(.13+.04*fi/6.)*(1.+amp)+fi/6.;
  float life=fract(cyc),id=floor(cyc);
  vec3 c0=vec3(hash3(vec3(fi,id,1.))-.5,0.,hash3(vec3(fi,id,2.))-.5)*.3;
  vec3 c=c0+vec3(sin(life*3.+fi)*.1,.05+life*.85,cos(life*2.5+fi)*.1);
  float r=.13+.15*life;
  f+=exp(-dot(sp-c,sp-c)/(r*r))*(1.-life*life);
 }
 float n=vnoise(sp*6.-vec3(0.,st*.7,0.));
 return f+(n-.5)*.2-.5;
}
// Wild water: a 3D noise level set held by the invisible sphere, so the mass folds, crests and
// throws spray in every direction instead of keeping a flat surface.
float sdWild(vec3 p,float tt,float storm){
 // A liquid ball churning in zero gravity: its surface is thrown into waves and crests.
 vec3 q=yrot(p,tt*(.5+.6*storm)+length(p)*2.*storm);
 vec3 q2=vec3(q.x,q.y*cos(tt*.3)-q.z*sin(tt*.3),q.y*sin(tt*.3)+q.z*cos(tt*.3));
 float n=fbm3(q2*1.8+vec3(tt*.4,-tt*.3,tt*.35));
 float n2=vnoise(q2*4.2-vec3(0.,tt*.9,0.));
 float rr=.34+(n-.5)*(.34+.3*storm)+(n2-.5)*(.07+.08*storm);
 float d=max(length(p)-.58,(length(p)-rr)*.55);
 for(int i=0;i<7;i++){
  float fi=float(i);
  float cyc=tt*(.45+.08*fi)+hash3(vec3(fi,3.,3.));
  float life=fract(cyc),id=floor(cyc);
  vec3 dir=normalize(vec3(hash3(vec3(fi,id,1.)),hash3(vec3(fi,id,2.)),hash3(vec3(fi,id,3.)))-.5);
  vec3 c=dir*(.3+life*(.3+.25*storm));
  float rr=(.03+.025*hash3(vec3(fi,id,4.)))*(1.-life*.5)*(.4+storm);
  d=min(d,length(p-c)-rr);
 }
 return d;
}
// Fire density for a volumetric, emissive flame: rising turbulence, a sway that grows with height,
// and tongues that are born, detach and die (cells of a rising lattice with their own lifetimes).
float fireDensity(vec3 p,float ft,float amp,float swirl){
 float h=p.y+.4;
 vec3 sp=yrot(p,swirl*ft*.6);
 sp.x+=sin(ft*1.3+h*3.)*.06*h+sin(ft*2.1+h*5.)*.03*h;
 sp.z+=cos(ft*1.1+h*2.7)*.05*h;
 vec3 np=vec3(sp.x*3.,h*2.-ft*2.2,sp.z*3.);
 vec3 w=vec3(fbm3(np*.7),fbm3(np*.7+5.),fbm3(np*.7+9.))-.5;
 float turb=fbm3(np+w*1.6);
 float width=(.42+.1*amp)*(1.-smoothstep(0.,1.2,h)*.8);
 float body=1.-length(vec2(sp.x,sp.z))/max(width,.02);
 float base=smoothstep(-.05,.12,h);
 float tongue=0.;
 vec3 cell=vec3(sp.x*4.,h*2.5-ft*1.6,sp.z*4.);
 vec3 ci=floor(cell);
 float life=fract(ft*.8+hash3(ci));
 tongue=smoothstep(.55,.0,length(fract(cell)-.5))*(1.-life)*step(hash3(ci+7.),.45+.3*amp)*smoothstep(.25,.6,h);
 float d=body+(turb-.5)*1.4+tongue*.8;
 return clamp(d,0.,1.)*base*smoothstep(1.35,.85,h);
}
// Wispy smoke: thin ridged filaments wound into a helix (spiral) that widens as it rises.
float smokeDensity(vec3 p,float st,float amp,float swirl){
 float h=p.y+.25;
 float r=length(vec2(p.x,p.z));
 vec3 q=yrot(p,h*(2.2+swirl*2.)-st*(.6+swirl*1.5));
 vec3 np=q*vec3(2.6,1.6,2.6)-vec3(0.,st*.55,0.);
 vec3 w=vec3(fbm3(np),fbm3(np+3.1),fbm3(np+6.7))-.5;
 float n=fbm3(np*1.4+w*2.2);
 float ridge=1.-abs(2.*n-1.);
 ridge=pow(ridge,4.);
 float plume=smoothstep(.12+h*.22,.0,abs(r-(.08+h*.16)))*smoothstep(-.05,.2,h)*smoothstep(1.05,.55,h);
 float source=smoothstep(.2,.0,abs(length(p)-.3))*.6;
 return ridge*(plume*(1.+amp)+source);
}
// Liquid in an invisible sphere: a sloshing surface, ripples, a whirlpool during analysis, drops thrown about.
float sdLiquid(vec3 p,float Rc,float tt,float slosh,float whirl,float drops){
 float rr=length(vec2(p.x,p.z));
 vec3 sp=yrot(p,whirl*2.5*exp(-rr*3.));
 float level=-.05+.03*sin(tt*.5);
 vec2 tilt=vec2(sin(tt*.7),cos(tt*.53))*slosh;
 float waves=(vnoise(vec3(sp.x*3.,sp.z*3.,tt*.5))*.66+vnoise(vec3(sp.x*6.,sp.z*6.,tt*.8))*.34-.5)*(.08+slosh*.35)+.018*sin(rr*16.-tt*2.5)*(.3+slosh*2.);
 float surf=level+dot(tilt,vec2(sp.x,sp.z))+waves-whirl*.22*exp(-rr*rr*10.);
 float d=max(length(p)-Rc,p.y-surf);
 for(int i=0;i<4;i++){
  float fi=float(i);
  vec3 c=vec3(sin(tt*(.9+fi*.3)+fi*1.7)*.28,.12+.14*sin(tt*(1.1+fi*.2)+fi*2.3),cos(tt*(.8+fi*.25)+fi)*.28);
  float rd=.035+.02*fi;
  float k=.06;float db=length(p-c)-rd*drops;
  float h=clamp(.5+.5*(db-d)/k,0.,1.);d=mix(db,d,h)-k*h*(1.-h);
 }
 return d;
}
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
 }else{
  // Three-dimensional materials, ray-marched: a camera slightly above, looking at the ball.
  vec3 ro=vec3(0.,sin(.38)*3.,cos(.38)*3.);
  vec3 fw=normalize(-ro);vec3 rt=normalize(cross(fw,vec3(0.,1.,0.)));vec3 up=cross(rt,fw);
  vec3 rd=normalize(fw+(uv.x*rt+uv.y*up)*.36);
  float spin=t*.12*pace;
  vec3 L3=normalize(vec3(-.5,.8,.6));
  float jit=hash3(vec3(gl_FragCoord.xy,uTime));
  float R3=(.33+uAmp*.02)*(1.+.08*thump);
  if(uMat==0){
   // Wild water in an invisible sphere: the mass folds and crests, foam caps it, spray flies.
   // Shading follows real water: Fresnel reflection of the sky, absorbed colour seen through it.
   float tt=t*(.9+pace*.7);
   float storm=clamp(.25+.35*uListen+uAmp*.8+uEnergy*.6+thump*.8,0.,1.6);
   vec2 bb=isph(ro,rd,.7);
   if(bb.x>0.){
    float tm=bb.x;float hit=0.;vec3 p=ro;
    for(int i=0;i<48;i++){
     p=ro+rd*tm;
     float d=sdWild(p,tt,storm);
     if(d<.0015){hit=1.;break;}
     tm+=max(d*.7,.004);
     if(tm>bb.y)break;
    }
    if(hit>.5){
     vec2 e=vec2(.004,0.);
     vec3 n=normalize(vec3(sdWild(p+e.xyy,tt,storm)-sdWild(p-e.xyy,tt,storm),sdWild(p+e.yxy,tt,storm)-sdWild(p-e.yxy,tt,storm),sdWild(p+e.yyx,tt,storm)-sdWild(p-e.yyx,tt,storm)));
     float cosT=max(dot(n,-rd),0.);
     float fres=.02+.98*pow(1.-cosT,5.);
     vec3 rf=reflect(rd,n);
     vec3 sky=mix(uMid*.9,mix(uLight,vec3(1.),.6),smoothstep(-.2,.8,rf.y));
     // Light that went into the water comes back absorbed: thicker water is deeper blue.
     float thick=0.;vec3 pi=p-n*.01;
     for(int k=0;k<5;k++){pi+=refract(rd,n,.75)*.06;thick+=step(sdWild(pi,tt,storm),0.)*.06;}
     vec3 body=mix(uLight*.95,uBase*.9,clamp(thick*3.,0.,1.));
     body*=.65+.45*clamp(dot(n,L3),0.,1.);
     vec3 c=mix(body,sky,fres);
     c+=vec3(1.)*pow(max(dot(rf,L3),0.),90.)*1.4;
     float foam=smoothstep(.62,.8,vnoise(p*14.+vec3(0.,tt*.8,0.)))*smoothstep(.15,.7,n.y)*(.4+storm*.6);
     foam+=smoothstep(.42,.56,length(p))*.45*storm;
     c=mix(c,vec3(1.),clamp(foam,0.,1.));
     ballC=c;ballA=1.;
    }
   }
  }else if(uMat==4){
   // Volumetric fire: emission follows a blackbody ramp (dark red, orange, yellow, white),
   // turbulence makes it dance, tongues are born and detach.
   float ft=t*(.9+.6*pace);
   float amp=uAmp+.6*thump;
   vec2 bb=isph(ro,rd,1.15);
   vec3 acc=vec3(0.);float a=0.;
   if(bb.x>0.){
    float span=bb.y-bb.x;
    for(int i=0;i<36;i++){
     float tm=bb.x+span*(float(i)+jit)/36.;
     vec3 p=ro+rd*tm;
     float d=fireDensity(p,ft,amp,uEnergy);
     if(d>.002){
      float T=pow(d,1.6)*(1.3-.35*clamp(p.y+.3,0.,1.));
      vec3 bbc=vec3(1.,.28+.72*smoothstep(.15,.85,T),.06+.94*smoothstep(.55,1.15,T))*smoothstep(.0,.35,T);
      bbc=mix(bbc,uMid*1.2,.2);
      acc+=bbc*d*span/36.*7.;
      a+=d*span/36.*5.;
     }
    }
   }
   ballC=acc*(1.+thump*.4);ballA=clamp(a,0.,1.);
   for(int i=0;i<10;i++){
    float fi=float(i);
    float cyc=uTime*(.25+.12*hash3(vec3(fi,2.,2.)))*(.6+pace)+hash3(vec3(fi,8.,1.));
    float id=floor(cyc),life=fract(cyc);
    float an=6.2832*hash3(vec3(fi,id,3.));
    vec3 e3=vec3(cos(an)*.15,.1+life*(.75+.3*hash3(vec3(fi,id,6.))),sin(an)*.15)+vec3(sin(life*9.+fi)*.08,0.,cos(life*7.+fi)*.05);
    vec3 pc=e3-ro;float zc=dot(pc,fw);
    vec2 s2=vec2(dot(pc,rt),dot(pc,up))/(zc*.36);
    float spark=smoothstep(.01,.0,length(uv-s2))*(1.-life)*smoothstep(.0,.1,life);
    frontC+=mix(uHot,vec3(1.,.7,.3),.5)*spark*1.3;frontA=max(frontA,spark);
   }
  }else if(uMat==3){
   // Wispy smoke in spirals, lit like real smoke: light is absorbed along the way (Beer-Lambert),
   // the side facing the light is brighter, thin wisps stay translucent.
   float st=t*(.6+.5*pace);
   float amp=uAmp+.3*uListen+.5*thump;
   vec2 bb=isph(ro,rd,1.25);
   vec3 acc=vec3(0.);float T=1.;
   if(bb.x>0.){
    float span=bb.y-bb.x;
    for(int i=0;i<40;i++){
     float tm=bb.x+span*(float(i)+jit)/40.;
     vec3 p=ro+rd*tm;
     float d=smokeDensity(p,st,amp,uEnergy);
     if(d>.003){
      float sh=smokeDensity(p+L3*.1,st,amp,uEnergy)+smokeDensity(p+L3*.22,st,amp,uEnergy);
      float light=exp(-sh*2.6)*(.75+.25*smoothstep(-.3,.9,p.y));
      vec3 c=mix(uBase*1.3,uLight,light);
      float ext=d*span/40.*12.;
      float aa=1.-exp(-ext);
      acc+=T*c*aa;T*=1.-aa;
      if(T<.03)break;
     }
    }
   }
   ballC=acc;ballA=1.-T;
  }else{
   // Data: glyphs swarming over the invisible sphere, and packets sent out from it.
   float Rd=R3*1.15;
   float rate=.22+.25*uListen+.4*uAmp+.5*uEnergy+.6*thump;
   for(int i=0;i<44;i++){
    float fi=float(i);
    vec3 p3;float fade;float sz;
    if(i<22){
     vec3 ax=normalize(vec3(hash3(vec3(fi,1.,1.)),hash3(vec3(fi,2.,1.)),hash3(vec3(fi,3.,1.)))-.5);
     vec3 v0=normalize(cross(ax,vec3(.3,1.,.2)));vec3 v1=cross(ax,v0);
     float a=t*(.25+.25*hash3(vec3(fi,4.,4.)))*(1.+1.5*uEnergy)+fi*1.7;
     p3=(v0*cos(a)+v1*sin(a))*Rd;
     fade=1.;sz=.06;
    }else{
     float cyc=uTime*rate*(.6+.5*hash3(vec3(fi,1.,4.)))+hash3(vec3(fi,9.,2.));
     float id=floor(cyc),life=fract(cyc);
     vec3 dir=normalize(vec3(hash3(vec3(fi,id,1.)),hash3(vec3(fi,id,2.)),hash3(vec3(fi,id,3.)))-.5);
     dir=yrot(dir,spin+uEnergy*life*2.5);
     p3=dir*(Rd+life*(.85+.3*uAmp));
     fade=(1.-life)*smoothstep(.0,.08,life);sz=.075*(1.-life*.4);
    }
    vec3 pc=p3-ro;float zc=dot(pc,fw);
    vec2 s2=vec2(dot(pc,rt),dot(pc,up))/(zc*.36);
    float back=smoothstep(-.1,.3,dot(normalize(p3),-fw));
    float s=sz/(zc*.36);
    vec2 lc=(uv-s2)/s;
    float inq=step(abs(lc.x),.5)*step(abs(lc.y),.5);
    vec2 bc=floor((lc+.5)*vec2(3.,4.));
    float gb=step(.42,hash3(vec3(bc,fi+floor(uTime*(2.+3.*uEnergy)))));
    float depthFade=mix(.35,1.,back);
    float g=inq*gb*fade*depthFade;
    vec3 gc=mix(uMid,mix(uLight,vec3(1.),.5),back*.6)*1.5;
    frontC+=gc*g*(1.-frontA);frontA+=g*(1.-frontA);
   }
   glowC=uMid*exp(-max(r-.35,0.)*7.)*.12*(1.+uAmp+uEnergy);
  }
 }
 // Analysis: a thin scanning ring sweeps round the ball.
 float ringR=uMat==1?R*1.18:.33/(3.*.36)*1.15;
 float scanRing=uEnergy*smoothstep(.006,.0,abs(r-ringR))*smoothstep(.5,1.,cos(ang-uTime*4.5))*(uMat==1?0.:1.);
 // Follow-up ready: a heartbeat and a shock wave leaving the ball.
 float waveR=(uMat==1?R*1.45:.33/(3.*.36))+beat*.45;
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
