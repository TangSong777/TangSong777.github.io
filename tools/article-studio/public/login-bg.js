/* 登录页背景：多色小球，随鼠标移动产生斥力与光晕。两站共用。 */
(function () {
  'use strict';
  var canvas = document.querySelector('.login-bg');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0;
  var balls = [];
  var mouse = { x: -9999, y: -9999, active: false };
  var COLORS = ['#4d7572', '#3f6e8c', '#d98324', '#7d5ba6', '#b5473f', '#5da48a', '#c25b7e', '#6aa6a0'];

  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function resize() {
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function init() {
    balls.length = 0;
    var n = Math.max(16, Math.min(28, Math.round((W * H) / 42000)));
    for (var i = 0; i < n; i++) {
      var r = 14 + Math.random() * 30;
      balls.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: r,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        c: COLORS[i % COLORS.length],
        a: 0.1 + Math.random() * 0.2
      });
    }
  }

  window.addEventListener('mousemove', function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  });
  window.addEventListener('mouseleave', function () {
    mouse.active = false;
  });
  window.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches[0]) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
      mouse.active = true;
    }
  }, { passive: true });

  function tick() {
    if (!document.hidden) {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < balls.length; i++) {
        var b = balls[i];
        if (mouse.active) {
          var dx = b.x - mouse.x;
          var dy = b.y - mouse.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          var R = 170;
          if (d < R && d > 0.1) {
            var f = (1 - d / R) * 0.9;
            b.vx += (dx / d) * f;
            b.vy += (dy / d) * f;
          }
        }
        b.vx *= 0.985;
        b.vy *= 0.985;
        b.x += b.vx;
        b.y += b.vy;
        if (b.x < -b.r) { b.x = -b.r; b.vx = Math.abs(b.vx); }
        else if (b.x > W + b.r) { b.x = W + b.r; b.vx = -Math.abs(b.vx); }
        if (b.y < -b.r) { b.y = -b.r; b.vy = Math.abs(b.vy); }
        else if (b.y > H + b.r) { b.y = H + b.r; b.vy = -Math.abs(b.vy); }

        var g = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.1, b.x, b.y, b.r);
        g.addColorStop(0, hexA(b.c, b.a));
        g.addColorStop(1, hexA(b.c, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (mouse.active) {
        var mg = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 120);
        mg.addColorStop(0, 'rgba(217,131,36,0.12)');
        mg.addColorStop(1, 'rgba(217,131,36,0)');
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 120, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', function () {
    resize();
    init();
  });

  resize();
  init();
  tick();
})();
