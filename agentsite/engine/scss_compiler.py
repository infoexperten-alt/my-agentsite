"""SCSS to CSS server-side compilation using libsass."""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger("agentsite.scss")


def is_available() -> bool:
    """Check if libsass is installed."""
    try:
        import sass  # noqa: F401

        return True
    except ImportError:
        return False


def compile_scss(source: str) -> str:
    """Compile an SCSS string to CSS.

    Args:
        source: SCSS source code.

    Returns:
        Compiled CSS string.

    Raises:
        ImportError: If libsass is not installed.
        sass.CompileError: If SCSS is invalid.
    """
    import sass

    return sass.compile(string=source, output_style="expanded")


def compile_scss_file(path: Path) -> str:
    """Compile an SCSS file to CSS.

    Args:
        path: Path to the .scss file.

    Returns:
        Compiled CSS string.
    """
    import sass

    return sass.compile(filename=str(path), output_style="expanded")


def compile_directory(directory: Path) -> int:
    """Compile all .scss files in a directory to .css files.

    Each `.scss` file produces a `.css` file in the same directory.

    Args:
        directory: Directory to scan for .scss files.

    Returns:
        Number of files compiled.
    """
    if not is_available():
        logger.warning("libsass not installed — skipping SCSS compilation")
        return 0

    compiled = 0
    for scss_file in directory.glob("**/*.scss"):
        try:
            css = compile_scss(scss_file.read_text(encoding="utf-8"))
            css_file = scss_file.with_suffix(".css")
            css_file.write_text(css, encoding="utf-8")
            compiled += 1
            logger.info("Compiled %s -> %s (%d bytes)", scss_file.name, css_file.name, len(css))
        except Exception:
            logger.warning("Failed to compile %s", scss_file, exc_info=True)

    return compiled
