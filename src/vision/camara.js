// Enciende la webcam. Solo funciona en localhost o HTTPS.
export async function iniciarCamara(video) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  if (video.readyState < 2) {
    await new Promise((listo) => video.addEventListener("loadeddata", listo, { once: true }));
  }
  return video;
}
