// === SCENE 1: CINEMATIC INTRO ===
class SceneIntro {
    constructor(W,H){this.W=W;this.H=H;this.t=0;this.duration=350;this.ps=new ParticleSystem();this.ringAngle=0;}
    reset(){this.t=0;this.ps.clear();this.ringAngle=0;}
    update(){
        this.t++;this.ringAngle+=0.02;
        if(this.t%2===0){
            const a=Math.random()*Math.PI*2,r=150+Math.random()*50;
            this.ps.emit(this.W/2+Math.cos(a)*r,this.H/2+Math.sin(a)*r,1,{
                vx:(Math.random()-0.5)*1.5,vy:(Math.random()-0.5)*1.5,
                life:60,size:1.5,color:[0,255,255],glow:12,trail:true,friction:0.97
            });
        }
        if(this.t>60&&this.t%4===0){
            this.ps.emit(this.W/2+(Math.random()-0.5)*300,this.H/2+(Math.random()-0.5)*150,1,{
                vx:0,vy:-0.5-Math.random(),life:80,size:1,color:[0,180,255],glow:8
            });
        }
        this.ps.update();
    }
    draw(ctx){
        const W=this.W,H=this.H,t=this.t,cx=W/2,cy=H/2;
        // Radial burst
        const ba=t<60?easeOutQuart(t/60):1;
        ctx.save();ctx.globalAlpha=ba*0.2;
        const g=ctx.createRadialGradient(cx,cy,0,cx,cy,350);
        g.addColorStop(0,'#0ff');g.addColorStop(0.5,'#0066ff');g.addColorStop(1,'transparent');
        ctx.fillStyle=g;ctx.fillRect(0,0,W,H);ctx.restore();
        // Spinning rings
        ctx.save();ctx.translate(cx,cy);
        for(let i=0;i<3;i++){
            const r=120+i*40,a=this.ringAngle*(i%2===0?1:-1);
            ctx.strokeStyle=`rgba(0,255,255,${0.15-i*0.04})`;
            ctx.lineWidth=1.5;ctx.setLineDash([8,20]);
            ctx.beginPath();ctx.arc(0,0,r,a,a+Math.PI*1.5);ctx.stroke();
        }
        ctx.setLineDash([]);ctx.restore();
        this.ps.draw(ctx);
        // Lightning bolt
        const bA=t<30?0:t<60?easeOutQuart((t-30)/30):1;
        ctx.save();ctx.globalAlpha=bA;ctx.fillStyle='#0ff';
        ctx.shadowBlur=50;ctx.shadowColor='#0ff';
        ctx.font=`bold ${85+Math.sin(t*0.1)*5}px Orbitron`;
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText('⚡',cx,cy-70);ctx.restore();
        // Title
        const tA=t<60?0:t<120?easeOutQuart((t-60)/60):1;
        drawGlowText(ctx,'ChargeIQ',cx,cy+20,68,'#0ff',35,tA);
        // Subtitle
        const sA=t<100?0:t<160?easeOutQuart((t-100)/60):1;
        drawGlowText(ctx,'Intelligent EV Charging Station Controller',cx,cy+80,20,'#0088cc',12,sA);
        // Tech tags
        const s2A=t<140?0:t<200?easeOutQuart((t-140)/60):1;
        const tags=['Fuzzy Logic','IoT','CC-CV','PWM','Thermal Protection','Auto-Stop'];
        tags.forEach((tag,i)=>{
            const tx=cx-250+i*100,ty=cy+130;
            ctx.save();ctx.globalAlpha=s2A*(0.5+Math.sin(t*0.05+i)*0.3);
            ctx.fillStyle='rgba(0,255,255,0.08)';ctx.strokeStyle='rgba(0,255,255,0.25)';
            ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(tx-40,ty-12,80,24,12);ctx.fill();ctx.stroke();
            drawGlowText(ctx,tag,tx,ty,10,'#0ff',5,s2A);
            ctx.restore();
        });
        // Team info
        if(t>200){
            const a=Math.min(1,(t-200)/40);
            drawGlowTextThin(ctx,'EL Semester 4 Project',cx,cy+175,16,'#555',0,a*0.6);
        }
    }
}

// === SCENE 2: DUMB vs SMART ===
class SceneDumbVsSmart {
    constructor(W,H){
        this.W=W;this.H=H;this.t=0;this.duration=650;
        this.ps=new ParticleSystem();
        this.dumbSOC=0;this.smartSOC=0;
        this.dumbStream=new EnergyStream(0,0,0,0,{color:[255,32,32],speed:0.03,particleCount:12});
        this.smartStream=new EnergyStream(0,0,0,0,{color:[0,255,255],speed:0.02,particleCount:12});
        this.carX=-200;this.shakeIntensity=0;this.wheelAngle=0;
    }
    reset(){this.t=0;this.dumbSOC=0;this.smartSOC=0;this.ps.clear();this.carX=-200;this.shakeIntensity=0;this.wheelAngle=0;}
    update(){
        this.t++;const t=this.t,W=this.W,H=this.H;
        if(t<80){this.carX=lerp(-200,0,easeInOutCubic(t/80));this.wheelAngle+=0.15;}
        if(t>100){
            this.dumbSOC=Math.min(108,(t-100)*0.25);
            const st=(t-100)*0.2;
            this.smartSOC=Math.min(100,st<60?st:60+(st-60)*0.5);
            this.dumbStream.setPoints(W*0.25-60,H*0.52,W*0.25-130,H*0.52);
            this.smartStream.setPoints(W*0.75-60,H*0.52,W*0.75-130,H*0.52);
            this.dumbStream.start();this.smartStream.start();
        }
        if(this.dumbSOC>95){
            this.shakeIntensity=Math.min(10,(this.dumbSOC-95)*0.9);
            if(t%3===0) this.ps.emit(W*0.25-100+Math.random()*30,H*0.32,3,{
                vx:(Math.random()-0.5)*2,vy:-1.5-Math.random()*2,
                life:50,size:3,color:[80,80,80],gravity:-0.02,glow:4
            });
            if(t%5===0) emitSparkBurst(this.ps,W*0.25-90+Math.random()*20,H*0.48,3,[255,100,0],4);
        }
        if(this.smartSOC>=99.5&&t%15===0){
            emitSparkBurst(this.ps,W*0.75-90,H*0.52,5,[57,255,20],3);
        }
        this.dumbStream.update();this.smartStream.update();this.ps.update();
    }
    draw(ctx){
        const W=this.W,H=this.H,t=this.t,cx=this.carX;
        // Divider
        ctx.save();ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.lineWidth=1;ctx.setLineDash([4,12]);
        ctx.beginPath();ctx.moveTo(W/2,60);ctx.lineTo(W/2,H-60);ctx.stroke();ctx.restore();
        // VS badge
        if(t>90){
            const a=Math.min(1,(t-90)/30);
            ctx.save();ctx.globalAlpha=a;
            ctx.fillStyle='rgba(255,255,255,0.05)';ctx.beginPath();ctx.arc(W/2,H/2,35,0,Math.PI*2);ctx.fill();
            ctx.fillStyle='#fff';ctx.shadowBlur=25;ctx.shadowColor='#fff';
            ctx.font='bold 32px Orbitron';ctx.textAlign='center';ctx.textBaseline='middle';
            ctx.fillText('VS',W/2,H/2);ctx.restore();
        }
        // --- LEFT: DUMB ---
        const shk=this.shakeIntensity;
        const sx=shk>0?(Math.random()-0.5)*shk:0,sy=shk>0?(Math.random()-0.5)*shk:0;
        if(t>30){
            const la=Math.min(1,(t-30)/40);
            drawGlowText(ctx,'DUMB CHARGER',W*0.25,70,20,'#ff2020',15,la);
            drawGlowTextThin(ctx,'Fixed CC-CV • No Intelligence',W*0.25,95,13,'#aa0000',3,la*0.6);
        }
        if(t>10) drawCar(ctx,W*0.25+50+cx+sx,H*0.42+sy,0.8,'#2a2a3e','#ff2020',this.wheelAngle);
        drawChargingStation(ctx,W*0.25-85+sx,H*0.47+sy,0.75,'#ff2020','#ff2020',t);
        const dBc=this.dumbSOC>95?'#ff2020':'#ff6600';
        drawBattery(ctx,W*0.25-40+sx,H*0.67+sy,65,90,Math.min(100,this.dumbSOC),dBc,'#ff4444',shk>0?25:10);
        // Dumb current - always flat
        if(t>120){
            const ba=Math.min(1,(t-120)/30);
            ctx.save();ctx.globalAlpha=ba;
            // Current graph
            ctx.strokeStyle='rgba(255,255,255,0.1)';ctx.lineWidth=1;
            ctx.beginPath();ctx.moveTo(W*0.05,H*0.87);ctx.lineTo(W*0.45,H*0.87);ctx.stroke();
            ctx.strokeStyle='#ff2020';ctx.lineWidth=2.5;ctx.shadowBlur=8;ctx.shadowColor='#ff2020';
            ctx.beginPath();ctx.moveTo(W*0.05,H*0.84);ctx.lineTo(W*0.45,H*0.84);ctx.stroke();
            drawGlowText(ctx,'CURRENT: MAX (ALWAYS)',W*0.25,H*0.92,11,'#ff4444',8,ba*0.8);
            drawGlowTextThin(ctx,'No battery health consideration',W*0.25,H*0.96,11,'#882222',0,ba*0.5);
            ctx.restore();
        }
        if(this.dumbSOC>100){
            const wa=0.5+Math.sin(t*0.2)*0.5;
            drawGlowText(ctx,'⚠ OVERCHARGE DAMAGE',W*0.25,H*0.32,15,'#ff2020',22,wa);
            drawGlowTextThin(ctx,'Battery degradation • Fire risk',W*0.25,H*0.36,12,'#ff6600',5,wa*0.7);
        }
        // --- RIGHT: SMART ---
        if(t>30){
            const la=Math.min(1,(t-30)/40);
            drawGlowText(ctx,'ChargeIQ',W*0.75,70,20,'#0ff',15,la);
            drawGlowTextThin(ctx,'Adaptive Fuzzy Logic • Safe',W*0.75,95,13,'#0088cc',3,la*0.6);
        }
        if(t>10) drawCar(ctx,W*0.75+50+cx,H*0.42,0.8,'#1a1a3e','#0ff',this.wheelAngle);
        drawChargingStation(ctx,W*0.75-85,H*0.47,0.75,'#0ff','#0ff',t);
        drawBattery(ctx,W*0.75-40,H*0.67,65,90,this.smartSOC,'#0ff','#00aaaa',15);
        // Smart current - adaptive curve
        if(t>120&&this.smartSOC>0){
            const ba=Math.min(1,(t-120)/30);
            ctx.save();ctx.globalAlpha=ba;
            ctx.strokeStyle='rgba(255,255,255,0.1)';ctx.lineWidth=1;
            ctx.beginPath();ctx.moveTo(W*0.55,H*0.87);ctx.lineTo(W*0.95,H*0.87);ctx.stroke();
            // Curved line showing current decrease
            ctx.strokeStyle='#0ff';ctx.lineWidth=2.5;ctx.shadowBlur=8;ctx.shadowColor='#0ff';
            ctx.beginPath();
            const gw=W*0.4;
            for(let i=0;i<=40;i++){
                const px=W*0.55+i*(gw/40);
                const prog=i/40;
                const cy=H*0.87-(prog<0.4?30:prog<0.7?30*(1-(prog-0.4)/0.3)*0.6+12:prog<0.9?12*(1-(prog-0.7)/0.2):2);
                if(i===0)ctx.moveTo(px,cy);else ctx.lineTo(px,cy);
            }
            ctx.stroke();
            const mode=this.smartSOC<40?'FAST':this.smartSOC<75?'NORMAL':this.smartSOC<90?'TRICKLE':'COMPLETE';
            drawGlowText(ctx,`MODE: ${mode}`,W*0.75,H*0.92,11,'#0ff',8,ba*0.8);
            drawGlowTextThin(ctx,'CC→CV transition • Battery safe',W*0.75,H*0.96,11,'#006688',0,ba*0.5);
            ctx.restore();
        }
        if(this.smartSOC>=99.5){
            drawGlowText(ctx,'✓ SAFE & COMPLETE',W*0.75,H*0.32,15,'#39ff14',22,0.7+Math.sin(t*0.1)*0.3);
            drawGlowTextThin(ctx,'Battery lifespan preserved',W*0.75,H*0.36,12,'#2ab510',5,0.6);
        }
        this.dumbStream.draw(ctx);this.smartStream.draw(ctx);this.ps.draw(ctx);
    }
}

// === SCENE 3: FUZZY LOGIC ENGINE ===
class SceneFuzzyLogic {
    constructor(W,H){
        this.W=W;this.H=H;this.t=0;this.duration=550;
        this.ps=new ParticleSystem();
        this.inputStream1=new EnergyStream(0,0,0,0,{color:[255,153,0],speed:0.025,particleCount:10});
        this.inputStream2=new EnergyStream(0,0,0,0,{color:[0,255,255],speed:0.025,particleCount:10});
        this.inputStream3=new EnergyStream(0,0,0,0,{color:[255,80,80],speed:0.025,particleCount:8});
        this.outputStream=new EnergyStream(0,0,0,0,{color:[57,255,20],speed:0.03,particleCount:10});
        this.phase=0;
    }
    reset(){this.t=0;this.phase=0;this.ps.clear();}
    update(){
        this.t++;const t=this.t,W=this.W,H=this.H;
        if(t>40)this.phase=1;if(t>120)this.phase=2;if(t>200)this.phase=3;if(t>300)this.phase=4;
        if(this.phase>=1){
            this.inputStream1.setPoints(W*0.1,H*0.33,W*0.35,H*0.45);
            this.inputStream2.setPoints(W*0.1,H*0.5,W*0.35,H*0.5);
            this.inputStream3.setPoints(W*0.1,H*0.67,W*0.35,H*0.55);
            this.inputStream1.start();this.inputStream2.start();this.inputStream3.start();
        }
        if(this.phase>=4){
            this.outputStream.setPoints(W*0.65,H*0.5,W*0.88,H*0.5);
            this.outputStream.start();
        }
        if(this.phase>=2&&t%4===0){
            this.ps.emit(W*0.5,H*0.5,2,{
                vx:(Math.random()-0.5)*4,vy:(Math.random()-0.5)*4,
                life:20,size:2,color:[0,191,255],glow:15,trail:true,friction:0.95
            });
        }
        this.inputStream1.update();this.inputStream2.update();this.inputStream3.update();
        this.outputStream.update();this.ps.update();
    }
    draw(ctx){
        const W=this.W,H=this.H,t=this.t;
        drawGlowText(ctx,'THE BRAIN: FUZZY LOGIC ENGINE',W/2,45,22,'#0ff',15,Math.min(1,t/40));
        // Input nodes
        if(this.phase>=1){
            const a=Math.min(1,(t-40)/30);
            const inputs=[
                {label:'SOC',val:'45%',color:'#ff9900',y:H*0.28,unit:'State of Charge'},
                {label:'TEMP',val:'28°C',color:'#0ff',y:H*0.45,unit:'Battery Temperature'},
                {label:'VOLT',val:'12.4V',color:'#ff5050',y:H*0.62,unit:'Terminal Voltage'}
            ];
            inputs.forEach(inp=>{
                ctx.save();ctx.globalAlpha=a;
                ctx.fillStyle=`${inp.color}15`;ctx.strokeStyle=inp.color;
                ctx.lineWidth=2;ctx.shadowBlur=12;ctx.shadowColor=inp.color;
                ctx.beginPath();ctx.roundRect(W*0.02,inp.y,W*0.1,55,8);ctx.fill();ctx.stroke();
                drawGlowText(ctx,inp.label,W*0.07,inp.y+15,13,inp.color,8,a);
                drawGlowText(ctx,inp.val,W*0.07,inp.y+35,18,'#fff',5,a);
                drawGlowTextThin(ctx,inp.unit,W*0.07,inp.y+52,9,inp.color,0,a*0.5);
                ctx.restore();
            });
        }
        // Central chip
        const cg=this.phase>=2,chipX=W*0.5,chipY=H*0.5;
        ctx.save();
        ctx.fillStyle=cg?'#081828':'#0a0a1a';
        ctx.strokeStyle=cg?'#0ff':'#333';ctx.lineWidth=3;
        ctx.shadowBlur=cg?35:0;ctx.shadowColor='#0ff';
        ctx.beginPath();ctx.roundRect(chipX-90,chipY-65,180,130,12);ctx.fill();ctx.stroke();
        // Chip pins
        ctx.fillStyle='#777';
        for(let i=0;i<7;i++){ctx.fillRect(chipX-75+i*22,chipY-73,8,10);ctx.fillRect(chipX-75+i*22,chipY+63,8,10);}
        for(let i=0;i<5;i++){ctx.fillRect(chipX-98,chipY-48+i*22,10,8);ctx.fillRect(chipX+88,chipY-48+i*22,10,8);}
        drawGlowText(ctx,'🧠',chipX,chipY-20,34,'#fff',0,1);
        drawGlowText(ctx,'FUZZY ENGINE',chipX,chipY+15,12,cg?'#0ff':'#555',cg?10:0,1);
        drawGlowTextThin(ctx,'Mamdani Inference',chipX,chipY+35,10,cg?'#0088aa':'#333',0,cg?0.7:0.3);
        ctx.restore();
        // Membership functions
        if(this.phase>=2){
            const a=Math.min(1,(t-120)/40);
            const mfY=H*0.08;
            ctx.save();ctx.globalAlpha=a;
            ctx.fillStyle='rgba(0,0,0,0.6)';ctx.strokeStyle='rgba(0,255,255,0.25)';ctx.lineWidth=1;
            ctx.beginPath();ctx.roundRect(W*0.28,mfY,W*0.44,110,6);ctx.fill();ctx.stroke();
            drawGlowText(ctx,'MEMBERSHIP FUNCTIONS (Fuzzification)',W*0.5,mfY+15,10,'#0ff',5,a);
            const gx=W*0.3,gy=mfY+90,gw=W*0.4,gh=50;
            // Axis
            ctx.strokeStyle='rgba(255,255,255,0.2)';ctx.lineWidth=1;
            ctx.beginPath();ctx.moveTo(gx,gy);ctx.lineTo(gx+gw,gy);ctx.stroke();
            // LOW
            ctx.strokeStyle='#ff9900';ctx.lineWidth=2;ctx.fillStyle='rgba(255,153,0,0.1)';
            ctx.beginPath();ctx.moveTo(gx,gy);ctx.lineTo(gx+gw*0.2,gy-gh);ctx.lineTo(gx+gw*0.4,gy);ctx.fill();ctx.stroke();
            // MEDIUM
            ctx.strokeStyle='#0ff';ctx.lineWidth=3;ctx.shadowBlur=12;ctx.shadowColor='#0ff';
            ctx.fillStyle='rgba(0,255,255,0.15)';
            ctx.beginPath();ctx.moveTo(gx+gw*0.2,gy);ctx.lineTo(gx+gw*0.45,gy-gh);ctx.lineTo(gx+gw*0.7,gy);ctx.fill();ctx.stroke();
            // HIGH
            ctx.shadowBlur=0;ctx.strokeStyle='#39ff14';ctx.lineWidth=2;ctx.fillStyle='rgba(57,255,20,0.1)';
            ctx.beginPath();ctx.moveTo(gx+gw*0.5,gy);ctx.lineTo(gx+gw*0.75,gy-gh);ctx.lineTo(gx+gw,gy);ctx.fill();ctx.stroke();
            // Indicator
            const indX=gx+gw*0.45;
            ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.setLineDash([3,3]);
            ctx.beginPath();ctx.moveTo(indX,gy+5);ctx.lineTo(indX,gy-gh-5);ctx.stroke();ctx.setLineDash([]);
            // Intersection highlight
            ctx.fillStyle='#0ff';ctx.shadowBlur=8;ctx.shadowColor='#0ff';
            ctx.beginPath();ctx.arc(indX,gy-gh*0.9,4,0,Math.PI*2);ctx.fill();
            drawGlowText(ctx,'45%',indX,gy+15,9,'#fff',5,a);
            drawGlowText(ctx,'LOW',gx+gw*0.15,gy+15,8,'#ff9900',0,a*0.5);
            drawGlowText(ctx,'MEDIUM',gx+gw*0.45,gy+15,8,'#0ff',5,a);
            drawGlowText(ctx,'HIGH',gx+gw*0.75,gy+15,8,'#39ff14',0,a*0.5);
            ctx.restore();
        }
        // Rule table
        if(this.phase>=3){
            const a=Math.min(1,(t-200)/40);
            const ry=H*0.75;
            ctx.save();ctx.globalAlpha=a;
            ctx.fillStyle='rgba(0,0,0,0.5)';ctx.strokeStyle='rgba(0,255,255,0.15)';ctx.lineWidth=1;
            ctx.beginPath();ctx.roundRect(W*0.2,ry-25,W*0.6,130,6);ctx.fill();ctx.stroke();
            drawGlowText(ctx,'RULE BASE (IF-THEN)',W*0.5,ry-10,10,'#0ff',5,a);
            const rules=[
                {text:'IF SOC=LOW  & TEMP=NORMAL  → CURRENT=HIGH   (4.5A)',active:false},
                {text:'IF SOC=MED  & TEMP=NORMAL  → CURRENT=MEDIUM (2.5A)',active:true},
                {text:'IF SOC=HIGH & TEMP=NORMAL  → CURRENT=LOW    (0.8A)',active:false},
                {text:'IF ANY      & TEMP=HOT     → CURRENT=STOP   (0A)',active:false},
            ];
            rules.forEach((r,i)=>{
                const yy=ry+10+i*25;
                if(r.active){
                    ctx.fillStyle='rgba(57,255,20,0.12)';ctx.strokeStyle='#39ff14';ctx.lineWidth=1;
                    ctx.shadowBlur=10;ctx.shadowColor='#39ff14';
                    ctx.beginPath();ctx.roundRect(W*0.22,yy-10,W*0.56,22,3);ctx.fill();ctx.stroke();
                }
                ctx.shadowBlur=0;
                ctx.fillStyle=r.active?'#39ff14':'#556';
                ctx.font='12px Share Tech Mono';ctx.textAlign='center';ctx.fillText(r.text,W*0.5,yy+4);
            });
            ctx.restore();
        }
        // Output
        if(this.phase>=4){
            const a=Math.min(1,(t-300)/40);
            ctx.save();ctx.globalAlpha=a;
            ctx.fillStyle='rgba(57,255,20,0.1)';ctx.strokeStyle='#39ff14';
            ctx.shadowBlur=15;ctx.shadowColor='#39ff14';ctx.lineWidth=2;
            ctx.beginPath();ctx.roundRect(W*0.83,H*0.35,W*0.14,100,8);ctx.fill();ctx.stroke();
            drawGlowText(ctx,'OUTPUT',W*0.9,H*0.39,12,'#39ff14',10,a);
            drawGlowText(ctx,'MEDIUM',W*0.9,H*0.45,18,'#fff',5,a);
            drawGlowText(ctx,'2.5A',W*0.9,H*0.51,16,'#0ff',8,a);
            drawGlowTextThin(ctx,'Defuzzified',W*0.9,H*0.56,10,'#39ff14',0,a*0.6);
            // PWM waveform
            const py=H*0.62;
            ctx.strokeStyle='#0bf';ctx.lineWidth=2;ctx.shadowBlur=8;ctx.shadowColor='#0bf';
            ctx.beginPath();
            const pw=W*0.13;
            for(let i=0;i<5;i++){
                const bx=W*0.835+i*(pw/5);
                ctx.lineTo(bx,py);ctx.lineTo(bx,py-18);ctx.lineTo(bx+pw*0.12,py-18);ctx.lineTo(bx+pw*0.12,py);
            }
            ctx.stroke();
            drawGlowText(ctx,'PWM ~65% Duty',W*0.9,py+15,9,'#0bf',5,a);
            ctx.restore();
        }
        this.inputStream1.draw(ctx);this.inputStream2.draw(ctx);this.inputStream3.draw(ctx);
        this.outputStream.draw(ctx);this.ps.draw(ctx);
    }
}
