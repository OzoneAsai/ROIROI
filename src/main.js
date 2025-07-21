const container = document.getElementById('stageContainer');
const stage = new Konva.Stage({
  container: 'stageContainer',
  width: container.clientWidth || 900,
  height: container.clientHeight || 600,
});
const layer = new Konva.Layer();
const gridLayer = new Konva.Layer();
stage.add(layer);
stage.add(gridLayer);

let imageNode = null;
let imgWidth = 0, imgHeight = 0;
let imgScale = 1;

document.querySelector('#fileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    imgWidth = img.width; imgHeight = img.height;

    const maxW = container.clientWidth || 900;
    const maxH = container.clientHeight || 600;
    const downScale = Math.min(maxW / imgWidth, maxH / imgHeight, 1);
    const upScale = Math.max(maxW / imgWidth, maxH / imgHeight, 1);
    imgScale = imgWidth < maxW && imgHeight < maxH ? upScale : downScale;

    stage.width(imgWidth * imgScale);
    stage.height(imgHeight * imgScale);

    imageNode = new Konva.Image({
      image: img,
      width: imgWidth * imgScale,
      height: imgHeight * imgScale,
    });

    layer.destroyChildren();
    gridLayer.destroyChildren();
    layer.add(imageNode);

    if (imgScale > 1) drawPixelGrid(imgWidth, imgHeight, imgScale);

    layer.draw();
  };
  img.src = url;
});

const yRois = [];
let xRoi = null;
let uid = 0;
const roiList = document.getElementById('roiList');

function drawPixelGrid(w, h, scale) {
  gridLayer.destroyChildren();
  if (scale <= 1) return;
  for (let x = 0; x <= w; x++) {
    gridLayer.add(new Konva.Line({
      points: [x * scale, 0, x * scale, h * scale],
      stroke: 'rgba(0,0,0,0.1)',
      strokeWidth: 1,
    }));
  }
  for (let y = 0; y <= h; y++) {
    gridLayer.add(new Konva.Line({
      points: [0, y * scale, w * scale, y * scale],
      stroke: 'rgba(0,0,0,0.1)',
      strokeWidth: 1,
    }));
  }
  gridLayer.draw();
}

function appendListItem(id, rect) {
  const li = document.createElement('li');
  li.className = 'list-group-item list-group-item-action p-1';
  li.textContent = `ROI ${id}`;
  li.addEventListener('click', () => {
    Array.from(roiList.children).forEach(el => el.classList.remove('active'));
    yRois.forEach(({ rect }) => rect.stroke(null));
    rect.stroke('red');
    li.classList.add('active');
    layer.draw();
    roiList.selected = li;
  });
  roiList.appendChild(li);
  return li;
}

function syncList() {
  const items = roiList.querySelectorAll('li');
  items.forEach((li, idx) => {
    const { rect } = yRois[idx];
    const y1 = Math.round(rect.y() / imgScale);
    const y2 = Math.round((rect.y() + rect.height()) / imgScale);
    li.textContent = `ROI ${idx + 1}: ${y1}-${y2}px`;
  });
}

function addYROI(auto = true) {
  if (!imageNode) return alert('画像を読み込んでください');
  let y1, y2;
  if (auto && yRois.length) {
    const last = yRois[yRois.length - 1].rect;
    y1 = (last.y() + last.height()) / imgScale;
    const h = last.height() / imgScale;
    y2 = Math.min(imgHeight, y1 + h);
  } else {
    y1 = imgHeight * 0.25;
    y2 = imgHeight * 0.75;
  }
  const rect = new Konva.Rect({
    x: 0,
    y: y1 * imgScale,
    width: imgWidth * imgScale,
    height: (y2 - y1) * imgScale,
    fill: 'rgba(0,100,255,0.3)', draggable: true,
  });
  rect.on('transformend dragend', syncList);
  layer.add(rect); layer.draw();

  const id = ++uid;
  yRois.push({ rect, id });
  appendListItem(id, rect);
  syncList();
}

function toggleXRoi() {
  if (!imageNode) return alert('画像を読み込んでください');
  if (xRoi) {
    xRoi.destroy(); xRoi = null; layer.draw();
  } else {
    xRoi = new Konva.Rect({
      x: imgWidth * 0.1 * imgScale,
      y: 0,
      width: imgWidth * 0.8 * imgScale,
      height: imgHeight * imgScale,
      fill: 'rgba(255,140,0,0.3)', draggable: true,
    });
    layer.add(xRoi); layer.draw();
  }
}

function deleteSelected() {
  const li = roiList.selected;
  if (!li) return;
  const index = Array.from(roiList.children).indexOf(li);
  const { rect } = yRois[index];
  rect.destroy();
  yRois.splice(index, 1);
  li.remove();
  Array.from(roiList.children).forEach(el => el.classList.remove('active'));
  roiList.selected = null;
  syncList();
  layer.draw();
}

function saveSlices() {
  if (!yRois.length) return alert('Y‑ROI がありません');
  const coords = {
    yRois: yRois.map(({ rect }) => [
      Math.round(rect.y() / imgScale),
      Math.round((rect.y() + rect.height()) / imgScale),
    ]),
    xRoi: xRoi
      ? [
          Math.round(xRoi.x() / imgScale),
          Math.round((xRoi.x() + xRoi.width()) / imgScale),
        ]
      : null,
  };
  const file = document.querySelector('#fileInput').files[0];
  const form = new FormData();
  form.append('image', file);
  form.append('coords', JSON.stringify(coords));

  fetch('/api/slice', { method: 'POST', body: form })
    .then(r => r.blob())
    .then(blob => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'slices.zip';
      link.click();
    });
}

document.querySelector('#addY').onclick = () => addYROI();
document.querySelector('#toggleX').onclick = toggleXRoi;
document.querySelector('#save').onclick = saveSlices;
document.querySelector('#clearYs').onclick = () => {
  yRois.forEach(({ rect }) => rect.destroy());
  yRois.length = 0;
  roiList.innerHTML = '';
  roiList.selected = null;
  syncList();
  layer.draw();
};
document.addEventListener('keydown', e => {
  if (e.key === 'Delete') deleteSelected();
});
