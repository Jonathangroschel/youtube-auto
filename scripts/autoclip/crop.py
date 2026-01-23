import argparse
import os
import sys
from typing import List, Optional, Tuple

import cv2
import numpy as np

try:
    import mediapipe as mp
except Exception:
    mp = None

FaceBox = Tuple[int, int, int, int, float]

DETECTION_MAX_WIDTH = 640
MIN_FACE_AREA_RATIO = 0.001
MIN_FACE_SCORE = 0.5
GROUP_FACE_AREA_RATIO = 0.6
GROUP_MAX_SPAN_RATIO = 0.9
MISSING_FACE_SECONDS = 2.0
DEFAULT_FPS = 30.0
DEFAULT_FFMPEG_THREADS = 1


def clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(value, max_value))


def resize_for_detection(frame: np.ndarray, max_width: int) -> Tuple[np.ndarray, float]:
    height, width = frame.shape[:2]
    if width <= max_width:
        return frame, 1.0
    scale = max_width / width
    resized = cv2.resize(
        frame,
        (int(width * scale), int(height * scale)),
        interpolation=cv2.INTER_AREA,
    )
    return resized, scale


def resolve_fps(cap: cv2.VideoCapture, fallback: float = DEFAULT_FPS) -> float:
    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or not np.isfinite(fps) or fps <= 0:
        return fallback
    return fps


def ensure_valid_dimensions(width: int, height: int) -> None:
    if width < 2 or height < 2:
        raise RuntimeError(f"Invalid video dimensions: {width}x{height}")


def resolve_threads() -> int:
    value = os.environ.get("AUTOCLIP_FFMPEG_THREADS")
    try:
        threads = int(value) if value is not None else DEFAULT_FFMPEG_THREADS
    except ValueError:
        threads = DEFAULT_FFMPEG_THREADS
    return max(1, threads)


def face_area(face: FaceBox) -> int:
    return face[2] * face[3]


def normalize_faces(
    faces: List[FaceBox], frame_width: int, frame_height: int
) -> List[FaceBox]:
    min_area = frame_width * frame_height * MIN_FACE_AREA_RATIO
    normalized: List[FaceBox] = []
    for x, y, w, h, score in faces:
        if score < MIN_FACE_SCORE:
            continue
        x = int(clamp(x, 0, frame_width - 1))
        y = int(clamp(y, 0, frame_height - 1))
        w = int(clamp(w, 1, frame_width - x))
        h = int(clamp(h, 1, frame_height - y))
        if w * h < min_area:
            continue
        normalized.append((x, y, w, h, score))
    return normalized


class FaceDetector:
    def __init__(self, min_confidence: float = MIN_FACE_SCORE) -> None:
        self.kind = "mediapipe" if mp is not None else "haar"
        self.min_confidence = min_confidence
        if self.kind == "mediapipe":
            self.detector = mp.solutions.face_detection.FaceDetection(
                model_selection=0, min_detection_confidence=min_confidence
            )
        else:
            self.detector = cv2.CascadeClassifier(
                cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
            )

    def detect(self, frame: np.ndarray) -> List[FaceBox]:
        resized, scale = resize_for_detection(frame, DETECTION_MAX_WIDTH)
        faces: List[FaceBox] = []
        if self.kind == "mediapipe":
            rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
            results = self.detector.process(rgb)
            if results and results.detections:
                height, width = resized.shape[:2]
                for detection in results.detections:
                    bbox = detection.location_data.relative_bounding_box
                    x = int(bbox.xmin * width)
                    y = int(bbox.ymin * height)
                    w = int(bbox.width * width)
                    h = int(bbox.height * height)
                    score = float(detection.score[0]) if detection.score else 1.0
                    faces.append((x, y, w, h, score))
        else:
            gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
            detected = self.detector.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=6, minSize=(30, 30)
            )
            for x, y, w, h in detected:
                faces.append((x, y, w, h, 1.0))

        if scale != 1.0:
            faces = [
                (
                    int(x / scale),
                    int(y / scale),
                    int(w / scale),
                    int(h / scale),
                    score,
                )
                for x, y, w, h, score in faces
            ]
        return faces

    def close(self) -> None:
        if self.kind == "mediapipe":
            try:
                self.detector.close()
            except Exception:
                pass


def pick_face_center(
    faces: List[FaceBox],
    prev_center: Optional[float],
    frame_width: int,
    frame_height: int,
    target_width: int,
) -> Optional[int]:
    if not faces:
        return None

    faces_sorted = sorted(faces, key=face_area, reverse=True)
    if len(faces_sorted) > 1:
        top_area = face_area(faces_sorted[0])
        group = [
            face
            for face in faces_sorted
            if face_area(face) >= top_area * GROUP_FACE_AREA_RATIO
        ]
        if len(group) >= 2:
            min_x = min(face[0] for face in group)
            max_x = max(face[0] + face[2] for face in group)
            span = max_x - min_x
            if span <= target_width * GROUP_MAX_SPAN_RATIO:
                return int((min_x + max_x) / 2)

    if prev_center is None:
        best = faces_sorted[0]
        return int(best[0] + best[2] / 2)

    frame_area = frame_width * frame_height
    best_score = -1e9
    best_center: Optional[float] = None
    for x, y, w, h, score in faces_sorted:
        center = x + w / 2
        area_ratio = (w * h) / frame_area
        distance_ratio = abs(center - prev_center) / frame_width
        total = area_ratio - distance_ratio * 0.2 + score * 0.01
        if total > best_score:
            best_score = total
            best_center = center
    return int(best_center) if best_center is not None else None


def detect_face_centers(video_path: str, max_samples: int = 12) -> List[int]:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return []

    detector = FaceDetector()
    centers: List[int] = []

    try:
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if total_frames > 0:
            sample_count = min(max_samples, total_frames)
            sample_indices = np.linspace(
                0, total_frames - 1, sample_count, dtype=int
            )
            for idx in sample_indices:
                cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
                ret, frame = cap.read()
                if not ret:
                    continue
                height, width = frame.shape[:2]
                faces = normalize_faces(detector.detect(frame), width, height)
                if not faces:
                    continue
                faces.sort(key=face_area, reverse=True)
                centers.append(int(faces[0][0] + faces[0][2] / 2))
                if len(centers) >= max_samples:
                    break
        else:
            frame_count = 0
            while frame_count < max_samples:
                ret, frame = cap.read()
                if not ret:
                    break
                height, width = frame.shape[:2]
                faces = normalize_faces(detector.detect(frame), width, height)
                if faces:
                    faces.sort(key=face_area, reverse=True)
                    centers.append(int(faces[0][0] + faces[0][2] / 2))
                frame_count += 1
    finally:
        cap.release()
        detector.close()

    return centers


def crop_face_tracking(input_path: str, output_path: str) -> None:
    import subprocess
    
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise RuntimeError("Unable to open video for face crop.")

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    ensure_valid_dimensions(width, height)
    fps = resolve_fps(cap)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    print(f"Input video: {width}x{height} @ {fps}fps, {total_frames} frames", file=sys.stderr)
    
    target_height = height
    target_width = int(target_height * 9 / 16)
    if target_width > width:
        target_width = width
    
    # Ensure even dimensions for libx264
    target_width = target_width - (target_width % 2)
    target_height = target_height - (target_height % 2)
    if target_width < 2 or target_height < 2:
        raise RuntimeError(f"Invalid crop size: {target_width}x{target_height}")
    
    print(f"Output dimensions: {target_width}x{target_height}", file=sys.stderr)

    threads = resolve_threads()

    # Use FFmpeg subprocess for output (proper timestamps)
    ffmpeg_cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-pix_fmt", "bgr24",
        "-s", f"{target_width}x{target_height}",
        "-r", str(fps),
        "-i", "-",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "18",
        "-threads", str(threads),
        "-pix_fmt", "yuv420p",
        "-reset_timestamps", "1",
        output_path
    ]
    ffmpeg_proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    frames_written = 0

    def write_frame(frame_data):
        nonlocal frames_written
        try:
            ffmpeg_proc.stdin.write(frame_data)
            frames_written += 1
        except BrokenPipeError:
            _, stderr = ffmpeg_proc.communicate()
            raise RuntimeError(f"FFmpeg pipe broke after {frames_written} frames: {stderr.decode()[-500:]}")

    if width <= target_width:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            # Resize to ensure exact dimensions
            frame = cv2.resize(frame, (target_width, target_height))
            write_frame(frame.tobytes())
        cap.release()
        ffmpeg_proc.stdin.close()
        ret = ffmpeg_proc.wait()
        if ret != 0:
            stderr = ffmpeg_proc.stderr.read().decode() if ffmpeg_proc.stderr else ""
            raise RuntimeError(f"FFmpeg exited with code {ret}: {stderr[-500:]}")
        print(f"Wrote {frames_written} frames (passthrough mode)", file=sys.stderr)
        return

    detector = FaceDetector()
    update_interval = max(1, int(fps * 0.5))
    smoothing = min(0.3, max(0.05, 5 / fps))
    missing_frames = 0
    missing_threshold = int(fps * MISSING_FACE_SECONDS)
    smoothed_center = width / 2
    target_center = smoothed_center
    frame_idx = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_idx % update_interval == 0:
                faces = normalize_faces(detector.detect(frame), width, height)
                center = pick_face_center(
                    faces, smoothed_center, width, height, target_width
                )
                if center is not None:
                    target_center = center
                    missing_frames = 0
                else:
                    missing_frames += update_interval
                    if missing_frames >= missing_threshold:
                        target_center = width / 2

            half_width = target_width / 2
            target_center = clamp(target_center, half_width, width - half_width)
            smoothed_center += (target_center - smoothed_center) * smoothing
            crop_x = int(round(smoothed_center - half_width))
            crop_x = int(clamp(crop_x, 0, width - target_width))
            cropped = frame[:target_height, crop_x : crop_x + target_width]
            # Ensure exact dimensions
            if cropped.shape[1] != target_width or cropped.shape[0] != target_height:
                cropped = cv2.resize(cropped, (target_width, target_height))
            write_frame(cropped.tobytes())
            frame_idx += 1
    finally:
        cap.release()
        detector.close()
        try:
            ffmpeg_proc.stdin.close()
        except:
            pass
        ret = ffmpeg_proc.wait()
        print(f"Wrote {frames_written} frames, FFmpeg exit code: {ret}", file=sys.stderr)
        if ret != 0:
            stderr = ffmpeg_proc.stderr.read().decode() if ffmpeg_proc.stderr else ""
            raise RuntimeError(f"FFmpeg exited with code {ret}: {stderr[-500:]}")


def crop_screen_tracking(input_path: str, output_path: str) -> None:
    import subprocess
    
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise RuntimeError("Unable to open video for screen crop.")

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    ensure_valid_dimensions(width, height)
    fps = resolve_fps(cap)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    print(f"Screen tracking input: {width}x{height} @ {fps}fps, {total_frames} frames", file=sys.stderr)

    target_height = height
    target_width = int(target_height * 9 / 16)
    
    # Ensure even dimensions for libx264
    target_width = target_width - (target_width % 2)
    target_height = target_height - (target_height % 2)
    if target_width < 2 or target_height < 2:
        raise RuntimeError(f"Invalid crop size: {target_width}x{target_height}")
    
    print(f"Screen tracking output: {target_width}x{target_height}", file=sys.stderr)

    threads = resolve_threads()

    target_display_width = int(width * 0.67)
    scale = target_width / target_display_width
    scaled_width = int(width * scale)
    scaled_height = int(height * scale)
    if scaled_height > target_height:
        scale = target_height / height
        scaled_width = int(width * scale)
        scaled_height = int(height * scale)

    # Use FFmpeg subprocess for output (proper timestamps)
    ffmpeg_cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-pix_fmt", "bgr24",
        "-s", f"{target_width}x{target_height}",
        "-r", str(fps),
        "-i", "-",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "18",
        "-threads", str(threads),
        "-pix_fmt", "yuv420p",
        "-reset_timestamps", "1",
        output_path
    ]
    ffmpeg_proc = subprocess.Popen(ffmpeg_cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    frames_written = 0
    
    def write_frame(frame_data):
        nonlocal frames_written
        try:
            ffmpeg_proc.stdin.write(frame_data)
            frames_written += 1
        except BrokenPipeError:
            _, stderr = ffmpeg_proc.communicate()
            raise RuntimeError(f"FFmpeg pipe broke after {frames_written} frames: {stderr.decode()[-500:]}")

    update_interval = max(1, int(fps))
    smoothed_x = 0
    prev_gray: Optional[np.ndarray] = None
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        resized = cv2.resize(
            frame,
            (scaled_width, scaled_height),
            interpolation=cv2.INTER_LANCZOS4,
        )
        if frame_idx % update_interval == 0:
            curr_gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
            if prev_gray is not None:
                flow = cv2.calcOpticalFlowFarneback(
                    prev_gray, curr_gray, None, 0.5, 3, 15, 3, 5, 1.2, 0
                )
                magnitude = np.sqrt(flow[..., 0] ** 2 + flow[..., 1] ** 2)
                significant = magnitude > 2.0
                if np.any(significant):
                    col_motion = np.sum(magnitude * significant, axis=0)
                    if np.sum(col_motion) > 0:
                        motion_x = int(
                            np.average(np.arange(scaled_width), weights=col_motion)
                        )
                        target_x = max(
                            0,
                            min(
                                motion_x - target_width // 2,
                                scaled_width - target_width,
                            ),
                        )
                        smoothed_x = int(0.9 * smoothed_x + 0.1 * target_x)
            prev_gray = curr_gray

        crop_x = int(smoothed_x)
        crop_x = max(0, min(crop_x, scaled_width - target_width))
        cropped = resized[:, crop_x : crop_x + target_width]

        if scaled_height < target_height:
            canvas = np.zeros((target_height, target_width, 3), dtype=np.uint8)
            offset_y = (target_height - scaled_height) // 2
            canvas[offset_y : offset_y + scaled_height, :] = cropped
            cropped = canvas
        elif scaled_height > target_height:
            cropped = cropped[:target_height, :]
        
        # Ensure exact dimensions
        if cropped.shape[1] != target_width or cropped.shape[0] != target_height:
            cropped = cv2.resize(cropped, (target_width, target_height))

        write_frame(cropped.tobytes())
        frame_idx += 1

        if total_frames and frame_idx >= total_frames:
            break

    cap.release()
    try:
        ffmpeg_proc.stdin.close()
    except:
        pass
    ret = ffmpeg_proc.wait()
    print(f"Screen tracking: wrote {frames_written} frames, FFmpeg exit code: {ret}", file=sys.stderr)
    if ret != 0:
        stderr = ffmpeg_proc.stderr.read().decode() if ffmpeg_proc.stderr else ""
        raise RuntimeError(f"FFmpeg exited with code {ret}: {stderr[-500:]}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--mode", default="auto", choices=["auto", "face", "screen"])
    args = parser.parse_args()

    mode = args.mode
    if mode == "auto":
        centers = detect_face_centers(args.input)
        mode = "face" if centers else "screen"

    try:
        if mode == "face":
            crop_face_tracking(args.input, args.output)
        else:
            crop_screen_tracking(args.input, args.output)
    except Exception as exc:
        sys.stderr.write(f"crop_failed: {exc}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
