const stage = new Konva.Stage({
  container: 'stageContainer',
  width: 900,
  height: 600,
});
const layer = new Konva.Layer();
stage.add(layer);

let imageNode = null;
let imgWidth = 0, imgHeight = 0;

document.querySelector('#fileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    imgWidth = img.width; imgHeight = img.height;
    imageNode = new Konva.Image({ image: img });
    layer.add(imageNode);
    layer.draw();
    stage.width(imgWidth);
    stage.height(imgHeight);
  };
  img.src = url;
});

const yRois = [];
let xRoi = null;
let uid = 0;
const roiList = document.getElementById('roiList');

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
    y1 = last.y() + last.height();
    const h = last.height();
    y2 = Math.min(imgHeight, y1 + h);
  } else {
    y1 = imgHeight * 0.25;
    y2 = imgHeight * 0.75;
  }
  const rect = new Konva.Rect({
    x: 0, y: y1, width: imgWidth, height: y2 - y1,
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
      x: imgWidth * 0.1, y: 0, width: imgWidth * 0.8, height: imgHeight,
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
    yRois: yRois.map(({ rect }) => [Math.round(rect.y()), Math.round(rect.y() + rect.height())]),
    xRoi: xRoi ? [Math.round(xRoi.x()), Math.round(xRoi.x() + xRoi.width())] : null,
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
