const container = document.getElementById('stageContainer');
const stage = new Konva.Stage({
  container: 'stageContainer',
  width: container.clientWidth,
  height: container.clientHeight,
});

const layer = new Konva.Layer({ draggable: true });
const gridLayer = new Konva.Layer({ listening: false });
stage.add(layer);
stage.add(gridLayer);

let imgWidth = 0;
let imgHeight = 0;
let imageNode = null;
let imgScale = 1;
let zoom = 1;

const yRois = [];
let xRoi = null;
let uid = 0;
const roiList = document.getElementById('roiList');

function fitStage() {
  stage.width(container.clientWidth);
  stage.height(container.clientHeight);
}

window.addEventListener('resize', () => {
  fitStage();
  applyTransform();
});

function computeBaseScale() {
  const maxW = stage.width();
  const maxH = stage.height();
  const down = Math.min(maxW / imgWidth, maxH / imgHeight, 1);
  const up = Math.max(maxW / imgWidth, maxH / imgHeight, 1);
  imgScale = imgWidth < maxW && imgHeight < maxH ? up : down;
}

function applyTransform() {
  const scale = imgScale * zoom;
  layer.scale({ x: scale, y: scale });
  gridLayer.scale({ x: scale, y: scale });
  gridLayer.position(layer.position());
  drawPixelGrid();
  stage.draw();
}

function drawPixelGrid() {
  gridLayer.destroyChildren();
  const scale = imgScale * zoom;
  if (scale <= 1) return;
  const stroke = 1 / scale;
  for (let x = 0; x <= imgWidth; x++) {
    gridLayer.add(
      new Konva.Line({
        points: [x, 0, x, imgHeight],
        stroke: 'rgba(0,0,0,0.1)',
        strokeWidth: stroke,
      })
    );
  }
  for (let y = 0; y <= imgHeight; y++) {
    gridLayer.add(
      new Konva.Line({
        points: [0, y, imgWidth, y],
        stroke: 'rgba(0,0,0,0.1)',
        strokeWidth: stroke,
      })
    );
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
    roiList.selected = li;
    stage.draw();
  });
  roiList.appendChild(li);
  return li;
}

function syncList() {
  Array.from(roiList.children).forEach((li, idx) => {
    const { rect } = yRois[idx];
    const y1 = Math.round(rect.y());
    const y2 = Math.round(rect.y() + rect.height());
    li.textContent = `ROI ${idx + 1}: ${y1}-${y2}px`;
  });
}

function addYROI(auto = true) {
  if (!imageNode) return alert('画像を読み込んでください');
  let y1, y2;
  if (auto && yRois.length) {
    const last = yRois[yRois.length - 1].rect;
    const span = last.height();
    y1 = last.y() + span;
    y2 = Math.min(imgHeight, y1 + span);
  } else {
    y1 = imgHeight * 0.25;
    y2 = imgHeight * 0.75;
  }
  const rect = new Konva.Rect({
    x: 0,
    y: y1,
    width: imgWidth,
    height: y2 - y1,
    fill: 'rgba(0,100,255,0.3)',
    draggable: true,
  });
  rect.on('transformend dragend', syncList);
  layer.add(rect);
  const id = ++uid;
  yRois.push({ rect, id });
  appendListItem(id, rect);
  syncList();
  stage.draw();
}

function toggleXRoi() {
  if (!imageNode) return alert('画像を読み込んでください');
  if (xRoi) {
    xRoi.destroy();
    xRoi = null;
  } else {
    xRoi = new Konva.Rect({
      x: imgWidth * 0.1,
      y: 0,
      width: imgWidth * 0.8,
      height: imgHeight,
      fill: 'rgba(255,140,0,0.3)',
      draggable: true,
    });
    layer.add(xRoi);
  }
  stage.draw();
}

document.getElementById('fileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    imgWidth = img.width;
    imgHeight = img.height;
    if (!imageNode) {
      imageNode = new Konva.Image({ image: img, width: imgWidth, height: imgHeight });
      layer.destroyChildren();
      layer.add(imageNode);
    } else {
      imageNode.image(img);
      imageNode.width(imgWidth);
      imageNode.height(imgHeight);
    }
    yRois.forEach(({ rect }) => rect.destroy());
    yRois.length = 0;
    roiList.innerHTML = '';
    if (xRoi) { xRoi.destroy(); xRoi = null; }
    computeBaseScale();
    layer.position({ x: 0, y: 0 });
    zoom = 1;
    applyTransform();
  };
  img.src = url;
});

function deleteSelected() {
  const li = roiList.selected;
  if (!li) return;
  const index = Array.from(roiList.children).indexOf(li);
  const { rect } = yRois[index];
  rect.destroy();
  yRois.splice(index, 1);
  li.remove();
  roiList.selected = null;
  syncList();
  stage.draw();
}

function saveSlices() {
  if (!yRois.length) return alert('Y‑ROI がありません');
  const coords = {
    yRois: yRois.map(({ rect }) => [
      Math.round(rect.y()),
      Math.round(rect.y() + rect.height()),
    ]),
    xRoi: xRoi
      ? [Math.round(xRoi.x()), Math.round(xRoi.x() + xRoi.width())]
      : null,
  };
  const file = document.getElementById('fileInput').files[0];
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

document.getElementById('addY').onclick = () => addYROI();
document.getElementById('toggleX').onclick = toggleXRoi;
document.getElementById('save').onclick = saveSlices;
document.getElementById('clearYs').onclick = () => {
  yRois.forEach(({ rect }) => rect.destroy());
  yRois.length = 0;
  roiList.innerHTML = '';
  roiList.selected = null;
  stage.draw();
};
document.getElementById('zoomIn').onclick = () => { zoom *= 1.25; applyTransform(); };
document.getElementById('zoomOut').onclick = () => { zoom /= 1.25; applyTransform(); };
document.addEventListener('keydown', e => {
  if (e.key === 'Delete') deleteSelected();
});

fitStage();
