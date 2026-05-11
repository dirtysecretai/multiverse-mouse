#!/usr/bin/env python3
"""Upscaler training server (ESRGAN / DRCT) — port 8766"""

import os, sys, json, time, threading, subprocess, re
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT    = 8766
AI_DIR  = Path(__file__).parent   # lives at AI/upscaler-server.py → AI_DIR = AI/

_state = {
    'status':     'idle',   # idle | preparing | training | done | error | cancelled
    'arch':       None,
    'logs':       [],
    'iter':       0,
    'total_iter': 0,
}
_process = None
_lock    = threading.Lock()

# ── Framework definitions ──────────────────────────────────────────────────────

ARCHS = {
    'esrgan': {
        'label':      'Real-ESRGAN',
        'dir':        AI_DIR / 'Real-ESRGAN',
        'scripts':    ['realesrgan/train.py', 'train.py'],
        'desc':       'GAN-based — fast training, good generalisation, no LR folder needed',
        'setup':      'git clone https://github.com/xinntao/Real-ESRGAN.git\ncd Real-ESRGAN\npython -m venv venv\nvenv\\Scripts\\activate\npip install basicsr facexlib gfpgan\npip install -r requirements.txt\npython setup.py develop',
    },
    'drct': {
        'label':      'DRCT',
        'dir':        AI_DIR / 'DRCT',
        'scripts':    ['train.py', 'drct/train.py'],
        'desc':       'Transformer-based — best for fine skin & face detail, auto-generates LR pairs',
        'setup':      'git clone https://github.com/ming053l/DRCT.git\ncd DRCT\npython -m venv venv\nvenv\\Scripts\\activate\npip install -r requirements.txt',
    },
}

def _find_script(arch_id):
    a = ARCHS[arch_id]
    for s in a['scripts']:
        p = a['dir'] / s
        if p.exists():
            return str(p)
    return None

def _find_python(arch_id):
    a = ARCHS[arch_id]
    candidates = [
        a['dir']  / 'venv' / 'Scripts' / 'python.exe',
        a['dir']  / 'venv' / 'bin'     / 'python',
        AI_DIR    / 'upscaler-venv' / 'Scripts' / 'python.exe',
        AI_DIR    / 'upscaler-venv' / 'bin'     / 'python',
        Path(r'C:\Users\Owner\AppData\Local\Programs\Python\Python311\python.exe'),
    ]
    for p in candidates:
        if p.exists():
            return str(p)
    return sys.executable

def arch_info(arch_id):
    a    = ARCHS[arch_id]
    scr  = _find_script(arch_id)
    return {
        'id':        arch_id,
        'label':     a['label'],
        'desc':      a['desc'],
        'setup':     a['setup'],
        'installed': scr is not None,
        'path':      str(a['dir']),
    }

# ── Config generation ──────────────────────────────────────────────────────────

def _cfg(c, key, default):
    return c.get(key, default)

def make_esrgan_config(c):
    scale     = int(_cfg(c, 'scale', 4))
    patch     = int(_cfg(c, 'patchSize', 256))
    batch     = int(_cfg(c, 'batchSize', 4))
    iters     = int(_cfg(c, 'totalIter', 100000))
    save_freq = int(_cfg(c, 'saveFreq', 5000))
    lr        = float(_cfg(c, 'lr', 1e-4))
    hr        = c['datasetPath'].replace('\\', '/')
    out       = c['outputPath'].replace('\\', '/')
    name      = _cfg(c, 'name', 'custom_esrgan')
    milestone = iters // 2

    return f"""name: {name}
model_type: RealESRGANModel
scale: {scale}
num_gpu: 1
manual_seed: 0

datasets:
  train:
    name: CustomHR
    type: RealESRGANDataset
    dataroot_gt: {hr}
    io_backend:
      type: disk
    blur_kernel_size: 21
    kernel_list: ['iso','aniso','generalized_iso','generalized_aniso','plateau_iso','plateau_aniso']
    kernel_prob: [0.45,0.25,0.12,0.03,0.12,0.03]
    sinc_prob: 0.1
    blur_sigma: [0.2,3]
    betag_range: [0.5,4]
    betap_range: [1,2]
    blur_kernel_size2: 21
    kernel_list2: ['iso','aniso','generalized_iso','generalized_aniso','plateau_iso','plateau_aniso']
    kernel_prob2: [0.45,0.25,0.12,0.03,0.12,0.03]
    sinc_prob2: 0.1
    blur_sigma2: [0.2,1.5]
    betag_range2: [0.5,4]
    betap_range2: [1,2]
    final_sinc_prob: 0.8
    gt_size: {patch}
    use_hflip: True
    use_rot: False
    num_worker_per_gpu: 4
    batch_size_per_gpu: {batch}
    dataset_enlarge_ratio: 1
    prefetch_mode: ~

network_g:
  type: RRDBNet
  num_in_ch: 3
  num_out_ch: 3
  num_feat: 64
  num_block: 23
  num_grow_ch: 32
  scale: {scale}

network_d:
  type: UNetDiscriminatorSN
  num_in_ch: 3
  num_feat: 64
  skip_connection: True

path:
  pretrain_network_g: ~
  strict_load_g: true
  resume_state: ~
  experiments_root: {out}

train:
  ema_decay: 0.999
  optim_g:
    type: Adam
    lr: !!float {lr}
    weight_decay: 0
    betas: [0.9,0.99]
  optim_d:
    type: Adam
    lr: !!float {lr}
    weight_decay: 0
    betas: [0.9,0.99]
  scheduler:
    type: MultiStepLR
    milestones: [{milestone}]
    gamma: 0.5
  total_iter: {iters}
  warmup_iter: -1
  pixel_opt:
    type: L1Loss
    loss_weight: 1.0
    reduction: mean
  perceptual_opt:
    type: PerceptualLoss
    layer_weights:
      conv1_2: 0.1
      conv2_2: 0.1
      conv3_4: 1
      conv4_4: 1
      conv5_4: 1
    vgg_type: vgg19
    use_input_norm: true
    range_norm: false
    perceptual_weight: 1.0
    style_weight: 0
    criterion: l1
  gan_opt:
    type: GANLoss
    gan_type: vanilla
    real_label_val: 1.0
    fake_label_val: 0.0
    loss_weight: !!float 1e-1
  net_d_iters: 1
  net_d_init_iters: 0

logger:
  print_freq: 100
  save_checkpoint_freq: !!float {save_freq}
  use_tb_logger: false
  wandb:
    project: ~

dist_params:
  backend: gloo
  port: 29501
"""

def make_drct_config(c, lq_path):
    scale     = int(_cfg(c, 'scale', 4))
    patch     = int(_cfg(c, 'patchSize', 256))
    batch     = int(_cfg(c, 'batchSize', 4))
    iters     = int(_cfg(c, 'totalIter', 100000))
    save_freq = int(_cfg(c, 'saveFreq', 5000))
    lr        = float(_cfg(c, 'lr', 2e-4))
    hr        = c['datasetPath'].replace('\\', '/')
    lq        = lq_path.replace('\\', '/')
    out       = c['outputPath'].replace('\\', '/')
    name      = _cfg(c, 'name', 'custom_drct')
    m1, m2, m3 = iters // 2, iters * 3 // 4, iters * 7 // 8

    return f"""name: {name}
model_type: DRCTModel
scale: {scale}
num_gpu: 1
manual_seed: 0

datasets:
  train:
    name: CustomPaired
    type: PairedImageDataset
    dataroot_gt: {hr}
    dataroot_lq: {lq}
    io_backend:
      type: disk
    gt_size: {patch}
    use_hflip: True
    use_rot: True
    num_worker_per_gpu: 4
    batch_size_per_gpu: {batch}
    dataset_enlarge_ratio: 1
    prefetch_mode: ~

network_g:
  type: DRCT
  upscale: {scale}
  in_chans: 3
  img_size: 64
  window_size: 16
  compress_ratio: 3
  squeeze_factor: 30
  conv_scale: 0.01
  overlap_ratio: 0.5
  img_range: 1.
  depths: [6,6,6,6,6,6]
  embed_dim: 180
  num_heads: [6,6,6,6,6,6]
  mlp_ratio: 2
  upsampler: pixelshuffle
  resi_connection: 1conv

path:
  pretrain_network_g: ~
  strict_load_g: true
  resume_state: ~
  experiments_root: {out}

train:
  ema_decay: 0.999
  optim_g:
    type: Adam
    lr: !!float {lr}
    weight_decay: 0
    betas: [0.9,0.99]
  scheduler:
    type: MultiStepLR
    milestones: [{m1},{m2},{m3}]
    gamma: 0.5
  total_iter: {iters}
  warmup_iter: -1
  pixel_opt:
    type: L1Loss
    loss_weight: 1.0
    reduction: mean

logger:
  print_freq: 100
  save_checkpoint_freq: !!float {save_freq}
  use_tb_logger: false
  wandb:
    project: ~

dist_params:
  backend: gloo
  port: 29502
"""

# ── LR generation for DRCT ────────────────────────────────────────────────────

def generate_lr(hr_dir, lr_dir, scale):
    try:
        from PIL import Image
    except ImportError:
        return False, 'Pillow not installed — run: pip install Pillow'

    hr_path = Path(hr_dir)
    lr_path = Path(lr_dir)
    lr_path.mkdir(parents=True, exist_ok=True)

    exts   = {'.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff'}
    images = [f for f in hr_path.iterdir() if f.is_file() and f.suffix.lower() in exts]
    count  = 0

    for img_file in images:
        try:
            img     = Image.open(img_file).convert('RGB')
            w, h    = img.width // scale, img.height // scale
            if w < 1 or h < 1:
                continue
            lr_img  = img.resize((w, h), Image.LANCZOS)
            lr_img.save(lr_path / (img_file.stem + '.png'))
            count  += 1
        except Exception:
            continue

    return True, f'Generated {count} LR images at 1/{scale} scale'

# ── Training thread ───────────────────────────────────────────────────────────

def _log(msg):
    with _lock:
        _state['logs'].append(msg)
        if len(_state['logs']) > 2000:
            _state['logs'] = _state['logs'][-2000:]

ITER_RE = re.compile(r'iter[:\s]+(\d+)', re.IGNORECASE)

def _train_thread(arch_id, config_text, work_dir, python_exe):
    global _process
    config_path = Path(work_dir) / 'train_config.yml'
    config_path.write_text(config_text, encoding='utf-8')

    script = _find_script(arch_id)
    cmd    = [python_exe, script, '-opt', str(config_path), '--launcher', 'none']

    with _lock:
        _state['status'] = 'training'
        _state['logs']   = _state['logs'][-5:] + ['─' * 60]

    try:
        _log(f'Command: {" ".join(cmd)}')
        _process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=str(ARCHS[arch_id]['dir']),
            text=True,
            bufsize=1,
        )

        for line in _process.stdout:
            line = line.rstrip()
            if not line:
                continue
            _log(line)
            m = ITER_RE.search(line)
            if m:
                with _lock:
                    _state['iter'] = int(m.group(1))

        _process.wait()
        code = _process.returncode
        with _lock:
            if _state['status'] == 'training':
                _state['status'] = 'done' if code == 0 else 'error'
        _log(f'─' * 60)
        _log(f'Exit code: {code}')

    except Exception as e:
        _log(f'Error: {e}')
        with _lock:
            _state['status'] = 'error'
    finally:
        _process = None

# ── HTTP handler ──────────────────────────────────────────────────────────────

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def _send(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        n = int(self.headers.get('Content-Length', 0))
        return json.loads(self.rfile.read(n)) if n else {}

    def do_GET(self):
        if self.path == '/health':
            return self._send({'ok': True})
        if self.path == '/status':
            with _lock:
                return self._send(dict(_state))
        if self.path == '/architectures':
            return self._send([arch_info(aid) for aid in ARCHS])
        self._send({'error': 'not found'}, 404)

    def do_POST(self):
        if self.path == '/cancel':
            global _process
            if _process and _process.poll() is None:
                _process.terminate()
            with _lock:
                if _state['status'] not in ('done', 'error'):
                    _state['status'] = 'cancelled'
            _log('Training cancelled.')
            return self._send({'ok': True})

        if self.path == '/train':
            cfg     = self._body()
            arch_id = cfg.get('arch', 'esrgan')

            if arch_id not in ARCHS:
                return self._send({'error': f'Unknown arch: {arch_id}'}, 400)
            if not arch_info(arch_id)['installed']:
                return self._send({'error': f'{ARCHS[arch_id]["label"]} not installed'}, 400)

            with _lock:
                if _state['status'] == 'training':
                    return self._send({'error': 'Already training'}, 409)
                _state.update({'arch': arch_id, 'iter': 0,
                               'total_iter': int(cfg.get('totalIter', 100000)),
                               'status': 'preparing', 'logs': []})

            python_exe = _find_python(arch_id)
            out_path   = Path(cfg.get('outputPath', str(AI_DIR / 'upscaler-output')))
            work_dir   = out_path / cfg.get('name', 'run')
            work_dir.mkdir(parents=True, exist_ok=True)

            if arch_id == 'esrgan':
                config_text = make_esrgan_config(cfg)
            else:
                scale  = int(cfg.get('scale', 4))
                lr_dir = str(work_dir / 'lr_auto')
                _log(f'Generating LR dataset (1/{scale} of HR)...')
                ok, msg = generate_lr(cfg['datasetPath'], lr_dir, scale)
                _log(msg)
                if not ok:
                    with _lock:
                        _state['status'] = 'error'
                    return self._send({'error': msg}, 500)
                config_text = make_drct_config(cfg, lr_dir)

            threading.Thread(
                target=_train_thread,
                args=(arch_id, config_text, work_dir, python_exe),
                daemon=True,
            ).start()
            return self._send({'ok': True, 'arch': arch_id})

        self._send({'error': 'not found'}, 404)


if __name__ == '__main__':
    server = HTTPServer(('localhost', PORT), Handler)
    print(f'Upscaler server on port {PORT}', flush=True)
    server.serve_forever()
