#!/usr/bin/env python3
"""
RunPod Serverless handler for OneTrainer Flux LoRA training.

Required env vars (set in RunPod endpoint config):
  R2_ENDPOINT           - Cloudflare R2 endpoint URL
  R2_ACCESS_KEY_ID      - R2 access key
  R2_SECRET_ACCESS_KEY  - R2 secret key
  R2_BUCKET_NAME        - Bucket name

Input JSON shape:
  {
    "run_name":           str,
    "config":             dict,   # OneTrainer config (paths will be overwritten)
    "concepts":           list,   # [{name, r2_dataset_key, repeats, prompt_source}]
    "checkpoint_r2_key":  str,    # e.g. "training/checkpoints/flux1dev.safetensors"
    "output_r2_key":      str     # optional, e.g. "training/loras/my-lora.safetensors"
  }
"""

import os
import sys
import json
import time
import zipfile
import subprocess
import shutil

import runpod
import boto3
from botocore.config import Config

OT_DIR     = '/workspace/OneTrainer'
MODELS_DIR = '/workspace/models'
WORK_DIR   = '/workspace/runs'


def _r2():
    return boto3.client(
        's3',
        endpoint_url=os.environ['R2_ENDPOINT'],
        aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'],
        config=Config(signature_version='s3v4'),
        region_name='auto',
    )


def _download(r2, key: str, dest: str, label: str, logs: list) -> bool:
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    logs.append(f'[runpod] Downloading {label}...')
    try:
        r2.download_file(os.environ['R2_BUCKET_NAME'], key, dest)
        size = os.path.getsize(dest) / 1e9
        logs.append(f'[runpod] {label} ready ({size:.2f} GB)')
        return True
    except Exception as e:
        logs.append(f'[runpod] ERROR downloading {label}: {e}')
        return False


def handler(job):
    inp      = job['input']
    job_id   = job['id']
    logs     = []
    r2       = _r2()
    t0       = time.time()

    run_name = inp.get('run_name', 'Training Run')
    config   = dict(inp['config'])
    concepts = inp['concepts']
    ckpt_key = inp['checkpoint_r2_key']
    out_key  = inp.get('output_r2_key') or f'training/loras/{run_name.replace(" ", "_")}.safetensors'

    logs.append(f"[runpod] Starting '{run_name}' (job {job_id})")

    # ── workspace dirs ──────────────────────────────────────────────────────
    run_dir      = os.path.join(WORK_DIR, job_id)
    dataset_root = os.path.join(run_dir, 'datasets')
    ckpt_path    = os.path.join(run_dir, 'checkpoint.safetensors')
    output_path  = os.path.join(run_dir, 'output.safetensors')
    os.makedirs(dataset_root, exist_ok=True)
    os.makedirs(MODELS_DIR, exist_ok=True)

    # ── 1. checkpoint ───────────────────────────────────────────────────────
    if not _download(r2, ckpt_key, ckpt_path, 'checkpoint', logs):
        return {'success': False, 'error': 'Checkpoint download failed', 'logs': logs}

    # ── 2. shared model files (cached across runs in MODELS_DIR) ────────────
    model_files = [
        ('training/models/clip_l.safetensors',          os.path.join(MODELS_DIR, 'clip_l.safetensors'),          'CLIP'),
        ('training/models/t5xxl_fp8_e4m3fn.safetensors', os.path.join(MODELS_DIR, 't5xxl_fp8_e4m3fn.safetensors'), 'T5'),
        ('training/models/flux_vae.safetensors',         os.path.join(MODELS_DIR, 'flux_vae.safetensors'),         'VAE'),
    ]
    for key, path, label in model_files:
        if os.path.exists(path):
            logs.append(f'[runpod] {label} already cached')
            continue
        if not _download(r2, key, path, label, logs):
            return {'success': False, 'error': f'{label} download failed', 'logs': logs}

    # tell FluxModelLoader where the model files are
    os.environ['CLIP_MODEL_DIR'] = MODELS_DIR
    os.environ['VAE_MODEL_DIR']  = MODELS_DIR

    # ── 3. datasets ─────────────────────────────────────────────────────────
    concept_dirs = []
    for c in concepts:
        zip_path    = os.path.join(run_dir, f"{c['name']}.zip")
        extract_dir = os.path.join(dataset_root, c['name'])
        if not _download(r2, c['r2_dataset_key'], zip_path, f"dataset '{c['name']}'", logs):
            return {'success': False, 'error': f"Dataset download failed: {c['name']}", 'logs': logs}
        os.makedirs(extract_dir, exist_ok=True)
        with zipfile.ZipFile(zip_path, 'r') as z:
            z.extractall(extract_dir)
        concept_dirs.append(extract_dir)

    # ── 4. build config ─────────────────────────────────────────────────────
    config['base_model_name']          = ckpt_path
    config['output_model_destination'] = output_path
    config['output_model_format']      = config.get('output_model_format', 'SAFETENSORS')
    config.pop('concepts', None)

    concepts_payload = [
        {
            'name':    c['name'],
            'path':    concept_dirs[i],
            'repeats': c.get('repeats', 1),
            'text': {
                'prompt_source': c.get('prompt_source', 'sample'),
                'prompt_path':   c.get('prompt_path', ''),
            },
        }
        for i, c in enumerate(concepts)
    ]

    config_path   = os.path.join(run_dir, 'config.json')
    concepts_path = os.path.join(run_dir, 'concepts.json')
    config['concept_file_name'] = concepts_path

    with open(concepts_path, 'w') as f:
        json.dump(concepts_payload, f, indent=2)
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)

    # ── 5. train ────────────────────────────────────────────────────────────
    logs.append('[runpod] Starting OneTrainer...')
    env = {**os.environ, 'CUDA_VISIBLE_DEVICES': '0'}

    proc = subprocess.Popen(
        [sys.executable, os.path.join(OT_DIR, 'scripts', 'train.py'), '--config-path', config_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        cwd=OT_DIR,
        env=env,
    )
    for line in proc.stdout:
        line = line.rstrip()
        if line:
            logs.append(line)
    proc.wait()

    elapsed = round((time.time() - t0) / 60, 1)
    logs.append(f'[runpod] Training finished in {elapsed} min (exit {proc.returncode})')

    if proc.returncode != 0:
        return {'success': False, 'error': f'Training exited {proc.returncode}', 'logs': logs}

    # ── 6. upload result ────────────────────────────────────────────────────
    if not os.path.exists(output_path):
        return {'success': False, 'error': 'Output LoRA file not found', 'logs': logs}

    logs.append(f'[runpod] Uploading LoRA to R2 ({out_key})...')
    try:
        r2.upload_file(output_path, os.environ['R2_BUCKET_NAME'], out_key)
        logs.append('[runpod] Upload complete!')
    except Exception as e:
        return {'success': False, 'error': f'Upload failed: {e}', 'logs': logs}

    shutil.rmtree(run_dir, ignore_errors=True)

    return {
        'success':      True,
        'output_r2_key': out_key,
        'elapsed_min':  elapsed,
        'logs':         logs,
    }


if __name__ == '__main__':
    runpod.serverless.start({'handler': handler})
