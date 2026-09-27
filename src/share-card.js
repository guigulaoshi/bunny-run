export async function createShareCard(score, translate, scenePicture) {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f6f4e9";
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.drawImage(scenePicture, 0, 730, 1080, 620);
  const fade = ctx.createLinearGradient(0, 730, 0, 835);
  fade.addColorStop(0, "#f6f4e9");
  fade.addColorStop(1, "#f6f4e900");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 730, 1080, 105);
  ctx.textAlign = "center";
  ctx.fillStyle = "#48634e";
  const font = '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
  ctx.font = `600 36px ${font}`;
  ctx.fillText(translate("\u5C0F\u5154\u5FEB\u8DD1"), 540, 145);
  ctx.fillStyle = "#294e3d";
  ctx.font = `700 64px ${font}`;
  ctx.fillText(translate("\u6700\u597D\u6210\u7EE9"), 540, 295);
  const value = String(Math.max(0, Math.floor(Number(score) || 0)));
  let size = 178;
  ctx.font = `800 ${size}px ${font}`;
  while (ctx.measureText(value).width > 780 && size > 40) {
    size -= 4;
    ctx.font = `800 ${size}px ${font}`;
  }
  ctx.fillText(value, 540, 495);
  ctx.save();
  ctx.translate(540, 590);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 20 : 43;
    const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.lineJoin = "round";
  ctx.lineWidth = 9;
  const gold = ctx.createLinearGradient(0, -43, 0, 43);
  gold.addColorStop(0, "#ffe99a");
  gold.addColorStop(1, "#e5ac35");
  ctx.fillStyle = gold;
  ctx.strokeStyle = "#f6ce67";
  ctx.stroke();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#60765d";
  ctx.font = `500 30px ${font}`;
  ctx.fillText(translate("\u8DF3\u4E00\u4E0B\uFF0C\u8DD1\u66F4\u8FDC"), 540, 690);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG export failed")), "image/png"));
}
export function canShareImage(platform, file) {
  try {
    return Boolean(platform.share && platform.canShare?.({ files: [file] }));
  } catch {
    return false;
  }
}
