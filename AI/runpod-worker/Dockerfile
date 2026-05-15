FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

RUN apt-get update && apt-get install -y \
    git unzip wget curl \
    libglib2.0-0 libsm6 libxext6 libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Clone OneTrainer pinned to the same commit as local installation
RUN git clone https://github.com/Nerogar/OneTrainer.git && \
    cd OneTrainer && git checkout 423c3b3

# Install OneTrainer deps (torch already in base image, skip reinstall)
WORKDIR /workspace/OneTrainer
RUN pip install --no-cache-dir -r requirements.txt

# Install worker deps
RUN pip install --no-cache-dir runpod boto3 tensorboard

# Patch OneTrainer code for Docker compatibility
RUN sed -i \
    -e 's/migrated_data\[part\]\["weight_dtype"\]/migrated_data[part].get("weight_dtype")/g' \
    -e 's/migrated_data\.pop("weight_dtype")/migrated_data.pop("weight_dtype", None)/g' \
    /workspace/OneTrainer/modules/util/config/TrainConfig.py && \
    ln -sf $(which tensorboard) /usr/bin/tensorboard && \
    mkdir -p /workspace/OneTrainer/training_samples && \
    echo '[]' > /workspace/OneTrainer/training_samples/samples.json

# Override with our customized files (all paths relative to AI/runpod-worker context)
COPY FluxModelLoader.py /workspace/OneTrainer/modules/modelLoader/flux/FluxModelLoader.py
COPY flux1dev_transformer_config/ /workspace/OneTrainer/flux1dev_transformer_config/
COPY flux1dev_vae_config/ /workspace/OneTrainer/flux1dev_vae_config/

WORKDIR /workspace
COPY handler.py /workspace/handler.py

CMD ["python", "-u", "/workspace/handler.py"]
