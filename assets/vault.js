
        // --------------------------------------------------
        // 1. REALISTIC WEB AUDIO SYNTHESIZER (HELICAL THREAD RATCHET & HYDRAULIC VAULT)
        // --------------------------------------------------
        let soundEnabled = false;
        let audioCtx = null;

        function initAudio() {
            if (!audioCtx) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (AudioContextClass) {
                    audioCtx = new AudioContextClass();
                }
            }
            if (audioCtx && audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        }

        // Multi-click mechanical ratchet & helical thread friction sound
        function playMechanicalRatchet(pitchOffset = 0, isUnscrewing = true) {
            if (!soundEnabled) return;
            try {
                initAudio();
                if (!audioCtx) return;

                const clicks = [0, 0.055, 0.115, 0.18, 0.25];
                clicks.forEach((timeOffset, i) => {
                    const now = audioCtx.currentTime + timeOffset;
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();

                    osc.type = i % 2 === 0 ? 'triangle' : 'sine';
                    const baseFreq = isUnscrewing
                        ? 220 + pitchOffset + i * 38
                        : 360 + pitchOffset - i * 32;

                    osc.frequency.setValueAtTime(baseFreq, now);
                    osc.frequency.exponentialRampToValueAtTime(58, now + 0.048);

                    gain.gain.setValueAtTime(0.14 - i * 0.018, now);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.052);

                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    osc.start(now);
                    osc.stop(now + 0.055);
                });
            } catch (e) {}
        }

        function playVaultReleaseSound() {
            if (!soundEnabled) return;
            try {
                initAudio();
                if (!audioCtx) return;

                const now = audioCtx.currentTime;
                // Sub-bass leather seal release + high metallic chime
                const oscLow = audioCtx.createOscillator();
                const gainLow = audioCtx.createGain();
                oscLow.type = 'sine';
                oscLow.frequency.setValueAtTime(118, now);
                oscLow.frequency.exponentialRampToValueAtTime(32, now + 0.85);

                gainLow.gain.setValueAtTime(0.28, now);
                gainLow.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

                oscLow.connect(gainLow);
                gainLow.connect(audioCtx.destination);
                oscLow.start(now);
                oscLow.stop(now + 0.92);

                const oscHigh = audioCtx.createOscillator();
                const gainHigh = audioCtx.createGain();
                oscHigh.type = 'sine';
                oscHigh.frequency.setValueAtTime(1240, now + 0.05);
                oscHigh.frequency.exponentialRampToValueAtTime(620, now + 0.55);

                gainHigh.gain.setValueAtTime(0.07, now + 0.05);
                gainHigh.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

                oscHigh.connect(gainHigh);
                gainHigh.connect(audioCtx.destination);
                oscHigh.start(now + 0.05);
                oscHigh.stop(now + 0.62);
            } catch (e) {}
        }

        function toggleSound() {
            soundEnabled = !soundEnabled;
            const label = document.getElementById('vault-sound-label');
            const dot = document.getElementById('vault-sound-dot');
            label.textContent = soundEnabled ? 'SOUND ON' : 'SOUND OFF';
            document.getElementById('vault-sound-btn').setAttribute('aria-pressed', String(soundEnabled));
            dot.className = soundEnabled ? 'w-1.5 h-1.5 rounded-full bg-white' : 'w-1.5 h-1.5 rounded-full bg-zinc-600';
        }

        // --------------------------------------------------
        // 2. SMOOTH INERTIA CURSOR & MAGNETIC DEFORMATION
        // --------------------------------------------------
        const mouse = {
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
            lerpX: window.innerWidth / 2,
            lerpY: window.innerHeight / 2,
            vx: 0,
            vy: 0,
            lastX: window.innerWidth / 2,
            lastY: window.innerHeight / 2,
            hoverLabel: ''
        };

        const cursorOuter = document.getElementById('custom-cursor-outer');
        const cursorDot = document.getElementById('custom-cursor-dot');
        const cursorLabel = document.getElementById('custom-cursor-label');
        const heroOrb = document.getElementById('hero-chrome-orb');

        window.addEventListener('mousemove', (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;

            const hoverTarget = e.target.closest('[data-cursor]');
            if (hoverTarget) {
                mouse.hoverLabel = hoverTarget.getAttribute('data-cursor') || '';
                if (cursorLabel) {
                    cursorLabel.textContent = mouse.hoverLabel;
                    cursorLabel.style.opacity = '1';
                }
            } else {
                mouse.hoverLabel = '';
                if (cursorLabel) {
                    cursorLabel.style.opacity = '0';
                }
            }
        });

        // --------------------------------------------------
        // 3. ULTRA-REALISTIC 3D ORGANIC CHROME ORB SCREW ENGINE
        // --------------------------------------------------
        const screwStates = [false, false, false, false];
        let vaultUnlocking = false;
        let vaultIsOpen = false;
        const vaultTimers = new Set();
        function scheduleVault(callback, delay) {
            const timer = setTimeout(() => { vaultTimers.delete(timer); callback(); }, delay);
            vaultTimers.add(timer);
        }
        function cancelVaultTimers() {
            vaultTimers.forEach(clearTimeout);
            vaultTimers.clear();
        }

        // Spring-driven physical state per screw
        const screwPhysics = [0, 1, 2, 3].map((idx) => ({
            index: idx,
            canvas: null,
            ctx: null,
            // 0 = fully torqued down, 1 = fully unscrewed & elevated, >1 = detached & floating
            progress: 0,
            targetProgress: 0,
            velocity: 0,
            angle: [-0.6, 0.45, 1.1, -1.25][idx],
            targetAngle: [-0.6, 0.45, 1.1, -1.25][idx],
            angularVelocity: 0,
            hovered: false,
            hoverScale: 1,
            morphSeed: idx * 2.17 + 0.5,
            droplets: [
                { angle: 0.4, dist: 0, size: 4.5, speed: 1.3 },
                { angle: 2.3, dist: 0, size: 3.2, speed: 1.7 },
                { angle: 4.5, dist: 0, size: 5.0, speed: 1.1 }
            ]
        }));

        function initScrewCanvases() {
            screwPhysics.forEach((s, idx) => {
                const canvas = document.getElementById(`screw-canvas-${idx}`);
                const wrap = document.getElementById(`screw-wrap-${idx}`);
                if (canvas) {
                    s.canvas = canvas;
                    s.ctx = canvas.getContext('2d');
                }
                if (wrap) {
                    wrap.addEventListener('mouseenter', () => { s.hovered = true; });
                    wrap.addEventListener('mouseleave', () => { s.hovered = false; });
                }
            });
        }

        // Renders a single 3D Raymarched/Normal-Mapped Organic Liquid-Chrome Orb Screw
        function renderSingle3DScrew(s, time) {
            const ctx = s.ctx;
            if (!ctx) return;
            const W = s.canvas.width;
            const H = s.canvas.height;
            const cx = W / 2;
            const cy = H / 2;

            ctx.clearRect(0, 0, W, H);

            // Spring update for unscrewing elevation & rotation
            const stiffness = 0.085;
            const damping = 0.78;
            const force = (s.targetProgress - s.progress) * stiffness;
            s.velocity = (s.velocity + force) * damping;
            s.progress += s.velocity;

            const angleForce = (s.targetAngle - s.angle) * 0.09;
            s.angularVelocity = (s.angularVelocity + angleForce) * 0.80;
            s.angle += s.angularVelocity;

            const targetHover = s.hovered ? 1.07 : 1.0;
            s.hoverScale += (targetHover - s.hoverScale) * 0.15;

            // Compute cursor vector relative to this screw on screen for real-time studio light reflection
            let lightDirX = -0.45;
            let lightDirY = -0.55;
            if (s.canvas) {
                const rect = s.canvas.getBoundingClientRect();
                const scx = rect.left + rect.width / 2;
                const scy = rect.top + rect.height / 2;
                const dx = (mouse.lerpX - scx) / 380;
                const dy = (mouse.lerpY - scy) / 380;
                const len = Math.hypot(dx, dy, 1);
                lightDirX = npClamp(dx / len, -0.75, 0.75);
                lightDirY = npClamp(dy / len, -0.75, 0.75);
            }

            const p = Math.max(0, s.progress); // 0..1.6
            const clampedUnscrew = Math.min(1, p);
            const detachFactor = Math.max(0, p - 1); // >0 when detaching

            // 1. DEEP EMBOSSED LEATHER SOCKET & KNURLED TITANIUM COLLAR (FIXED ON PANEL)
            const socketRadius = 50;
            ctx.save();

            // Outer recessed shadow in leather
            const recessGrad = ctx.createRadialGradient(cx, cy + 2, socketRadius * 0.2, cx, cy, socketRadius * 1.18);
            recessGrad.addColorStop(0, '#000000');
            recessGrad.addColorStop(0.68, '#050507');
            recessGrad.addColorStop(0.88, '#242429');
            recessGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = recessGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, socketRadius * 1.18, 0, Math.PI * 2);
            ctx.fill();

            // Beveled Brushed Titanium Washer/Collar Ring
            const collarGrad = ctx.createLinearGradient(
                cx - socketRadius * lightDirX,
                cy - socketRadius * lightDirY,
                cx + socketRadius * lightDirX,
                cy + socketRadius * lightDirY
            );
            collarGrad.addColorStop(0, '#f4f4f6');
            collarGrad.addColorStop(0.25, '#52525b');
            collarGrad.addColorStop(0.5, '#141417');
            collarGrad.addColorStop(0.78, '#a1a1aa');
            collarGrad.addColorStop(1, '#27272a');

            ctx.fillStyle = collarGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, socketRadius, 0, Math.PI * 2);
            ctx.fill();

            // Knurled micro-ridges around the titanium collar
            const numKnurls = 36;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
            ctx.lineWidth = 1.1;
            for (let i = 0; i < numKnurls; i++) {
                const ka = (i / numKnurls) * Math.PI * 2;
                const rIn = socketRadius * 0.80;
                const rOut = socketRadius * 0.96;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(ka) * rIn, cy + Math.sin(ka) * rIn);
                ctx.lineTo(cx + Math.cos(ka) * rOut, cy + Math.sin(ka) * rOut);
                ctx.stroke();
            }

            // Deep threaded bore hole center
            const boreRadius = socketRadius * 0.56;
            const boreGrad = ctx.createRadialGradient(cx, cy + 3, 2, cx, cy, boreRadius);
            boreGrad.addColorStop(0, '#000000');
            boreGrad.addColorStop(0.75, '#070709');
            boreGrad.addColorStop(1, '#1f1f24');
            ctx.fillStyle = boreGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, boreRadius, 0, Math.PI * 2);
            ctx.fill();

            // Inner chamfered rim highlight of bore hole
            ctx.strokeStyle = 'rgba(255,255,255,0.28)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(cx, cy, boreRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            // 2. EXPOSED HELICAL MACHINED STEEL THREADS & CAST DROP SHADOW (WHEN UNSCREWING)
            const liftY = -clampedUnscrew * 24 - detachFactor * 36;
            const liftX = lightDirX * clampedUnscrew * 8;
            const orbScale = (1 + clampedUnscrew * 0.28 + detachFactor * 0.35) * s.hoverScale;

            // Elongated Ambient Occlusion Shadow cast by the rising orb onto the leather/collar
            const shadowOffsetX = -lightDirX * (10 + clampedUnscrew * 22);
            const shadowOffsetY = 10 + clampedUnscrew * 20;
            const shadowAlpha = Math.max(0, 0.82 - detachFactor * 1.1);
            if (shadowAlpha > 0.01) {
                ctx.save();
                const shadowGrad = ctx.createRadialGradient(
                    cx + shadowOffsetX, cy + shadowOffsetY, 6,
                    cx + shadowOffsetX, cy + shadowOffsetY, 54 * (1 + clampedUnscrew * 0.25)
                );
                shadowGrad.addColorStop(0, `rgba(0, 0, 0, ${shadowAlpha})`);
                shadowGrad.addColorStop(0.55, `rgba(0, 0, 0, ${shadowAlpha * 0.55})`);
                shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = shadowGrad;
                ctx.beginPath();
                ctx.arc(cx + shadowOffsetX, cy + shadowOffsetY, 56, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // Helical Machined Steel Screw Shaft & Spiral Threads emerging from bore hole
            if (clampedUnscrew > 0.03 && detachFactor < 0.85) {
                ctx.save();
                const shaftWidth = 22;
                const shaftTopY = cy + liftY + 12;
                const shaftBottomY = cy + 6;
                const numThreads = 6;

                // Cylindrical steel core
                const shaftGrad = ctx.createLinearGradient(cx - shaftWidth / 2, cy, cx + shaftWidth / 2, cy);
                shaftGrad.addColorStop(0, '#18181b');
                shaftGrad.addColorStop(0.28, '#f4f4f6');
                shaftGrad.addColorStop(0.55, '#52525b');
                shaftGrad.addColorStop(0.82, '#09090b');
                shaftGrad.addColorStop(1, '#a1a1aa');

                ctx.fillStyle = shaftGrad;
                ctx.fillRect(cx - shaftWidth / 2, shaftTopY, shaftWidth, Math.max(0, shaftBottomY - shaftTopY));

                // Spiral Helical Thread Ribs that actively climb as the screw rotates
                const phaseShift = (s.angle / (Math.PI * 2)) * 6;
                for (let t = 0; t < numThreads; t++) {
                    const frac = ((t + phaseShift) % numThreads + numThreads) % numThreads / numThreads;
                    const ty = shaftTopY + frac * (shaftBottomY - shaftTopY);
                    if (ty >= shaftTopY && ty <= shaftBottomY) {
                        ctx.beginPath();
                        ctx.moveTo(cx - shaftWidth * 0.62, ty + 2.2);
                        ctx.lineTo(cx + shaftWidth * 0.62, ty - 2.2);
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 2.4;
                        ctx.stroke();

                        ctx.beginPath();
                        ctx.moveTo(cx - shaftWidth * 0.62, ty + 3.8);
                        ctx.lineTo(cx + shaftWidth * 0.62, ty - 0.6);
                        ctx.strokeStyle = '#09090b';
                        ctx.lineWidth = 1.6;
                        ctx.stroke();
                    }
                }
                ctx.restore();
            }

            // 3. ORGANIC MORPHING LIQUID-CHROME DOME HEAD
            const headAlpha = Math.max(0, 1 - detachFactor * 1.25);
            if (headAlpha > 0.01) {
                const headCx = cx + liftX;
                const headCy = cy + liftY;
                const baseRadius = 42 * orbScale;

                ctx.save();
                ctx.globalAlpha = headAlpha;
                ctx.translate(headCx, headCy);

                // Build Organic Liquid-Chrome Perimeter Path (Perlin-style harmonic undulations)
                const steps = 64;
                const points = [];
                for (let i = 0; i < steps; i++) {
                    const theta = (i / steps) * Math.PI * 2;
                    // Multi-harmonic organic liquid ripple
                    const wave1 = Math.sin(theta * 3 + time * 2.1 + s.morphSeed) * 2.4;
                    const wave2 = Math.cos(theta * 4 - time * 1.6 + s.angle * 0.5) * 1.5;
                    const wave3 = Math.sin(theta * 2 + time * 1.1 + s.morphSeed * 2) * 1.8;
                    // Amplify organic liquid wobble while unscrewing or hovering
                    const morphAmp = 1 + (s.hovered ? 0.45 : 0) + clampedUnscrew * 0.55;
                    const r = baseRadius + (wave1 + wave2 + wave3) * morphAmp;
                    points.push({
                        x: Math.cos(theta) * r,
                        y: Math.sin(theta) * r
                    });
                }

                ctx.beginPath();
                points.forEach((pt, i) => {
                    if (i === 0) ctx.moveTo(pt.x, pt.y);
                    else ctx.lineTo(pt.x, pt.y);
                });
                ctx.closePath();
                ctx.clip();

                // Layer A: Studio Environment Chrome Base Map (High-Contrast Obsidian & White Cyclorama)
                const specX = lightDirX * baseRadius * 0.55;
                const specY = lightDirY * baseRadius * 0.55;
                const chromeGrad = ctx.createRadialGradient(
                    specX - baseRadius * 0.28,
                    specY - baseRadius * 0.32,
                    baseRadius * 0.04,
                    specX * 0.3,
                    specY * 0.3,
                    baseRadius * 1.18
                );
                chromeGrad.addColorStop(0.00, '#ffffff');
                chromeGrad.addColorStop(0.14, '#f8f8fa');
                chromeGrad.addColorStop(0.29, '#a1a1aa');
                chromeGrad.addColorStop(0.46, '#18181c');
                chromeGrad.addColorStop(0.64, '#050507');
                chromeGrad.addColorStop(0.81, '#71717a');
                chromeGrad.addColorStop(0.93, '#e4e4e7');
                chromeGrad.addColorStop(1.00, '#ffffff');

                ctx.fillStyle = chromeGrad;
                ctx.fillRect(-baseRadius * 1.3, -baseRadius * 1.3, baseRadius * 2.6, baseRadius * 2.6);

                // Layer B: Brushed Elevator Horizontal Studio Strip Reflections (Warped across sphere)
                ctx.save();
                ctx.rotate(s.angle * 0.18 + lightDirX * 0.35);
                const bandGrad = ctx.createLinearGradient(0, -baseRadius, 0, baseRadius);
                bandGrad.addColorStop(0.0, 'rgba(255,255,255,0.45)');
                bandGrad.addColorStop(0.18, 'rgba(0,0,0,0.65)');
                bandGrad.addColorStop(0.36, 'rgba(255,255,255,0.75)');
                bandGrad.addColorStop(0.50, 'rgba(10,10,14,0.85)');
                bandGrad.addColorStop(0.68, 'rgba(255,255,255,0.4)');
                bandGrad.addColorStop(0.85, 'rgba(0,0,0,0.7)');
                bandGrad.addColorStop(1.0, 'rgba(255,255,255,0.6)');
                ctx.globalCompositeOperation = 'overlay';
                ctx.fillStyle = bandGrad;
                ctx.fillRect(-baseRadius * 1.3, -baseRadius * 1.3, baseRadius * 2.6, baseRadius * 2.6);
                ctx.restore();

                // Layer C: Deep Machined Precision Cross/Slotted Drive Channel (Rotates with Screw Torque)
                ctx.save();
                ctx.rotate(s.angle);

                const slotLength = baseRadius * 1.24;
                const slotWidth = 7.5;
                const crossLength = baseRadius * 0.68;

                // Beveled Chrome Rim Catch-Light around the Machined Drive Slot
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.fillRect(-slotLength / 2 - 1.2, -slotWidth / 2 - 1.4, slotLength + 2.4, slotWidth + 2.8);
                ctx.fillRect(-slotWidth / 2 - 1.4, -crossLength / 2 - 1.2, slotWidth + 2.8, crossLength + 2.4);

                // Deep Carved Interior Wall of the Drive Channel
                const slotDepthGrad = ctx.createLinearGradient(0, -slotWidth / 2, 0, slotWidth / 2);
                slotDepthGrad.addColorStop(0, '#020203');
                slotDepthGrad.addColorStop(0.35, '#18181b');
                slotDepthGrad.addColorStop(0.7, '#3f3f46');
                slotDepthGrad.addColorStop(1, '#09090b');

                ctx.fillStyle = slotDepthGrad;
                ctx.fillRect(-slotLength / 2, -slotWidth / 2, slotLength, slotWidth);
                ctx.fillRect(-slotWidth / 2, -crossLength / 2, slotWidth, crossLength);

                // Inner Machined Torque Center Hex Pit
                ctx.fillStyle = '#030304';
                ctx.beginPath();
                ctx.arc(0, 0, slotWidth * 0.72, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(255,255,255,0.45)';
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.restore();

                // Layer D: Primary Pinpoint Specular Softbox Glint & Grazing Fresnel Rim
                const glintX = -baseRadius * 0.32 + lightDirX * 14;
                const glintY = -baseRadius * 0.34 + lightDirY * 14;
                const glintGrad = ctx.createRadialGradient(glintX, glintY, 1, glintX, glintY, baseRadius * 0.42);
                glintGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
                glintGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.45)');
                glintGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = glintGrad;
                ctx.beginPath();
                ctx.arc(glintX, glintY, baseRadius * 0.42, 0, Math.PI * 2);
                ctx.fill();

                // Crisp Fresnel Outer Edge Stroke
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                points.forEach((pt, i) => {
                    if (i === 0) ctx.moveTo(pt.x, pt.y);
                    else ctx.lineTo(pt.x, pt.y);
                });
                ctx.closePath();
                ctx.stroke();

                ctx.restore();

                // 4. SATELLITE LIQUID-MERCURY MICRO-DROPLETS (EJECTED WHEN UNSCREWED)
                if (clampedUnscrew > 0.25) {
                    const dropProgress = (clampedUnscrew - 0.25) / 0.75;
                    s.droplets.forEach((d, di) => {
                        const curAngle = d.angle + s.angle * 0.4 + time * d.speed;
                        const dist = baseRadius * (0.95 + dropProgress * 0.45);
                        const dx = headCx + Math.cos(curAngle) * dist;
                        const dy = headCy + Math.sin(curAngle) * dist;
                        const r = d.size * dropProgress;

                        const dGrad = ctx.createRadialGradient(dx - r * 0.3, dy - r * 0.3, 0.5, dx, dy, r);
                        dGrad.addColorStop(0, '#ffffff');
                        dGrad.addColorStop(0.5, '#a1a1aa');
                        dGrad.addColorStop(0.85, '#09090b');
                        dGrad.addColorStop(1, '#ffffff');

                        ctx.save();
                        ctx.globalAlpha = headAlpha * dropProgress;
                        ctx.fillStyle = dGrad;
                        ctx.beginPath();
                        ctx.arc(dx, dy, r, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    });
                }
            }
        }

        function npClamp(val, min, max) {
            return Math.max(min, Math.min(max, val));
        }

        // --------------------------------------------------
        // 4. CENTRAL 3D LIQUID-MERCURY & REFRACTIVE MONOLITH LENS
        // --------------------------------------------------
        function renderMercuryBlobCanvas(canvasId, time, scaleFactor = 1, isInteractive = true) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const W = canvas.width;
            const H = canvas.height;
            const cx = W / 2;
            const cy = H / 2;

            ctx.clearRect(0, 0, W, H);

            // Normalized mouse offset for 3D reflection shift
            const mx = (mouse.lerpX / window.innerWidth - 0.5) * 2;
            const my = (mouse.lerpY / window.innerHeight - 0.5) * 2;

            const baseR = (W * 0.34) * scaleFactor;
            const numPts = 90;
            const pts = [];

            for (let i = 0; i < numPts; i++) {
                const a = (i / numPts) * Math.PI * 2;
                const n1 = Math.sin(a * 3 + time * 1.9 + mx * 2.2) * 11;
                const n2 = Math.cos(a * 5 - time * 2.4 + my * 2.2) * 6.5;
                const n3 = Math.sin(a * 2 - time * 1.2) * 8;
                const r = baseR + (n1 + n2 + n3) * scaleFactor;
                pts.push({
                    x: cx + Math.cos(a) * r + mx * 8,
                    y: cy + Math.sin(a) * r + my * 8
                });
            }

            // Outer architectural razor-sharp rotated frame contrasting the organic mercury
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(time * 0.15 + mx * 0.25);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
            ctx.lineWidth = 1;
            const boxSize = baseR * 1.52;
            ctx.strokeRect(-boxSize / 2, -boxSize / 2, boxSize, boxSize);
            ctx.restore();

            // Ambient glow behind mercury core
            const glowGrad = ctx.createRadialGradient(cx, cy, baseR * 0.2, cx, cy, baseR * 1.45);
            glowGrad.addColorStop(0, 'rgba(255,255,255,0.22)');
            glowGrad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = glowGrad;
            ctx.beginPath();
            ctx.arc(cx, cy, baseR * 1.45, 0, Math.PI * 2);
            ctx.fill();

            // Clip to organic liquid mercury silhouette
            ctx.save();
            ctx.beginPath();
            pts.forEach((p, idx) => {
                if (idx === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.closePath();
            ctx.clip();

            // Multi-lobed liquid chrome studio reflection map
            const specX = cx - baseR * 0.32 + mx * 36;
            const specY = cy - baseR * 0.35 + my * 36;
            const coreGrad = ctx.createRadialGradient(specX, specY, 4, cx, cy, baseR * 1.25);
            coreGrad.addColorStop(0.00, '#ffffff');
            coreGrad.addColorStop(0.16, '#f4f4f5');
            coreGrad.addColorStop(0.32, '#71717a');
            coreGrad.addColorStop(0.50, '#09090b');
            coreGrad.addColorStop(0.68, '#18181b');
            coreGrad.addColorStop(0.84, '#d4d4d8');
            coreGrad.addColorStop(1.00, '#ffffff');

            ctx.fillStyle = coreGrad;
            ctx.fillRect(0, 0, W, H);

            // Refracted Avant-Garde Silhouette & Architectural Sunlight Blades inside the Lens
            ctx.save();
            ctx.translate(cx + mx * -18, cy + my * -18);
            ctx.rotate(-0.28 + mx * 0.18);

            // Stark Cyclorama Light Stripes (Elevator & Window Shadow Grid)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
            for (let s = -4; s <= 4; s++) {
                ctx.fillRect(s * 24, -baseR * 1.4, 8, baseR * 2.8);
            }

            // Sculptural High-Fashion Hat & Monolith Silhouette Refracted in Center
            ctx.fillStyle = 'rgba(5, 5, 8, 0.86)';
            // Wide Avant-Garde Hat Brim
            ctx.beginPath();
            ctx.ellipse(0, -14, baseR * 0.62, baseR * 0.13, 0, 0, Math.PI * 2);
            ctx.fill();
            // Tall Crown
            ctx.fillRect(-baseR * 0.16, -baseR * 0.52, baseR * 0.32, baseR * 0.4);
            // Monolith Shoulders
            ctx.beginPath();
            ctx.moveTo(-baseR * 0.38, baseR * 0.75);
            ctx.lineTo(-baseR * 0.28, 4);
            ctx.lineTo(baseR * 0.28, 4);
            ctx.lineTo(baseR * 0.38, baseR * 0.75);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            // Specular Hotspots & Grazing Rim Reflection
            const hotGrad = ctx.createRadialGradient(specX, specY, 1, specX, specY, baseR * 0.45);
            hotGrad.addColorStop(0, 'rgba(255,255,255,0.95)');
            hotGrad.addColorStop(0.4, 'rgba(255,255,255,0.3)');
            hotGrad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = hotGrad;
            ctx.beginPath();
            ctx.arc(specX, specY, baseR * 0.45, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            pts.forEach((p, idx) => {
                if (idx === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.closePath();
            ctx.stroke();

            ctx.restore();
        }

        // --------------------------------------------------
        // 5. REACTIVE FERROFLUID RIPPLES & LIGHT-BLADE LANDING CANVAS
        // --------------------------------------------------
        // --------------------------------------------------
        // 6. SPRING-DRIVEN VAULT UNSCREWING & PANEL SPLIT ENGINE
        // --------------------------------------------------
        const vaultSpring = {
            openProgress: 0,
            targetOpen: 0,
            velocity: 0
        };

        function toggleSingleScrew(index) {
            if (vaultUnlocking) return;
            const s = screwPhysics[index];
            const wrapEl = document.getElementById(`screw-wrap-${index}`);
            const statusEl = document.getElementById(`screw-status-${index}`);

            screwStates[index] = !screwStates[index];
            playMechanicalRatchet(index * 32, screwStates[index]);

            if (screwStates[index]) {
                // Unscrew: counter-clockwise 3 full turns + rise toward camera
                s.targetProgress = 1.0;
                s.targetAngle -= Math.PI * 6;
                if (wrapEl) wrapEl.classList.add('is-unscrewed');
                if (statusEl) {
                    statusEl.textContent = 'STATE: THREADS EXPOSED';
                    statusEl.className = 'text-white font-bold';
                }
            } else {
                // Re-torque clockwise back into leather socket
                s.targetProgress = 0.0;
                s.targetAngle += Math.PI * 6;
                if (wrapEl) wrapEl.classList.remove('is-unscrewed');
                if (statusEl) {
                    statusEl.textContent = 'TORQUE: 18.4 N·m';
                    statusEl.className = 'text-zinc-400';
                }
            }

            const lockedCount = screwStates.filter(st => !st).length;
            const counterEl = document.getElementById('vault-fastener-count');
            const statusReadout = document.getElementById('vault-status-readout');
            if (counterEl) {
                counterEl.textContent = `${lockedCount}/4 ENGAGED`;
            }
            if (statusReadout) {
                statusReadout.textContent = lockedCount === 4
                    ? 'READY TO EXPLORE'
                    : `STATUS: ${4 - lockedCount}/4 FASTENERS UNSCREWED`;
            }

            // Automatically open the vault if all 4 screws are manually unscrewed
            if (lockedCount === 0) {
                triggerVaultSequence();
            }
        }

        function triggerVaultSequence() {
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { skipIntro(); return; }
            if (vaultUnlocking) return;
            vaultUnlocking = true;
            beginMaterialExit();

            const vaultEl = document.getElementById('leather-vault');
            const statusReadout = document.getElementById('vault-status-readout');
            const enterBtnText = document.getElementById('enter-btn-text');

            if (statusReadout) statusReadout.textContent = 'OPENING THE ATELIER';
            if (enterBtnText) enterBtnText.textContent = 'ENTERING THE ATELIER';

            // Stage 1: Staggered realistic counter-clockwise unscrewing of all 4 3D orb screws
            [0, 1, 2, 3].forEach((idx, stagger) => {
                scheduleVault(() => {
                    const s = screwPhysics[idx];
                    const wrapEl = document.getElementById(`screw-wrap-${idx}`);
                    const statusEl = document.getElementById(`screw-status-${idx}`);
                    if (!screwStates[idx]) {
                        screwStates[idx] = true;
                        s.targetProgress = 1.0;
                        s.targetAngle -= Math.PI * 6.5;
                        playMechanicalRatchet(idx * 35, true);
                    }
                    if (wrapEl) wrapEl.classList.add('is-unscrewed');
                    if (statusEl) {
                        statusEl.textContent = 'STATE: RELEASED';
                        statusEl.className = 'text-white font-bold';
                    }
                }, stagger * 55);
            });

            // Stage 2: Detach orbs out of their sockets with spring elevation
            scheduleVault(() => {
                screwPhysics.forEach((s) => {
                    s.targetProgress = 1.85;
                    s.targetAngle -= Math.PI * 3;
                });
                const counterEl = document.getElementById('vault-fastener-count');
                if (counterEl) counterEl.textContent = '0/4 UNLOCKED';
                if (statusReadout) statusReadout.textContent = 'WELCOME INSIDE';
                playVaultReleaseSound();
            }, 260);

            // Stage 3: Engage spring-physics leather panel separation
            scheduleVault(() => {
                vaultSpring.targetOpen = 1;
            }, 360);

            // Stage 4: Disable vault pointer events once panels have glided open
            scheduleVault(() => {
                vaultIsOpen = true;
                vaultEl.style.pointerEvents = 'none';
                completeVaultEntry();
            }, 1800);
        }

        function relockVault() {
            const vaultEl = document.getElementById('leather-vault');
            const statusReadout = document.getElementById('vault-status-readout');
            const enterBtnText = document.getElementById('enter-btn-text');
            const counterEl = document.getElementById('vault-fastener-count');

            vaultIsOpen = false;
            vaultEl.style.pointerEvents = 'auto';
            document.body.classList.add('vault-locked');

            // Spring panels back together
            vaultSpring.targetOpen = 0;

            // Re-thread all 4 3D orb screws back into their sockets
            scheduleVault(() => {
                [0, 1, 2, 3].forEach((idx, stagger) => {
                    scheduleVault(() => {
                        screwStates[idx] = false;
                        const s = screwPhysics[idx];
                        s.targetProgress = 0;
                        s.targetAngle += Math.PI * 6;
                        playMechanicalRatchet(idx * 25, false);

                        const wrapEl = document.getElementById(`screw-wrap-${idx}`);
                        const statusEl = document.getElementById(`screw-status-${idx}`);
                        if (wrapEl) wrapEl.classList.remove('is-unscrewed');
                        if (statusEl) {
                            statusEl.textContent = 'TORQUE: 18.4 N·m';
                            statusEl.className = 'text-zinc-400';
                        }
                    }, stagger * 90);
                });
            }, 320);

            if (counterEl) counterEl.textContent = 'A WORLD WITHIN';
            if (statusReadout) statusReadout.textContent = 'READY TO EXPLORE';
            if (enterBtnText) enterBtnText.textContent = 'ENTER THE ATELIER';

            playVaultReleaseSound();
            scheduleVault(() => {
                vaultUnlocking = false;
            }, 1050);
        }

        // --------------------------------------------------
        // 7. MASTER 60FPS ANIMATION LOOP (SPRING PHYSICS + SHADERS)
        // --------------------------------------------------
        const panelEls = [
            document.getElementById('vault-panel-0'),
            document.getElementById('vault-panel-1'),
            document.getElementById('vault-panel-2'),
            document.getElementById('vault-panel-3')
        ];
        const centerPlateEl = document.getElementById('vault-center-plate');

        function masterAnimationLoop(nowMs) {
            if (vaultIsOpen) return;
            const time = nowMs * 0.001;

            // 1. Smoothly interpolate cursor position & velocity deformation
            mouse.vx = mouse.x - mouse.lerpX;
            mouse.vy = mouse.y - mouse.lerpY;
            mouse.lerpX += mouse.vx * 0.16;
            mouse.lerpY += mouse.vy * 0.16;

            document.documentElement.style.setProperty('--cursor-x', `${mouse.lerpX}px`);
            document.documentElement.style.setProperty('--cursor-y', `${mouse.lerpY}px`);

            if (cursorOuter && cursorDot) {
                const speed = Math.min(Math.hypot(mouse.vx, mouse.vy), 60);
                const angle = Math.atan2(mouse.vy, mouse.vx);
                const stretch = 1 + (speed / 60) * 0.38;
                const squash = 1 / Math.sqrt(stretch);
                const hoverScale = mouse.hoverLabel ? 1.55 : 1.0;

                cursorOuter.style.transform = `translate3d(${mouse.lerpX}px, ${mouse.lerpY}px, 0) translate(-50%, -50%) rotate(${angle}rad) scale(${stretch * hoverScale}, ${squash * hoverScale})`;
                if (cursorLabel) {
                    cursorLabel.style.transform = `rotate(${-angle}rad)`;
                }
                cursorDot.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0) translate(-50%, -50%)`;
            }

            // 2. Vault Spring Physics & 3D Parallax Plate Tilt
            const vForce = (vaultSpring.targetOpen - vaultSpring.openProgress) * 0.065;
            vaultSpring.velocity = (vaultSpring.velocity + vForce) * 0.80;
            vaultSpring.openProgress += vaultSpring.velocity;
            const vp = Math.max(0, vaultSpring.openProgress);

            if (!vaultIsOpen || vp < 0.999) {
                // 3D Tilt on Central Leather Lock Plate based on cursor position
                const normX = (mouse.lerpX / window.innerWidth - 0.5) * 2;
                const normY = (mouse.lerpY / window.innerHeight - 0.5) * 2;
                const tiltX = -normY * 4.5 * (1 - vp);
                const tiltY = normX * 5.5 * (1 - vp);

                if (centerPlateEl) {
                    if (vaultUnlocking) {
                        centerPlateEl.style.transform = '';
                        centerPlateEl.style.opacity = '';
                    } else {
                        const plateScale = 1 - vp * 0.16;
                        const plateOpacity = Math.max(0, 1 - vp * 1.35);
                        centerPlateEl.style.transform = `perspective(1400px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale(${plateScale})`;
                        centerPlateEl.style.opacity = plateOpacity;
                    }
                }

                // Split 4 Leather Panels with realistic spring glide & rotation
                if (vaultUnlocking) {
                    panelEls.forEach(panel => { if (panel) panel.style.transform = ''; });
                } else {
                    const pDist = vp * 112;
                    const pRot = vp * 6.5;
                    if (panelEls[0]) panelEls[0].style.transform = `translate3d(${-pDist}%, ${-pDist}%, 0) rotate(${-pRot}deg)`;
                    if (panelEls[1]) panelEls[1].style.transform = `translate3d(${pDist}%, ${-pDist}%, 0) rotate(${pRot}deg)`;
                    if (panelEls[2]) panelEls[2].style.transform = `translate3d(${-pDist}%, ${pDist}%, 0) rotate(${pRot}deg)`;
                    if (panelEls[3]) panelEls[3].style.transform = `translate3d(${pDist}%, ${pDist}%, 0) rotate(${-pRot}deg)`;
                }

                // Render all 4 3D Organic Chrome Orb Screws
                screwPhysics.forEach(s => renderSingle3DScrew(s, time));

                // Render Central Liquid-Mercury Monolith Lens
                renderMercuryBlobCanvas('central-mercury-canvas', time, 1.0, true);

                // Render Ferrofluid & Sunlight Blade Surface
                renderFluidLandingSurface(time);
            }

            // 3. Render Hero 3D Liquid-Mercury Orb inside the Portfolio World
            renderMercuryBlobCanvas('hero-mercury-canvas', time * 0.85, 0.95, false);
            if (heroOrb) {
                const moveX = (mouse.lerpX / window.innerWidth - 0.5) * 34;
                const moveY = (mouse.lerpY / window.innerHeight - 0.5) * 34;
                heroOrb.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;
            }

            requestAnimationFrame(masterAnimationLoop);
        }

        // --------------------------------------------------
        // 8. VAULT TYPEWRITER CYCLING
        // --------------------------------------------------
        const disciplinesList = [
            'INTERIOR DESIGN',
            'BRAND IDENTITY',
            'AVANT-GARDE PHOTOGRAPHY',
            'SOCIAL MEDIA CURATION'
        ];
        let discIndex = 0;
        let charIndex = 0;
        let isDeleting = false;
        let typewriterTimer = null;
        const typewriterEl = document.getElementById('vault-typewriter');

        function runTypewriter() {
            clearTimeout(typewriterTimer);
            if (vaultIsOpen) return;
            const currentWord = disciplinesList[discIndex];
            if (isDeleting) {
                charIndex--;
            } else {
                charIndex++;
            }

            if (typewriterEl) {
                typewriterEl.textContent = currentWord.substring(0, charIndex);
            }

            let delay = isDeleting ? 45 : 95;

            if (!isDeleting && charIndex === currentWord.length) {
                delay = 1800;
                isDeleting = true;
            } else if (isDeleting && charIndex === 0) {
                isDeleting = false;
                discIndex = (discIndex + 1) % disciplinesList.length;
                delay = 350;
            }

            typewriterTimer = setTimeout(runTypewriter, delay);
        }

        // --------------------------------------------------
