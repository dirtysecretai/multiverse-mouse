#!/usr/bin/env python3
"""
Generic upscaler inference — uses spandrel to auto-detect model architecture.
Supports RRDB, SPAN, SwinIR, HAT, DAT, SRVGGNet, and more.
"""
import argparse
import os
import sys
import cv2
import numpy as np
import torch
from spandrel import ImageModelDescriptor, ModelLoader


def infer_tiled(model, img_t, tile=512, pad=16):
    """Process large images in overlapping tiles to avoid OOM."""
    b, c, h, w = img_t.shape
    scale = model.scale
    out = torch.zeros(b, c, h * scale, w * scale,
                      dtype=img_t.dtype, device=img_t.device)

    for yi in range(0, h, tile - pad * 2):
        for xi in range(0, w, tile - pad * 2):
            y1, x1 = yi, xi
            y2, x2 = min(yi + tile, h), min(xi + tile, w)
            tile_in = img_t[:, :, y1:y2, x1:x2]
            with torch.no_grad():
                tile_out = model(tile_in)
            out[:, :, y1 * scale:y2 * scale, x1 * scale:x2 * scale] = tile_out

    return out


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--model_path', required=True)
    p.add_argument('-i', '--input',  required=True)
    p.add_argument('-o', '--output', required=True)
    p.add_argument('--outscale', type=float, default=None,
                   help='Final output scale (resizes if different from model native scale)')
    p.add_argument('--tile', type=int, default=512,
                   help='Tile size for large images (0 = no tiling)')
    args = p.parse_args()

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f'Device: {device}', flush=True)

    print(f'Loading model: {args.model_path}', flush=True)
    descriptor = ModelLoader().load_from_file(args.model_path)
    if not isinstance(descriptor, ImageModelDescriptor):
        print('ERROR: model is not an image-to-image upscaler', file=sys.stderr)
        sys.exit(1)
    model = descriptor.to(device).eval()
    native_scale = model.scale
    print(f'Architecture: {type(model.model).__name__}  native scale: {native_scale}x', flush=True)

    img_bgr = cv2.imread(args.input, cv2.IMREAD_UNCHANGED)
    if img_bgr is None:
        print(f'ERROR: cannot read {args.input}', file=sys.stderr)
        sys.exit(1)

    has_alpha = img_bgr.ndim == 3 and img_bgr.shape[2] == 4
    if has_alpha:
        alpha = img_bgr[:, :, 3]
        img_bgr = img_bgr[:, :, :3]

    h_in, w_in = img_bgr.shape[:2]
    img_f = img_bgr.astype(np.float32) / 255.0
    # BGR → RGB tensor
    img_t = torch.from_numpy(img_f).permute(2, 0, 1).unsqueeze(0).to(device)
    img_t = img_t[:, [2, 1, 0], :, :]

    use_tile = args.tile > 0 and (h_in > args.tile or w_in > args.tile)
    print(f'Inference (tiled={use_tile}) ...', flush=True)
    if use_tile:
        out_t = infer_tiled(model, img_t, tile=args.tile)
    else:
        with torch.no_grad():
            out_t = model(img_t)

    # Tensor → BGR numpy
    out_np = out_t.squeeze(0).permute(1, 2, 0)[:, :, [2, 1, 0]].cpu().numpy()
    out_np = (out_np * 255.0).clip(0, 255).astype(np.uint8)

    # Resize to requested outscale if it differs from the model's native scale
    if args.outscale and abs(args.outscale - native_scale) > 0.01:
        out_h = round(h_in * args.outscale)
        out_w = round(w_in * args.outscale)
        print(f'Resizing from {native_scale}x to {args.outscale}x ...', flush=True)
        out_np = cv2.resize(out_np, (out_w, out_h), interpolation=cv2.INTER_LANCZOS4)

    if has_alpha:
        alpha_up = cv2.resize(alpha, (out_np.shape[1], out_np.shape[0]),
                              interpolation=cv2.INTER_LANCZOS4)
        out_np = np.dstack([out_np, alpha_up])

    os.makedirs(args.output, exist_ok=True)
    stem = os.path.splitext(os.path.basename(args.input))[0]
    out_path = os.path.join(args.output, stem + '.png')
    cv2.imwrite(out_path, out_np)
    print(f'Saved: {out_path}', flush=True)


if __name__ == '__main__':
    main()
