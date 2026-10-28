"""Imports OpenCV with the decoder pixel limit set first. Every module imports cv2 from here."""

import os

from app.config.settings import MAX_IMAGE_PIXELS

# OpenCV reads this when it is imported; it refuses to decode larger images.
os.environ.setdefault("OPENCV_IO_MAX_IMAGE_PIXELS", str(MAX_IMAGE_PIXELS))

import cv2

cv2.setNumThreads(2)

__all__ = ["cv2"]
