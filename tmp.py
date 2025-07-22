#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
question_slicer_v3.py
PyQt5 + PyQtGraph 製 問題用紙スライサー
機能:
  1) Y‑ROI 複数 → 問ごとにスライス
  2) 1 本だけの X‑ROI (縦帯) で幅をグローバルに制限
  3) サイドバーで Y‑ROI 一覧／Delete キー削除
依存: PyQt5>=5.15, pyqtgraph>=0.13, pillow, numpy
"""

import sys
from pathlib import Path
import numpy as np
from PIL import Image
from PyQt5 import QtCore, QtGui, QtWidgets
import pyqtgraph as pg


class SliceWindow(QtWidgets.QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("問題用紙スライサー (v3.0)")
        self.resize(1250, 820)

        # ---------- Central view ----------
        self.pg_widget = pg.GraphicsLayoutWidget()
        self.setCentralWidget(self.pg_widget)

        self.view = self.pg_widget.addViewBox(lockAspect=True)
        self.view.invertY(True)          # 上 0, 下 +Y
        # 左右は自然 (右が +X) のまま

        self.img_item = pg.ImageItem()
        self.view.addItem(self.img_item)

        # ---------- Internal state ----------
        self.img_np   = None
        self.img_path = None
        self.rois_y   = []               # List[LinearRegionItem] (horizontal)
        self.x_roi    = None             # LinearRegionItem (vertical)
        self._roi_uid = 0

        # ---------- UI ----------
        self._build_toolbar()
        self._build_sidebar()
        self.statusBar().showMessage("画像を読み込んでください")

        # Delete‑key で選択 Y‑ROI 削除
        QtWidgets.QShortcut(QtGui.QKeySequence("Delete"), self,
                            activated=self._delete_selected_y_roi)

    # ---------------------------------------------------------------- UI
    def _build_toolbar(self):
        tb = self.addToolBar("tools")
        tb.setMovable(False)

        act_open = QtWidgets.QAction("画像を開く", self)
        act_open.triggered.connect(self.open_image)
        tb.addAction(act_open)

        act_add = QtWidgets.QAction("+Y‑ROI", self)
        act_add.setToolTip("問を切り出す帯 (横向き) を追加")
        act_add.triggered.connect(self.add_y_roi)
        tb.addAction(act_add)

        act_xroi = QtWidgets.QAction("幅 ROI 切替", self)
        act_xroi.setToolTip("クリックで X‑ROI を表示 / 非表示")
        act_xroi.triggered.connect(self.toggle_x_roi)
        tb.addAction(act_xroi)

        act_save = QtWidgets.QAction("保存", self)
        act_save.triggered.connect(self.save_slices)
        tb.addAction(act_save)

    def _build_sidebar(self):
        dock = QtWidgets.QDockWidget("Y‑ROI 一覧", self)
        dock.setAllowedAreas(QtCore.Qt.LeftDockWidgetArea | QtCore.Qt.RightDockWidgetArea)
        self.addDockWidget(QtCore.Qt.RightDockWidgetArea, dock)

        side = QtWidgets.QWidget()
        dock.setWidget(side)
        vbox = QtWidgets.QVBoxLayout(side)

        self.list_rois = QtWidgets.QListWidget()
        self.list_rois.currentRowChanged.connect(self._highlight_selected_y_roi)
        vbox.addWidget(self.list_rois)

        btn_clear = QtWidgets.QPushButton("Y‑ROI 全削除")
        btn_clear.clicked.connect(self.clear_y_rois)
        vbox.addWidget(btn_clear)

        vbox.addStretch()

    # ----------------------------------------------------------- 画像読み込み
    def open_image(self):
        fn, _ = QtWidgets.QFileDialog.getOpenFileName(
            self, "画像ファイルを選択", "", "画像 (*.png *.jpg *.jpeg *.bmp)")
        if not fn:
            return
        self.img_path = Path(fn)
        self.img_np = np.array(Image.open(fn).convert("RGB"))
        self.img_item.setImage(self.img_np, autoLevels=False)

        h, w = self.img_np.shape[:2]
        self.view.setRange(QtCore.QRectF(0, 0, w, h), padding=0)

        self.clear_y_rois()
        self.remove_x_roi()
        self.statusBar().showMessage(f"読み込み完了: {fn}")

    # ------------------------------------------------------------ Y‑ROI 操作
    def add_y_roi(self, *, y_top=None, y_bottom=None):
        if self.img_np is None:
            QtWidgets.QMessageBox.warning(self, "警告", "画像を先に読み込んでください")
            return
        h = self.img_np.shape[0]

        # 自動配置（最後の直下に同じ高さで置く / 最初は中央）
        if y_top is None or y_bottom is None:
            if self.rois_y:
                y1, y2 = sorted(self.rois_y[-1].getRegion())
                span = y2 - y1
                y_top = min(h - span, y2)
                y_bottom = y_top + span
            else:
                y_top, y_bottom = h * 0.25, h * 0.75

        roi = pg.LinearRegionItem(values=(y_top, y_bottom),
                                  orientation='horizontal',
                                  brush=pg.mkBrush(0, 100, 255, 60),
                                  movable=True)
        roi.setBounds([0, h])
        roi.sigRegionChanged.connect(self._sync_list_labels)

        self.view.addItem(roi)
        self.rois_y.append(roi)

        # List へ
        self._roi_uid += 1
        item = QtWidgets.QListWidgetItem(f"ROI {self._roi_uid}")
        item.setData(QtCore.Qt.UserRole, roi)
        self.list_rois.addItem(item)

    def clear_y_rois(self):
        for r in self.rois_y:
            self.view.removeItem(r)
        self.rois_y.clear()
        self.list_rois.clear()

    def _highlight_selected_y_roi(self, row):
        for i, r in enumerate(self.rois_y):
            r.setSelected(i == row)

    def _delete_selected_y_roi(self):
        row = self.list_rois.currentRow()
        if row < 0:
            return
        roi = self.list_rois.item(row).data(QtCore.Qt.UserRole)
        self.view.removeItem(roi)
        self.rois_y.remove(roi)
        self.list_rois.takeItem(row)
        self._sync_list_labels()

    def _sync_list_labels(self):
        for i in range(self.list_rois.count()):
            roi = self.list_rois.item(i).data(QtCore.Qt.UserRole)
            y1, y2 = sorted(int(v) for v in roi.getRegion())
            self.list_rois.item(i).setText(f"ROI {i+1}: {y1}-{y2}px")

    # ------------------------------------------------------------ X‑ROI 操作
    def toggle_x_roi(self):
        if self.img_np is None:
            QtWidgets.QMessageBox.warning(self, "警告", "画像を先に読み込んでください")
            return
        if self.x_roi is None:
            self.add_x_roi()
        else:
            self.remove_x_roi()

    def add_x_roi(self):
        w = self.img_np.shape[1]
        # 初期は左右 10 % をカット
        left, right = w * 0.1, w * 0.9
        self.x_roi = pg.LinearRegionItem(values=(left, right),
                                         orientation='vertical',
                                         brush=pg.mkBrush(255, 140, 0, 60),
                                         movable=True)
        self.x_roi.setBounds([0, w])
        self.view.addItem(self.x_roi)
        self.statusBar().showMessage("幅 ROI 追加: ドラッグで調整可")

    def remove_x_roi(self):
        if self.x_roi is not None:
            self.view.removeItem(self.x_roi)
            self.x_roi = None
            self.statusBar().showMessage("幅 ROI を解除し、全幅で保存")

    # -------------------------------------------------------------- 保存
    def save_slices(self):
        if self.img_np is None:
            QtWidgets.QMessageBox.warning(self, "警告", "画像が読み込まれていません")
            return
        if not self.rois_y:
            QtWidgets.QMessageBox.warning(self, "警告", "Y‑ROI がありません")
            return

        # X 方向
        w = self.img_np.shape[1]
        if self.x_roi is not None:
            x1, x2 = sorted(int(round(v)) for v in self.x_roi.getRegion())
            x1, x2 = max(0, x1), min(w, x2)
            if x2 - x1 < 5:
                QtWidgets.QMessageBox.warning(self, "警告", "幅 ROI が狭すぎます")
                return
        else:
            x1, x2 = 0, w

        # Y 方向
        h = self.img_np.shape[0]
        sorted_y = sorted(self.rois_y, key=lambda r: min(r.getRegion()))

        out_dir = self.img_path.parent
        stem = self.img_path.stem
        saved = 0

        for idx, roi in enumerate(sorted_y, 1):
            y1, y2 = sorted(int(round(v)) for v in roi.getRegion())
            y1, y2 = max(0, y1), min(h, y2)
            if y2 - y1 < 5:
                continue
            slice_np = self.img_np[y1:y2, x1:x2]
            Image.fromarray(slice_np).save(out_dir / f"{stem}_slice_{idx:02d}.png")
            saved += 1

        QtWidgets.QMessageBox.information(
            self, "完了", f"{saved} 枚を書き出しました\n保存先: {out_dir}")

# ---------------------------------------------------------------------------

def main():
    app = QtWidgets.QApplication(sys.argv)
    pg.setConfigOptions(imageAxisOrder='row-major')  # NumPy 行優先
    win = SliceWindow()
    win.show()
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
