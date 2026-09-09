"""Application upload limits (decimal MB), independent of provider limits."""

MAX_FILE_BYTES = 30_000_000
# Base64 expands each file by 4/3; reserve room for JSON and source metadata.
MAX_FILE_REQUEST_BYTES = 4 * ((MAX_FILE_BYTES + 2) // 3) + 1_000_000
# Multi-image endpoints retain a bounded request while allowing four full files.
MAX_IMAGE_BATCH_BYTES = 4 * MAX_FILE_BYTES
MAX_IMAGE_BATCH_REQUEST_BYTES = 4 * ((MAX_IMAGE_BATCH_BYTES + 2) // 3) + 1_000_000
