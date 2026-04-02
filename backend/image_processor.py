from PIL import Image, ImageEnhance
import cv2
import numpy as np
import os


def apply_clahe(img: Image.Image) -> Image.Image:
    """Adaptive contrast enhancement via CLAHE on L channel (LAB color space)."""
    img_cv = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2LAB)
    l, a, b = cv2.split(img_cv)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    img_cv = cv2.merge([l, a, b])
    img_cv = cv2.cvtColor(img_cv, cv2.COLOR_LAB2RGB)
    return Image.fromarray(img_cv)


def apply_white_balance(img: Image.Image) -> Image.Image:
    """Gray world white balance to remove color casts."""
    img_cv = np.array(img).astype(np.float32)
    mean_r = np.mean(img_cv[:, :, 0])
    mean_g = np.mean(img_cv[:, :, 1])
    mean_b = np.mean(img_cv[:, :, 2])
    mean_gray = (mean_r + mean_g + mean_b) / 3.0
    img_cv[:, :, 0] = np.clip(img_cv[:, :, 0] * (mean_gray / (mean_r + 1e-6)), 0, 255)
    img_cv[:, :, 1] = np.clip(img_cv[:, :, 1] * (mean_gray / (mean_g + 1e-6)), 0, 255)
    img_cv[:, :, 2] = np.clip(img_cv[:, :, 2] * (mean_gray / (mean_b + 1e-6)), 0, 255)
    return Image.fromarray(img_cv.astype(np.uint8))


def reduce_highlights(img: Image.Image, strength: float = 0.5) -> Image.Image:
    """Reduce blown-out highlights (riflessi) by pulling down overexposed areas."""
    img_cv = np.array(img).astype(np.float32)
    # Work in HSV: reduce V where it's very high
    hsv = cv2.cvtColor(img_cv.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
    v = hsv[:, :, 2]
    threshold = 220.0
    mask = v > threshold
    factor = 1.0 - strength * ((v - threshold) / (255.0 - threshold + 1e-6))
    v[mask] = v[mask] * factor[mask]
    hsv[:, :, 2] = np.clip(v, 0, 255)
    result = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
    return Image.fromarray(result)


def process_image(
    input_path: str,
    output_dir: str,
    brightness: float = 1.0,
    contrast: float = 1.0,
    saturation: float = 1.0,
    sharpness: float = 1.0,
    webp_quality: int = 85,
    auto_enhance: bool = False,
    white_balance: bool = False,
    reduce_reflections: bool = False,
    reflection_strength: float = 0.5,
) -> str:
    img = Image.open(input_path).convert("RGB")

    if white_balance:
        img = apply_white_balance(img)

    if auto_enhance:
        img = apply_clahe(img)

    if reduce_reflections:
        img = reduce_highlights(img, strength=reflection_strength)

    if brightness != 1.0:
        img = ImageEnhance.Brightness(img).enhance(brightness)
    if contrast != 1.0:
        img = ImageEnhance.Contrast(img).enhance(contrast)
    if saturation != 1.0:
        img = ImageEnhance.Color(img).enhance(saturation)
    if sharpness != 1.0:
        img = ImageEnhance.Sharpness(img).enhance(sharpness)

    stem = os.path.splitext(os.path.basename(input_path))[0]
    output_path = os.path.join(output_dir, f"{stem}.webp")
    img.save(output_path, "WEBP", quality=webp_quality, method=6)
    return output_path
