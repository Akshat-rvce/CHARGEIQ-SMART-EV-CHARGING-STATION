// === SCENE 6: CC-CV CHARGING CURVE ===
class SceneCCCV {
    constructor(W,H){
        this.W=W;this.H=H;this.t=0;this.duration=600;
        this.ps=new ParticleSystem();this.progress=0;
    }
    reset(){this.t=0;this.ps.clear();this.progress=0;}
    update(){
        this.t++;
        if(this.t>80) this.progress=Math.min(1,(this.t-80)/400);
        if(this.t>80&&this.t%6===0){
            const px=this.W*0.15+this.progress*(this.W*0.6);
            this.ps.emit(px,this.H*0.5,1,{vx:(Math.random()-0.5)*2,vy:-1-Math.random(),life:30,size:1.5,color:[0,255,255],glow:10,trail:true,friction:0.96});
        }
        this.ps.update();
    }
    draw(ctx){
        const W=this.W,H=this.H,t=this.t,p=this.progress;
        drawGlowText(ctx,'CC-CV CHARGING ALGORITHM',W/2,35,22,'#0ff',15,Math.min(1,t/40));
        drawGlowTextThin(ctx,'Constant Current → Constant Voltage Transition',W/2,58,13,'#0088cc',0,Math.min(1,t/60)*0.6);
        // Graph area
        const gx=W*0.12,gy=H*0.18,gw=W*0.65,gh=H*0.6;
        if(t>40){
            const a=Math.min(1,(t-40)/30);
            ctx.save();ctx.globalAlpha=a;
            // Background
            ctx.fillStyle='rgba(0,0,0,0.4)';ctx.beginPath();ctx.roundRect(gx-20,gy-10,gw+40,gh+50,8);ctx.fill();
            // Axes
            ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=2;
            ctx.beginPath();ctx.moveTo(gx,gy);ctx.lineTo(gx,gy+gh);ctx.lineTo(gx+gw,gy+gh);ctx.stroke();
            // Axis labels
            drawGlowTextThin(ctx,'Time →',gx+gw/2,gy+gh+30,12,'#888',0,a);
            ctx.save();ctx.translate(gx-30,gy+gh/2);ctx.rotate(-Math.PI/2);
            drawGlowTextThin(ctx,'Value',0,0,12,'#888',0,a);ctx.restore();
            // Grid lines
            ctx.strokeStyle='rgba(255,255,255,0.06)';ctx.lineWidth=1;
            for(let i=1;i<5;i++){
                const ly=gy+i*(gh/5);
                ctx.beginPath();ctx.moveTo(gx,ly);ctx.lineTo(gx+gw,ly);ctx.stroke();
            }
            // CC-CV boundary
            const ccEnd=0.55;
            const bx=gx+gw*ccEnd;
            ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.setLineDash([5,5]);ctx.lineWidth=1;
            ctx.beginPath();ctx.moveTo(bx,gy);ctx.lineTo(bx,gy+gh);ctx.stroke();ctx.setLineDash([]);
            drawGlowTextThin(ctx,'CC→CV',bx,gy-5,10,'#fff',3,a*0.7);
            // CC zone label
            ctx.fillStyle='rgba(0,255,255,0.03)';ctx.fillRect(gx,gy,gw*ccEnd,gh);
            drawGlowText(ctx,'CC MODE',gx+gw*ccEnd/2,gy+gh+15,10,'#0ff',5,a*0.5);
            // CV zone label
            ctx.fillStyle='rgba(57,255,20,0.03)';ctx.fillRect(bx,gy,gw*(1-ccEnd),gh);
            drawGlowText(ctx,'CV MODE',bx+gw*(1-ccEnd)/2,gy+gh+15,10,'#39ff14',5,a*0.5);

            // Draw curves up to current progress
            const drawPt=Math.floor(p*100);
            // CURRENT curve (blue) - flat then drops
            ctx.strokeStyle='#0ff';ctx.lineWidth=3;ctx.shadowBlur=10;ctx.shadowColor='#0ff';
            ctx.beginPath();
            for(let i=0;i<=drawPt;i++){
                const x=gx+i/100*gw;
                const prog=i/100;
                let cy;
                if(prog<ccEnd) cy=gy+gh*0.2; // flat at high current
                else cy=gy+gh*0.2+(prog-ccEnd)/(1-ccEnd)*gh*0.6; // drops in CV
                if(i===0)ctx.moveTo(x,cy);else ctx.lineTo(x,cy);
            }
            ctx.stroke();
            // VOLTAGE curve (green) - rises then flat
            ctx.strokeStyle='#39ff14';ctx.lineWidth=3;ctx.shadowBlur=10;ctx.shadowColor='#39ff14';
            ctx.beginPath();
            for(let i=0;i<=drawPt;i++){
                const x=gx+i/100*gw;
                const prog=i/100;
                let vy;
                if(prog<ccEnd) vy=gy+gh*0.8-prog/ccEnd*gh*0.5; // rises
                else vy=gy+gh*0.3; // flat at max voltage
                if(i===0)ctx.moveTo(x,vy);else ctx.lineTo(x,vy);
            }
            ctx.stroke();
            ctx.shadowBlur=0;
            // Legend
            if(t>100){
                const la=Math.min(1,(t-100)/30);
                ctx.fillStyle='#0ff';ctx.beginPath();ctx.roundRect(gx+gw+20,gy+10,12,12,2);ctx.fill();
                drawGlowTextThin(ctx,'Current (A)',gx+gw+38,gy+16,11,'#0ff',0,la,'left');
                ctx.fillStyle='#39ff14';ctx.beginPath();ctx.roundRect(gx+gw+20,gy+32,12,12,2);ctx.fill();
                drawGlowTextThin(ctx,'Voltage (V)',gx+gw+38,gy+38,11,'#39ff14',0,la,'left');
            }
            ctx.restore();
        }
        // Right panel - live values
        if(t>120){
            const a=Math.min(1,(t-120)/40);
            const px=W*0.85,py=H*0.4;
            ctx.save();ctx.globalAlpha=a;
            ctx.fillStyle='rgba(0,0,0,0.5)';ctx.strokeStyle='rgba(0,255,255,0.2)';ctx.lineWidth=1;
            ctx.beginPath();ctx.roundRect(px-60,py,120,H*0.45,8);ctx.fill();ctx.stroke();
            // Live values
            const soc=Math.min(100,p*100);
            const curr=p<0.55?4.5:4.5*(1-(p-0.55)/0.45);
            const volt=p<0.55?10.5+p/0.55*3.5:14.0;
            drawGlowText(ctx,'LIVE',px,py+18,11,'#0ff',5,a);
            drawGlowText(ctx,Math.round(soc)+'%',px,py+50,24,'#fff',5,a);
            drawGlowTextThin(ctx,'SOC',px,py+70,10,'#0ff',0,a*0.7);
            drawGlowText(ctx,curr.toFixed(1)+'A',px,py+100,18,'#0ff',8,a);
            drawGlowTextThin(ctx,'Current',px,py+118,10,'#0088cc',0,a*0.7);
            drawGlowText(ctx,volt.toFixed(1)+'V',px,py+148,18,'#39ff14',8,a);
            drawGlowTextThin(ctx,'Voltage',px,py+166,10,'#2ab510',0,a*0.7);
            const mode=p<0.55?'CC':'CV';
            drawGlowText(ctx,mode,px,py+200,20,p<0.55?'#0ff':'#39ff14',12,a);
            ctx.restore();
        }
        this.ps.draw(ctx);
    }
}

// === SCENE 7: PWM & BUCK CONVERTER ===
class ScenePWM {
    constructor(W,H){
        this.W=W;this.H=H;this.t=0;this.duration=600;
        this.ps=new ParticleSystem();this.duty=0.65;this.dutyTarget=0.65;
    }
    reset(){this.t=0;this.ps.clear();this.duty=0.65;this.dutyTarget=0.65;}
    update(){
        this.t++;const t=this.t;
        // Animate duty cycle changes
        if(t>200&&t<250) this.dutyTarget=0.4;
        if(t>300&&t<350) this.dutyTarget=0.8;
        if(t>400) this.dutyTarget=0.25;
        this.duty+=(this.dutyTarget-this.duty)*0.02;
        // Spark at MOSFET
        if(t>120&&t%8===0){
            this.ps.emit(this.W*0.35,this.H*0.48,1,{vx:(Math.random()-0.5)*3,vy:(Math.random()-0.5)*3,life:15,size:1.5,color:[255,200,0],glow:12,trail:true,friction:0.95});
        }
        this.ps.update();
    }
    draw(ctx){
        const W=this.W,H=this.H,t=this.t,duty=this.duty;
        drawGlowText(ctx,'PWM CURRENT CONTROL',W/2,35,22,'#ff9900',15,Math.min(1,t/40));
        drawGlowTextThin(ctx,'Buck Converter — XL4015 Step-Down Module',W/2,58,13,'#cc6600',0,Math.min(1,t/60)*0.6);
        // PWM waveform - large animated
        if(t>60){
            const a=Math.min(1,(t-60)/40);
            const wx=W*0.05,wy=H*0.15,ww=W*0.9,wh=H*0.22;
            ctx.save();ctx.globalAlpha=a;
            ctx.fillStyle='rgba(0,0,0,0.4)';ctx.beginPath();ctx.roundRect(wx-10,wy-10,ww+20,wh+40,6);ctx.fill();
            drawGlowText(ctx,'PWM SIGNAL @ 31.25kHz',wx+ww/2,wy-2,10,'#ff9900',5,a);
            // Axis
            ctx.strokeStyle='rgba(255,255,255,0.2)';ctx.lineWidth=1;
            ctx.beginPath();ctx.moveTo(wx,wy+wh);ctx.lineTo(wx+ww,wy+wh);ctx.stroke();
            // Animated PWM
            ctx.strokeStyle='#ff9900';ctx.lineWidth=3;ctx.shadowBlur=10;ctx.shadowColor='#ff9900';
            ctx.beginPath();
            const periods=8;const pw=ww/periods;
            const offset=(t*2)%pw;
            for(let i=-1;i<periods+1;i++){
                const px=wx+i*pw-offset;
                const hiW=pw*duty;
                ctx.lineTo(px,wy+wh);ctx.lineTo(px,wy+5);
                ctx.lineTo(px+hiW,wy+5);ctx.lineTo(px+hiW,wy+wh);
            }
            ctx.stroke();
            // Duty cycle label
            drawGlowText(ctx,`Duty: ${Math.round(duty*100)}%`,wx+ww-60,wy+wh+18,12,'#ff9900',8,a);
            // High/Low labels
            drawGlowTextThin(ctx,'5V',wx-18,wy+5,9,'#ff9900',0,a*0.5);
            drawGlowTextThin(ctx,'0V',wx-18,wy+wh,9,'#888',0,a*0.5);
            ctx.restore();
        }
        // Buck converter schematic
        if(t>120){
            const a=Math.min(1,(t-120)/50);
            const sy=H*0.55,sx=W*0.1;
            ctx.save();ctx.globalAlpha=a;
            ctx.fillStyle='rgba(0,0,0,0.35)';ctx.beginPath();ctx.roundRect(sx-20,sy-40,W*0.8+40,H*0.35,8);ctx.fill();
            drawGlowText(ctx,'BUCK CONVERTER TOPOLOGY',W/2,sy-25,11,'#0ff',5,a);
            // Vin
            ctx.fillStyle='rgba(255,50,50,0.1)';ctx.strokeStyle='#ff5050';ctx.lineWidth=2;
            ctx.shadowBlur=10;ctx.shadowColor='#ff5050';
            ctx.beginPath();ctx.roundRect(sx,sy,70,40,6);ctx.fill();ctx.stroke();
            drawGlowText(ctx,'Vin',sx+35,sy+12,12,'#ff5050',5,a);
            drawGlowText(ctx,'18V',sx+35,sy+30,14,'#fff',0,a);
            // MOSFET
            drawMOSFET(ctx,sx+150,sy+20,t>150,'#ff9900');
            // Inductor
            drawInductor(ctx,sx+240,sy+8,80,t>150,'#0ff');
            // Capacitor
            drawCapacitor(ctx,sx+380,sy+20,40,t>150,'#39ff14');
            // Diode
            ctx.strokeStyle=t>150?'#ff9900':'#444';ctx.lineWidth=2.5;
            ctx.shadowBlur=t>150?8:0;ctx.shadowColor='#ff9900';
            ctx.beginPath();ctx.moveTo(sx+200,sy+40);ctx.lineTo(sx+200,sy+65);ctx.stroke();
            ctx.beginPath();ctx.moveTo(sx+190,sy+65);ctx.lineTo(sx+210,sy+65);ctx.lineTo(sx+200,sy+80);ctx.closePath();
            ctx.fillStyle=t>150?'#ff9900':'#444';ctx.fill();
            drawGlowTextThin(ctx,'Schottky',sx+200,sy+92,8,t>150?'#ff9900':'#444',0,a*0.7);
            // Vout
            ctx.fillStyle='rgba(57,255,20,0.1)';ctx.strokeStyle='#39ff14';ctx.lineWidth=2;
            ctx.shadowBlur=10;ctx.shadowColor='#39ff14';
            ctx.beginPath();ctx.roundRect(sx+440,sy,70,40,6);ctx.fill();ctx.stroke();
            drawGlowText(ctx,'Vout',sx+475,sy+12,12,'#39ff14',5,a);
            const vout=(18*duty).toFixed(1);
            drawGlowText(ctx,vout+'V',sx+475,sy+30,14,'#fff',0,a);
            // Connection lines
            ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=1.5;ctx.shadowBlur=0;
            ctx.beginPath();ctx.moveTo(sx+70,sy+20);ctx.lineTo(sx+120,sy+20);ctx.stroke();
            ctx.beginPath();ctx.moveTo(sx+330,sy+8);ctx.lineTo(sx+370,sy+8);ctx.lineTo(sx+370,sy+20);ctx.stroke();
            ctx.beginPath();ctx.moveTo(sx+395,sy+20);ctx.lineTo(sx+440,sy+20);ctx.stroke();
            // Formula
            drawGlowTextThin(ctx,`Vout = Vin × D = 18V × ${Math.round(duty*100)}% = ${vout}V`,W/2,sy+H*0.28,13,'#fff',3,a*0.8);
            ctx.restore();
        }
        this.ps.draw(ctx);
    }
}

// === SCENE 8: IoT DASHBOARD ===
class SceneIoT {
    constructor(W,H){
        this.W=W;this.H=H;this.t=0;this.duration=650;
        this.ps=new ParticleSystem();
        this.soc=45;this.temp=31;this.current=2.1;this.voltage=12.6;
    }
    reset(){this.t=0;this.ps.clear();this.soc=45;this.temp=31;this.current=2.1;this.voltage=12.6;}
    update(){
        this.t++;const t=this.t;
        if(t>100){
            this.soc=Math.min(100,45+(t-100)*0.08);
            this.current=this.soc<70?3.5:this.soc<85?2.0:this.soc<95?0.8:0.1;
            this.voltage=Math.min(14.4,12.0+this.soc*0.024);
            this.temp=28+Math.sin(t*0.02)*5+this.current*1.5;
        }
        // WiFi particles
        if(t>200&&t%10===0){
            this.ps.emit(this.W*0.5,this.H*0.48,2,{vx:3+Math.random()*2,vy:(Math.random()-0.5)*2,life:40,size:1.5,color:[170,0,255],glow:10,trail:true,friction:0.98});
        }
        this.ps.update();
    }
    draw(ctx){
        const W=this.W,H=this.H,t=this.t;
        drawGlowText(ctx,'IoT CLOUD MONITORING',W/2,35,22,'#aa00ff',15,Math.min(1,t/40));
        drawGlowTextThin(ctx,'ESP32 → Firebase → Blynk App',W/2,58,13,'#7700bb',0,Math.min(1,t/60)*0.6);
        // Left: STM32 + ESP module
        if(t>60){
            const a=Math.min(1,(t-60)/40);
            ctx.save();ctx.globalAlpha=a;
            // STM32
            drawSTM32Board(ctx,W*0.18,H*0.45,1.8,true,t);
            drawGlowTextThin(ctx,'Sensor Hub',W*0.18,H*0.55,11,'#0ff',0,a*0.7);
            // ESP32 (Adjacent to STM32)
            ctx.fillStyle='rgba(20,0,40,0.8)';ctx.strokeStyle='#aa00ff';ctx.lineWidth=2;
            ctx.shadowBlur=15;ctx.shadowColor='#aa00ff';
            ctx.beginPath();ctx.roundRect(W*0.32-30,H*0.45-20,60,40,5);ctx.fill();ctx.stroke();
            drawGlowText(ctx,'ESP',W*0.32,H*0.45-6,10,'#aa00ff',8,a);
            drawGlowText(ctx,'32',W*0.32,H*0.45+8,10,'#fff',0,a);
            // Antenna
            ctx.strokeStyle='#aa00ff';ctx.lineWidth=1.5;
            ctx.beginPath();ctx.moveTo(W*0.32+20,H*0.45-20);ctx.lineTo(W*0.32+25,H*0.45-25);ctx.lineTo(W*0.32+30,H*0.45-20);ctx.stroke();
            // Connection line (Directly linking STM32 & ESP32)
            ctx.strokeStyle='rgba(0,255,255,0.3)';ctx.lineWidth=2;ctx.setLineDash([4,4]);
            ctx.beginPath();ctx.moveTo(W*0.279,H*0.45);ctx.lineTo(W*0.32-30,H*0.45);ctx.stroke();
            ctx.setLineDash([]);
            // WiFi waves (Radiating from ESP32 towards cloud)
            for(let i=0;i<3;i++){
                const rr=20+i*15+Math.sin(t*0.06)*3;
                ctx.globalAlpha=a*(0.3-i*0.08);ctx.strokeStyle='#aa00ff';ctx.lineWidth=2;
                ctx.shadowBlur=8;ctx.shadowColor='#aa00ff';
                ctx.beginPath();ctx.arc(W*0.32+20,H*0.45,rr,-Math.PI*0.4,Math.PI*0.4);ctx.stroke();
            }
            ctx.restore();
        }
        // Cloud
        if(t>150){
            const a=Math.min(1,(t-150)/40);
            ctx.save();ctx.globalAlpha=a;
            ctx.fillStyle='rgba(170,0,255,0.08)';ctx.strokeStyle='#aa00ff';ctx.lineWidth=2;
            ctx.shadowBlur=20;ctx.shadowColor='#aa00ff';
            ctx.beginPath();ctx.roundRect(W*0.52,H*0.3,W*0.12,H*0.25,10);ctx.fill();ctx.stroke();
            drawGlowText(ctx,'☁',W*0.58,H*0.38,28,'#fff',0,a);
            drawGlowText(ctx,'FIREBASE',W*0.58,H*0.46,11,'#aa00ff',8,a);
            drawGlowTextThin(ctx,'Realtime DB',W*0.58,H*0.5,9,'#7700bb',0,a*0.6);
            ctx.restore();
        }
        // Right: Phone dashboard
        if(t>200){
            const a=Math.min(1,(t-200)/50);
            const px=W*0.78,py=H*0.18,pw=W*0.2,ph=H*0.7;
            ctx.save();ctx.globalAlpha=a;
            // Phone frame
            ctx.fillStyle='#0a0a14';ctx.strokeStyle='#555';ctx.lineWidth=3;
            ctx.shadowBlur=20;ctx.shadowColor='rgba(170,0,255,0.3)';
            ctx.beginPath();ctx.roundRect(px,py,pw,ph,16);ctx.fill();ctx.stroke();
            // Notch
            ctx.fillStyle='#222';ctx.beginPath();ctx.roundRect(px+pw*0.3,py+2,pw*0.4,10,5);ctx.fill();
            // Header
            ctx.fillStyle='rgba(170,0,255,0.15)';ctx.fillRect(px+5,py+18,pw-10,30);
            drawGlowText(ctx,'ChargeIQ',px+pw/2,py+33,11,'#aa00ff',5,a);
            // Gauge
            drawGauge(ctx,px+pw/2,py+90,32,this.soc,100,'#0ff','SOC');
            // Data cards
            const cards=[
                {label:'VOLTAGE',val:this.voltage.toFixed(1)+'V',color:'#39ff14',y:py+140},
                {label:'CURRENT',val:this.current.toFixed(1)+'A',color:'#0ff',y:py+175},
                {label:'TEMP',val:Math.round(this.temp)+'°C',color:this.temp>40?'#ff9900':'#0ff',y:py+210},
            ];
            cards.forEach(c=>{
                ctx.fillStyle='rgba(255,255,255,0.03)';ctx.beginPath();ctx.roundRect(px+8,c.y,pw-16,28,4);ctx.fill();
                drawGlowTextThin(ctx,c.label,px+pw*0.3,c.y+14,9,c.color,0,a*0.7);
                drawGlowText(ctx,c.val,px+pw*0.72,c.y+14,13,c.color,5,a);
            });
            // Status
            const mode=this.soc<70?'CC-FAST':this.soc<85?'CC-NORM':this.soc<95?'CV':'DONE';
            ctx.fillStyle=mode==='DONE'?'rgba(57,255,20,0.15)':'rgba(0,255,255,0.1)';
            ctx.beginPath();ctx.roundRect(px+8,py+245,pw-16,25,4);ctx.fill();
            drawGlowText(ctx,mode,px+pw/2,py+258,11,mode==='DONE'?'#39ff14':'#0ff',8,a);
            // Mini chart
            const cy=py+290,ch=50;
            ctx.strokeStyle='rgba(255,255,255,0.1)';ctx.lineWidth=1;
            ctx.beginPath();ctx.moveTo(px+10,cy+ch);ctx.lineTo(px+pw-10,cy+ch);ctx.stroke();
            ctx.strokeStyle='#0ff';ctx.lineWidth=1.5;ctx.shadowBlur=4;ctx.shadowColor='#0ff';
            ctx.beginPath();
            for(let i=0;i<pw-20;i++){
                const v=Math.sin(i*0.08+t*0.03)*ch*0.3+ch*0.4;
                if(i===0)ctx.moveTo(px+10+i,cy+v);else ctx.lineTo(px+10+i,cy+v);
            }
            ctx.stroke();
            drawGlowTextThin(ctx,'Current History',px+pw/2,cy+ch+12,8,'#0ff',0,a*0.5);
            // Home button
            ctx.fillStyle='#333';ctx.beginPath();ctx.arc(px+pw/2,py+ph-18,8,0,Math.PI*2);ctx.fill();
            ctx.restore();
        }
        // Data transfer indicator
        if(t>250&&t%30<15){
            drawGlowTextThin(ctx,'● LIVE',W*0.58,H*0.55,10,'#39ff14',8,0.8);
        }
        this.ps.draw(ctx);
    }
}
