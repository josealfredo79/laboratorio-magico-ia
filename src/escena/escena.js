// Renderer, cámara y conversión de coordenadas cámara-web → pantalla → mundo 3D.
import * as THREE from "three";

export function crearEscena(contenedor, video) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  contenedor.appendChild(renderer.domElement);

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camara.position.set(0, 0, 10);
  escena.add(new THREE.HemisphereLight(0xffffff, 0x223355, 1.6));
  const sol = new THREE.DirectionalLight(0xffffff, 2.2);
  sol.position.set(3, 5, 8);
  escena.add(sol);

  // Tamaño de la pantalla en píxeles y del plano z=0 en unidades del mundo.
  const vista = { ancho: 1, alto: 1, mundoAncho: 1, mundoAlto: 1 };

  function redimensionar() {
    vista.ancho = innerWidth;
    vista.alto = innerHeight;
    renderer.setSize(vista.ancho, vista.alto);
    camara.aspect = vista.ancho / vista.alto;
    camara.updateProjectionMatrix();
    vista.mundoAlto = 2 * camara.position.z * Math.tan(THREE.MathUtils.degToRad(camara.fov / 2));
    vista.mundoAncho = vista.mundoAlto * camara.aspect;
  }
  addEventListener("resize", redimensionar);
  redimensionar();

  // Rectángulo que ocupa el video con object-fit: cover.
  function marcoVideo() {
    const vw = video.videoWidth || 16;
    const vh = video.videoHeight || 9;
    const escala = Math.max(vista.ancho / vw, vista.alto / vh);
    const w = vw * escala;
    const h = vh * escala;
    return { x: (vista.ancho - w) / 2, y: (vista.alto - h) / 2, w, h };
  }

  // Coordenadas normalizadas de MediaPipe → píxeles (en espejo, como el video).
  function normAPantalla(nx, ny) {
    const m = marcoVideo();
    return { x: m.x + (1 - nx) * m.w, y: m.y + ny * m.h };
  }

  // Píxeles → punto 3D a profundidad z que se ve exactamente en ese píxel.
  function pantallaAMundo(px, py, z = 0) {
    const f = (camara.position.z - z) / camara.position.z;
    return new THREE.Vector3(
      (px / vista.ancho - 0.5) * vista.mundoAncho * f,
      -(py / vista.alto - 0.5) * vista.mundoAlto * f,
      z,
    );
  }

  function mundoAPantalla(punto) {
    const p = punto.clone().project(camara);
    return { x: ((p.x + 1) / 2) * vista.ancho, y: ((1 - p.y) / 2) * vista.alto };
  }

  return {
    renderer,
    escena,
    camara,
    vista,
    normAPantalla,
    pantallaAMundo,
    mundoAPantalla,
    normAMundo: (nx, ny, z = 0) => {
      const p = normAPantalla(nx, ny);
      return pantallaAMundo(p.x, p.y, z);
    },
    render: () => renderer.render(escena, camara),
  };
}

// Quita un objeto de la escena y libera su memoria de GPU.
export function liberar(objeto) {
  objeto.traverse((o) => {
    o.geometry?.dispose();
    const materiales = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of materiales) {
      m.map?.dispose();
      m.dispose();
    }
  });
  objeto.removeFromParent();
}
