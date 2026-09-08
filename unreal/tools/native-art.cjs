// Native art revisions reuse the authored mesh primitives; the web game is left intact.
module.exports=function(T, A, C){
 const {mesh,ellipsoid:ball,softBox,tube,strut,mat,bakeStatic:bake,label}=A;
 const names=['Гризз','Громмак','Аэлир','Ноктис','Рейн','Борин','Одноглаз','Зара'];
 const kinds=['Гоблин-механик','Орк-гонщик','Светлый эльф','Тёмный эльф','Человек-пилот','Дворф-инженер','Циклоп-тяжеловес','Тифлинг-алхимик'];
 const skins=[0x789b50,0x658365,0xe8cbb0,0x827798,0xbb8a68,0xcda080,0x9c9377,0xa76663];
 const suits=[0x745036,0x3b4d43,0x52697d,0x403950,0x354c61,0x654b38,0x655d4b,0x65445c];
 function group(parent,name){const g=new T.Group();g.name=name;parent.add(g);return g;}
 function reviseKart(k,hero,skin){
  // Remove the complete old rider, including every animal detail and all fabric/tail geometry.
  const oldRider=k.body.children.find(o=>o!==k.frame&&o.isGroup);
  for(const o of [oldRider,k.head,k.cape,k.tail,k.steeringPivot,k.flame,k.items.boost,k.items.shield])o?.removeFromParent();
  const skinMat=mat(skins[hero],{roughness:.67}),jacket=mat(suits[hero],{roughness:.74}),steel=mat(0x71818a,{metalness:.75,roughness:.28}),gold=mat(0xb79a62,{metalness:.8,roughness:.28}),rubber=mat(0x202b30,{roughness:.8}),ivory=mat(0xefe0b9,{roughness:.45});
  const accent=mat(C.DRIVERS[hero].glow,{emissive:C.DRIVERS[hero].glow,emissiveIntensity:1.3,metalness:.25,roughness:.25});
  const rider=group(k.body,'racing-suit'),wide=hero===1||hero===6?1.13:hero===2||hero===3?.92:1;
  ball(0,1.51,-.4,.37*wide,.49,.29,jacket,rider,true);
  softBox(.6*wide,.47,.14,steel,0,1.62,-.10,rider,true);
  for(const side of [-1,1]){
   for(let j=0;j<3;j++)ball(side*(.4+j*.018)*wide,1.82-j*.065,-.35,.22,.12,.25,j%2?gold:steel,rider,true);
   tube([[side*.24,1.95,-.2],[side*.17,1.65,.0],[side*.19,1.31,-.11]],.042,rubber,rider);
   ball(side*.22,1.12,.07,.18,.19,.47,jacket,rider,true);
   softBox(.29,.16,.37,steel,side*.23,1.16,.36,rider,true);
   softBox(.29,.22,.47,rubber,side*.25,.91,.53,rider,true);
   for(let i=0;i<3;i++)softBox(.19,.025,.035,gold,side*.23,1.74-i*.075,.011,rider);
  }
  tube([[-.33,1.27,-.2],[0,1.25,.03],[.33,1.27,-.2]],.065,rubber,rider);
  softBox(.13,.13,.05,gold,0,1.26,.065,rider);
  mesh(new T.CircleGeometry(.075,24),accent,0,1.72,.025,rider);
  mesh(new T.PlaneGeometry(.16,.2),label(String(hero+1),'#26343d','#eddbab',64,96),0,1.48,.004,rider);
  bake(rider);
  k.head=group(k.body,'head');k.head.position.set(0,2.16,-.31);
  const head=k.head,large=hero===1||hero===6?1.12:1;
  ball(0,.03,0,.305*large,.38*large,.29,skinMat,head,true);
  ball(0,-.18,.11,.26*large,.19,.24,skinMat,head,true);
  ball(0,-.02,.30,hero===0?.095:.065,hero===0?.17:.1,hero===0?.18:.09,skinMat,head,true);
  for(const side of [-1,1]){
   ball(side*.19,-.1,.24,.1,.09,.08,skinMat,head,true);
   if([0,1,2,3,7].includes(hero)){
    const ear=ball(side*.37,.06,-.01,hero===0?.27:.22,.105,.06,skinMat,head,true);ear.rotation.z=side*.36;
    tube([[side*.27,.05,.045],[side*.43,.09,.05],[side*.55,.15,.002]],.014,hero===3?mat(0xaaa0bb):skinMat,head);
   }else ball(side*.3,.02,-.015,.065,.105,.06,skinMat,head,true);
  }
  const hair=mat([0x293524,0x283530,0xe9e0c9,0xd1cbdc,0x302b28,0x7c462e,0x4b4a3d,0x292e39][hero],{roughness:.85});
  if(hero!==6){ball(0,.23,-.055,.31,.19,.28,hair,head,true);for(let i=0;i<9;i++){const a=-1.5+i*.37;const lock=ball(Math.sin(a)*.245,.23-i%3*.027,.08+Math.cos(a)*.12,.08,.15,.07,hair,head);lock.rotation.z=-a*.3;}}
  if(hero===0||hero===4||hero===5){
   const cap=mesh(new T.SphereGeometry(.335,40,28,0,Math.PI*2,0,Math.PI*.46),jacket,0,.04,0,head,true);cap.scale.set(1,1.28,1.02);
   tube([[-.31,.14,.03],[0,.44,.03],[.31,.14,.03]],.02,gold,head);
   for(const side of [-1,1]){const g=group(head,'goggle');g.position.set(side*.145,.27,.246);mesh(new T.TorusGeometry(.105,.024,12,32),gold,0,0,0,g);ball(0,0,.005,.081,.081,.024,mat(0x557e88,{metalness:.6,roughness:.12}),g);}
  }
  if(hero===1)for(const side of [-1,1]){const tusk=mesh(new T.ConeGeometry(.058,.23,24),ivory,side*.19,-.13,.33,head,true);tusk.rotation.z=-side*.22;}
  if(hero===2||hero===3){tube([[-.29,.18,.17],[0,.3,.285],[.29,.18,.17]],.025,gold,head);mesh(new T.OctahedronGeometry(.066,1),accent,0,.275,.292,head);}
  if(hero===5){for(let i=0;i<7;i++){const x=(i-3)*.065;ball(x,-.24,.215,.063,.17+(.2-Math.abs(x))*.6,.072,hair,head,true);mesh(new T.TorusGeometry(.052,.016,8,16),gold,x,-.35,.215,head).rotation.x=Math.PI/2;}}
  if(hero===6){tube([[-.27,.31,.02],[0,.44,-.13],[.27,.31,.02]],.045,steel,head);}
  if(hero===7)for(const side of [-1,1])tube([[side*.22,.27,-.04],[side*.4,.49,-.10],[side*.36,.7,-.18],[side*.17,.75,-.11]],.07,ivory,head);
  tube([[-.13,-.17,.332],[0,-.19,.354],[.13,-.17,.332]],.011,mat(0x503e3b),head);
  bake(head);k.eyes=[];
  for(const side of hero===6?[0]:[-1,1]){
   const eye=group(head,'eye-'+k.eyes.length);eye.position.set(side*.135,.075,hero===6?.282:.26);const w=hero===6?.14:.082;
   ball(0,0,0,w,hero===6?.125:.057,.047,ivory,eye);
   ball(0,0,.043,w*.5,w*.55,.018,accent,eye);
   ball(0,0,.061,w*.24,w*.38,.011,mat(0x142128),eye);
   ball(-.016,.02,.07,.012,.015,.007,mat(0xffffff),eye);
   ball(0,hero===6?.125:.064,-.009,w*1.17,.035,.06,skinMat,eye);
   bake(eye);k.eyes.push(eye);
  }
  // A real column reaches the dashboard; the rim, hands and rotation axis share one frame.
  k.steeringPivot=group(k.body,'steeringPivot');k.steeringPivot.position.set(0,1.36,.35);k.steeringPivot.rotation.x=.6;
  const rim=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2;rim.push([Math.sin(a)*.32,Math.max(-.23,Math.cos(a)*.3),0]);}
  tube(rim,.041,rubber,k.steeringPivot);for(const x of [-.3,.3])strut([0,0,0],[x,0,0],.027,steel,k.steeringPivot);strut([0,0,0],[0,-.23,0],.023,steel,k.steeringPivot);ball(0,0,0,.075,.065,.04,accent,k.steeringPivot);bake(k.steeringPivot);
  const cockpit=group(k.body,'cockpit-details');strut([0,.94,.95],[0,1.36,.35],.045,steel,cockpit);
  softBox(.74,.13,.22,rubber,0,1.13,.70,cockpit,true);
  for(const x of [-.2,0,.2]){const gauge=group(cockpit,'gauge');gauge.position.set(x,1.21,.72);gauge.rotation.x=.8;mesh(new T.CircleGeometry(.079,28),mat(0x10252a),0,0,0,gauge);mesh(new T.TorusGeometry(.083,.013,10,28),gold,0,0,0,gauge);strut([0,0,.014],[.027,.044,.014],.007,accent,gauge);}
  bake(cockpit);
  // Six wheels need six separate arches and a longer chassis, with no adjacent tire overlap.
  if(k.ws.length===6){k.frame.scale.z*=1.17;const chassis=group(k.body,'six-wheel-chassis');for(const side of [-1,1]){softBox(.2,.22,4.35,steel,side*.72,.42,0,chassis,true);for(const z of [-1.76,0,1.76])strut([side*.25,.48,z],[side*1.14,.52,z],.058,gold,chassis);}bake(chassis);}
  const exhaust=group(k.body,'rear-exhausts');const tail=skin===1?-2.45:k.ws.length===6?-2.25:-1.88;
  for(const side of [-1,1]){
   const count=hero===6||skin===2?2:1;
   for(let j=0;j<count;j++){
    const x=side*(.61+j*.24),y=hero===1||hero===6?1.30:.85,tip=[x,y,tail];
    tube([[side*.62,.7,-.7],[x,.66,tail+.62],[x,y,tail+.20],tip],hero===7?.14:.105,steel,exhaust);
    // Annular open mouth: dark inner bore, bright rim and outer heat shield.
    for(const z of [tail+.18,tail+.09,tail])mesh(new T.TorusGeometry(hero===7?.145:.114,.022,12,32),gold,x,y,z,exhaust);
    mesh(new T.CircleGeometry(hero===7?.118:.087,28),mat(0x111b20),x,y,tail+.035,exhaust).rotation.y=Math.PI;
    const flame=group(k.body,'exhaust-flame-'+side+'-'+j);flame.position.set(...tip);flame.visible=false;
    // The flame mesh starts at the outlet, so stretching never moves its root.
    const plume=mesh(new T.ConeGeometry(.12,.95,28,1,true),mat(C.DRIVERS[hero].glow,{emissive:C.DRIVERS[hero].glow,emissiveIntensity:3,transparent:true,opacity:.8}),0,0,-.475,flame);plume.rotation.x=-Math.PI/2;
    const core=mesh(new T.ConeGeometry(.065,.56,24),mat(0xc3eaff,{emissive:0xbde6ff,emissiveIntensity:4}),0,0,-.28,flame);core.rotation.x=-Math.PI/2;
   }
  }
  bake(exhaust);
  k.g.updateMatrixWorld(true);const bounds=new T.Box3();for(const o of [k.frame,...k.ws.map(w=>w.parent),k.body.getObjectByName('six-wheel-chassis')].filter(Boolean))bounds.union(new T.Box3().setFromObject(o));
  k.collision={halfWidth:Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x))+.08,front:bounds.max.z+.08,rear:-bounds.min.z+.08};
  for(const wheel of k.ws){const siblings=k.ws.filter(w=>w.parent.position.x===wheel.parent.position.x&&w!==wheel);for(const other of siblings)if(Math.abs(other.parent.position.z-wheel.parent.position.z)<1.15)throw Error('Overlapping axles');}
  return k;
 }
 function bankTrack(t){
  t.meta.subtitle=['Каменные арки · пепельный ветер','Корни и грибные сады · дождь','Ледяные арки и серпантин · метель','Шестерни над виадуком · жар и искры','Рунные кольца · ливень и гроза'][t.courseIndex];
  t.banks=[];const base=t.sample;t.camber=t.segments.map((s,i)=>{
   const a=base(s.d-12),b=base(s.d+12);let bank=Math.max(-.3,Math.min(.3,C.angle(Math.atan2(b.tx,b.tz)-Math.atan2(a.tx,a.tz))/24*17));
   for(const g of t.gaps){const away=Math.max(g.start-32-s.d,s.d-g.end-32);bank*=Math.max(0,Math.min(1,away/18));}return bank;
  });
  t.bank=(d,lane)=>{d=C.wrap(d,t.length);const i=t.index(d),s=t.segments[i],rate=(t.camber[(i+1)%t.camber.length]-t.camber[i])/s.len,bank=t.camber[i]+rate*(d-s.d);return {y:bank*lane,crossSlope:bank,slope:rate*lane};};
 }
 function alignSurface(g,p){
  const forward=new T.Vector3(p.tx,p.slope,p.tz).normalize(),normal=new T.Vector3(-p.tx*p.slope+p.tz*p.crossSlope,1,-p.tz*p.slope-p.tx*p.crossSlope).normalize();
  const right=new T.Vector3().crossVectors(normal,forward).normalize();g.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right,new T.Vector3().crossVectors(forward,right),forward));
 }
 function reviseWorld(world,t,index){
  const gone=[];world.traverse(o=>{if(o.name==='gothic-city'||o.name==='distant-background'||o.name==='background-liquid')gone.push(o);});gone.forEach(o=>o.removeFromParent());
  for(const o of [...world.children])if(o.isSprite&&o.position.y>140)o.removeFromParent();
  const stone=mat(t.meta.stone,{roughness:.6}),steel=mat(0x667780,{metalness:.75,roughness:.3}),gold=mat(0xb49a6d,{metalness:.7,roughness:.3});
  const additions=group(world,'road-attached-scenery');
  // Tie every roadside structure to the edge with a stone shelf and diagonal brackets.
  world.updateMatrixWorld(true);const anchors=[];world.traverse(o=>{if(!o.isGroup||o.position.length()<1||o.name==='raven')return;const v=o.getWorldPosition(new T.Vector3()),p=t.nearest(v.x,v.z,undefined,v.y);if(Math.abs(p.lane)>11.3&&Math.abs(p.lane)<30&&Math.abs(p.y-v.y)<6)anchors.push(p);});
  for(const p of anchors){const side=Math.sign(p.lane),edge=t.sample(p.d,side*10.95),outer=t.sample(p.d,p.lane+side*1.8),mid=new T.Vector3(edge.x+outer.x,edge.y+outer.y-.45,edge.z+outer.z).multiplyScalar(.5),g=group(additions,'edge-bracket');g.position.copy(mid);g.rotation.y=Math.atan2(p.tx,p.tz);const width=Math.hypot(edge.x-outer.x,edge.z-outer.z);alignSurface(g,t.sample(p.d,(side*10.95+p.lane+side*1.8)*.5));softBox(width,.5,4.6,stone,0,0,0,g,true);for(const z of [-1.45,1.45])strut([side*width*.5,-2.4,z],[-side*width*.43,-.23,z],.16,steel,g);bake(g);}
  // The five courses have different built silhouettes as well as different weather.
  for(let i=0;i<18;i++){
   const d=(i+.55)/18*t.length;if(t.bridgeAt(d))continue;const side=i%2?1:-1,p=t.sample(d,side*11.1),g=group(additions,'theme-scenery');g.position.set(p.x,p.y,p.z);g.rotation.y=Math.atan2(p.tx,p.tz);
   if(index===0){for(const z of [-2,2]){softBox(.7,3.1,.7,stone,0,1.4,z,g,true);mesh(new T.ConeGeometry(.58,.9,8),gold,0,3.2,z,g);}tube([[0,2,-2],[0,3.6,0],[0,2,2]],.23,stone,g);}
   if(index===1){for(let j=0;j<5;j++){const x=side*(.3+j*.12),z=(j-2)*.65;strut([x,0,z],[x,.4+j*.09,z],.06,mat(0x807868),g);ball(x,.4+j*.09,z,.5,.16,.44,mat(j%2?0x5d9278:0x9b7b55),g,true);}for(let j=0;j<4;j++)tube([[0,.1,(j-2)*.55],[side*.8,-1.5,j*.5],[side*1.1,-3.1,j*.7]],.07,mat(0x394e3c),g);}
   if(index===2){softBox(.65,.35,4.5,mat(0xdae5e7,{roughness:.92}),0,.19,0,g,true);for(let j=0;j<6;j++){const icicle=mesh(new T.ConeGeometry(.12,.7+j%3*.35,20),mat(0x97cfe4,{metalness:.25,roughness:.12}),side*.22,-.3-j%3*.15,(j-2.5)*.6,g);icicle.rotation.z=Math.PI;}tube([[0,0,0],[side*.3,3,0],[-side*1.4,4.9,0]],.24,mat(0xb3d5e3,{roughness:.24}),g);}
   if(index===3){const gear=group(g,'forge-gear');gear.position.set(side*.3,1.8,0);gear.rotation.y=Math.PI/2;mesh(new T.TorusGeometry(1.3,.19,12,48),steel,0,0,0,gear);for(let j=0;j<12;j++){const a=j/12*Math.PI*2;const tooth=softBox(.34,.5,.24,gold,Math.sin(a)*1.3,Math.cos(a)*1.3,0,gear,true);tooth.rotation.z=-a;if(j%3===0)strut([0,0,0],[Math.sin(a),Math.cos(a),0],.09,steel,gear);}bake(gear);tube([[0,-.4,-3],[0,.8,-2],[0,.8,2],[0,-.4,3]],.18,steel,g);}
   if(index===4){const ring=group(g,'oracle-ring');ring.position.set(0,2.4,0);mesh(new T.TorusGeometry(1.2,.12,12,56),gold,0,0,0,ring);mesh(new T.OctahedronGeometry(.47,2),mat(0x64b9c5,{emissive:0x498f9e,emissiveIntensity:.7,metalness:.5}),0,0,0,ring);strut([0,0,0],[0,1.2,0],.06,stone,g);for(const z of [-2.1,2.1])softBox(.65,1.4,.65,stone,0,.7,z,g,true);}
   const moving=g.children.filter(o=>o.name==='forge-gear'||o.name==='oracle-ring');moving.forEach(o=>o.removeFromParent());bake(g);if(moving.length)g.add(...moving);
  }
  for(const crossing of t.overpasses)for(const offset of [-36,36]){const p=t.sample(crossing.upper+offset),g=group(additions,'bridge-crossbeam');g.position.set(p.x,p.y-2.9,p.z);alignSurface(g,p);softBox(28,.8,2.4,stone,0,0,0,g,true);}
  for(const o of world.children)if(o.name==='track-strip'){o.material.roughness=[.64,.16,.28,.58,.10][index];o.material.metalness=[.12,.35,.28,.38,.4][index];}
 }
 return {reviseKart,bankTrack,reviseWorld,drivers:C.DRIVERS.map((d,i)=>({...d,name:names[i],kind:kinds[i]}))};
};
