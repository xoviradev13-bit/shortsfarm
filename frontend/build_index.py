"""
ShortsStack - Frontend Template Assembler
Compiles frontend/index.html (or index.template.html) with all component partials in frontend/components/
into a standalone bundle if needed.
"""
import os
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

def compile_frontend(template_name="index.html", output_name="index.bundle.html"):
    template_path = BASE_DIR / template_name
    output_path = BASE_DIR / output_name

    if not template_path.exists():
        raise FileNotFoundError(f"Template not found at {template_path}")

    template_text = template_path.read_text(encoding="utf-8")

    def replacer(match):
        rel_path = match.group(1).strip()
        comp_file = BASE_DIR / rel_path
        if comp_file.exists():
            return comp_file.read_text(encoding="utf-8")
        print(f"[WARN] Component file missing: {comp_file}")
        return f"<!-- Missing component: {rel_path} -->"

    pattern = re.compile(r'<!--\s*include:\s*([^\s>]+)\s*-->')
    compiled = pattern.sub(replacer, template_text)

    output_path.write_text(compiled, encoding="utf-8")
    print(f"[OK] Compiled frontend template to {output_path} ({len(compiled)} bytes, {compiled.count(chr(10))} lines)")
    return compiled

if __name__ == "__main__":
    compile_frontend()

