/* =====================================================================
   FERROFLUID SPIKES & BRUTALIST CHROME TALISMAN CANVAS ENGINE
   ===================================================================== */
(function() {
  const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Ferrofluid Spike Dividers
  function initSpikeDividers() {
    document.querySelectorAll('[data-ferro-divider]').forEach((container, idx) => {
      const canvas = container.querySelector('canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      let w = (canvas.width = container.offsetWidth * (window.devicePixelRatio || 1));
      let h = (canvas.height = container.offsetHeight * (window.devicePixelRatio || 1));

      window.addEventListener('resize', () => {
        w = canvas.width = container.offsetWidth * (window.devicePixelRatio || 1);
        h = canvas.height = container.offsetHeight * (window.devicePixelRatio || 1);
      });

      let mouseX = w / 2;
      container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        mouseX = (e.clientX - rect.left) * (window.devicePixelRatio || 1);
      });

      let time = idx * 1.5;
      function draw() {
        ctx.clearRect(0, 0, w, h);
        const count = 48;
        const step = w / count;
        const midY = h / 2;

        ctx.fillStyle = '#111115';
        ctx.fillRect(0, 0, w, h);

        ctx.beginPath();
        ctx.moveTo(0, midY);

        for (let i = 0; i <= count; i++) {
          const x = i * step;
          const distToMouse = Math.abs(x - mouseX);
          const influence = Math.max(0, 1 - distToMouse / (180 * (window.devicePixelRatio || 1)));
          const spikeHeight = Math.sin(i * 0.45 + time) * 12 + influence * 28;
          const y = (i % 2 === 0) ? midY - spikeHeight : midY + (spikeHeight * 0.4);
          ctx.lineTo(x, y);
        }

        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.2, '#71717a');
        grad.addColorStop(0.7, '#18181b');
        grad.addColorStop(1, '#09090b');

        ctx.fillStyle = grad;
        ctx.fill();

        time += 0.035;
        if (!isReduced) requestAnimationFrame(draw);
      }
      draw();
    });
  }

  // 2. Interactive 3D Talisman Canvases
  function initTalismans() {
    ['interior-talisman-canvas'].forEach((id, idx) => {
      const canvas = document.getElementById(id);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      let size = (canvas.width = canvas.height = 360 * (window.devicePixelRatio || 1));

      let rotX = 0.4;
      let rotY = 0.5 + idx * 0.8;
      let isDragging = false;
      let lastX = 0, lastY = 0;

      canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
      });
      window.addEventListener('mouseup', () => { isDragging = false; });
      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        rotY += dx * 0.01;
        rotX += dy * 0.01;
        lastX = e.clientX;
        lastY = e.clientY;
      });

      function render() {
        ctx.clearRect(0, 0, size, size);
        const cx = size / 2;
        const cy = size / 2;
        const radius = size * 0.28;

        if (!isDragging) {
          rotY += 0.008;
        }

        // Draw central chrome core
        const grad = ctx.createRadialGradient(cx - 30, cy - 30, 10, cx, cy, radius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, '#d4d4d8');
        grad.addColorStop(0.6, '#3f3f46');
        grad.addColorStop(0.95, '#09090b');
        grad.addColorStop(1, '#000000');

        ctx.save();
        ctx.translate(cx, cy);

        // Draw radial spikes rotated in 3D
        const spikeCount = 12;
        for (let i = 0; i < spikeCount; i++) {
          const angle = (i / spikeCount) * Math.PI * 2 + rotY;
          const z = Math.sin(angle);
          const x = Math.cos(angle) * (radius * 1.35);
          const y = (i % 2 === 0 ? -1 : 1) * 20 * Math.cos(rotX);

          ctx.beginPath();
          ctx.arc(x, y, 6 + z * 3, 0, Math.PI * 2);
          ctx.fillStyle = z > 0 ? '#ffffff' : '#52525b';
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(x, y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0.15, 0.6 + z * 0.4)})`;
          ctx.lineWidth = 2 + z;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
        ctx.shadowBlur = 25;
        ctx.fill();
        ctx.restore();

        if (!isReduced) requestAnimationFrame(render);
      }
      render();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initSpikeDividers();
      initTalismans();
    });
  } else {
    initSpikeDividers();
    initTalismans();
  }
})();
