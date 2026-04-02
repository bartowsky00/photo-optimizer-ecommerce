import os
import uuid
import shutil
import zipfile
from pathlib import Path
from typing import List

from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from image_processor import process_image

app = FastAPI(title="Photo Optimizer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
TMP_DIR = Path("/tmp/photo_optimizer")
TMP_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

# job_id -> {"status": str, "progress": int, "total": int, "zip_path": str|None, "error": str|None}
jobs: dict = {}

MAX_FILES = 50


@app.get("/", response_class=HTMLResponse)
async def root():
    index = FRONTEND_DIR / "index.html"
    return HTMLResponse(index.read_text(encoding="utf-8"))


@app.post("/process")
async def start_processing(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    brightness: float = Form(1.0),
    contrast: float = Form(1.0),
    saturation: float = Form(1.0),
    sharpness: float = Form(1.0),
    webp_quality: int = Form(85),
    auto_enhance: bool = Form(False),
    white_balance: bool = Form(False),
    reduce_reflections: bool = Form(False),
    reflection_strength: float = Form(0.5),
):
    if len(files) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"Massimo {MAX_FILES} file per volta.")

    job_id = str(uuid.uuid4())
    input_dir = TMP_DIR / job_id / "input"
    output_dir = TMP_DIR / job_id / "output"
    input_dir.mkdir(parents=True)
    output_dir.mkdir(parents=True)

    saved_paths = []
    for f in files:
        dest = input_dir / Path(f.filename).name
        content = await f.read()
        dest.write_bytes(content)
        saved_paths.append(str(dest))

    jobs[job_id] = {
        "status": "processing",
        "progress": 0,
        "total": len(saved_paths),
        "zip_path": None,
        "error": None,
    }

    background_tasks.add_task(
        _process_batch,
        job_id,
        saved_paths,
        str(output_dir),
        brightness,
        contrast,
        saturation,
        sharpness,
        webp_quality,
        auto_enhance,
        white_balance,
        reduce_reflections,
        reflection_strength,
    )

    return {"job_id": job_id}


def _process_batch(
    job_id,
    file_paths,
    output_dir,
    brightness,
    contrast,
    saturation,
    sharpness,
    webp_quality,
    auto_enhance,
    white_balance,
    reduce_reflections,
    reflection_strength,
):
    try:
        for i, path in enumerate(file_paths):
            try:
                process_image(
                    path,
                    output_dir,
                    brightness=brightness,
                    contrast=contrast,
                    saturation=saturation,
                    sharpness=sharpness,
                    webp_quality=webp_quality,
                    auto_enhance=auto_enhance,
                    white_balance=white_balance,
                    reduce_reflections=reduce_reflections,
                    reflection_strength=reflection_strength,
                )
            except Exception as e:
                print(f"[WARN] Errore su {path}: {e}")
            jobs[job_id]["progress"] = i + 1

        # Build zip
        zip_path = str(TMP_DIR / job_id / "risultato.zip")
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for fname in os.listdir(output_dir):
                zf.write(os.path.join(output_dir, fname), fname)

        jobs[job_id]["status"] = "done"
        jobs[job_id]["zip_path"] = zip_path

    except Exception as e:
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)


@app.get("/progress/{job_id}")
async def get_progress(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job non trovato.")
    return job


@app.get("/download/{job_id}")
async def download(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job non trovato.")
    if job["status"] != "done":
        raise HTTPException(status_code=400, detail="Elaborazione non completata.")
    return FileResponse(
        job["zip_path"],
        filename="immagini_ottimizzate.zip",
        media_type="application/zip",
    )


@app.delete("/job/{job_id}")
async def cleanup_job(job_id: str):
    """Rimuove i file temporanei di un job."""
    job_dir = TMP_DIR / job_id
    if job_dir.exists():
        shutil.rmtree(job_dir)
    jobs.pop(job_id, None)
    return {"ok": True}
