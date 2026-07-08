// === SCENE 4: PROTECTION SCENARIOS ===
class SceneProtection {
    constructor(W,H){
        this.W=W;this.H=H;this.t=0;this.duration=750;
        this.ps=new ParticleSystem();
        this.adaptiveSOC=30;this.temp=28;this.tempDir=1;
        this.relayOpen=false;this.faultTriggered=false;
    }
    reset(){
        this.t=0;this.ps.clear();this.adaptiveSOC=30;this.temp=28;this.tempDir=1;
        this.relayOpen=false;this.faultTriggered=false;
    }
    update(){
        this.t++;const t=this.t;
        if(t>60)this.adaptiveSOC=Math.min(100,30+(t-60)*0.15);
        if(t>60){this.temp+=this.tempDir*0.3;if(this.temp>58)this.tempDir=-1;if(this.temp<28)this.tempDir=1;}
        if(this.adaptiveSOC>=100&&!this.relayOpen){
            this.relayOpen=true;
            emitSparkBurst(this.ps,this.W*0.25,this.H*0.75+40,20,[57,255,20],5);
        }
        if(t>480&&!this.faultTriggered){
            this.faultTriggered=true;
            emitSparkBurst(this.ps,this.W*0.75,this.H*0.75+30,25,[255,32,32],7);
        }
        this.ps.update();
    }
    draw(ctx){
        const W=this.W,H=this.H,t=this.t,midX=W/2,midY=H/2;
        drawGlowText(ctx,'REAL-TIME PROTECTION SYSTEM',W/2,35,22,'#0ff',15,Math.min(1,t/40));
        drawGlowTextThin(ctx,'4 Independent Safety Layers',W/2,58,13,'#0088cc',0,Math.min(1,t/60)*0.6);
        // Grid
        ctx.save();ctx.strokeStyle='rgba(0,255,255,0.1)';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(midX,75);ctx.lineTo(midX,H-30);ctx.stroke();
        ctx.beginPath();ctx.moveTo(40,midY+5);ctx.lineTo(W-40,midY+5);ctx.stroke();ctx.restore();

        // === Q1: ADAPTIVE CHARGING ===
        const q1x=W*0.25,q1y=H*0.3;
        drawGlowText(ctx,'① ADAPTIVE CC-CV',q1x,82,14,'#0ff',10,Math.min(1,(t-20)/30));
        if(t>60){
            drawGauge(ctx,q1x,q1y+20,45,this.adaptiveSOC,100,'#0ff','SOC%');
            const mode=this.adaptiveSOC<50?'CC-FAST':this.adaptiveSOC<75?'CC-NORMAL':this.adaptiveSOC<90?'CV-TRICKLE':'DONE';
            const mc=this.adaptiveSOC<50?'#0ff':this.adaptiveSOC<75?'#0bf':this.adaptiveSOC<90?'#ff9900':'#39ff14';
            drawGlowText(ctx,mode,q1x,q1y+85,14,mc,10,1);
            // Current bar
            const cp=this.adaptiveSOC<50?1:this.adaptiveSOC<75?0.6:this.adaptiveSOC<90?0.25:0.05;
            ctx.save();ctx.fillStyle='rgba(255,255,255,0.08)';ctx.beginPath();ctx.roundRect(q1x-55,q1y+100,110,7,3);ctx.fill();
            ctx.fillStyle=mc;ctx.shadowBlur=6;ctx.shadowColor=mc;
            ctx.beginPath();ctx.roundRect(q1x-55,q1y+100,110*cp,7,3);ctx.fill();
            drawGlowTextThin(ctx,`${Math.round(cp*4.5)}A output`,q1x,q1y+118,10,mc,0,0.7);
            ctx.restore();
        }

        // === Q2: THERMAL PROTECTION ===
        const q2x=W*0.75,q2y=H*0.3;
        drawGlowText(ctx,'② THERMAL GUARD',q2x,82,14,'#ff9900',10,Math.min(1,(t-20)/30));
        if(t>60){
            drawThermometer(ctx,q2x-15,q2y-35,this.temp,70);
            // Threshold lines
            ctx.save();
            ctx.strokeStyle='rgba(255,153,0,0.3)';ctx.lineWidth=1;ctx.setLineDash([3,4]);
            const t45y=q2y-35+90*(1-45/70);
            ctx.beginPath();ctx.moveTo(q2x+20,t45y);ctx.lineTo(q2x+60,t45y);ctx.stroke();
            drawGlowTextThin(ctx,'45°C limit',q2x+55,t45y-8,9,'#ff9900',0,0.5);
            ctx.setLineDash([]);ctx.restore();
            if(this.temp>45){
                const wa=0.5+Math.sin(t*0.15)*0.5;
                drawGlowText(ctx,'⚠ DERATING',q2x,q2y+80,12,'#ff9900',15,wa);
                const rp=Math.max(0.1,1-(this.temp-45)/20);
                ctx.save();ctx.fillStyle='rgba(255,255,255,0.08)';ctx.beginPath();ctx.roundRect(q2x-55,q2y+93,110,6,3);ctx.fill();
                ctx.fillStyle=this.temp>50?'#ff2020':'#ff9900';ctx.shadowBlur=6;ctx.shadowColor='#ff9900';
                ctx.beginPath();ctx.roundRect(q2x-55,q2y+93,110*rp,6,3);ctx.fill();
                drawGlowTextThin(ctx,`Current: ${(rp*4.5).toFixed(1)}A`,q2x,q2y+110,10,'#ff9900',0,wa*0.7);
                ctx.restore();
            }
        }

        // === Q3: AUTO STOP ===
        const q3x=W*0.25,q3y=H*0.75;
        drawGlowText(ctx,'③ AUTO-STOP RELAY',q3x,midY+30,14,'#39ff14',10,Math.min(1,(t-20)/30));
        if(t>60){
            ctx.save();ctx.translate(q3x,q3y);
            // Relay body
            ctx.fillStyle='#121828';ctx.strokeStyle=this.relayOpen?'#39ff14':'#444';
            ctx.lineWidth=2;ctx.shadowBlur=this.relayOpen?18:0;ctx.shadowColor='#39ff14';
            ctx.beginPath();ctx.roundRect(-45,-28,90,56,6);ctx.fill();ctx.stroke();
            // Coil symbol
            ctx.strokeStyle=this.relayOpen?'#39ff14':'#555';ctx.lineWidth=1.5;
            ctx.beginPath();
            for(let i=0;i<3;i++){ctx.arc(-25+i*10,-10,5,Math.PI,0,false);}
            ctx.stroke();
            // Contact arm
            ctx.strokeStyle=this.relayOpen?'#ff2020':'#39ff14';ctx.lineWidth=4;ctx.shadowBlur=8;
            ctx.shadowColor=this.relayOpen?'#ff2020':'#39ff14';
            ctx.beginPath();ctx.moveTo(-20,8);
            ctx.lineTo(this.relayOpen?10:-2,this.relayOpen?-14:8);ctx.lineTo(20,this.relayOpen?-14:8);
            ctx.stroke();
            // Contacts
            ctx.fillStyle='#aaa';ctx.shadowBlur=0;
            ctx.beginPath();ctx.arc(-20,8,4,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.arc(20,8,4,0,Math.PI*2);ctx.fill();
            // NO/NC labels
            drawGlowTextThin(ctx,'NO',25,-18,8,'#888',0,0.5);
            drawGlowTextThin(ctx,'COM',-25,20,8,'#888',0,0.5);
            ctx.restore();
            if(this.relayOpen){
                drawGlowText(ctx,'✓ RELAY OPEN',q3x,q3y+48,12,'#39ff14',12,0.7+Math.sin(t*0.08)*0.3);
                drawGlowTextThin(ctx,'Battery disconnected safely',q3x,q3y+65,10,'#2ab510',0,0.5);
            } else {
                drawGlowTextThin(ctx,'RELAY CLOSED — Charging',q3x,q3y+48,11,'#555',0,0.5);
            }
        }

        // === Q4: FAULT PROTECTION ===
        const q4x=W*0.75,q4y=H*0.75;
        drawGlowText(ctx,'④ FAULT DETECT',q4x,midY+30,14,'#ff2020',10,Math.min(1,(t-20)/30));
        if(t>60){
            ctx.save();ctx.translate(q4x-70,q4y-30);
            // Graph area
            ctx.fillStyle='rgba(0,0,0,0.3)';ctx.beginPath();ctx.roundRect(-5,-5,150,80,4);ctx.fill();
            ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=1;
            ctx.beginPath();ctx.moveTo(0,65);ctx.lineTo(140,65);ctx.stroke();
            ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,65);ctx.stroke();
            // Y-axis labels
            drawGlowTextThin(ctx,'V',- 8,5,8,'#888',0,0.4);
            // Safe zone
            ctx.fillStyle='rgba(57,255,20,0.04)';ctx.fillRect(0,20,140,40);
            ctx.strokeStyle='rgba(57,255,20,0.3)';ctx.lineWidth=1;ctx.setLineDash([3,3]);
            ctx.beginPath();ctx.moveTo(0,20);ctx.lineTo(140,20);ctx.stroke();
            drawGlowTextThin(ctx,'14.4V max',142,20,7,'#39ff14',0,0.4);
            ctx.setLineDash([]);
            // Voltage line
            ctx.lineWidth=2.5;
            ctx.beginPath();
            if(this.faultTriggered){
                ctx.strokeStyle='#ff2020';ctx.shadowBlur=12;ctx.shadowColor='#ff2020';
                ctx.moveTo(0,42);ctx.lineTo(35,42);ctx.lineTo(45,40);
                ctx.lineTo(55,8);ctx.lineTo(65,4);ctx.lineTo(75,6);ctx.lineTo(85,5);
                ctx.lineTo(95,42);ctx.lineTo(140,42);
            } else {
                ctx.strokeStyle='#0ff';ctx.shadowBlur=5;ctx.shadowColor='#0ff';
                ctx.moveTo(0,42);
                for(let i=0;i<=140;i+=3){ctx.lineTo(i,42+Math.sin(i*0.1+t*0.05)*3);}
            }
            ctx.stroke();
            ctx.restore();
            if(this.faultTriggered){
                const fa=0.5+Math.sin(t*0.3)*0.5;
                drawGlowText(ctx,'⚠ OVERVOLTAGE',q4x,q4y+50,13,'#ff2020',20,fa);
                drawGlowTextThin(ctx,'Relay cutoff in <50ms',q4x,q4y+68,10,'#ff6600',5,fa*0.7);
            } else {
                drawGlowTextThin(ctx,'Monitoring: 12.6V nominal',q4x,q4y+50,10,'#555',0,0.5);
            }
        }
        this.ps.draw(ctx);
    }
}

// === SCENE 5: FULL SYSTEM FLOW ===
class SceneSystemFlow {
    constructor(W,H){
        this.W=W;this.H=H;this.t=0;this.duration=750;
        this.ps=new ParticleSystem();this.step=0;this.streams=[];
    }
    reset(){this.t=0;this.step=0;this.ps.clear();this.streams=[];}
    update(){
        this.t++;const t=this.t,W=this.W,H=this.H;
        if(t>40)this.step=1;if(t>120)this.step=2;if(t>200)this.step=3;
        if(t>280)this.step=4;if(t>360)this.step=5;if(t>440)this.step=6;if(t>540)this.step=7;
        if(this.step>=2&&this.streams.length<1){const s=new EnergyStream(W*0.22,H*0.45,W*0.38,H*0.35,{color:[0,255,255],speed:0.02});s.start();this.streams.push(s);}
        if(this.step>=3&&this.streams.length<2){const s=new EnergyStream(W*0.52,H*0.35,W*0.5,H*0.5,{color:[0,191,255],speed:0.025});s.start();this.streams.push(s);}
        if(this.step>=4&&this.streams.length<3){const s=new EnergyStream(W*0.5,H*0.6,W*0.5,H*0.72,{color:[255,153,0],speed:0.02});s.start();this.streams.push(s);}
        if(this.step>=6&&this.streams.length<4){const s=new EnergyStream(W*0.60,H*0.48,W*0.68,H*0.42,{color:[170,0,255],speed:0.03});s.start();this.streams.push(s);}
        if(this.step>=6&&this.streams.length<5){const s=new EnergyStream(W*0.68,H*0.42,W*0.78,H*0.18,{color:[170,0,255],speed:0.03});s.start();this.streams.push(s);}
        if(this.step>=6&&this.streams.length<6){const s=new EnergyStream(W*0.68,H*0.42,W*0.92,H*0.3,{color:[170,0,255],speed:0.03});s.start();this.streams.push(s);}
        this.streams.forEach(s=>s.update());this.ps.update();
    }
    draw(ctx){
        const W=this.W,H=this.H,t=this.t;
        drawGlowText(ctx,'END-TO-END CHARGING SESSION',W/2,35,22,'#0ff',15,Math.min(1,t/40));
        drawGlowTextThin(ctx,'Complete hardware + software pipeline',W/2,58,13,'#0088cc',0,Math.min(1,t/60)*0.6);
        const drawNode=(x,y,w,h,label,sub,color,active,icon)=>{
            ctx.save();
            const rgb=color==='#0ff'?'0,255,255':color==='#ff9900'?'255,153,0':color==='#39ff14'?'57,255,20':color==='#aa00ff'?'170,0,255':'0,191,255';
            ctx.fillStyle=active?`rgba(${rgb},0.1)`:'rgba(10,10,30,0.8)';
            ctx.strokeStyle=active?color:'#333';ctx.lineWidth=active?2:1;
            ctx.shadowBlur=active?18:0;ctx.shadowColor=color;
            ctx.beginPath();ctx.roundRect(x-w/2,y-h/2,w,h,8);ctx.fill();ctx.stroke();
            if(icon) drawGlowText(ctx,icon,x,y-12,20,'#fff',0,active?1:0.3);
            drawGlowText(ctx,label,x,y+(icon?8:-5),12,active?'#fff':'#444',0,active?1:0.3);
            if(sub) drawGlowTextThin(ctx,sub,x,y+(icon?24:10),10,active?color:'#333',active?3:0,active?0.7:0.2);
            ctx.restore();
        };
        // EV
        if(this.step>=1&&this.step<2){
            const cp=Math.min(1,(t-40)/60);
            drawCar(ctx,lerp(-200,W*0.12,easeOutQuart(cp)),H*0.45,0.65,'#1a1a3e','#0ff',t*0.1);
        } else if(this.step>=2){
            drawCar(ctx,W*0.12,H*0.45,0.65,'#1a1a3e','#0ff',0);
        }
        drawNode(W*0.12,H*0.65,115,48,'EV BATTERY','12V Lead-Acid','#ff9900',this.step>=1,null);
        // Sensors
        drawNode(W*0.38,H*0.25,95,38,'V-DIVIDER','12.6V → ADC','#0ff',this.step>=2,null);
        drawNode(W*0.38,H*0.38,95,38,'ACS712','2.1A Current','#0ff',this.step>=2,null);
        drawNode(W*0.38,H*0.51,95,38,'NTC 10K','32°C Temp','#0ff',this.step>=2,null);
        // STM32
        drawSTM32Board(ctx,W*0.55,H*0.5,1.4,this.step>=3,t);
        // Buck + Relay
        drawNode(W*0.42,H*0.78,105,48,'BUCK CONV.','XL4015 PWM','#ff9900',this.step>=4,null);
        drawNode(W*0.58,H*0.78,105,48,'5V RELAY',this.step>=7?'OPEN — SAFE':'CLOSED','#39ff14',this.step>=4,null);
        // LCD
        if(this.step>=5){
            ctx.save();ctx.fillStyle='#001200';ctx.strokeStyle='#39ff14';ctx.lineWidth=2;
            ctx.shadowBlur=10;ctx.shadowColor='#39ff14';
            ctx.beginPath();ctx.roundRect(W*0.7-85,H*0.68,170,60,5);ctx.fill();ctx.stroke();
            ctx.font='12px Share Tech Mono';ctx.fillStyle='#39ff14';ctx.textAlign='center';
            ctx.fillText('SOC:67%  V:12.8',W*0.7,H*0.71);
            ctx.fillText('T:31°C  I:2.1A',W*0.7,H*0.735);
            ctx.fillText('MODE: NORMAL',W*0.7,H*0.755);
            drawGlowTextThin(ctx,'LCD 16×2 I2C',W*0.7,H*0.775,9,'#1a5a1a',0,0.5);
            ctx.restore();
        }
        // Cloud/IoT
        drawNode(W*0.68,H*0.42,90,38,'ESP32','WiFi + BLE','#aa00ff',this.step>=6,null);
        if(this.step>=6){
            for(let i=0;i<3;i++){
                const ra=0.25-i*0.07,rr=15+i*12+Math.sin(t*0.05)*3;
                ctx.save();ctx.globalAlpha=ra;ctx.strokeStyle='#aa00ff';ctx.lineWidth=1.5;
                ctx.shadowBlur=8;ctx.shadowColor='#aa00ff';
                ctx.beginPath();ctx.arc(W*0.68,H*0.31,rr,-Math.PI*0.8,-Math.PI*0.2);ctx.stroke();ctx.restore();
            }
            drawNode(W*0.78,H*0.18,115,42,'FIREBASE','Realtime DB','#aa00ff',true,'☁');
            drawNode(W*0.92,H*0.3,85,50,'BLYNK','Dashboard','#aa00ff',true,'📱');
        }
        if(this.step>=7){
            const fa=0.6+Math.sin(t*0.08)*0.4;
            drawGlowText(ctx,'✓ CHARGE SESSION COMPLETE',W/2,H*0.93,16,'#39ff14',20,fa);
        }
        const st=['','EV CONNECTED','SENSORS ACTIVE','FUZZY ENGINE RUNNING','CURRENT CONTROL ACTIVE','LCD UPDATED','CLOUD SYNC LIVE','ALL SYSTEMS NOMINAL'];
        drawGlowText(ctx,st[this.step]||'',W/2,H*0.88,13,this.step>=7?'#39ff14':'#0ff',10,1);
        this.streams.forEach(s=>s.draw(ctx));this.ps.draw(ctx);
    }
}
