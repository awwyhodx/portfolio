// ------------------------------------------------------------------
// Sydoria: category menu with a 3D earring (motion concept).
// Hovering EARRINGS brings the earring in; it spins on its own and a
// fast pointer swipe across the frame kicks it into a sharp turn.
// three.js is loaded only when the block comes near the screen.
// ------------------------------------------------------------------
const block = document.querySelector('[data-cat3d]');
if (block) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items = [...block.querySelectorAll('.cat3d__item')];
  const stage = block.querySelector('.cat3d__stage');
  let api = null;                   // set once three.js and the model are ready
  let active = 'all';

  // Wide display face for the menu (stand-in, see HANDOFF.md); not needed for the earring alone
  if (items.length) {
    const font = document.createElement('link');
    font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=Lexend:wght@300&family=Michroma&display=swap';
    document.head.appendChild(font);
  }

  function setActive(key) {
    if (key === active) return;
    active = key;
    items.forEach((b) => b.classList.toggle('is-active', b.dataset.cat === key));
    if (key === 'earrings' && api) api.enter();
  }
  items.forEach((b) => {
    if (b.disabled) return;
    b.addEventListener('pointerenter', () => setActive(b.dataset.cat));
    b.addEventListener('focus', () => setActive(b.dataset.cat));
    b.addEventListener('click', () => setActive(b.dataset.cat));
  });
  block.addEventListener('pointerleave', () => setActive('all'));

  const near = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    near.disconnect();
    init().catch((err) => console.warn('Sydoria 3D:', err));
  }, { rootMargin: '400px 0px' });
  near.observe(block);

  async function init() {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    stage.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(2, 3, 4);
    scene.add(key);

    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 50);

    const gltf = await new GLTFLoader().loadAsync('images/sydoria/earring.glb');
    const model = gltf.scene;
    model.traverse((o) => { if (o.isMesh) o.material = jewelleryMaterial(THREE, o.material.map); });
    const box = new THREE.Box3().setFromObject(model);
    model.position.sub(box.getCenter(new THREE.Vector3()));
    const height = box.getSize(new THREE.Vector3()).y;
    camera.position.set(0, 0, (height / 2) / Math.tan(THREE.MathUtils.degToRad(28 / 2)) * 1.25);

    const yaw = new THREE.Group();     // spin + swipe
    const pitch = new THREE.Group();   // tilt from pointer height
    const pop = new THREE.Group();     // entrance scale
    yaw.add(model); pitch.add(yaw); pop.add(pitch); scene.add(pop);

    // Motion state
    const BASE_SPIN = reduceMotion ? 0 : 0.7;   // rad/s
    let angle = reduceMotion ? -0.45 : 0;
    let spin = BASE_SPIN;
    let tilt = 0, tiltTarget = 0;
    let popT = 1;                                // 0..1 entrance progress
    let lastX = null, lastT = 0;

    function resize() {
      const w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    }
    new ResizeObserver(resize).observe(stage);

    if (!reduceMotion) {
      block.addEventListener('pointermove', (e) => {
        const r = block.getBoundingClientRect();
        tiltTarget = ((e.clientY - r.top) / r.height - 0.5) * 0.6;
        if (lastX !== null && e.timeStamp - lastT < 80) {
          spin += (e.clientX - lastX) * 0.09;    // a fast swipe = a sharp turn
          spin = Math.max(-18, Math.min(18, spin));
        }
        lastX = e.clientX; lastT = e.timeStamp;
      });
      block.addEventListener('pointerleave', () => { tiltTarget = 0; lastX = null; });
    }

    function render() { renderer.render(scene, camera); }

    let running = false, prev = 0;
    function frame(t) {
      if (!running) return;
      const dt = Math.min((t - prev) / 1000 || 0, 0.05);
      prev = t;
      spin += (BASE_SPIN - spin) * (1 - Math.exp(-dt * 2.2));   // settle back to the idle spin
      angle += spin * dt;
      tilt += (tiltTarget - tilt) * (1 - Math.exp(-dt * 6));
      popT = Math.min(1, popT + dt * 1.6);
      const s = 1 - Math.pow(1 - popT, 3) * 0.45 + Math.sin(popT * Math.PI) * 0.06;
      pop.scale.setScalar(s);
      yaw.rotation.y = angle;
      pitch.rotation.x = tilt;
      render();
      requestAnimationFrame(frame);
    }
    function start() { if (running || reduceMotion) return; running = true; prev = performance.now(); requestAnimationFrame(frame); }
    function stop() { running = false; }

    new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0.1 }).observe(block);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : null));

    yaw.rotation.y = angle;
    resize();
    block.classList.add('is-ready');

    api = {
      enter() {
        if (reduceMotion) return;
        popT = 0;
        spin += 9;      // comes in with a quick turn
        start();
      },
    };
  }

  // Silver where the texture is grey, polished stone where it is blue.
  function jewelleryMaterial(THREE, map) {
    const m = new THREE.MeshStandardMaterial({ map, metalness: 1, roughness: 0.15, envMapIntensity: 1.25 });
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
          float gemMask = smoothstep(0.05, 0.16, diffuseColor.b - diffuseColor.r);
          vec3 silver = vec3(0.86, 0.87, 0.9) * (0.75 + 0.25 * dot(diffuseColor.rgb, vec3(0.333)));
          diffuseColor.rgb = mix(silver, diffuseColor.rgb * vec3(0.55, 1.0, 1.25), gemMask);`)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(roughness, 0.04, gemMask);')
        .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = mix(metalness, 0.0, gemMask);')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += diffuseColor.rgb * gemMask * 0.45;`);
    };
    return m;
  }
}
