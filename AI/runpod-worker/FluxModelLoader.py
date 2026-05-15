import os
import traceback

from modules.model.FluxModel import FluxModel
from modules.modelLoader.mixin.HFModelLoaderMixin import HFModelLoaderMixin
from modules.util.config.TrainConfig import QuantizationConfig
from modules.util.enum.ModelType import ModelType
from modules.util.ModelNames import ModelNames
from modules.util.ModelWeightDtypes import ModelWeightDtypes

import torch

from diffusers import (
    AutoencoderKL,
    FlowMatchEulerDiscreteScheduler,
    FluxPipeline,
    FluxTransformer2DModel,
    GGUFQuantizationConfig,
)
from transformers import CLIPTextModel, CLIPTokenizer, T5EncoderModel, T5Tokenizer


class FluxModelLoader(
    HFModelLoaderMixin,
):
    def __init__(self):
        super().__init__()

    def __load_internal(
            self,
            model: FluxModel,
            model_type: ModelType,
            weight_dtypes: ModelWeightDtypes,
            base_model_name: str,
            transformer_model_name: str,
            vae_model_name: str,
            include_text_encoder_1: bool,
            include_text_encoder_2: bool,
            quantization: QuantizationConfig,
    ):
        if os.path.isfile(os.path.join(base_model_name, "meta.json")):
            self.__load_diffusers(
                model, model_type, weight_dtypes, base_model_name, transformer_model_name, vae_model_name,
                include_text_encoder_1, include_text_encoder_2, quantization,
            )
        else:
            raise Exception("not an internal model")

    def __load_diffusers(
            self,
            model: FluxModel,
            model_type: ModelType,
            weight_dtypes: ModelWeightDtypes,
            base_model_name: str,
            transformer_model_name: str,
            vae_model_name: str,
            include_text_encoder_1: bool,
            include_text_encoder_2: bool,
            quantization: QuantizationConfig,
    ):
        diffusers_sub = []
        transformers_sub = []
        if not transformer_model_name:
            diffusers_sub.append("transformer")
        if include_text_encoder_1:
            transformers_sub.append("text_encoder")
        if include_text_encoder_2:
            transformers_sub.append("text_encoder_2")
        if not vae_model_name:
            diffusers_sub.append("vae")

        self._prepare_sub_modules(
            base_model_name,
            diffusers_modules=diffusers_sub,
            transformers_modules=transformers_sub,
        )

        if include_text_encoder_1:
            tokenizer_1 = CLIPTokenizer.from_pretrained(
                base_model_name,
                subfolder="tokenizer",
            )
        else:
            tokenizer_1 = None

        if include_text_encoder_2:
            tokenizer_2 = T5Tokenizer.from_pretrained(
                base_model_name,
                subfolder="tokenizer_2",
            )
        else:
            tokenizer_2 = None

        noise_scheduler = FlowMatchEulerDiscreteScheduler.from_pretrained(
            base_model_name,
            subfolder="scheduler",
        )

        if include_text_encoder_1:
            text_encoder_1 = self._load_transformers_sub_module(
                CLIPTextModel,
                weight_dtypes.text_encoder,
                weight_dtypes.train_dtype,
                base_model_name,
                "text_encoder",
            )
        else:
            text_encoder_1 = None

        if include_text_encoder_2:
            text_encoder_2 = self._load_transformers_sub_module(
                T5EncoderModel,
                weight_dtypes.text_encoder_2,
                weight_dtypes.fallback_train_dtype,
                base_model_name,
                "text_encoder_2",
            )
        else:
            text_encoder_2 = None

        if vae_model_name:
            vae = self._load_diffusers_sub_module(
                AutoencoderKL,
                weight_dtypes.vae,
                weight_dtypes.train_dtype,
                vae_model_name,
            )
        else:
            vae = self._load_diffusers_sub_module(
                AutoencoderKL,
                weight_dtypes.vae,
                weight_dtypes.train_dtype,
                base_model_name,
                "vae",
            )

        if transformer_model_name:
            transformer = FluxTransformer2DModel.from_single_file(
                transformer_model_name,
                #avoid loading the transformer in float32:
                torch_dtype = torch.bfloat16 if weight_dtypes.transformer.torch_dtype() is None else weight_dtypes.transformer.torch_dtype(),
                quantization_config=GGUFQuantizationConfig(compute_dtype=torch.bfloat16) if weight_dtypes.transformer.is_gguf() else None,
            )
            transformer = self._convert_diffusers_sub_module_to_dtype(
                transformer, weight_dtypes.transformer, weight_dtypes.train_dtype, quantization,
            )
        else:
            transformer = self._load_diffusers_sub_module(
                FluxTransformer2DModel,
                weight_dtypes.transformer,
                weight_dtypes.train_dtype,
                base_model_name,
                "transformer",
                quantization,
            )

        model.model_type = model_type
        model.tokenizer_1 = tokenizer_1
        model.tokenizer_2 = tokenizer_2
        model.noise_scheduler = noise_scheduler
        model.text_encoder_1 = text_encoder_1
        model.text_encoder_2 = text_encoder_2
        model.vae = vae
        model.transformer = transformer

    def __load_safetensors(
            self,
            model: FluxModel,
            model_type: ModelType,
            weight_dtypes: ModelWeightDtypes,
            base_model_name: str,
            transformer_model_name: str,
            vae_model_name: str,
            include_text_encoder_1: bool,
            include_text_encoder_2: bool,
            quantization: QuantizationConfig,
    ):
        from transformers import CLIPTextConfig, T5Config, T5EncoderModel as _T5EncoderModel
        from diffusers import FlowMatchEulerDiscreteScheduler
        from accelerate import init_empty_weights
        from accelerate.utils import set_module_tensor_to_device
        from safetensors import safe_open

        COMFYUI_CLIP = os.environ.get('CLIP_MODEL_DIR', r"C:\Users\Owner\Desktop\123\.ai\ComfyUI_windows_portable\ComfyUI\models\clip")
        COMFYUI_VAE  = os.environ.get('VAE_MODEL_DIR',  r"C:\Users\Owner\Desktop\123\.ai\ComfyUI_windows_portable\ComfyUI\models\vae")

        _root = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
        _transformer_cfg = os.path.join(_root, "flux1dev_transformer_config")
        _vae_cfg         = os.path.join(_root, "flux1dev_vae_config")

        def _load_from_safetensors(model, path, target_dtype):
            """Stream weights one tensor at a time into a meta-device model — avoids double-buffering RAM spike."""
            with safe_open(path, framework="pt", device="cpu") as f:
                for key in f.keys():
                    tensor = f.get_tensor(key).to(target_dtype)
                    set_module_tensor_to_device(model, key, device="cpu", value=tensor)
            return model

        # ── 1. Transformer ────────────────────────────────────────────────────
        transformer_dtype = weight_dtypes.transformer.torch_dtype() or torch.bfloat16
        transformer = FluxTransformer2DModel.from_single_file(
            transformer_model_name if transformer_model_name else base_model_name,
            config=_transformer_cfg,
            torch_dtype=transformer_dtype,
        )
        transformer = self._convert_diffusers_sub_module_to_dtype(
            transformer, weight_dtypes.transformer, weight_dtypes.train_dtype, quantization,
        )

        # ── 2. CLIP text encoder + tokenizer ──────────────────────────────────
        if include_text_encoder_1:
            clip_dtype = weight_dtypes.text_encoder.torch_dtype() or torch.float16
            tokenizer_1 = CLIPTokenizer.from_pretrained("openai/clip-vit-large-patch14")
            clip_cfg = CLIPTextConfig.from_pretrained("openai/clip-vit-large-patch14")
            with init_empty_weights():
                text_encoder_1 = CLIPTextModel(clip_cfg)
            text_encoder_1 = _load_from_safetensors(
                text_encoder_1, os.path.join(COMFYUI_CLIP, "clip_l.safetensors"), clip_dtype
            )
            text_encoder_1 = self._convert_transformers_sub_module_to_dtype(
                text_encoder_1, weight_dtypes.text_encoder, weight_dtypes.train_dtype
            )
        else:
            tokenizer_1    = None
            text_encoder_1 = None

        # ── 3. T5 text encoder + tokenizer ────────────────────────────────────
        if include_text_encoder_2:
            t5_dtype = weight_dtypes.text_encoder_2.torch_dtype() or torch.float16
            tokenizer_2 = T5Tokenizer.from_pretrained("google/t5-v1_1-xxl")
            t5_cfg = T5Config.from_pretrained("google/t5-v1_1-xxl")
            with init_empty_weights():
                text_encoder_2 = _T5EncoderModel(t5_cfg)
            text_encoder_2 = _load_from_safetensors(
                text_encoder_2, os.path.join(COMFYUI_CLIP, "t5xxl_fp8_e4m3fn.safetensors"), t5_dtype
            )
            text_encoder_2 = self._convert_transformers_sub_module_to_dtype(
                text_encoder_2, weight_dtypes.text_encoder_2, weight_dtypes.fallback_train_dtype
            )
        else:
            tokenizer_2    = None
            text_encoder_2 = None

        # ── 4. VAE ────────────────────────────────────────────────────────────
        vae_path = vae_model_name if vae_model_name else os.path.join(COMFYUI_VAE, "flux_vae.safetensors")
        vae = AutoencoderKL.from_single_file(vae_path, config=_vae_cfg)
        vae = self._convert_diffusers_sub_module_to_dtype(vae, weight_dtypes.vae, weight_dtypes.train_dtype)

        # ── 5. Scheduler ──────────────────────────────────────────────────────
        noise_scheduler = FlowMatchEulerDiscreteScheduler(
            num_train_timesteps=1000,
            shift=3.0,
        )

        model.model_type    = model_type
        model.tokenizer_1   = tokenizer_1
        model.tokenizer_2   = tokenizer_2
        model.noise_scheduler = noise_scheduler
        model.text_encoder_1 = text_encoder_1
        model.text_encoder_2 = text_encoder_2
        model.vae           = vae
        model.transformer   = transformer

    def load(
            self,
            model: FluxModel,
            model_type: ModelType,
            model_names: ModelNames,
            weight_dtypes: ModelWeightDtypes,
            quantization: QuantizationConfig,
    ):
        stacktraces = []

        try:
            self.__load_internal(
                model, model_type, weight_dtypes, model_names.base_model, model_names.transformer_model, model_names.vae_model,
                model_names.include_text_encoder, model_names.include_text_encoder_2, quantization,
            )
            return
        except Exception:
            stacktraces.append(traceback.format_exc())

        try:
            self.__load_diffusers(
                model, model_type, weight_dtypes, model_names.base_model, model_names.transformer_model, model_names.vae_model,
                model_names.include_text_encoder, model_names.include_text_encoder_2, quantization,
            )
            return
        except Exception:
            stacktraces.append(traceback.format_exc())

        try:
            self.__load_safetensors(
                model, model_type, weight_dtypes, model_names.base_model, model_names.transformer_model, model_names.vae_model,
                model_names.include_text_encoder, model_names.include_text_encoder_2, quantization,
            )
            return
        except Exception:
            stacktraces.append(traceback.format_exc())

        for stacktrace in stacktraces:
            print(stacktrace)
        raise Exception("could not load model: " + model_names.base_model)
